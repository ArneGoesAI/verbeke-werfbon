"""Stap 1 van docs/eval-plan.md: de ground truth uit de database bevriezen als eval/data/gold.jsonl.

Eenmalig uit te voeren. De eval leest daarna nooit meer uit de live database.

    .venv/bin/python eval/export_gold.py              # schrijft eval/data/gold.jsonl
    .venv/bin/python eval/export_gold.py --overschrijf

Garanties:
- De verbinding is read-only (default_transaction_read_only=on, BEGIN READ ONLY, en een controle).
- De selectie volgt de stratificatie uit §2 van het evalplan, reproduceerbaar via een vaste seed.
- Geen namen, telefoonnummers of e-mailadressen in de output. Bij een treffer stopt de export zonder te schrijven.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Pattern, Tuple

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO = Path(__file__).resolve().parent.parent
STANDAARD_UIT = REPO / "eval" / "data" / "gold.jsonl"
SEED = 42

# Lijnen die de code zelf afleidt (beslissing 1). Alle andere codes zijn "onderdelen".
AFGELEID = {"ARB-TECH", "VERPL", "ARB-ONDERH-WP", "ARB-ONDERH-VENT", "ARB-ONDERH-ZB"}


# ─────────────────────────────────────────────
# 1. Verbinding: read-only, één momentopname
# ─────────────────────────────────────────────

def verbind(url: str) -> psycopg.Connection:
    conn = psycopg.connect(url, autocommit=True, row_factory=dict_row)
    # Sessie-instelling. Bewust SET en geen startoptie: de Supabase-pooler geeft "options" niet altijd door.
    conn.execute("set default_transaction_read_only = on")
    conn.autocommit = False
    conn.read_only = True  # psycopg start elke transactie met BEGIN READ ONLY
    conn.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    return conn


def controleer_read_only(conn: psycopg.Connection) -> None:
    waarde = conn.execute("show transaction_read_only").fetchone()["transaction_read_only"]
    if waarde != "on":
        raise SystemExit(f"Verbinding is niet read-only (transaction_read_only={waarde}). Gestopt.")


# ─────────────────────────────────────────────
# 2. Ophalen
# ─────────────────────────────────────────────

# Expliciete kolommen, geen join met klanten of medewerkers.
SQL_BONNEN = """
select wb.id          as werfbon_id,
       i.type         as type,
       i.omschrijving as omschrijving,
       i.contract_id is not null as heeft_contract,
       oc.toesteltype as toesteltype,
       oc.merk        as merk,
       oc.model       as model,
       wb.uren        as uren,
       wb.km          as km,
       wb.opmerkingen as opmerking
from werfbonnen wb
join interventies i on i.id = wb.interventie_id
left join onderhoudscontracten oc on oc.id = i.contract_id
where i.type in ('herstelling', 'onderhoud')
order by wb.id
"""

SQL_LIJNEN = """
select wl.werfbon_id, a.code, wl.aantal
from werfbon_lijnen wl
join artikelen a on a.id = wl.artikel_id
join werfbonnen wb on wb.id = wl.werfbon_id
join interventies i on i.id = wb.interventie_id
where i.type in ('herstelling', 'onderhoud')
order by wl.werfbon_id, a.code
"""

# Alleen voor de controle in het geheugen. Wordt nooit weggeschreven.
SQL_NAMEN = """
select voornaam as naam from klanten where voornaam is not null
union select achternaam from klanten where achternaam is not null
union select bedrijfsnaam from klanten where bedrijfsnaam is not null
union select voornaam from medewerkers
union select achternaam from medewerkers
"""


def getal(waarde: Any) -> Any:
    """Decimal → int als het een geheel getal is, anders float. Zo blijft de JSON leesbaar (1 en niet 1.00)."""
    if isinstance(waarde, Decimal):
        return int(waarde) if waarde == waarde.to_integral_value() else float(waarde)
    return waarde


def haal_bonnen(conn: psycopg.Connection) -> List[Dict[str, Any]]:
    bonnen = conn.execute(SQL_BONNEN).fetchall()
    lijnen: Dict[int, List[Dict[str, Any]]] = {}
    for r in conn.execute(SQL_LIJNEN).fetchall():
        lijnen.setdefault(r["werfbon_id"], []).append({"code": r["code"], "aantal": getal(r["aantal"])})
    for b in bonnen:
        b["lijnen"] = lijnen.get(b["werfbon_id"], [])
        b["onderdelen"] = tuple(sorted(l["code"] for l in b["lijnen"] if l["code"] not in AFGELEID))
        b["uren"] = getal(b["uren"])
    return bonnen


def haal_namen(conn: psycopg.Connection) -> List[str]:
    return [r["naam"] for r in conn.execute(SQL_NAMEN).fetchall()]


# ─────────────────────────────────────────────
# 3. Stratificatie (§2 van het evalplan)
# ─────────────────────────────────────────────

# (groep, stratum, filter). Filtersleutels:
#   type        interventietype
#   toestel     toesteltype van het contract
#   onderdelen  exacte set onderdelen naast de afgeleide lijnen (() = geen)
#   contract    True/False: interventie heeft wel/geen contract
#   opmerking   deze tekst moet in de opmerking staan
#   uren        exact aantal uren
STRATA: List[Tuple[str, str, Dict[str, Any]]] = [
    # Herstelling (8): alle 6 onderdelen, plus 2 keer reset zonder onderdelen
    ("herstelling", "OND-PCB", {"type": "herstelling", "onderdelen": ("OND-PCB",)}),
    ("herstelling", "OND-VENTIEL", {"type": "herstelling", "onderdelen": ("OND-VENTIEL",)}),
    ("herstelling", "OND-POMP", {"type": "herstelling", "onderdelen": ("OND-POMP",)}),
    ("herstelling", "SAN-BUIS", {"type": "herstelling", "onderdelen": ("SAN-BUIS",)}),
    ("herstelling", "OND-SENS", {"type": "herstelling", "onderdelen": ("OND-SENS",)}),
    ("herstelling", "OND-PRES", {"type": "herstelling", "onderdelen": ("OND-PRES",)}),
    ("herstelling", "reset, zonder contract", {"type": "herstelling", "onderdelen": (), "contract": False}),
    ("herstelling", "reset, met contract", {"type": "herstelling", "onderdelen": (), "contract": True}),
    # Onderhoud (8): de 3 toesteltypes, waarvan 4 met een extra onderdeel
    ("onderhoud", "warmtepomp", {"type": "onderhoud", "toestel": "warmtepomp", "onderdelen": ()}),
    ("onderhoud", "warmtepomp", {"type": "onderhoud", "toestel": "warmtepomp", "onderdelen": ()}),
    ("onderhoud", "ventilatie", {"type": "onderhoud", "toestel": "ventilatie", "onderdelen": ()}),
    ("onderhoud", "zonneboiler", {"type": "onderhoud", "toestel": "zonneboiler", "onderdelen": ()}),
    ("onderhoud", "warmtepomp + OND-SENS", {"type": "onderhoud", "toestel": "warmtepomp", "onderdelen": ("OND-SENS",)}),
    ("onderhoud", "warmtepomp + OND-PRES", {"type": "onderhoud", "toestel": "warmtepomp", "onderdelen": ("OND-PRES",)}),
    ("onderhoud", "ventilatie + VENT-FILT", {"type": "onderhoud", "toestel": "ventilatie", "onderdelen": ("VENT-FILT",)}),
    ("onderhoud", "ventilatie + VENT-FILT", {"type": "onderhoud", "toestel": "ventilatie", "onderdelen": ("VENT-FILT",)}),
    # Randgevallen (4): hier alleen de basisbon. Stap 2 (maak_cases.py) past de gold aan en zet bron op "aangepast".
    ("randgeval", "correctie tijdens het spreken", {"type": "herstelling", "uren": 1.5}),
    ("randgeval", "aantal hoger dan 1", {"type": "onderhoud", "toestel": "warmtepomp", "opmerking": "koelmiddel"}),
    ("randgeval", "onderdeel niet in catalogus", {"type": "herstelling", "onderdelen": ()}),
    ("randgeval", "bon zonder km", {"type": "herstelling"}),
]


def past(bon: Dict[str, Any], f: Dict[str, Any]) -> bool:
    if bon["type"] != f["type"]:
        return False
    if "toestel" in f and bon["toesteltype"] != f["toestel"]:
        return False
    if "onderdelen" in f and bon["onderdelen"] != f["onderdelen"]:
        return False
    if "contract" in f and bon["heeft_contract"] != f["contract"]:
        return False
    if "opmerking" in f and f["opmerking"] not in (bon["opmerking"] or ""):
        return False
    if "uren" in f and bon["uren"] != f["uren"]:
        return False
    return True


def selecteer(bonnen: List[Dict[str, Any]], seed: int) -> List[Tuple[str, str, int, Dict[str, Any]]]:
    """Kiest per stratum één bon. Geeft (groep, stratum, aantal kandidaten, bon) terug."""
    rng = random.Random(seed)
    gekozen: set = set()
    gebruikte_opmerkingen: set = set()
    selectie = []
    for groep, stratum, f in STRATA:
        kandidaten = [b for b in bonnen if b["werfbon_id"] not in gekozen and past(b, f)]
        if not kandidaten:
            raise SystemExit(f"Geen kandidaten voor stratum '{groep}: {stratum}'. Klopt de seed nog met het plan?")
        # Liefst een opmerking die nog niet in de selectie zit, voor meer variatie in de invoer.
        nieuw = [b for b in kandidaten if b["opmerking"] not in gebruikte_opmerkingen]
        bon = rng.choice(nieuw or kandidaten)
        gekozen.add(bon["werfbon_id"])
        gebruikte_opmerkingen.add(bon["opmerking"])
        selectie.append((groep, stratum, len(kandidaten), bon))
    return selectie


# ─────────────────────────────────────────────
# 4. Record opbouwen
# ─────────────────────────────────────────────

def maak_record(groep: str, stratum: str, bon: Dict[str, Any]) -> Dict[str, Any]:
    toestel = None
    if bon["toesteltype"]:
        toestel = {"type": bon["toesteltype"], "merk": bon["merk"], "model": bon["model"]}
    return {
        "werfbon_id": bon["werfbon_id"],
        "type": bon["type"],
        "groep": groep,
        "stratum": stratum,
        "bron": "database",
        "context": {
            "type": bon["type"],
            "omschrijving": bon["omschrijving"],
            "toestel": toestel,
        },
        "gold": {
            "uren": bon["uren"],
            "km": bon["km"],
            "lijnen": bon["lijnen"],
            "opmerking": bon["opmerking"],
        },
    }


# ─────────────────────────────────────────────
# 5. Controle op persoonsgegevens (ook bruikbaar voor cases.jsonl in stap 2)
# ─────────────────────────────────────────────

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# 9 tot 12 cijfers, eventueel met +32/0032 en spaties, punten, schuine strepen of streepjes ertussen.
TELEFOON = re.compile(r"(?<!\w)(?:\+|00)?\d(?:[ ./-]?\d){8,11}(?!\w)")


def naampatroon(namen: List[str]) -> Optional[Pattern[str]]:
    termen = sorted({n.strip() for n in namen if n and n.strip()}, key=len, reverse=True)
    if not termen:
        return None
    return re.compile(r"(?<!\w)(?:" + "|".join(re.escape(t) for t in termen) + r")(?!\w)", re.IGNORECASE)


def teksten(obj: Any, pad: str = "") -> Iterator[Tuple[str, str]]:
    """Alle strings in een record, met hun pad (bv. gold.opmerking)."""
    if isinstance(obj, str):
        yield pad, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from teksten(v, f"{pad}.{k}" if pad else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from teksten(v, f"{pad}[{i}]")


def zoek_persoonsgegevens(record: Dict[str, Any], namen: Optional[Pattern[str]]) -> List[Tuple[str, str, str]]:
    """Geeft (pad, soort, treffer) terug. Filtert niets weg: de beslissing ligt bij jou."""
    treffers = []
    for pad, tekst in teksten(record):
        for soort, patroon in (("e-mail", EMAIL), ("telefoon", TELEFOON), ("naam", namen)):
            if patroon is None:
                continue
            for m in patroon.finditer(tekst):
                treffers.append((pad, soort, m.group(0)))
    return treffers


# ─────────────────────────────────────────────
# 6. Wegschrijven
# ─────────────────────────────────────────────

def schrijf(records: List[Dict[str, Any]], uit: Path) -> None:
    uit.parent.mkdir(parents=True, exist_ok=True)
    tijdelijk = uit.with_suffix(uit.suffix + ".tmp")
    with tijdelijk.open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    os.replace(tijdelijk, uit)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--uit", type=Path, default=STANDAARD_UIT, help="doelbestand (standaard eval/data/gold.jsonl)")
    parser.add_argument("--overschrijf", action="store_true", help="een bestaande, bevroren gold.jsonl vervangen")
    parser.add_argument("--seed", type=int, default=SEED, help="seed voor de selectie binnen elk stratum")
    args = parser.parse_args()

    if args.uit.exists() and not args.overschrijf:
        raise SystemExit(f"{args.uit} bestaat al en is bevroren. Gebruik --overschrijf om hem te vervangen.")

    load_dotenv(REPO / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL ontbreekt. Zet hem in .env (zie .env.example).")

    with verbind(url) as conn:
        with conn.transaction():
            controleer_read_only(conn)
            bonnen = haal_bonnen(conn)
            namen = naampatroon(haal_namen(conn))

    selectie = selecteer(bonnen, args.seed)
    records = [maak_record(groep, stratum, bon) for groep, stratum, _, bon in selectie]

    alle_treffers = [(r["werfbon_id"], *t) for r in records for t in zoek_persoonsgegevens(r, namen)]
    if alle_treffers:
        print("Mogelijke persoonsgegevens gevonden. Er is niets weggeschreven:", file=sys.stderr)
        for werfbon_id, pad, soort, treffer in alle_treffers:
            print(f"  werfbon {werfbon_id}  {pad}  {soort}: {treffer!r}", file=sys.stderr)
        raise SystemExit(1)

    schrijf(records, args.uit)

    met_extra = sum(1 for b in bonnen if b["type"] == "onderhoud" and b["onderdelen"])
    print(f"{len(records)} bonnen weggeschreven naar {args.uit.relative_to(REPO) if args.uit.is_relative_to(REPO) else args.uit}")
    print(f"Kandidaten: {len(bonnen)} bonnen, waarvan {met_extra} onderhoudsbonnen met een extra onderdeel.\n")
    for groep, stratum, n, bon in selectie:
        print(f"  {groep:<12} {stratum:<32} werfbon {bon['werfbon_id']:>5}  (uit {n})")


if __name__ == "__main__":
    main()
