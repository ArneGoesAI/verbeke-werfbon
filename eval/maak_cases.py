"""Stap 2 van docs/eval-plan.md: de 20 testgevallen maken uit eval/data/gold.jsonl.

    .venv/bin/python eval/maak_cases.py                 # ontbrekende teksten genereren, alle bonnen renderen
    .venv/bin/python eval/maak_cases.py --opnieuw 814   # de tekst van werfbon 814 opnieuw genereren

Per geval:
- de gold, met de aangepaste gold voor de 4 randgevallen (bron "aangepast");
- een inspreektekst in Vlaamse spreektaal, geschreven door Claude Opus 5.5;
- een gerenderd, ingevuld bonformulier (PNG).

Het resultaat, eval/data/cases.jsonl, is volledig op zichzelf: de scoring leest alleen dat bestand, nooit gold.jsonl.
Bestaande teksten worden niet opnieuw gegenereerd. Na het nalezen zet je "nagelezen" op true.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import random
import re
import textwrap
from pathlib import Path
from typing import Any, Dict, List, Optional, Pattern, Tuple

import anthropic
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from export_gold import REPO, controleer_read_only, haal_namen, naampatroon, verbind, zoek_persoonsgegevens

DATA = REPO / "eval" / "data"
GOLD = DATA / "gold.jsonl"
CASES = DATA / "cases.jsonl"
CATALOGUS = DATA / "artikelen.json"
BONNEN = DATA / "bonnen"

SEED = 42
MODEL = "claude-opus-5-5"
EFFORT = "high"
MAX_POGINGEN = 3
PRIJS_PER_MTOK = {"input": 4.00, "output": 20.00}  # Opus 5.5, Anthropic API, USD

ONBEKEND = "onbekend"


# ─────────────────────────────────────────────
# 0. Catalogus (bevroren) en namen (alleen in het geheugen)
# ─────────────────────────────────────────────

SQL_CATALOGUS = """
select code, omschrijving, categorie, eenheid, verkoopprijs
from artikelen
order by code
"""


def laad_db_gegevens() -> Tuple[Optional[Pattern[str]], Dict[str, Dict[str, Any]]]:
    """Namen voor de controle en de catalogus, via een read-only verbinding.

    De catalogus wordt bij de eerste run bevroren in artikelen.json en daarna uit dat bestand gelezen.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL ontbreekt. Zet hem in .env (zie .env.example).")
    with verbind(url) as conn:
        with conn.transaction():
            controleer_read_only(conn)
            namen = naampatroon(haal_namen(conn))
            rijen = conn.execute(SQL_CATALOGUS).fetchall() if not CATALOGUS.exists() else None

    if rijen is not None:
        catalogus = {r["code"]: {**r, "verkoopprijs": float(r["verkoopprijs"])} for r in rijen}
        CATALOGUS.write_text(json.dumps(list(catalogus.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Catalogus bevroren in {CATALOGUS.relative_to(REPO)} ({len(catalogus)} artikelen).")
    else:
        catalogus = {a["code"]: a for a in json.loads(CATALOGUS.read_text(encoding="utf-8"))}
    return namen, catalogus


# ─────────────────────────────────────────────
# 1. Randgevallen: aangepaste gold
# ─────────────────────────────────────────────

# Een onderdeel dat niet in de catalogus staat, passend bij het toestel.
ONBEKEND_ONDERDEEL = {
    "ventilatie": ("motor van de bypassklep", "motor bypassklep vervangen"),
    "warmtepomp": ("ventilatormotor van de buitenunit", "ventilatormotor buitenunit vervangen"),
    "zonneboiler": ("automatische ontluchter", "ontluchter vervangen"),
    None: ("automatische ontluchter", "ontluchter vervangen"),
}


def pas_randgeval_aan(case: Dict[str, Any]) -> None:
    """Past gold, spraakopdracht en foto-instructie aan volgens het stratum. Zet bron op 'aangepast'."""
    stratum, gold = case["stratum"], case["gold"]
    toestel = (case["context"]["toestel"] or {}).get("type")

    if stratum == "correctie tijdens het spreken":
        if gold["uren"] != 1.5:
            raise SystemExit(f"Werfbon {case['werfbon_id']}: correctie verwacht 1,5 uur, gold heeft {gold['uren']}.")
        case["randgeval"] = "correctie"
        case["_spraak_extra"] = (
            "De technieker zegt eerst dat hij twee uur bezig was en verbetert zichzelf meteen: het was anderhalf uur. "
            "Alleen anderhalf uur telt."
        )
        case["_foto"] = {"uren_doorstreept": 2}
    elif stratum == "aantal hoger dan 1":
        gold["lijnen"].append({"code": "WP-KOEL", "aantal": 2})
        gold["opmerking"] = "koelmiddel bijgevuld, 2 kg"
        case["randgeval"] = "aantal_hoger_dan_1"
        case["_spraak_extra"] = "Er werd twee kilo koelmiddel bijgevuld. Zeg die hoeveelheid duidelijk."
    elif stratum == "onderdeel niet in catalogus":
        omschrijving, opmerking = ONBEKEND_ONDERDEEL.get(toestel, ONBEKEND_ONDERDEEL[None])
        gold["lijnen"].append({"code": ONBEKEND, "aantal": 1, "omschrijving": omschrijving})
        gold["opmerking"] = opmerking
        case["randgeval"] = "onbekend_onderdeel"
        case["_spraak_extra"] = f"Er werd één onderdeel vervangen: de {omschrijving}. Beschrijf dat onderdeel."
    elif stratum == "bon zonder km":
        gold["km"] = None
        case["randgeval"] = "zonder_km"
        case["_spraak_extra"] = "Zeg niets over kilometers of de afstand."
    else:
        raise SystemExit(f"Onbekend randgeval-stratum: {stratum!r}")

    gold["lijnen"].sort(key=lambda l: l["code"])
    case["bron"] = "aangepast"


def controleer_codes(cases: List[Dict[str, Any]], catalogus: Dict[str, Dict[str, Any]]) -> None:
    fouten = []
    for c in cases:
        for l in c["gold"]["lijnen"]:
            if l["code"] == ONBEKEND:
                if not l.get("omschrijving"):
                    fouten.append(f"werfbon {c['werfbon_id']}: lijn 'onbekend' zonder omschrijving")
            elif l["code"] not in catalogus:
                fouten.append(f"werfbon {c['werfbon_id']}: code {l['code']!r} staat niet in de catalogus")
    if fouten:
        raise SystemExit("Ongeldige codes in de gold:\n  " + "\n  ".join(fouten))


# ─────────────────────────────────────────────
# 2. Inspreekteksten (Opus 5.5) en hun controle
# ─────────────────────────────────────────────

SYSTEEM = """Je schrijft testmateriaal voor een app waarin een technieker van een Vlaams installatiebedrijf \
(warmtepompen, ventilatie, sanitair) na een interventie zijn werfbon inspreekt op zijn gsm.

Schrijf exact wat de technieker inspreekt, als één doorlopend stuk tekst, zonder aanhalingstekens, uitleg of titel.

Stijl:
- Vlaamse spreektaal en tussentaal, zoals een technieker echt praat in zijn camionette: "ge", "da", "efkes", \
"'t", "ne", afgebroken zinnen, herhalingen.
- Getallen altijd voluit in woorden ("anderhalf", "twee en een half uur", "een uur en een kwartierke", \
"drieëntwintig kilometer"). Nooit cijfers.
- Onderdelen in volkstaal ("de pomp", "dat vat", "de klep", "de print"), nooit artikelcodes of de vaktermen \
die in de opdracht verboden zijn.
- Wissel je spreektaal af. Niet elke technieker zegt "efkes", "allez" of "zenne".
- De opdracht zegt hoe je begint, hoe lang de tekst is en welke ruis erin mag. Houd je daar strikt aan. \
Andere ruis dan die uit de opdracht mag niet: geen weer, geen koffie en geen tevreden klant als dat er niet staat.
- Zeg nooit hoe iets op de bon moet komen ("zet dat op de bon", "noteer", "aanrekenen"). \
De technieker vertelt wat hij gedaan heeft, de app maakt de bon.
- Geen namen van mensen of bedrijven, geen telefoonnummers, geen e-mailadressen, geen adressen. \
Het merk van het toestel mag, een modelnummer niet.
- Geen opsommingen, geen nette samenvatting: het moet klinken als een mens, niet als een model.

Inhoud: vertel in je eigen woorden hoe lang je bezig was, hoeveel kilometer je gereden hebt, welk materiaal \
je gebruikt hebt (met het aantal) en wat er gebeurd is. Laat niets weg en verzin niets bij: geen extra \
onderdelen, geen andere uren."""

CODEPATROON = re.compile(r"\b[A-Z]{2,}-[A-Z0-9]+(?:-[A-Z0-9]+)*\b")

# Vaktermen van de onderdelen: die mogen niet in de inspreektekst. Ook verkleinwoorden en meervouden
# ("sensorke", "filters") tellen mee, want de controle kijkt naar het begin van elk woord.
# "Koelmiddel" mag wel: het evalplan noemt "twee kilo koelmiddel" zelf als voorbeeld van wat een technieker zegt.
ONDERDEELNAMEN = {
    "OND-PCB": ["printplaat"],
    "OND-VENTIEL": ["driewegklep", "driewegventiel"],
    "OND-POMP": ["circulatiepomp"],
    "SAN-BUIS": ["meerlagenbuis"],
    "OND-SENS": ["temperatuursensor", "sensor"],
    "OND-PRES": ["expansievat"],
    "VENT-FILT": ["filterset", "filter"],
    "WP-KOEL": ["r32"],
    "ZB-ONDERD": ["onderdelenset"],
}
ONBEKEND_NAMEN = ["bypassklep", "bypass", "ventilatormotor", "ontluchter"]

# Ruis die in de hele set hoogstens twee keer mag voorkomen. "weer" alleen niet: dat betekent meestal "opnieuw".
BEPERKTE_RUIS = {
    "weer": re.compile(
        r"\b(regen\w*|wind\w*|storm\w*|pijpenstelen|giet\w*|miezer\w*|motregen|sneeuw\w*|vriest|vriezen|ijzel|hagel\w*|onweer|"
        r"(?:da|dat|het|'t|met|zo'n|slecht|schoon)\s+weer(?:tje)?|weertje|koud\s+buiten)\b",
        re.IGNORECASE,
    ),
    "koffie": re.compile(r"\bkoffie\w*|\bkafee\w*", re.IGNORECASE),
    "tevreden klant": re.compile(r"\b(content|kontent|tevreden|blij|dankbaar)\b", re.IGNORECASE),
}
BON_VERWIJZING = re.compile(
    r"\b(op|in|van)\s+(de|den|die|da|dien)\s+(werf)?bon\b|\bnoteer\w*|\bnoteren\b|\bopschrijven\b|"
    r"\bopgeschreven\b|\baanreken\w*|\baangerekend\b|\bfactur\w*",
    re.IGNORECASE,
)
EUH = re.compile(r"\b(euh+|eh+|ehm+|uh+|uhm+)\b", re.IGNORECASE)
EFKES = re.compile(r"\befkes\b", re.IGNORECASE)


def woorden(tekst: str) -> List[str]:
    return re.findall(r"[a-zà-ÿ0-9]+", tekst.lower())


def verboden_namen(case: Dict[str, Any]) -> List[str]:
    """Alle vaktermen van onderdelen: die van de catalogus en die van het onbekende onderdeel."""
    namen = [n for lijst in ONDERDEELNAMEN.values() for n in lijst] + ONBEKEND_NAMEN
    for l in case["gold"]["lijnen"]:
        if l["code"] == ONBEKEND:
            namen += [w for w in woorden(l["omschrijving"]) if len(w) >= 6]  # "bypassklep", niet "van" of "de"
    return list(dict.fromkeys(namen))


def aantal_zinnen(tekst: str) -> int:
    tekst = re.sub(r"\.\.\.|…", ",", tekst.strip())
    return len([z for z in re.split(r"(?<=[.!?])\s+", tekst) if z.strip()])


# ─────────────────────────────────────────────
# Stijlkaarten: variatie over de hele set
# ─────────────────────────────────────────────

# Opus schrijft elke tekst apart en ziet de andere niet. Regels over de hele set (hoeveel keer "euh", weer, koffie,
# welke lengtes) verdeelt het script daarom vooraf: elk geval krijgt een vaste kaart, die in de opdracht staat
# en daarna gecontroleerd wordt.
OPENINGEN_EUH = ["Begin met \"euh\" of \"ja, euh\"."] * 6
OPENINGEN_ANDERS = [
    "Begin meteen met wat er mis was met het toestel. Geen \"euh\" in het begin.",
    "Begin met het soort werk, zonder aanloop (bv. \"Onderhoud bij ...\"). Geen \"euh\" in het begin.",
    "Begin met hoe lang je bezig was. Geen \"euh\" in het begin.",
    "Begin met hoe je het toestel aantrof toen je aankwam. Geen \"euh\" in het begin.",
    "Begin met wat je gedaan hebt. Geen \"euh\" in het begin.",
    "Begin met \"Zo,\" of \"Allez,\" en dan meteen ter zake. Geen \"euh\" in het begin.",
    "Begin met waar je geweest bent (de gemeente niet noemen, wel \"die van gisteren\", \"die dringende\"). "
    "Geen \"euh\" in het begin.",
]
LENGTES = (
    [("één zin", "Precies één zin, met alles erin, aan één stuk door.", 1, 1)] * 4
    + [("kort", "Kort: twee of drie zinnen.", 2, 3)] * 6
    + [("gemiddeld", "Drie tot vijf zinnen.", 3, 5)] * 6
    + [("lang", "Lang: zes tot tien zinnen, met wat herhaling en een zijsprong.", 6, 10)] * 4
)
RUIS = (
    [("weer", "Zeg één korte zin over het weer.")] * 2
    + [("koffie", "Zeg dat je koffie kreeg.")] * 2
    + [("tevreden klant", "Zeg kort dat de klant tevreden was.")] * 2
    + [("verkeer", "Zeg iets over het verkeer of de file.")] * 2
    + [("telefoon", "Je wordt even onderbroken door je telefoon of een collega.")] * 2
    + [("huisdier", "Zeg iets over een hond of kat bij de klant.")] * 2
    + [("geen", "Geen ruis: alleen het werk.")] * 8
)


def deel_stijlkaarten_uit(cases: List[Dict[str, Any]]) -> None:
    """Deterministisch: dezelfde gevallen krijgen bij elke run dezelfde kaart."""
    n = len(cases)
    rng = random.Random(f"{SEED}-stijl")
    openingen = (OPENINGEN_EUH + OPENINGEN_ANDERS * n)[:n]
    lengtes = (LENGTES * (n // len(LENGTES) + 1))[:n]
    ruis = (RUIS * (n // len(RUIS) + 1))[:n]
    for lijst in (openingen, lengtes, ruis):
        rng.shuffle(lijst)
    for c, o, l, r in zip(cases, openingen, lengtes, ruis):
        c["_stijl"] = {"opening": o, "euh": o in OPENINGEN_EUH, "lengte": l, "ruis": r}


def getal_nl(x: Any) -> str:
    return str(x).replace(".", ",")


def spraak_opdracht(case: Dict[str, Any], catalogus: Dict[str, Dict[str, Any]]) -> str:
    ctx, gold = case["context"], case["gold"]
    toestel = ctx["toestel"]
    regels = [f"Type interventie: {ctx['type']}", f"Omschrijving van de interventie: {ctx['omschrijving']}"]
    if toestel:
        regels.append(f"Toestel: {toestel['type']} van {toestel['merk']}")
    regels.append(f"Gewerkte tijd: {getal_nl(gold['uren'])} uur")
    regels.append("Kilometers: niets over zeggen" if gold["km"] is None else f"Gereden kilometers: {gold['km']}")

    materiaal = []
    for l in gold["lijnen"]:
        if l["code"] == ONBEKEND:
            materiaal.append(f"{l['omschrijving']} ({getal_nl(l['aantal'])} stuk)")
        elif catalogus[l["code"]]["categorie"] not in ("arbeid", "verplaatsing"):
            a = catalogus[l["code"]]
            materiaal.append(f"{a['omschrijving']} ({getal_nl(l['aantal'])} {a['eenheid']})")
    regels.append("Gebruikt materiaal: " + ("; ".join(materiaal) if materiaal else "geen"))
    regels.append(f"Wat er gebeurd is (vertel het in je eigen woorden): {gold['opmerking'] or '(niets bijzonders)'}")
    if case.get("_spraak_extra"):
        regels.append(f"Extra opdracht: {case['_spraak_extra']}")
    stijl = case["_stijl"]
    regels.append(f"Opening: {stijl['opening']}")
    regels.append(f"Lengte: {stijl['lengte'][1]}")
    regels.append(f"Ruis: {stijl['ruis'][1]}")
    regels.append(
        "Deze vaktermen voor onderdelen mag je niet gebruiken, ook niet als deel van een woord: "
        + ", ".join(verboden_namen(case))
    )
    return "\n".join(regels)


def controleer_spraak(
    tekst: str, case: Dict[str, Any], catalogus: Dict[str, Dict[str, Any]], namen: Optional[Pattern[str]]
) -> List[str]:
    """Geeft een lijst met problemen terug (leeg = in orde)."""
    problemen = []
    # Een catalogus-code (met streepje: in eender welke schrijfwijze; zonder, zoals KM: alleen exact),
    # of iets in hoofdletters dat op een code lijkt.
    for code in catalogus:
        vlag = re.IGNORECASE if "-" in code else 0
        if re.search(r"(?<![\w-])" + re.escape(code) + r"(?![\w-])", tekst, vlag):
            problemen.append(f"artikelcode: {code}")
    for m in CODEPATROON.finditer(tekst):
        if m.group(0) not in catalogus:
            problemen.append(f"lijkt op een artikelcode: {m.group(0)}")
    tekst_woorden = woorden(tekst)
    for naam in verboden_namen(case):
        if any(w.startswith(naam) for w in tekst_woorden):
            problemen.append(f"vakterm voor een onderdeel: {naam!r}")
    m = BON_VERWIJZING.search(tekst)
    if m:
        problemen.append(f"zegt hoe iets op de bon moet komen: {m.group(0)!r}")

    stijl = case["_stijl"]
    if not stijl["euh"] and EUH.search(" ".join(tekst.split()[:3])):
        problemen.append("begint met \"euh\", terwijl de opdracht een andere opening vraagt")
    for soort, patroon in BEPERKTE_RUIS.items():
        m = patroon.search(tekst)
        if m and stijl["ruis"][0] != soort:
            problemen.append(f"ruis die niet gevraagd is ({soort}): {m.group(0)!r}")
    naam, _, minimum, maximum = stijl["lengte"]
    zinnen = aantal_zinnen(tekst)
    if not minimum <= zinnen <= maximum:
        problemen.append(f"{zinnen} zinnen, de opdracht vraagt {naam} ({minimum} tot {maximum})")
    if re.search(r"\d", tekst):
        problemen.append("bevat cijfers (getallen moeten voluit)")
    for pad, soort, treffer in zoek_persoonsgegevens({"spraak": tekst}, namen):
        problemen.append(f"mogelijke persoonsgegevens ({soort}): {treffer!r}")
    return problemen


def genereer_spraak(
    client: anthropic.Anthropic,
    case: Dict[str, Any],
    catalogus: Dict[str, Dict[str, Any]],
    namen: Optional[Pattern[str]],
    gebruik: Dict[str, int],
) -> Tuple[str, Dict[str, Any]]:
    opdracht = spraak_opdracht(case, catalogus)
    vorige_problemen: List[str] = []
    for poging in range(1, MAX_POGINGEN + 1):
        inhoud = opdracht
        if vorige_problemen:
            inhoud += "\n\nEen vorige versie werd afgekeurd om deze redenen. Vermijd ze:\n- " + "\n- ".join(vorige_problemen)
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": EFFORT},
            system=SYSTEEM,
            messages=[{"role": "user", "content": inhoud}],
        )
        gebruik["input"] += response.usage.input_tokens
        gebruik["output"] += response.usage.output_tokens
        if response.stop_reason == "refusal":
            raise SystemExit(f"Werfbon {case['werfbon_id']}: het model weigerde ({response.stop_details}).")
        if response.stop_reason == "max_tokens":
            vorige_problemen = ["de tekst was te lang"]
            continue
        tekst = " ".join(b.text for b in response.content if b.type == "text").strip()
        vorige_problemen = controleer_spraak(tekst, case, catalogus, namen)
        if not vorige_problemen:
            stijl = case["_stijl"]
            meta = {
                "model": response.model,
                "effort": EFFORT,
                "pogingen": poging,
                "stijl": {"opening": stijl["opening"], "lengte": stijl["lengte"][0], "ruis": stijl["ruis"][0]},
            }
            return tekst, meta
        print(f"  werfbon {case['werfbon_id']}, poging {poging} afgekeurd: {'; '.join(vorige_problemen)}")
    raise SystemExit(
        f"Werfbon {case['werfbon_id']}: na {MAX_POGINGEN} pogingen nog afgekeurd: {'; '.join(vorige_problemen)}"
    )


# ─────────────────────────────────────────────
# 3. Bonformulier renderen (PIL)
# ─────────────────────────────────────────────

LETTERTYPES_HAND = [
    "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf",
    "/System/Library/Fonts/Noteworthy.ttc",
    "/System/Library/Fonts/MarkerFelt.ttc",
]
LETTERTYPES_DRUK = ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"]
INKT = (28, 38, 120)
DRUK = (40, 40, 40)
BREEDTE, HOOGTE = 1240, 1754  # A4 staand op 150 dpi

# Hoe een technieker het materiaal opschrijft. {n} = aantal. Soms schrijft hij de code.
MATERIAAL_HAND = {
    "OND-PCB": ["{n}x print binnenunit", "nieuwe print", "printplaat"],
    "OND-VENTIEL": ["{n}x 3-wegklep", "driewegklep", "klep vervangen"],
    "OND-POMP": ["{n}x circulatiepomp", "pomp vervangen", "circ. pomp"],
    "SAN-BUIS": ["{n} m buis + koppeling", "stuk meerlagenbuis", "koppeling + buis"],
    "OND-SENS": ["{n}x voeler", "temp. sensor", "sensor"],
    "OND-PRES": ["{n}x expansievat", "exp. vat 18L", "vat vervangen"],
    "VENT-FILT": ["{n}x filterset", "filters", "nieuwe filters"],
    "WP-KOEL": ["{n} kg koelmiddel", "{n} kg R32"],
}


def laad_lettertype(kandidaten: List[str], grootte: int) -> ImageFont.FreeTypeFont:
    eigen = os.environ.get("BON_LETTERTYPE") if kandidaten is LETTERTYPES_HAND else None
    for pad in ([eigen] if eigen else []) + kandidaten:
        if pad and Path(pad).exists():
            return ImageFont.truetype(pad, grootte)
    raise SystemExit(f"Geen lettertype gevonden. Zet BON_LETTERTYPE op een .ttf-bestand. Gezocht: {kandidaten}")


def uren_hand(uren: float, rng: random.Random) -> str:
    h, minuten = int(uren), round((uren - int(uren)) * 60)
    vormen = [f"{getal_nl(uren)} u", f"{h}u{minuten:02d}" if minuten else f"{h}u"]
    if minuten == 30:
        vormen.append(f"{h}½ u")
    return rng.choice(vormen)


def materiaal_hand(case: Dict[str, Any], catalogus: Dict[str, Dict[str, Any]], rng: random.Random) -> List[str]:
    regels = []
    for l in case["gold"]["lijnen"]:
        code, n = l["code"], getal_nl(l["aantal"])
        if code == ONBEKEND:
            regels.append(l["omschrijving"])
        elif catalogus[code]["categorie"] in ("arbeid", "verplaatsing"):
            continue  # arbeid, verplaatsing en forfait schrijft de technieker niet als materiaal
        elif code == "WP-KOEL":  # randgeval "aantal hoger dan 1": altijd in kilo, zoals een technieker het schrijft
            regels.append(rng.choice(MATERIAAL_HAND[code]).format(n=n))
        elif rng.random() < 0.3 or code not in MATERIAAL_HAND:
            eenheid = catalogus[code]["eenheid"]
            regels.append(f"{n}x {code}" if eenheid == "stuk" else f"{n} {eenheid} {code}")
        else:
            regels.append(rng.choice(MATERIAAL_HAND[code]).format(n=n))
    return regels


def render_bon(case: Dict[str, Any], catalogus: Dict[str, Dict[str, Any]], pad: Path) -> Dict[str, Any]:
    """Tekent het ingevulde formulier. Geeft terug wat er met de hand op staat (voor controle en debug)."""
    rng = random.Random(f"{SEED}-{case['case_id']}")
    hand = laad_lettertype(LETTERTYPES_HAND, 46)
    druk = laad_lettertype(LETTERTYPES_DRUK, 30)
    titel = laad_lettertype(LETTERTYPES_DRUK, 54)

    img = Image.new("RGB", (BREEDTE, HOOGTE), (250, 248, 240))
    d = ImageDraw.Draw(img)

    def schrijf(x: int, y: int, tekst: str) -> None:
        d.text((x + rng.randint(-4, 4), y + rng.randint(-4, 4)), tekst, font=hand, fill=INKT)

    # Gedrukt formulier
    d.text((80, 70), "WERFBON", font=titel, fill=DRUK)
    d.text((80, 140), "Verbeke Installatietechniek", font=druk, fill=DRUK)
    d.line((80, 200, BREEDTE - 80, 200), fill=DRUK, width=3)

    y = 250
    d.text((80, y), "Type werk:", font=druk, fill=DRUK)
    for i, soort in enumerate(("herstelling", "onderhoud")):
        x = 330 + i * 340
        d.rectangle((x, y, x + 34, y + 34), outline=DRUK, width=3)
        d.text((x + 50, y), soort.capitalize(), font=druk, fill=DRUK)
        if case["type"] == soort:
            schrijf(x + 2, y - 18, "X")

    y = 360
    d.text((80, y), "Uren:", font=druk, fill=DRUK)
    d.line((230, y + 45, 560, y + 45), fill=DRUK, width=2)
    uren_tekst = uren_hand(case["gold"]["uren"], rng)
    doorstreept = case.get("_foto", {}).get("uren_doorstreept")
    if doorstreept is not None:
        oud = f"{doorstreept}u"
        schrijf(250, y - 15, oud)
        breedte = d.textlength(oud, font=hand)
        d.line((245, y + 15, 255 + breedte, y + 5), fill=INKT, width=5)
        schrijf(280 + int(breedte), y - 15, uren_tekst)
        uren_tekst = f"[{oud} doorstreept] {uren_tekst}"
    else:
        schrijf(250, y - 15, uren_tekst)

    d.text((640, y), "Km:", font=druk, fill=DRUK)
    d.line((740, y + 45, 1000, y + 45), fill=DRUK, width=2)
    km_tekst = "" if case["gold"]["km"] is None else str(case["gold"]["km"]) + rng.choice(["", " km"])
    if km_tekst:
        schrijf(760, y - 15, km_tekst)

    y = 480
    d.text((80, y), "Materiaal:", font=druk, fill=DRUK)
    materiaal = materiaal_hand(case, catalogus, rng)
    for i in range(4):
        ly = y + 60 + i * 75
        d.line((80, ly + 50, BREEDTE - 80, ly + 50), fill=(170, 170, 170), width=2)
        if i < len(materiaal):
            schrijf(100, ly, materiaal[i])

    y = 860
    d.text((80, y), "Opmerking:", font=druk, fill=DRUK)
    opmerking = case["gold"]["opmerking"] or ""
    for i, regel in enumerate(textwrap.wrap(opmerking, 34)[:5]):
        ly = y + 60 + i * 75
        schrijf(100, ly, regel)
    for i in range(5):
        ly = y + 60 + i * 75
        d.line((80, ly + 50, BREEDTE - 80, ly + 50), fill=(170, 170, 170), width=2)

    y = 1350
    d.text((80, y), "Handtekening klant:", font=druk, fill=DRUK)
    d.line((80, y + 150, 600, y + 150), fill=DRUK, width=2)
    punten = [(120 + i * 40, y + 120 - rng.randint(0, 60)) for i in range(10)]  # krabbel, geen naam
    d.line(punten, fill=INKT, width=4, joint="curve")

    # Licht gedraaid, ruis en wat onscherpte: een foto van papier, geen scan.
    img = img.rotate(rng.uniform(-3, 3), resample=Image.BICUBIC, fillcolor=(205, 200, 190))
    ruis = Image.effect_noise((BREEDTE, HOOGTE), rng.uniform(25, 40)).convert("RGB")
    img = Image.blend(img, ruis, 0.08)
    img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.4, 0.9)))

    pad.parent.mkdir(parents=True, exist_ok=True)
    img.save(pad, optimize=True)
    return {"uren": uren_tekst, "km": km_tekst, "materiaal": materiaal, "opmerking": opmerking}


# ─────────────────────────────────────────────
# 4. Cases opbouwen en wegschrijven
# ─────────────────────────────────────────────

def lees_jsonl(pad: Path) -> List[Dict[str, Any]]:
    with pad.open(encoding="utf-8") as fh:
        return [json.loads(regel) for regel in fh if regel.strip()]


def maak_case(n: int, record: Dict[str, Any]) -> Dict[str, Any]:
    case_id = f"c{n:02d}-wb{record['werfbon_id']}"
    case = {
        "case_id": case_id,
        "werfbon_id": record["werfbon_id"],
        "type": record["type"],
        "groep": record["groep"],
        "stratum": record["stratum"],
        "bron": record["bron"],
        "randgeval": None,
        "deel": "synthetisch",
        "context": copy.deepcopy(record["context"]),
        "gold": copy.deepcopy(record["gold"]),
    }
    if record["groep"] == "randgeval":
        pas_randgeval_aan(case)
    return case


def publiek(case: Dict[str, Any]) -> Dict[str, Any]:
    """Zonder de interne velden (_spraak_extra, _foto)."""
    return {k: v for k, v in case.items() if not k.startswith("_")}


def schrijf_cases(cases: List[Dict[str, Any]]) -> None:
    tijdelijk = CASES.with_suffix(".jsonl.tmp")
    with tijdelijk.open("w", encoding="utf-8") as fh:
        for c in cases:
            if c.get("invoer", {}).get("spraak"):
                fh.write(json.dumps(publiek(c), ensure_ascii=False) + "\n")
    os.replace(tijdelijk, CASES)


def print_tellingen(teksten: List[str]) -> None:
    """Hoe vaak komt de typische ruis voor, over de hele set (aantal teksten)."""
    def telt(patroon: Pattern[str]) -> int:
        return sum(1 for t in teksten if patroon.search(t))

    begin_euh = sum(1 for t in teksten if EUH.search(" ".join(t.split()[:3])))
    print(f"\nIn {len(teksten)} teksten:")
    print(f"  begint met euh   {begin_euh}")
    print(f"  euh (ergens)     {telt(EUH)}")
    print(f"  efkes            {telt(EFKES)}")
    for soort, patroon in BEPERKTE_RUIS.items():
        print(f"  {soort:<16} {telt(patroon)}")
    lengtes = sorted(aantal_zinnen(t) for t in teksten)
    print(f"  zinnen per tekst {lengtes}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--opnieuw", type=int, nargs="*", default=[], metavar="WERFBON_ID",
                        help="de inspreektekst van deze werfbonnen opnieuw genereren")
    parser.add_argument("--alles", action="store_true", help="alle inspreekteksten opnieuw genereren")
    args = parser.parse_args()

    load_dotenv(REPO / ".env")
    gold = lees_jsonl(GOLD)
    onbekend = set(args.opnieuw) - {r["werfbon_id"] for r in gold}
    if onbekend:
        raise SystemExit(f"Niet in gold.jsonl: {sorted(onbekend)}")

    namen, catalogus = laad_db_gegevens()

    # 1. Gold (met randgevallen) en codecontrole
    cases = [maak_case(n, r) for n, r in enumerate(gold, start=1)]
    controleer_codes(cases, catalogus)
    deel_stijlkaarten_uit(cases)
    if args.alles:
        args.opnieuw = [c["werfbon_id"] for c in cases]

    # Bestaande teksten hergebruiken, tenzij --opnieuw
    bestaand = {c["case_id"]: c for c in lees_jsonl(CASES)} if CASES.exists() else {}
    for c in cases:
        oud = bestaand.get(c["case_id"])
        if oud and c["werfbon_id"] not in args.opnieuw:
            c["invoer"] = {"spraak": oud["invoer"]["spraak"]}
            c["generatie"] = oud.get("generatie")
            c["nagelezen"] = oud.get("nagelezen", False)

    # Hergebruikte (en eventueel met de hand aangepaste) teksten eerst controleren
    fouten = []
    for c in cases:
        if c.get("invoer"):
            for p in controleer_spraak(c["invoer"]["spraak"], c, catalogus, namen):
                fouten.append(f"{c['case_id']}: {p}")
    if fouten:
        raise SystemExit("Bestaande teksten afgekeurd. Er is niets weggeschreven:\n  " + "\n  ".join(fouten))

    # 3. Bonnen renderen (deterministisch, dus altijd opnieuw)
    for c in cases:
        pad = BONNEN / f"{c['case_id']}.png"
        c["foto_inhoud"] = render_bon(c, catalogus, pad)
        c.setdefault("invoer", {})["foto"] = str(pad.relative_to(REPO))

    # 2. Ontbrekende inspreekteksten genereren; na elke tekst wegschrijven
    te_doen = [c for c in cases if not c["invoer"].get("spraak")]
    gebruik = {"input": 0, "output": 0}
    if te_doen:
        client = anthropic.Anthropic()
        print(f"{len(te_doen)} inspreekteksten genereren met {MODEL} (effort {EFFORT})...")
        for c in te_doen:
            tekst, meta = genereer_spraak(client, c, catalogus, namen, gebruik)
            c["invoer"]["spraak"] = tekst
            c["generatie"] = meta
            c["nagelezen"] = False
            schrijf_cases(cases)
            print(f"  {c['case_id']}: ok ({meta['pogingen']} poging(en), {meta['model']})")
    schrijf_cases(cases)

    kost = gebruik["input"] / 1e6 * PRIJS_PER_MTOK["input"] + gebruik["output"] / 1e6 * PRIJS_PER_MTOK["output"]
    niet_nagelezen = [c["case_id"] for c in cases if not c.get("nagelezen")]
    print(f"\n{len(cases)} gevallen in {CASES.relative_to(REPO)}, bonnen in {BONNEN.relative_to(REPO)}/")
    print(f"Tokens: {gebruik['input']} in, {gebruik['output']} uit (ongeveer ${kost:.2f})")
    print_tellingen([c["invoer"]["spraak"] for c in cases])
    if niet_nagelezen:
        print(f"Nog na te lezen ({len(niet_nagelezen)}): {', '.join(niet_nagelezen)}")


if __name__ == "__main__":
    main()
