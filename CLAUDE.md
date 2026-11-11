# CLAUDE.md

Richtlijnen voor Claude Code in deze repository.

## Wat dit is

De eval voor laag b van de werfbon-app van "Verbeke Installatietechniek", een fictief installatiebedrijf. Het model
haalt een gestructureerde werfbon uit een inspreektekst of een foto van een bon. De eval vergelijkt Claude Haiku 5.5
met Claude Sonnet 5.5 op kwaliteit en kost. Het volledige plan staat in `docs/eval-plan.md`; houd dat plan bij als
een beslissing verandert. De data komt uit de gedeelde database van `ArneGoesAI/verbeke-data`; het appplan staat daar
in `docs/plan-werfbon-app.md`.

Code, commentaar, bestandsnamen, documentatie en commitberichten zijn in het Nederlands. Houd dat zo.

## Commando's

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # Python 3.9, versies vastgepind

.venv/bin/python -m unittest discover -s eval/tests -v               # unit tests (afgeleide lijnen)
.venv/bin/python eval/score.py --zelftest                            # gold als modeloutput: moet overal 100% geven

.venv/bin/python eval/export_gold.py            # stap 1: gold uit de database (eenmalig, read-only)
.venv/bin/python eval/maak_cases.py             # stap 2: testgevallen; --opnieuw <werfbon_id> of --alles
.venv/bin/python eval/run_eval.py --model sonnet --effort low --pad beide --herhaal 3 --uit eval/results/<map>
.venv/bin/python eval/run_eval.py ... --droog   # toont het verzoek zonder API-call
.venv/bin/python eval/score.py --resultaten eval/results/<map>
```

Draai de unit tests en de zelftest na elke wijziging aan `afgeleide_lijnen.py`, `schema.py` of `score.py`.

## Architectuur

Datastroom: database → `eval/data/gold.jsonl` → `eval/data/cases.jsonl` + `eval/data/bonnen/*.png` →
`eval/results/<map>/runs.jsonl` → `summary.md`, `verschillen.md`.

- **`gold.jsonl` is bevroren.** `export_gold.py` overschrijft het alleen met `--overschrijf`. De eval leest nooit uit
  de live database. De catalogus is ook bevroren, in `eval/data/artikelen.json`.
- **De scoring leest alleen `cases.jsonl`**, nooit `gold.jsonl`. Elk geval bevat context, gold (met de aangepaste
  gold van de randgevallen, `bron: "aangepast"`), de invoer en `nagelezen_door`.
- **Afgeleide lijnen** (`afgeleide_lijnen.py`): het model geeft alleen uren, km, onderdelen en een opmerking terug.
  De code voegt `ARB-TECH` (= uren) en `VERPL` toe bij een herstelling, en het forfait volgens het toestel bij
  onderhoud. "Factuur juist" vergelijkt de volledige lijnenset.
- **Schema** (`schema.py`): één Pydantic-model voor zowel het JSON-schema van structured output als de validatie.
  De codes zijn een enum zonder arbeid en verplaatsing, plus `onbekend`. Gebruik geen `minimum`, `maxLength` en
  dergelijke: die ondersteunt structured output niet.
- **Testgevallen** (`maak_cases.py`): Opus 5.5 schrijft de inspreekteksten. Elk geval krijgt een vaste stijlkaart
  (opening, lengte, ruis), en elke tekst gaat door automatische controles: geen artikelcodes of vaktermen van
  onderdelen, geen cijfers, geen persoonsgegevens, geen verwijzing naar de bon. Opus krijgt nooit catalogusnamen
  te zien, alleen een generieke omschrijving (`GENERIEKE_NAMEN`). Hoogstens één bon in de set toont een artikelcode.
- **Nalezen**: een nieuwe of opnieuw gegenereerde tekst krijgt `nagelezen_door: null`. `run_eval.py` weigert zulke
  gevallen. Zet het veld pas na het nalezen (bv. `"claude-code"`), en zeg erbij wie las: §6 van het plan maakt
  het verschil tussen een mens en een model.
- **Run** (`run_eval.py`): geen refusal-fallback, met opzet: een fallback zou een ander model meten. Een onderbroken
  run hervat; API-fouten worden bij de volgende run opnieuw geprobeerd.
- **Resultaten**: elke run in een eigen map onder `eval/results/` (bv. `2026-11-11-controle`). Meng geen runs op
  verschillende versies van `cases.jsonl` in dezelfde map.

## Kosten en API-calls

Elke call naar de Anthropic API kost geld. Doe geen calls (`maak_cases.py` zonder bestaande teksten, `run_eval.py`
zonder `--droog`) zonder dat de gebruiker erom vraagt, en vermeld daarna de kost. `run_eval.py --droog` en
`score.py --zelftest` zijn gratis.

## Data-veiligheid

- Alle data is fictief, maar er komen nooit namen, telefoonnummers of e-mailadressen in de testdata. De controles in
  `export_gold.py` en `maak_cases.py` stoppen bij een treffer; filter niets stil weg.
- De databaseverbinding is altijd read-only (`default_transaction_read_only = on`).
- `.env` bevat `ANTHROPIC_API_KEY` en `DATABASE_URL`. Lees het niet en commit het nooit.

## Werkwijze

- Wijzigingen gaan via een branch en een pull request naar `main`, nooit rechtstreeks op `main`.
- Controleer voor elke commit dat `.env` niet gestaged is.
