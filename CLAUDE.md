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
.venv/bin/python eval/exporteer_voor_app.py     # prompt, schema en catalogus naar web/ (na elke wijziging eraan)

npm --prefix web install                        # Node ≥ 20, versies vastgepind
npm --prefix web test                           # vitest: kern van de verwerking (gratis)
npm --prefix web run typecheck
npm --prefix web run test:gevallen -- --droog   # testgevallen door de kern, zonder API-call
npm --prefix web run testaccounts               # twee testaccounts op live (schrijft); wachtwoorden in .env.testaccounts
npm --prefix web run test:logins                # beide accounts aanmelden en RLS nakijken (alleen lezen)
npm --prefix web run test:schermen              # queries van T1/T2 met de technieker (alleen lezen)
npm --prefix web run test:flow -- --stap concept # foto → route → conceptbon (kost geld, schrijft op live)
npm --prefix web run test:flow -- --stap bevestig --bon <id>   # bevestigen + factuur nakijken (schrijft)
npm --prefix web run test:administratie         # A1: conceptfacturen, bedragen, opname als administratie (alleen lezen)
npm --prefix web run test:administratie -- --goedkeuren <factuur_id>   # goedkeuren + nakijken (schrijft)
npm --prefix web run opruimen                   # app-data op live tonen (droog); -- --echt [--ook-accounts] verwijdert
npm --prefix web run dev                        # app op localhost:3000
npm --prefix web run test:gevallen -- --invoer tekst,foto --uit ../eval/results/<map>   # kost geld
```

Draai de unit tests en de zelftest na elke wijziging aan `afgeleide_lijnen.py`, `schema.py` of `score.py`. Na een
wijziging aan `schema.py`, `prompts/extractie.md`, `artikelen.json` of het verzoek in `run_eval.py`: ook
`exporteer_voor_app.py` draaien; `test_export_app.py` faalt anders.

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

## De app (`web/`)

Next.js (App Router, TypeScript), later op Vercel in `fra1`. Stap 8 van `verbeke-data/docs/plan-stap-8.md`. Deel 2
(de kern van de verwerking in `web/lib/verwerking/`) en deel 3 (inloggen, schermen T1–T4 en A1, route) zijn gebouwd.

- **Flow** (`verwerk.ts`): audio → Voxtral (`voxtral-mini-transcribe-3`, taal `nl`) → tekst; een foto gaat
  rechtstreeks naar Claude. Dan Haiku 5.5 op effort `medium` met hetzelfde verzoek als de eval → validatie →
  afgeleide lijnen. Onderdelen met code `onbekend` komen apart terug: ze kunnen geen werfbonlijn worden.
- **Eén bron:** Python. `web/lib/verwerking/gegenereerd/` komt uit `eval/exporteer_voor_app.py`; pas het niet met de
  hand aan. `afgeleide-lijnen.ts` is een port van `afgeleide_lijnen.py` en draait dezelfde tests.
- **Validatie** (`valideer.ts`): Ajv op hetzelfde schema, plus uren 0–12, km ≥ 0, aantal > 0. Een fout wordt niet
  gecorrigeerd. Ook hier geen refusal-fallback.
- **Testscript** (`web/scripts/test-gevallen.ts`): schrijft `runs.jsonl` in het formaat van `run_eval.py`, zodat
  `score.py` het scoort. Spraak op tekst (`tekst`) en op eigen opnames (`audio`) in aparte mappen.
  Eigen opnames staan in `eval/data/opnames/` en worden nooit gecommit (een stem is een persoonsgegeven).
- `.env` staat in de repo-root; `next.config.ts` en het testscript laden ze daar.
- **Supabase** (`web/lib/supabase/`): `browser.ts` en `server.ts` werken met de sessie van de gebruiker, dus RLS uit
  migratie 0004 bepaalt wat iemand ziet. `dienst.ts` gebruikt `SUPABASE_SECRET_KEY` en passeert RLS: alleen voor de
  route en, via `dienst-kern.ts`, voor de scripts. `server.ts` en `dienst.ts` importeren `server-only`, zodat de
  build faalt als ze in een clientcomponent belanden.
- **Deel 3 in uitvoering** (plan en stand: `docs/plan-deel-3.md`, houd het bij; ontwerp in `docs/ontwerp/`). Gebouwd: de Supabase-clients.
  Ook al: testaccounts (`technieker@verbeke.test` → medewerker 18, `administratie@verbeke.test` → medewerker 4),
  inloggen (`/login`, `proxy.ts`, doorsturen per rol in `lib/rol.ts` en `lib/sessie.ts`), met tijdelijke pagina's
  `/vandaag` en `/administratie`; huisstijl (`components/`, `lib/opmaak.ts`, `/huisstijl` in ontwikkeling);
  opruimscript. Pakket B (één keer echt getest met `test:flow`): T1 `/vandaag`, T2 `/interventie/[id]`,
  T3 `/interventie/[id]/inspreken`, T4 `/bon/[id]` met server action `bevestig`, route `POST /api/verwerk`
  (logica in `lib/route/`, testbaar met nagemaakte afhankelijkheden). Pakket C: A1 `/administratie` met filter en
  selectie in de URL (`?filter=nakijken`, `?factuur=<id>`), status uit `factuurwaarschuwingen()` (korte labels en
  bedragen in `lib/schermen/waarschuwing.ts`), queries en goedkeuren in `lib/schermen/administratie.ts`, server
  action `keurGoed` met een bevestigingsstap. Goedkeuren zet alleen de status (`keur_factuur_goed`); er gaat geen mail
  weg. Opname of foto via een signed URL van 10 minuten.
- **Prijzen** horen niet in de browser van de technieker: importeer in clientcode nooit `gegenereerd.ts`,
  `valideer.ts` of `verwerk.ts` (die laden de catalogus met prijzen). `MAX_UREN` staat apart in `grenzen.ts`.
- **Opruimen** (`scripts/opruimen.ts`): app-data herkent het aan `werfbonnen.bron` spraak of foto; alles in
  `werfbon_opnames` en de bucket is van de app. Het stopt bij twijfel. Na een test met de app: droog, dan `--echt`.
- `next.config.ts` laadt de root-`.env` met `forceReload`: zonder dat geeft `@next/env` de eerdere lading van `web/`
  (zonder sleutels) uit de cache terug.

## Kosten en API-calls

Elke call naar de Anthropic API kost geld. Doe geen calls (`maak_cases.py` zonder bestaande teksten, `run_eval.py`
zonder `--droog`) zonder dat de gebruiker erom vraagt, en vermeld daarna de kost. `run_eval.py --droog` en
`score.py --zelftest` zijn gratis. `test-gevallen.ts` zonder `--droog` en `test-flow.ts --stap concept` doen wel calls (Claude, en bij
`--invoer audio` ook Voxtral, aan $0,0035 per minuut audio). `npm --prefix web test` en `--droog` zijn gratis.

## Data-veiligheid

- Alle data is fictief, maar er komen nooit namen, telefoonnummers of e-mailadressen in de testdata. De controles in
  `export_gold.py` en `maak_cases.py` stoppen bij een treffer; filter niets stil weg.
- De databaseverbinding is altijd read-only (`default_transaction_read_only = on`).
- `.env` bevat `ANTHROPIC_API_KEY`, `DATABASE_URL`, `MISTRAL_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `SUPABASE_SECRET_KEY`. Lees het niet en commit het nooit. Alleen de twee
  `NEXT_PUBLIC_`-waarden mogen in de browser; de secret key nooit.

## Werkwijze

- Wijzigingen gaan via een branch en een pull request naar `main`, nooit rechtstreeks op `main`.
- Controleer voor elke commit dat `.env` niet gestaged is.
