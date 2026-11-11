"""Stap 4 van docs/eval-plan.md: de extractie draaien op eval/data/cases.jsonl en de ruwe resultaten opslaan.

    .venv/bin/python eval/run_eval.py --model sonnet --effort low --pad beide --herhaal 3
    .venv/bin/python eval/run_eval.py --model haiku --effort medium --pad spraak --droog   # toont het verzoek

Elke call wordt één regel in eval/results/<datum>/runs.jsonl. Scoren doet score.py.
Een onderbroken run hervat: wat al een antwoord heeft, wordt overgeslagen.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import anthropic
from dotenv import load_dotenv

from schema import REPO, json_schema, laad_catalogus, maak_werfbon_model, onderdeel_codes

CASES = REPO / "eval" / "data" / "cases.jsonl"
PROMPT = REPO / "eval" / "prompts" / "extractie.md"
RESULTATEN = REPO / "eval" / "results"

MODELLEN = {"sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5"}
PADEN = ("spraak", "foto")
MAX_TOKENS = 16000


# ─────────────────────────────────────────────
# Provider (§5): één plek waar de client gemaakt wordt
# ─────────────────────────────────────────────

def maak_client(provider: str) -> anthropic.Anthropic:
    if provider == "anthropic":
        return anthropic.Anthropic()
    if provider == "bedrock":
        return anthropic.AnthropicBedrockMantle(aws_region=os.environ["AWS_REGION"])
    if provider == "vertex":
        return anthropic.AnthropicVertex(project_id=os.environ["GOOGLE_CLOUD_PROJECT"],
                                         region=os.environ.get("CLOUD_ML_REGION", "europe-west1"))
    raise SystemExit(f"Onbekende provider: {provider}")


def model_id(provider: str, model: str) -> str:
    return f"anthropic.{model}" if provider == "bedrock" else model


# ─────────────────────────────────────────────
# Verzoek opbouwen
# ─────────────────────────────────────────────

def systeemprompt(catalogus: Dict[str, Dict[str, Any]]) -> str:
    regels = [f"- {c}: {catalogus[c]['omschrijving']} (eenheid: {catalogus[c]['eenheid']})"
              for c in onderdeel_codes(catalogus)]
    return PROMPT.read_text(encoding="utf-8").replace("{catalogus}", "\n".join(regels))


def context_tekst(case: Dict[str, Any]) -> str:
    ctx = case["context"]
    regels = [f"Type interventie: {ctx['type']}", f"Omschrijving: {ctx['omschrijving']}"]
    if ctx.get("toestel"):
        t = ctx["toestel"]
        regels.append(f"Toestel: {t['type']}, {t['merk']} {t['model']}")
    return "Context van de interventie:\n" + "\n".join(regels)


def gebruikersinhoud(case: Dict[str, Any], pad: str) -> List[Dict[str, Any]]:
    inhoud: List[Dict[str, Any]] = [{"type": "text", "text": context_tekst(case)}]
    if pad == "spraak":
        inhoud.append({"type": "text", "text": "Ingesproken tekst van de technieker:\n" + case["invoer"]["spraak"]})
    else:
        data = base64.standard_b64encode((REPO / case["invoer"]["foto"]).read_bytes()).decode("ascii")
        inhoud.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}})
        inhoud.append({"type": "text", "text": "Hierboven: foto van de ingevulde werfbon."})
    return inhoud


def verzoek(case: Dict[str, Any], pad: str, model: str, effort: str, systeem: str,
            schema: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "model": model,
        "max_tokens": MAX_TOKENS,
        # Zelfde prompt voor elke call: cachen. (Onder de minimumlengte van het model gebeurt er gewoon niets.)
        "system": [{"type": "text", "text": systeem, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": gebruikersinhoud(case, pad)}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        # Bewust geen refusal-fallback: die zou een ander model laten antwoorden dan het model dat we meten.
    }


# ─────────────────────────────────────────────
# Eén call
# ─────────────────────────────────────────────

def voer_uit(client: anthropic.Anthropic, req: Dict[str, Any]) -> Dict[str, Any]:
    """Het resultaat van één call als dict. Een API-fout wordt 'api_fout' en later opnieuw geprobeerd."""
    start = time.perf_counter()
    try:
        response = client.messages.create(**req)
    except anthropic.APIStatusError as e:
        return {"api_fout": f"{e.status_code}: {e.message}", "latency_s": round(time.perf_counter() - start, 3)}
    except anthropic.APIConnectionError as e:
        return {"api_fout": f"verbinding: {e}", "latency_s": round(time.perf_counter() - start, 3)}
    latency = time.perf_counter() - start
    u = response.usage
    return {
        "model_antwoord": response.model,
        "stop_reason": response.stop_reason,
        "ruwe_output": "".join(b.text for b in response.content if b.type == "text"),
        "usage": {
            "input_tokens": u.input_tokens,
            "output_tokens": u.output_tokens,
            "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", None) or 0,
            "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", None) or 0,
        },
        "latency_s": round(latency, 3),
        "request_id": getattr(response, "_request_id", None),
    }


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def sleutel(r: Dict[str, Any]) -> Tuple[Any, ...]:
    c = r["config"]
    return (c["model"], c["effort"], c["provider"], r["case_id"], r["pad"], r["herhaling"])


def lees_runs(pad: Path) -> List[Dict[str, Any]]:
    if not pad.exists():
        return []
    return [json.loads(r) for r in pad.read_text(encoding="utf-8").splitlines() if r.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--model", required=True, help="haiku, sonnet of een volledige model-id")
    parser.add_argument("--effort", required=True, choices=["low", "medium", "high", "xhigh", "max"])
    parser.add_argument("--pad", default="beide", choices=["spraak", "foto", "beide"])
    parser.add_argument("--herhaal", type=int, default=3)
    parser.add_argument("--provider", default="anthropic", choices=["anthropic", "bedrock", "vertex"])
    parser.add_argument("--cases", nargs="*", help="alleen deze case_id's (bv. c01-wb814)")
    parser.add_argument("--parallel", type=int, default=4, help="aantal calls tegelijk")
    parser.add_argument("--uit", type=Path, default=RESULTATEN / date.today().isoformat())
    parser.add_argument("--droog", action="store_true", help="toon het eerste verzoek, zonder API-call")
    parser.add_argument("--ook-niet-nagelezen", action="store_true")
    args = parser.parse_args()

    model = MODELLEN.get(args.model, args.model)
    cases = [json.loads(r) for r in CASES.read_text(encoding="utf-8").splitlines() if r.strip()]
    if args.cases:
        onbekend = set(args.cases) - {c["case_id"] for c in cases}
        if onbekend:
            raise SystemExit(f"Onbekende case_id's: {sorted(onbekend)}")
        cases = [c for c in cases if c["case_id"] in args.cases]
    niet_nagelezen = [c["case_id"] for c in cases if not c.get("nagelezen_door")]
    if niet_nagelezen and not args.ook_niet_nagelezen:
        raise SystemExit(f"Niet nagelezen: {', '.join(niet_nagelezen)}. Lees ze eerst na, of gebruik --ook-niet-nagelezen.")

    catalogus = laad_catalogus()
    systeem = systeemprompt(catalogus)
    schema = json_schema(maak_werfbon_model(catalogus))
    paden = PADEN if args.pad == "beide" else (args.pad,)
    config = {"model": model, "effort": args.effort, "provider": args.provider}

    taken = [(c, p, h) for c in cases for p in paden for h in range(1, args.herhaal + 1)]

    if args.droog:
        c, p, _ = taken[0]
        req = verzoek(c, p, model_id(args.provider, model), args.effort, systeem, schema)
        for blok in req["messages"][0]["content"]:
            if blok["type"] == "image":
                blok["source"]["data"] = blok["source"]["data"][:40] + f"... ({len(blok['source']['data'])} tekens)"
        print(json.dumps(req, ensure_ascii=False, indent=2))
        print(f"\nDroog: {len(taken)} calls zouden volgen ({len(cases)} gevallen × {len(paden)} pad(en) × "
              f"{args.herhaal} herhaling(en)). Er is niets verstuurd.", file=sys.stderr)
        return

    load_dotenv(REPO / ".env")
    uit = args.uit / "runs.jsonl"
    uit.parent.mkdir(parents=True, exist_ok=True)
    klaar = {sleutel(r) for r in lees_runs(uit) if not r.get("api_fout")}
    te_doen = [t for t in taken
               if (model, args.effort, args.provider, t[0]["case_id"], t[1], t[2]) not in klaar]
    print(f"{len(taken)} calls in totaal, {len(taken) - len(te_doen)} al gedaan, {len(te_doen)} te doen "
          f"({model}, effort {args.effort}, {args.provider}).")
    if not te_doen:
        return

    client = maak_client(args.provider)
    slot = threading.Lock()

    def taak(case: Dict[str, Any], pad: str, herhaling: int) -> Dict[str, Any]:
        req = verzoek(case, pad, model_id(args.provider, model), args.effort, systeem, schema)
        rij = {"config": config, "case_id": case["case_id"], "pad": pad, "herhaling": herhaling,
               "tijdstip": datetime.now(timezone.utc).isoformat(timespec="seconds"), **voer_uit(client, req)}
        with slot, uit.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rij, ensure_ascii=False) + "\n")
        return rij

    fouten = 0
    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = [pool.submit(taak, *t) for t in te_doen]
        for i, f in enumerate(as_completed(futures), start=1):
            rij = f.result()
            if rij.get("api_fout"):
                fouten += 1
                print(f"  [{i}/{len(te_doen)}] {rij['case_id']} {rij['pad']} #{rij['herhaling']}: {rij['api_fout']}")
            elif i % 10 == 0 or i == len(te_doen):
                print(f"  [{i}/{len(te_doen)}] klaar")
    print(f"Resultaten in {uit}." +(f" {fouten} API-fout(en): draai opnieuw om ze te herhalen." if fouten else ""))


if __name__ == "__main__":
    main()
