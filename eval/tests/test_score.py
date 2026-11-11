"""Unit tests voor de indeling juist / onzeker / fout in eval/score.py.

    .venv/bin/python -m unittest discover -s eval/tests -v
"""

import json
import sys
import unittest
from pathlib import Path

EVAL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVAL))

from schema import laad_catalogus, maak_werfbon_model  # noqa: E402
from score import beoordeel  # noqa: E402

CATALOGUS = laad_catalogus()
MODEL = maak_werfbon_model(CATALOGUS)


def case(lijnen, type_="herstelling", toestel=None, randgeval=None):
    return {
        "case_id": "t01", "type": type_, "bron": "database", "randgeval": randgeval,
        "context": {"type": type_, "omschrijving": "test", "toestel": toestel},
        "gold": {"uren": 2, "km": 10, "lijnen": lijnen, "opmerking": ""},
        "invoer": {"spraak": "nieuwe pomp gestoken"},
    }


def run(onderdelen, uren=2, ruw=None):
    output = {"uren": uren, "km": 10, "opmerking": "", "onderdelen": [
        {"code": c, "aantal": a, "omschrijving": "iets" if c == "onbekend" else None, "bronzin": "nieuwe pomp"}
        for c, a in onderdelen]}
    return {"config": {"model": "test", "effort": "-", "provider": "-"}, "pad": "spraak", "herhaling": 1,
            "stop_reason": "end_turn", "ruwe_output": ruw if ruw is not None else json.dumps(output)}


HERSTELLING_POMP = [{"code": "ARB-TECH", "aantal": 2}, {"code": "VERPL", "aantal": 1}, {"code": "OND-POMP", "aantal": 1}]
HERSTELLING_ONBEKEND = [{"code": "ARB-TECH", "aantal": 2}, {"code": "VERPL", "aantal": 1},
                        {"code": "onbekend", "aantal": 1, "omschrijving": "motor"}]


class TestStatus(unittest.TestCase):
    def beoordeel(self, gold_lijnen, onderdelen, **kw):
        return beoordeel(run(onderdelen, **kw), case(gold_lijnen), CATALOGUS, MODEL)

    def test_juist(self):
        r = self.beoordeel(HERSTELLING_POMP, [("OND-POMP", 1)])
        self.assertEqual((r["status"], r["factuur"], r["verzonnen"]), ("juist", True, 0))

    def test_onbekend_voor_een_code_is_onzeker(self):
        r = self.beoordeel(HERSTELLING_POMP, [("onbekend", 1)])
        self.assertEqual((r["status"], r["factuur"], r["verzonnen"], r["onzeker_n"]), ("onzeker", False, 0, 1))

    def test_verkeerde_code_is_fout_en_verzonnen(self):
        r = self.beoordeel(HERSTELLING_POMP, [("OND-PRES", 1)])
        self.assertEqual((r["status"], r["verzonnen"]), ("fout", 1))

    def test_onbekend_zonder_gemist_onderdeel_is_verzonnen(self):
        r = self.beoordeel(HERSTELLING_POMP, [("OND-POMP", 1), ("onbekend", 1)])
        self.assertEqual((r["status"], r["verzonnen"], r["onzeker_n"]), ("fout", 1, 0))

    def test_onbekend_bij_onbekend_in_de_gold_is_juist(self):
        r = self.beoordeel(HERSTELLING_ONBEKEND, [("onbekend", 1)])
        self.assertEqual((r["status"], r["verzonnen"]), ("juist", 0))

    def test_onbekend_met_verkeerde_uren_is_fout(self):
        r = self.beoordeel(HERSTELLING_POMP, [("onbekend", 1)], uren=3)
        self.assertEqual(r["status"], "fout")

    def test_onbekend_met_verkeerd_aantal_elders_is_fout(self):
        gold = HERSTELLING_POMP + [{"code": "SAN-BUIS", "aantal": 2}]
        r = self.beoordeel(gold, [("onbekend", 1), ("SAN-BUIS", 3)])
        self.assertEqual(r["status"], "fout")

    def test_ongeldige_output_is_fout(self):
        r = beoordeel(run([], ruw='{"uren": 2}'), case(HERSTELLING_POMP), CATALOGUS, MODEL)
        self.assertEqual((r["status"], r["geldig"], r["verzonnen"]), ("fout", False, 0))


class TestBron(unittest.TestCase):
    def test_bronzin_in_inspreektekst(self):
        r = beoordeel(run([("OND-POMP", 1)]), case(HERSTELLING_POMP), CATALOGUS, MODEL)
        self.assertEqual((r["bron_ok"], r["bron_n"]), (1, 1))

    def test_bronzin_in_transcript_bij_audio(self):
        # Het model zag het transcript ("een nieuwe pomp"), niet de inspreektekst ("nieuwe pomp gestoken").
        audio = run([("OND-POMP", 1)])
        audio["transcript"] = "ik heb er een nieuwe pomp in gestoken"
        self.assertEqual(beoordeel(audio, case(HERSTELLING_POMP), CATALOGUS, MODEL)["bron_ok"], 1)
        audio["transcript"] = "ik heb er een pomp in gestoken"
        self.assertEqual(beoordeel(audio, case(HERSTELLING_POMP), CATALOGUS, MODEL)["bron_ok"], 0)


if __name__ == "__main__":
    unittest.main()
