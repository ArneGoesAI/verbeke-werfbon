"""Unit tests voor eval/afgeleide_lijnen.py.

    .venv/bin/python -m unittest discover -s eval/tests -v
"""

import json
import sys
import unittest
from pathlib import Path

EVAL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVAL))

from afgeleide_lijnen import (  # noqa: E402
    AFGELEIDE_CODES,
    afgeleide_lijnen,
    getal,
    normaliseer,
    onderdelen_uit,
    volledige_lijnen,
)


class TestHerstelling(unittest.TestCase):
    def test_arbeid_is_uren_plus_verplaatsing(self):
        self.assertEqual(
            afgeleide_lijnen("herstelling", None, 2.5),
            [{"code": "ARB-TECH", "aantal": 2.5}, {"code": "VERPL", "aantal": 1}],
        )

    def test_met_onderdeel(self):
        self.assertEqual(
            volledige_lijnen("herstelling", None, 2, [{"code": "OND-POMP", "aantal": 1}]),
            [{"code": "ARB-TECH", "aantal": 2}, {"code": "OND-POMP", "aantal": 1}, {"code": "VERPL", "aantal": 1}],
        )

    def test_toestel_maakt_niet_uit(self):
        met = afgeleide_lijnen("herstelling", "warmtepomp", 1.5)
        zonder = afgeleide_lijnen("herstelling", None, 1.5)
        self.assertEqual(met, zonder)

    def test_kwartieren(self):
        self.assertEqual(afgeleide_lijnen("herstelling", None, 1.25)[0], {"code": "ARB-TECH", "aantal": 1.25})

    def test_nul_uren_geeft_geen_arbeidslijn(self):
        self.assertEqual(afgeleide_lijnen("herstelling", None, 0), [{"code": "VERPL", "aantal": 1}])

    def test_onbekend_onderdeel_blijft_staan(self):
        lijnen = volledige_lijnen("herstelling", "ventilatie", 2.5, [{"code": "onbekend", "aantal": 1}])
        self.assertIn({"code": "onbekend", "aantal": 1}, lijnen)


class TestOnderhoud(unittest.TestCase):
    def test_forfait_per_toestel(self):
        for toestel, code in [
            ("warmtepomp", "ARB-ONDERH-WP"),
            ("ventilatie", "ARB-ONDERH-VENT"),
            ("zonneboiler", "ARB-ONDERH-ZB"),
        ]:
            with self.subTest(toestel=toestel):
                self.assertEqual(afgeleide_lijnen("onderhoud", toestel, 1.5), [{"code": code, "aantal": 1}])

    def test_geen_arbeid_en_geen_verplaatsing(self):
        codes = {l["code"] for l in afgeleide_lijnen("onderhoud", "warmtepomp", 2)}
        self.assertNotIn("ARB-TECH", codes)
        self.assertNotIn("VERPL", codes)

    def test_met_extra_onderdeel(self):
        self.assertEqual(
            volledige_lijnen("onderhoud", "ventilatie", 1.5, [{"code": "VENT-FILT", "aantal": 1}]),
            [{"code": "ARB-ONDERH-VENT", "aantal": 1}, {"code": "VENT-FILT", "aantal": 1}],
        )

    def test_zonder_toestel_is_een_fout(self):
        with self.assertRaises(ValueError):
            afgeleide_lijnen("onderhoud", None, 1)

    def test_onbekend_toestel_is_een_fout(self):
        with self.assertRaises(ValueError):
            afgeleide_lijnen("onderhoud", "boiler", 1)


class TestFouten(unittest.TestCase):
    def test_ander_type_is_een_fout(self):
        for type_ in ("installatie", "plaatsbezoek", ""):
            with self.subTest(type_=type_), self.assertRaises(ValueError):
                afgeleide_lijnen(type_, None, 8)

    def test_afgeleide_code_tussen_onderdelen_is_een_fout(self):
        for code in sorted(AFGELEIDE_CODES):
            with self.subTest(code=code), self.assertRaises(ValueError):
                volledige_lijnen("herstelling", None, 1, [{"code": code, "aantal": 1}])


class TestNormaliseer(unittest.TestCase):
    def test_dezelfde_code_wordt_samengeteld(self):
        self.assertEqual(
            normaliseer([{"code": "WP-KOEL", "aantal": 1}, {"code": "WP-KOEL", "aantal": 1}]),
            [{"code": "WP-KOEL", "aantal": 2}],
        )

    def test_gesorteerd_op_code_en_extra_velden_weg(self):
        self.assertEqual(
            normaliseer([{"code": "VERPL", "aantal": 1}, {"code": "onbekend", "aantal": 1, "omschrijving": "x"},
                         {"code": "ARB-TECH", "aantal": 2.0}]),
            [{"code": "ARB-TECH", "aantal": 2}, {"code": "VERPL", "aantal": 1}, {"code": "onbekend", "aantal": 1}],
        )

    def test_getal(self):
        self.assertEqual(getal(2.0), 2)
        self.assertIsInstance(getal(2.0), int)
        self.assertEqual(getal("1.5"), 1.5)


class TestAlleGevallen(unittest.TestCase):
    """De gold-onderdelen plus de afgeleide lijnen geven voor elk geval exact de gold-lijnen."""

    def test_cases_jsonl(self):
        pad = EVAL / "data" / "cases.jsonl"
        if not pad.exists():
            self.skipTest("eval/data/cases.jsonl ontbreekt")
        cases = [json.loads(r) for r in pad.read_text(encoding="utf-8").splitlines() if r.strip()]
        self.assertEqual(len(cases), 20)
        for c in cases:
            with self.subTest(case=c["case_id"]):
                gold = c["gold"]
                toestel = (c["context"]["toestel"] or {}).get("type")
                lijnen = volledige_lijnen(c["type"], toestel, gold["uren"], onderdelen_uit(gold["lijnen"]))
                self.assertEqual(lijnen, normaliseer(gold["lijnen"]))


if __name__ == "__main__":
    unittest.main()
