"""De bestanden in web/lib/verwerking/gegenereerd/ moeten overeenkomen met wat de eval nu zou versturen.

    .venv/bin/python -m unittest discover -s eval/tests -v
"""

import sys
import unittest
from pathlib import Path

EVAL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVAL))

from exporteer_voor_app import DOEL, verouderd  # noqa: E402


class TestExportApp(unittest.TestCase):
    def test_gegenereerde_bestanden_zijn_actueel(self):
        if not DOEL.exists():
            self.fail(f"{DOEL} ontbreekt: draai eval/exporteer_voor_app.py")
        self.assertEqual(verouderd(), [], "Draai eval/exporteer_voor_app.py en commit het resultaat.")


if __name__ == "__main__":
    unittest.main()
