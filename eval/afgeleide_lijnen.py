"""Afgeleide lijnen (beslissing 1 van docs/eval-plan.md).

Het model geeft alleen uren, km, onderdelen en een opmerking terug. De lijnen die vastliggen door het type
interventie en het toestel, vult deze code aan:

- herstelling: ARB-TECH met aantal = uren, plus VERPL 1
- onderhoud:   één forfait volgens het toestel (ARB-ONDERH-WP, -VENT of -ZB), geen ARB-TECH

De score vergelijkt de volledige lijnenset (onderdelen + afgeleide lijnen) met de gold.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Any, Dict, Iterable, List, Optional

FORFAIT = {"warmtepomp": "ARB-ONDERH-WP", "ventilatie": "ARB-ONDERH-VENT", "zonneboiler": "ARB-ONDERH-ZB"}
AFGELEIDE_CODES = frozenset({"ARB-TECH", "VERPL", *FORFAIT.values()})

Lijn = Dict[str, Any]


def getal(x: Any) -> Any:
    """2.0 → 2, 2.5 → 2.5. Zo is 2 gelijk aan 2.0 en blijft de JSON leesbaar."""
    x = float(x)
    return int(x) if x.is_integer() else x


def afgeleide_lijnen(type_: str, toestel_type: Optional[str], uren: float) -> List[Lijn]:
    if type_ == "herstelling":
        lijnen: List[Lijn] = []
        if uren > 0:
            lijnen.append({"code": "ARB-TECH", "aantal": getal(uren)})
        lijnen.append({"code": "VERPL", "aantal": 1})
        return lijnen
    if type_ == "onderhoud":
        if toestel_type not in FORFAIT:
            raise ValueError(f"Onderhoud zonder bekend toestel ({toestel_type!r}): geen forfait af te leiden.")
        return [{"code": FORFAIT[toestel_type], "aantal": 1}]
    raise ValueError(f"Geen afgeleide lijnen voor type {type_!r}.")


def normaliseer(lijnen: Iterable[Lijn]) -> List[Lijn]:
    """Telt dezelfde code samen en sorteert op code. Alleen code en aantal blijven over."""
    som: Dict[str, float] = OrderedDict()
    for l in lijnen:
        som[l["code"]] = som.get(l["code"], 0.0) + float(l["aantal"])
    return [{"code": code, "aantal": getal(som[code])} for code in sorted(som)]


def volledige_lijnen(
    type_: str, toestel_type: Optional[str], uren: float, onderdelen: Iterable[Lijn]
) -> List[Lijn]:
    """De factuurlijnen: onderdelen van het model plus de afgeleide lijnen, genormaliseerd."""
    onderdelen = list(onderdelen)
    fout = sorted({o["code"] for o in onderdelen} & AFGELEIDE_CODES)
    if fout:
        raise ValueError(f"Afgeleide code(s) tussen de onderdelen: {', '.join(fout)}. Die vult de code zelf aan.")
    return normaliseer(onderdelen + afgeleide_lijnen(type_, toestel_type, uren))


def onderdelen_uit(lijnen: Iterable[Lijn]) -> List[Lijn]:
    """De lijnen zonder de afgeleide: wat het model zelf moet teruggeven."""
    return [l for l in lijnen if l["code"] not in AFGELEIDE_CODES]
