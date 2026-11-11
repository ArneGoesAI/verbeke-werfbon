"""Zet de systeemprompt, het JSON-schema en de catalogus van de eval klaar voor de app (web/).

    .venv/bin/python eval/exporteer_voor_app.py            # schrijft web/lib/verwerking/gegenereerd/
    .venv/bin/python eval/exporteer_voor_app.py --controle # schrijft niets, faalt als iets verouderd is

Python blijft de enige bron: de app leest deze bestanden en definieert prompt of schema nergens zelf. Draai dit
script na elke wijziging aan schema.py, prompts/extractie.md, artikelen.json of de opbouw van het verzoek in
run_eval.py. eval/tests/test_export_app.py faalt zolang je dat vergeet.

referentie_inhoud.json bevat voor elk geval de gebruikersinhoud zoals run_eval.py die opbouwt (van de foto alleen
het mediatype en een sha256). De vitest-tests vergelijken de opbouw in TypeScript daarmee.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from run_eval import CASES, MAX_TOKENS, gebruikersinhoud, systeemprompt
from schema import CATALOGUS, REPO, json_schema, laad_catalogus, maak_werfbon_model

DOEL = REPO / "web" / "lib" / "verwerking" / "gegenereerd"


def json_tekst(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def referentie_inhoud() -> Dict[str, Any]:
    cases = [json.loads(r) for r in CASES.read_text(encoding="utf-8").splitlines() if r.strip()]
    uit: Dict[str, Any] = {}
    for case in cases:
        per_pad: Dict[str, List[Dict[str, Any]]] = {}
        for pad in ("spraak", "foto"):
            blokken = []
            for blok in gebruikersinhoud(case, pad):
                if blok["type"] == "image":
                    data = blok["source"]["data"].encode("ascii")
                    blok = {"type": "image", "media_type": blok["source"]["media_type"],
                            "sha256_base64": hashlib.sha256(data).hexdigest()}
                blokken.append(blok)
            per_pad[pad] = blokken
        uit[case["case_id"]] = per_pad
    return uit


def bestanden() -> Dict[str, str]:
    catalogus = laad_catalogus()
    return {
        "systeemprompt.md": systeemprompt(catalogus),
        "schema.json": json_tekst(json_schema(maak_werfbon_model(catalogus))),
        "catalogus.json": json_tekst(json.loads(CATALOGUS.read_text(encoding="utf-8"))),
        "instellingen.json": json_tekst({"max_tokens": MAX_TOKENS}),
        "referentie_inhoud.json": json_tekst(referentie_inhoud()),
    }


def verouderd() -> List[str]:
    return [naam for naam, inhoud in bestanden().items()
            if not (DOEL / naam).exists() or (DOEL / naam).read_text(encoding="utf-8") != inhoud]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--controle", action="store_true", help="niets schrijven, alleen controleren")
    args = parser.parse_args()

    if args.controle:
        oud = verouderd()
        if oud:
            sys.exit(f"Verouderd in {DOEL.relative_to(REPO)}: {', '.join(oud)}. Draai eval/exporteer_voor_app.py.")
        print("Alles actueel.")
        return

    DOEL.mkdir(parents=True, exist_ok=True)
    for naam, inhoud in bestanden().items():
        (DOEL / naam).write_text(inhoud, encoding="utf-8")
        print(f"  {DOEL.relative_to(REPO) / naam}")


if __name__ == "__main__":
    main()
