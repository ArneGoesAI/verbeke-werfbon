"""Stap 3 van docs/eval-plan.md: deterministische scores op de runs van run_eval.py.

    .venv/bin/python eval/score.py                                  # nieuwste map in eval/results/
    .venv/bin/python eval/score.py --resultaten eval/results/2026-11-12
    .venv/bin/python eval/score.py --zelftest                       # gold als modeloutput: moet overal 100% geven

Leest alleen eval/data/cases.jsonl (met de gold) en de bevroren catalogus, nooit gold.jsonl.
Schrijft summary.md en verschillen.md in de resultatenmap.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from afgeleide_lijnen import getal, normaliseer, onderdelen_uit, volledige_lijnen
from schema import ONBEKEND, REPO, laad_catalogus, maak_werfbon_model, valideer

CASES = REPO / "eval" / "data" / "cases.jsonl"
RESULTATEN = REPO / "eval" / "results"

# Prijzen per miljoen tokens (Anthropic API, USD). Vervang ze door die van de gekozen cloudprovider.
PRIJZEN = {
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50},
    "claude-opus-5-5": {"input": 4.00, "output": 20.00},
    "zelftest": {"input": 0.0, "output": 0.0},
}
CACHE_SCHRIJVEN, CACHE_LEZEN = 1.25, 0.10  # factor op de inputprijs


# ─────────────────────────────────────────────
# Eén run beoordelen
# ─────────────────────────────────────────────

def normaliseer_tekst(t: str) -> str:
    t = t.lower().replace("’", "'").replace("‘", "'")
    return " ".join(re.sub(r"[^\w']+", " ", t).split())


def invoertekst(case: Dict[str, Any], pad: str) -> str:
    """Waar een bronzin letterlijk in moet staan: de inspreektekst, of wat er op de bon geschreven staat."""
    if pad == "spraak":
        return case["invoer"]["spraak"]
    f = case.get("foto_inhoud") or {}
    return " ".join([f.get("uren", ""), f.get("km", ""), *f.get("materiaal", []), f.get("opmerking", "")])


def bedrag(lijnen: Iterable[Dict[str, Any]], catalogus: Dict[str, Dict[str, Any]]) -> float:
    """Σ aantal × verkoopprijs. Een onbekend onderdeel heeft geen prijs en telt voor 0."""
    return sum(float(l["aantal"]) * catalogus[l["code"]]["verkoopprijs"]
               for l in lijnen if l["code"] != ONBEKEND)


def antwoord_sleutel(output: Optional[Dict[str, Any]], lijnen: Optional[List[Dict[str, Any]]]) -> str:
    """Compacte vorm van een antwoord, om herhalingen en configs te vergelijken."""
    if output is None or lijnen is None:
        return "ongeldig"
    regels = ", ".join(f"{l['code']}×{l['aantal']}" for l in lijnen)
    return f"uren {getal(output['uren'])}, km {output['km']}: {regels}"


def beoordeel(run: Dict[str, Any], case: Dict[str, Any], catalogus, werfbon_model) -> Dict[str, Any]:
    gold = case["gold"]
    toestel = (case["context"]["toestel"] or {}).get("type")
    gold_lijnen = normaliseer(gold["lijnen"])
    gold_onderdelen = Counter(l["code"] for l in onderdelen_uit(gold_lijnen))
    gold_aantal = {l["code"]: l["aantal"] for l in onderdelen_uit(gold_lijnen)}

    output, fout = (None, f"stop_reason {run.get('stop_reason')}") if run.get("stop_reason") != "end_turn" \
        else valideer(werfbon_model, run.get("ruwe_output"))
    lijnen = None
    if output is not None:
        try:
            lijnen = volledige_lijnen(case["type"], toestel, output["uren"], output["onderdelen"])
        except ValueError as e:
            output, fout = None, str(e)

    r: Dict[str, Any] = {
        "case_id": case["case_id"], "type": case["type"], "bron": case["bron"], "randgeval": case["randgeval"],
        "pad": run["pad"], "herhaling": run["herhaling"], "config": run["config"],
        "geldig": output is not None, "fout": fout, "antwoord": antwoord_sleutel(output, lijnen),
        "usage": run.get("usage") or {}, "latency_s": run.get("latency_s"),
        "testdata_probleem": case.get("testdata_probleem"),
    }
    if output is None:
        r.update(status="fout", onzeker_n=0, verzonnen=0)
        r.update(factuur=False, uren=False, km=False, tp=0, fp=0, fn=sum(gold_onderdelen.values()),
                 aantal_ok=0, aantal_n=0, bron_ok=0, bron_n=0, onbekend=False if case["randgeval"] ==
                 "onbekend_onderdeel" else None,
                 euro=bedrag(gold_lijnen, catalogus) if case["type"] == "herstelling" else None)
        return r

    model_onderdelen = Counter(o["code"] for o in output["onderdelen"])
    model_aantal = {l["code"]: l["aantal"] for l in onderdelen_uit(lijnen)}
    tp = sum((model_onderdelen & gold_onderdelen).values())
    gevonden = [c for c in model_onderdelen if c in gold_onderdelen]
    tekst = f" {normaliseer_tekst(invoertekst(case, run['pad']))} "
    bron_ok = sum(1 for o in output["onderdelen"]
                  if normaliseer_tekst(o["bronzin"]) and f" {normaliseer_tekst(o['bronzin'])} " in tekst)

    # Onzeker of fout? "onbekend" waar de gold een catalogus-code heeft, is voorzichtig: de factuur moet nagekeken
    # worden, maar er is niets verzonnen. Een verkeerde code, of "onbekend" zonder gemist onderdeel, is verzonnen.
    gold_cat = Counter({c: n for c, n in gold_onderdelen.items() if c != ONBEKEND})
    model_cat = Counter({c: n for c, n in model_onderdelen.items() if c != ONBEKEND})
    gemist = gold_cat - model_cat
    onbekend_extra = max(0, model_onderdelen[ONBEKEND] - gold_onderdelen[ONBEKEND])
    onzeker_n = min(onbekend_extra, sum(gemist.values()))
    verzonnen = sum((model_cat - gold_cat).values()) + (onbekend_extra - onzeker_n)
    uren_ok = getal(output["uren"]) == getal(gold["uren"])
    factuur = uren_ok and lijnen == gold_lijnen

    status = "juist" if factuur else "fout"
    if not factuur and uren_ok and verzonnen == 0 and onzeker_n and onzeker_n == sum(gemist.values()):
        # Juist als elk extra "onbekend" het gemiste onderdeel was (met het aantal uit de gold)?
        hersteld = [l for l in lijnen if l["code"] != ONBEKEND] + [l for l in gold_lijnen if l["code"] == ONBEKEND]
        hersteld += [{"code": c, "aantal": gold_aantal[c]} for c in gemist]
        if normaliseer(hersteld) == gold_lijnen:
            status = "onzeker"

    r.update(
        status=status, onzeker_n=onzeker_n, verzonnen=verzonnen,
        factuur=factuur,
        uren=uren_ok,
        km=output["km"] == gold["km"],
        tp=tp, fp=sum(model_onderdelen.values()) - tp, fn=sum(gold_onderdelen.values()) - tp,
        aantal_ok=sum(1 for c in gevonden if model_aantal[c] == gold_aantal[c]), aantal_n=len(gevonden),
        bron_ok=bron_ok, bron_n=len(output["onderdelen"]),
        onbekend=(model_onderdelen == gold_onderdelen) if case["randgeval"] == "onbekend_onderdeel" else None,
        euro=abs(bedrag(lijnen, catalogus) - bedrag(gold_lijnen, catalogus)) if case["type"] == "herstelling" else None,
    )
    return r


# ─────────────────────────────────────────────
# Samenvatten
# ─────────────────────────────────────────────

def pct(teller: float, noemer: float) -> Optional[float]:
    return None if noemer == 0 else 100.0 * teller / noemer


def kost(r: Dict[str, Any]) -> float:
    p = PRIJZEN.get(r["config"]["model"])
    if p is None:
        return float("nan")
    u = r["usage"]
    invoer = (u.get("input_tokens", 0) + CACHE_SCHRIJVEN * u.get("cache_creation_input_tokens", 0)
              + CACHE_LEZEN * u.get("cache_read_input_tokens", 0))
    return (invoer * p["input"] + u.get("output_tokens", 0) * p["output"]) / 1e6


def samenvatting(rs: List[Dict[str, Any]]) -> Dict[str, Any]:
    tp, fp, fn = (sum(r[k] for r in rs) for k in ("tp", "fp", "fn"))
    onbekend = [r["onbekend"] for r in rs if r["onbekend"] is not None]
    herstel = [r["euro"] for r in rs if r["euro"] is not None]
    onderhoud = [r for r in rs if r["type"] == "onderhoud"]
    o_tp, o_fp, o_fn = (sum(r[k] for r in onderhoud) for k in ("tp", "fp", "fn"))
    return {
        "n": len(rs),
        "factuur": pct(sum(r["factuur"] for r in rs), len(rs)),
        "onzeker": pct(sum(r["status"] == "onzeker" for r in rs), len(rs)),
        "foutief": pct(sum(r["status"] == "fout" for r in rs), len(rs)),
        "uren": pct(sum(r["uren"] for r in rs), len(rs)),
        "precisie": pct(tp, tp + fp) if tp + fp else (100.0 if fn == 0 else 0.0),
        "recall": pct(tp, tp + fn) if tp + fn else 100.0,
        "aantal": pct(sum(r["aantal_ok"] for r in rs), sum(r["aantal_n"] for r in rs)),
        "onbekend": pct(sum(onbekend), len(onbekend)),
        "bron": pct(sum(r["bron_ok"] for r in rs), sum(r["bron_n"] for r in rs)),
        "geldig": pct(sum(r["geldig"] for r in rs), len(rs)),
        "km": pct(sum(r["km"] for r in rs), len(rs)),
        "euro_som": sum(herstel) if herstel else None,
        "euro_gem": statistics.mean(herstel) if herstel else None,
        "onderhoud_precisie": pct(o_tp, o_tp + o_fp) if onderhoud and o_tp + o_fp else None,
        "onderhoud_recall": pct(o_tp, o_tp + o_fn) if onderhoud and o_tp + o_fn else None,
        "verzonnen": sum(r["verzonnen"] for r in rs),
    }


def stabiliteit(rs: List[Dict[str, Any]]) -> Optional[float]:
    per_geval: Dict[Tuple[str, str], set] = defaultdict(set)
    for r in rs:
        per_geval[(r["case_id"], r["pad"])].add(r["antwoord"])
    return pct(sum(1 for a in per_geval.values() if len(a) == 1), len(per_geval))


def percentiel(waarden: List[float], p: float) -> Optional[float]:
    if not waarden:
        return None
    w = sorted(waarden)
    return w[min(len(w) - 1, max(0, round(p / 100 * len(w) + 0.5) - 1))]


def config_naam(c: Dict[str, str]) -> str:
    return f"{c['model']} / {c['effort']}" + ("" if c.get("provider") in (None, "anthropic", "-") else f" / {c['provider']}")


def fmt(x: Optional[float], eenheid: str = "%") -> str:
    if x is None:
        return "–"
    if eenheid == "%":
        return f"{x:.0f}%"
    if eenheid == "€":
        return f"€ {x:.2f}"
    if eenheid == "$":
        return f"${x:.4f}"
    return f"{x:.2f}{eenheid}"


KOLOMMEN = [("factuur", "Factuur juist", "%"), ("onzeker", "Onzeker", "%"), ("foutief", "Fout", "%"),
            ("uren", "Uren", "%"), ("precisie", "Precisie", "%"),
            ("recall", "Recall", "%"), ("aantal", "Aantal", "%"), ("onbekend", "Onbekend", "%"),
            ("bron", "Bron", "%"), ("geldig", "Geldig", "%"), ("km", "Km", "%"),
            ("euro_som", "Fout € (herst.)", "€"), ("onderhoud_recall", "Onderh. extra recall", "%"),
            ("onderhoud_precisie", "Onderh. extra precisie", "%")]
# Factuur juist = 100% − onzeker − fout. Onzeker: "onbekend" waar de gold een code heeft (voorzichtig, na te kijken).
# Fout: al de rest (verkeerde code, verzonnen onderdeel, verkeerde uren, ongeldige output).
NUL_IN_ZELFTEST = {"onzeker", "foutief"}


def tabel(groepen: Dict[str, List[Dict[str, Any]]], titel: str) -> List[str]:
    regels = [f"### {titel}", "", "| | n | " + " | ".join(k[1] for k in KOLOMMEN) + " |",
              "|---|---|" + "---|" * len(KOLOMMEN)]
    for naam, rs in groepen.items():
        s = samenvatting(rs)
        regels.append(f"| {naam} | {s['n']} | " + " | ".join(fmt(s[k], e) for k, _, e in KOLOMMEN) + " |")
    return regels + [""]


def groepeer(rs: List[Dict[str, Any]], sleutel: Callable[[Dict[str, Any]], str]) -> Dict[str, List[Dict[str, Any]]]:
    g: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rs:
        g[sleutel(r)].append(r)
    return dict(sorted(g.items()))


def kosten_tabel(rs: List[Dict[str, Any]]) -> List[str]:
    regels = ["### Kost en latency", "",
              "| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |",
              "|---|---|---|---|---|---|---|---|"]
    for (cfg, pad), groep in groepeer(rs, lambda r: (config_naam(r["config"]), r["pad"])).items():
        totaal = sum(kost(r) for r in groep)
        juist = sum(r["factuur"] for r in groep)
        lat = [r["latency_s"] for r in groep if r["latency_s"] is not None]
        regels.append(f"| {cfg} | {pad} | {len(groep)} | {fmt(totaal / len(groep), '$')} | "
                      f"{fmt(totaal / juist, '$') if juist else '–'} | {fmt(percentiel(lat, 50), ' s')} | "
                      f"{fmt(percentiel(lat, 95), ' s')} | {fmt(stabiliteit(groep))} |")
    return regels + [""]


def beslisregel(rs: List[Dict[str, Any]]) -> List[str]:
    """§4: mag Haiku het spraakpad overnemen?

    - Factuur: per geval bij meerderheid. Een geval is juist als meer dan de helft van de herhalingen juist is.
      Anders is het fout of onzeker, naargelang wat vaker voorkomt (bij een gelijke stand: fout). Alleen "fout"
      telt voor de regel; "onzeker" (onbekend waar de gold een code heeft) wordt apart getoond.
    - Verzonnen onderdeel: over alle herhalingen. Eén verzonnen onderdeel in één herhaling is genoeg om te falen.
    - Onbekend onderdeel: elke herhaling van het randgeval moet juist zijn.
    - Fout in euro: gemiddelde per herstelbon, over alle herhalingen.
    """
    spraak = [r for r in rs if r["pad"] == "spraak"]
    configs = groepeer(spraak, lambda r: config_naam(r["config"]))
    sonnet = [c for c in configs if "sonnet" in c]
    haiku = [c for c in configs if "haiku" in c]
    if not sonnet or not haiku:
        return []

    def geval_status(g):
        n = Counter(r["status"] for r in g)
        if n["juist"] * 2 > len(g):
            return "juist"
        return "fout" if n["fout"] >= n["onzeker"] else "onzeker"

    def gevallen(groep, status):
        return sorted(cid for cid, g in groepeer(groep, lambda r: r["case_id"]).items() if geval_status(g) == status)

    def gevallen_fout(groep):
        return len(gevallen(groep, "fout"))

    def lijst(ids, groep):
        probleem = {r["case_id"] for r in groep if r["testdata_probleem"]}
        return ", ".join(i + (" (testdata-probleem)" if i in probleem else "") for i in ids) or "geen"

    def euro_gem(groep):
        e = [r["euro"] for r in groep if r["euro"] is not None]
        return statistics.mean(e) if e else 0.0

    s = configs[sonnet[0]]
    regels = [f"### Beslisregel (spraak, tegenover {sonnet[0]})", ""]
    for h in haiku:
        g = configs[h]
        onbekend = [r["onbekend"] for r in g if r["onbekend"] is not None]
        runs_met_verzonnen = [r for r in g if r["verzonnen"] > 0]  # over alle herhalingen, niet bij meerderheid
        toetsen = [
            (f"factuur (per geval bij meerderheid): hoogstens 1 geval meer fout "
             f"({gevallen_fout(g)} tegenover {gevallen_fout(s)}; fout: {lijst(gevallen(g, 'fout'), g)}). "
             f"Onzeker telt niet mee: {lijst(gevallen(g, 'onzeker'), g)} tegenover {lijst(gevallen(s, 'onzeker'), s)}",
             gevallen_fout(g) <= gevallen_fout(s) + 1),
            (f"geen verzonnen onderdeel, over alle herhalingen ({len(runs_met_verzonnen)} van {len(g)} runs, "
             f"{sum(r['verzonnen'] for r in g)} onderdeel/onderdelen"
             + (f": {', '.join(sorted({r['case_id'] for r in runs_met_verzonnen}))}" if runs_met_verzonnen else "")
             + ")",
             not runs_met_verzonnen),
            (f"randgeval onbekend onderdeel juist ({sum(onbekend)}/{len(onbekend)})", bool(onbekend) and all(onbekend)),
            (f"fout in euro niet hoger (gem. {fmt(euro_gem(g), '€')} tegenover {fmt(euro_gem(s), '€')})",
             euro_gem(g) <= euro_gem(s)),
        ]
        regels.append(f"**{h}**: {'mag het spraakpad overnemen' if all(t[1] for t in toetsen) else 'nog niet'}")
        regels += [f"- {'✓' if ok else '✗'} {tekst}" for tekst, ok in toetsen] + [""]
    return regels


def verschillen(rs: List[Dict[str, Any]], cases: Dict[str, Dict[str, Any]]) -> List[str]:
    regels = ["# Verschillen tussen configs", "",
              "Gevallen waar de configs niet dezelfde antwoorden geven, met de gold erbij. Eén voor één te bekijken.", ""]
    for (case_id, pad), groep in groepeer(rs, lambda r: (r["case_id"], r["pad"])).items():
        per_config = {naam: Counter(r["antwoord"] for r in g)
                      for naam, g in groepeer(groep, lambda r: config_naam(r["config"])).items()}
        if len(per_config) < 2 or len({frozenset(c) for c in per_config.values()}) == 1:
            continue
        case = cases[case_id]
        gold = case["gold"]
        markering = " — testdata-probleem" if case.get("testdata_probleem") else ""
        regels += [f"## {case_id} ({pad}, {case['stratum']}){markering}", "",
                   f"- **gold**: uren {getal(gold['uren'])}, km {gold['km']}: "
                   + ", ".join(f"{l['code']}×{l['aantal']}" for l in normaliseer(gold["lijnen"]))]
        for naam, antwoorden in per_config.items():
            regels += [f"- **{naam}**: " + "; ".join(f"{a} ({n}×)" for a, n in antwoorden.most_common())]
        regels.append("")
    return regels


def rapport(rs: List[Dict[str, Any]], cases: Dict[str, Dict[str, Any]]) -> List[str]:
    regels = ["# Samenvatting werfbon-eval", ""]
    regels += tabel(groepeer(rs, lambda r: config_naam(r["config"])), "Per config")
    regels += tabel(groepeer(rs, lambda r: f"{config_naam(r['config'])} · {r['type']}"), "Per type")
    regels += tabel(groepeer(rs, lambda r: f"{config_naam(r['config'])} · {r['pad']}"), "Per invoerweg")
    regels += tabel(groepeer(rs, lambda r: f"{config_naam(r['config'])} · {r['bron']}"), "Per bron")
    probleem = {r["case_id"]: r["testdata_probleem"] for r in rs if r["testdata_probleem"]}
    if probleem:
        regels += tabel(groepeer([r for r in rs if not r["testdata_probleem"]], lambda r: config_naam(r["config"])),
                        "Per config, zonder gevallen met een testdata-probleem")
    regels += kosten_tabel(rs)
    regels += beslisregel(rs)
    niet_juist = [r for r in rs if r["status"] != "juist"]
    if niet_juist:
        regels += ["### Facturen die niet juist zijn", ""] + [
            f"- {config_naam(r['config'])} · {r['case_id']} · {r['pad']} #{r['herhaling']}: **{r['status']}** — "
            f"{r['antwoord']}" + (" _(testdata-probleem)_" if r["testdata_probleem"] else "")
            for r in sorted(niet_juist, key=lambda r: (config_naam(r["config"]), r["case_id"], r["pad"], r["herhaling"]))
        ] + [""]
    if probleem:
        regels += ["### Gevallen met een testdata-probleem", ""] + [
            f"- {cid}: {reden}" for cid, reden in sorted(probleem.items())] + [""]
    ongeldig = [r for r in rs if not r["geldig"]]
    if ongeldig:
        regels += ["### Ongeldige outputs", ""] + [
            f"- {config_naam(r['config'])} · {r['case_id']} · {r['pad']} #{r['herhaling']}: {r['fout']}"
            for r in ongeldig] + [""]
    return regels


# ─────────────────────────────────────────────
# Zelftest: de gold als modeloutput
# ─────────────────────────────────────────────

def zelftest_runs(cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    runs = []
    for c in cases:
        gold = c["gold"]
        for pad in ("spraak", "foto"):
            output = {
                "uren": gold["uren"],
                "km": gold["km"],
                "onderdelen": [{"code": l["code"], "aantal": l["aantal"], "omschrijving": l.get("omschrijving"),
                                # De gold heeft geen bronzin. De hele invoer staat letterlijk in de invoer.
                                "bronzin": invoertekst(c, pad)}
                               for l in onderdelen_uit(gold["lijnen"])],
                "opmerking": gold["opmerking"] or "",
            }
            runs.append({"config": {"model": "zelftest", "effort": "-", "provider": "-"}, "case_id": c["case_id"],
                         "pad": pad, "herhaling": 1, "stop_reason": "end_turn",
                         "ruwe_output": json.dumps(output, ensure_ascii=False),
                         "usage": {}, "latency_s": 0.0})
    return runs


def controleer_zelftest(rs: List[Dict[str, Any]]) -> List[str]:
    problemen = []
    groepen = {"alles": rs, **groepeer(rs, lambda r: r["type"]), **groepeer(rs, lambda r: r["pad"]),
               **groepeer(rs, lambda r: r["bron"])}
    for naam, groep in groepen.items():
        s = samenvatting(groep)
        for k, titel, eenheid in KOLOMMEN:
            verwacht = 0.0 if k in NUL_IN_ZELFTEST else 100.0
            if eenheid == "%" and s[k] is not None and s[k] != verwacht:
                problemen.append(f"{naam}: {titel} = {s[k]:.1f}% (verwacht {verwacht:.0f}%)")
        if s["euro_som"] not in (None, 0.0):
            problemen.append(f"{naam}: fout in euro = {s['euro_som']}")
        if s["verzonnen"]:
            problemen.append(f"{naam}: {s['verzonnen']} verzonnen onderdeel/onderdelen")
    if stabiliteit(rs) != 100.0:
        problemen.append("stabiliteit is geen 100%")
    for r in rs:
        if not r["geldig"]:
            problemen.append(f"{r['case_id']} {r['pad']}: ongeldig ({r['fout']})")
    return problemen


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--resultaten", type=Path, help="map met runs.jsonl (standaard: de nieuwste in eval/results)")
    parser.add_argument("--zelftest", action="store_true", help="de gold als modeloutput scoren; moet overal 100% geven")
    args = parser.parse_args()

    case_lijst = [json.loads(r) for r in CASES.read_text(encoding="utf-8").splitlines() if r.strip()]
    cases = {c["case_id"]: c for c in case_lijst}
    catalogus = laad_catalogus()
    werfbon_model = maak_werfbon_model(catalogus)

    if args.zelftest:
        rs = [beoordeel(run, cases[run["case_id"]], catalogus, werfbon_model) for run in zelftest_runs(case_lijst)]
        print("\n".join(rapport(rs, cases)))
        problemen = controleer_zelftest(rs)
        if problemen:
            print("Zelftest MISLUKT:\n  " + "\n  ".join(problemen))
            sys.exit(1)
        print(f"Zelftest geslaagd: {len(rs)} runs ({len(cases)} gevallen × 2 paden), alle scores 100%, "
              f"onzeker en fout 0%, fout in euro 0.")
        return

    map_ = args.resultaten or max((p for p in RESULTATEN.glob("*") if (p / "runs.jsonl").exists()), default=None)
    if map_ is None or not (map_ / "runs.jsonl").exists():
        raise SystemExit("Geen runs.jsonl gevonden. Draai eerst run_eval.py, of geef --resultaten mee.")
    runs = [json.loads(r) for r in (map_ / "runs.jsonl").read_text(encoding="utf-8").splitlines() if r.strip()]
    api_fouten = sum(1 for r in runs if r.get("api_fout"))
    runs = [r for r in runs if not r.get("api_fout")]
    onbekend = {r["case_id"] for r in runs} - set(cases)
    if onbekend:
        raise SystemExit(f"Runs voor gevallen die niet in cases.jsonl staan: {sorted(onbekend)}")

    rs = [beoordeel(run, cases[run["case_id"]], catalogus, werfbon_model) for run in runs]
    samen = rapport(rs, cases)
    if api_fouten:
        samen.insert(2, f"_{api_fouten} call(s) met een API-fout zijn niet meegeteld. Draai run_eval.py opnieuw._\n")
    (map_ / "summary.md").write_text("\n".join(samen) + "\n", encoding="utf-8")
    (map_ / "verschillen.md").write_text("\n".join(verschillen(rs, cases)) + "\n", encoding="utf-8")
    print("\n".join(samen))
    print(f"Geschreven: {map_ / 'summary.md'} en {map_ / 'verschillen.md'}")


if __name__ == "__main__":
    main()
