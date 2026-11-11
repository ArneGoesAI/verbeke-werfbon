"""Pydantic-model van de werfbon die het model teruggeeft (= JSON-schema voor structured output).

Eén bron voor twee dingen:
- het JSON-schema in output_config.format (run_eval.py);
- de validatie van de output achteraf (score.py, "geldige output").

De artikelcodes zijn een enum: alle codes uit de catalogus behalve arbeid en verplaatsing (die leidt
afgeleide_lijnen.py zelf af), plus "onbekend" voor een onderdeel dat niet in de catalogus staat.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple, Type

from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model

REPO = Path(__file__).resolve().parent.parent
CATALOGUS = REPO / "eval" / "data" / "artikelen.json"

ONBEKEND = "onbekend"
NIET_VOOR_MODEL = ("arbeid", "verplaatsing")  # ARB-TECH, ARB-ONDERH-*, VERPL, KM

Catalogus = Dict[str, Dict[str, Any]]


def laad_catalogus(pad: Path = CATALOGUS) -> Catalogus:
    return {a["code"]: a for a in json.loads(pad.read_text(encoding="utf-8"))}


def onderdeel_codes(catalogus: Catalogus) -> List[str]:
    """De codes die het model mag teruggeven, zonder 'onbekend'."""
    return sorted(c for c, a in catalogus.items() if a["categorie"] not in NIET_VOOR_MODEL)


def maak_werfbon_model(catalogus: Catalogus) -> Type[BaseModel]:
    codes: Tuple[str, ...] = tuple(onderdeel_codes(catalogus)) + (ONBEKEND,)
    verbied_extra = ConfigDict(extra="forbid")  # additionalProperties: false, verplicht voor structured output

    onderdeel = create_model(
        "Onderdeel",
        __config__=verbied_extra,
        code=(Literal[codes], Field(description="Artikelcode uit de catalogus, of 'onbekend' als het onderdeel "
                                                "er niet in staat of je niet zeker weet welk artikel het is.")),
        aantal=(float, Field(description="Aantal in de eenheid van het artikel (stuk, m, kg).")),
        omschrijving=(Optional[str], Field(description="Alleen bij code 'onbekend': wat het onderdeel is. "
                                                       "Anders null.")),
        bronzin=(str, Field(description="Het stuk tekst waaruit dit onderdeel blijkt, letterlijk overgenomen.")),
    )
    return create_model(
        "Werfbon",
        __config__=verbied_extra,
        uren=(float, Field(description="Gewerkte uren als decimaal getal (anderhalf uur = 1.5). "
                                       "Bij een verbetering: de verbeterde waarde.")),
        km=(Optional[int], Field(description="Gereden kilometers, of null als er niets over gezegd of geschreven is.")),
        onderdelen=(List[onderdeel], Field(description="Gebruikt materiaal. Geen arbeid, verplaatsing of "
                                                       "onderhoudsforfait: die rekent het systeem zelf.")),
        opmerking=(str, Field(description="Hoogstens twee zinnen, in de woorden van de technieker: wat er "
                                          "gebeurd is en wat opgevolgd moet worden.")),
    )


def json_schema(model: Type[BaseModel]) -> Dict[str, Any]:
    """Het schema voor output_config.format. Zonder minimum/maximum/lengtes: die ondersteunt het API niet."""
    return model.model_json_schema()


def valideer(model: Type[BaseModel], tekst: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """(output als dict, None) als de tekst geldig is, anders (None, foutmelding)."""
    if not tekst:
        return None, "lege output"
    try:
        return model.model_validate_json(tekst).model_dump(), None
    except ValidationError as e:
        eerste = e.errors()[0]
        plaats = ".".join(str(p) for p in eerste["loc"])
        waarde = f" (kreeg {eerste['input']!r})" if eerste["type"] == "literal_error" else ""
        return None, f"past niet in het schema: {plaats}: {eerste['msg'][:60]}{waarde} ({e.error_count()} fout(en))"
