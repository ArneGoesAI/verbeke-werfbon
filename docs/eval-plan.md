# Evalplan: werfbon-extractie (laag b)

Dit plan beschrijft de eval voor laag b uit `docs/plan-werfbon-app.md` in `ArneGoesAI/verbeke-data`: we halen een
gestructureerde werfbon uit een inspreektekst of een foto, scoren die tegen de database, en vergelijken Claude Haiku 5.5
met Claude Sonnet 5.5 op kwaliteit en kost. De eval is in Python geschreven. We beginnen klein, met 20 testgevallen.

Status: stap 1 tot 4 van §8 zijn klaar; Haiku `medium` is kandidaat voor het spraakpad. Volgende stap: de echte bonnen.

## Beslissingen

1. **Afgeleide lijnen.** Het model geeft alleen `uren`, `km`, `onderdelen[]` (code en aantal, met een bronzin) en
   `opmerking` terug. Code leidt `ARB-TECH` (aantal = uren), `VERPL` (bij herstelling) en het onderhoudsforfait af uit
   het type interventie en het toestel. De score vergelijkt de volledige lijnenset, met de afgeleide lijnen erbij, met
   `werfbon_lijnen`.
2. **Hoofdscore: factuur juist.** Uren en de volledige lijnenset met aantallen zijn exact gelijk. Km telt niet mee in
   de hoofdscore en wordt apart gerapporteerd, omdat km nooit gefactureerd wordt.
3. **Fout in euro alleen voor herstellingen.** Bij onderhoud bepaalt de jaarprijs van het contract de factuur, dus een
   fout in euro zegt daar niets. Onderhoud wordt apart gerapporteerd (zie §3).
4. **Geen persoonsgegevens in `gold.jsonl`.** Geen namen, telefoonnummers of e-mailadressen, ook al is de seed fictief.
   Zie §1.
5. **Haiku 5.5 op effort `medium` is kandidaat voor het spraakpad** (11 november 2026). Het haalt de beslisregel uit
   §4 in de volledige vergelijking (`eval/results/2026-11-11-vergelijking`); Haiku op `low` haalt hem niet. Het
   model wordt pas vastgelegd na de echte bonnen (§6, §8 stap 5). De kost is bij dit volume geen argument: ongeveer
   $1,50 per maand voor Sonnet tegenover $0,07 voor Haiku.
6. **`max_tokens` 2000 en een korte opmerking** (11 november 2026). In de vergelijking bleef één Sonnet-run zijn
   opmerking doorschrijven tot 16.000 tokens. Het schema kan geen lengte opleggen, dus vraagt de prompt nu hoogstens
   twee zinnen in de woorden van de technieker, en stopt `max_tokens` 2000 een run die toch doorloopt. De hoogste
   normale output in de vergelijking was 953 tokens.

## Vaststelling die het ontwerp stuurt

De seed in `verbeke-data` is erg regelmatig:

- Een herstelbon bestaat altijd uit `ARB-TECH` = uren, plus `VERPL` 1, plus hoogstens één onderdeel.
- De opmerking komt uit een lijst van 7 vaste zinnen, en elke zin hoort bij precies één onderdeel.
- Een onderhoudsbon is altijd één forfait, plus soms `VENT-FILT`, `OND-PRES` of `OND-SENS`.
- Er komen nooit aantallen boven 1 voor, behalve bij de uren.

Als we de opmerkingen gewoon aan het model geven, meten we dus bijna niets. De moeilijkheid moet uit de **invoer**
komen (spreektaal, omschrijvingen in volkstaal, handschrift), niet uit de bon zelf.

## 1. Ground truth ophalen

- **Eén SQL-query, eenmalig uitgevoerd.** We nemen `werfbonnen` met `interventies.type in ('herstelling','onderhoud')`,
  met daarbij:
  - `werfbon_lijnen` met `artikelen.code`
  - de context die de app ook zal hebben: het type interventie, `interventies.omschrijving` (met merk en model van het
    toestel) en bij onderhoud het contracttype (`warmtepomp`, `ventilatie`, `zonneboiler`)
- **Bevriezen als `eval/data/gold.jsonl`**, één record per bon:
  `werfbon_id`, `type`, `context{…}`, `gold{uren, km, lijnen:[{code, aantal}], opmerking}`. De eval leest daarna nooit
  meer uit de live database. Zo blijft hij reproduceerbaar, ook als de seed opnieuw gegenereerd wordt.
- **Geen persoonsgegevens:**
  - De query selecteert expliciet de nodige kolommen en joint niet met `klanten` of `medewerkers`. Klanten en
    techniekers komen er alleen als id in voor, of helemaal niet als ze niet nodig zijn.
  - Vrije tekst (`opmerkingen`, `omschrijving`) kan toch een naam of nummer bevatten. Daarom controleert het
    exportscript elke tekst vóór het wegschrijven:
    - regex op e-mailadressen en telefoonnummers
    - vergelijking met alle voor- en achternamen en bedrijfsnamen uit `klanten` en `medewerkers`, alleen in het geheugen
  - Bij een treffer stopt de export met een foutmelding. Er wordt niets automatisch weggefilterd, zodat je het geval
    zelf bekijkt.
  - Dezelfde regel geldt voor de gegenereerde inspreekteksten in `cases.jsonl` (§2): de generator krijgt de opdracht
    geen namen of nummers te gebruiken, en dezelfde controle draait opnieuw na het genereren.
- **Onderhoudsbonnen met een extra onderdeel** (de 123 bonnen van het lek): het onderdeel hoort in de gold. Het model
  moet het eruit halen. Of het aangerekend wordt, beslist SQL in laag c.

## 2. De 20 testgevallen

**Selectie.** De gevallen worden gestratificeerd gekozen, niet willekeurig:

| Groep | Aantal | Doel |
|---|---|---|
| Herstelling, rechtstreeks uit de database | 8 | Alle 6 onderdelen (`OND-PCB`, `OND-VENTIEL`, `OND-POMP`, `SAN-BUIS`, `OND-SENS`, `OND-PRES`) plus 2 keer "reset, geen onderdelen" |
| Onderhoud, rechtstreeks uit de database | 8 | Warmtepomp, ventilatie en zonneboiler, waarvan 4 met een extra onderdeel |
| Randgevallen, gebaseerd op een bon uit de database met aangepaste gold | 4 | Een correctie tijdens het spreken ("twee uur… nee, anderhalf"), een aantal hoger dan 1 ("twee kilo koelmiddel"), een onderdeel dat niet in de catalogus staat (moet als `onbekend` gemarkeerd worden en niet als een gegokte code), en een bon zonder km |

De randgevallen krijgen `bron: "aangepast"`. Zo blijft de score op de zuivere databasegevallen apart zichtbaar.

**Elk geval krijgt twee invoeren**, dus 40 invoeren per configuratie:

- **Inspreektekst.**
  - Eenmalig gegenereerd door Claude Opus 5.5 uit de gold plus de context, met vaste stijlregels:
    - Vlaamse spreektaal en tussentaal, met getallen voluit ("anderhalf", "een kwartierke")
    - onderdelen in volkstaal ("de pomp", "dat vat", "de klep"), nooit artikelcodes
    - soms wat ruis ("euh", iets over de klant)
    - geen namen, telefoonnummers of e-mailadressen
  - Daarna lees jij de 20 teksten na en worden ze bevroren in `eval/data/cases.jsonl`.
- **Ingevulde bon.**
  - Een afbeelding van het papieren bonformulier, gerenderd met PIL: velden voor uren, km, materiaal en opmerking, in
    een handschriftlettertype, licht gedraaid en met wat ruis.
  - Het materiaal staat er als vrije tekst, soms met een code ("pomp vervangen", "OND-PRES").
  - Dit test de lay-out en het lezen, niet echt handschrift.

**Audio en Voxtral blijven buiten deze eerste ronde.** De synthetische set test de stap van tekst naar bon. De ongeveer
tien echte bonnen (zelf ingesproken en met de hand ingevuld) testen later de hele keten van audio over Voxtral naar bon.
Ze volgen hetzelfde formaat in `cases.jsonl`, met `deel: "echt"`.

## 3. Scores

Alle scores zijn deterministisch. Een LLM als beoordelaar is nog niet nodig.

**Voor alle bonnen**

| Score | Definitie | Waarom |
|---|---|---|
| **Factuur juist** (hoofdscore) | Uren exact juist, en de volledige lijnenset (met de afgeleide lijnen) is exact gelijk aan `werfbon_lijnen`, met aantallen | Dat bepaalt of de technieker iets moet corrigeren voor de factuur |
| Onzeker en fout | Een factuur die niet juist is, is **onzeker** als het enige verschil is dat het model `onbekend` gaf waar de gold een catalogus-code heeft. Al de rest is **fout**: een verkeerde code, een verzonnen onderdeel, verkeerde uren, ongeldige output | Beide vragen een correctie, maar onzeker is voorzichtig (er wordt iets nagevraagd) en fout geeft een verkeerde factuur |
| Uren juist | Exact, zonder tolerantie | Arbeid is het grootste deel van een herstelfactuur |
| Onderdelen: precisie en recall | Over de artikelcodes van de onderdelen | Een gemist onderdeel is gemiste omzet, een verzonnen onderdeel geeft een klacht |
| Aantal juist | Per gevonden code | |
| Onbekend juist gemarkeerd | Alleen bij het randgeval | Het model mag geen code gokken |
| Bron klopt | Elke bronzin komt letterlijk (na normalisatie) voor in de inspreektekst, of bij een eigen opname in het transcript | De app toont die zin naast elke lijn |
| Geldige output | De JSON past in het schema en de codes komen uit de enum | Met structured output zou dit 100% moeten zijn. Een geval waar dat niet zo is, is een bug |

**Apart gerapporteerd**

| Score | Voor | Definitie |
|---|---|---|
| Km juist | Alle bonnen | Exact. Telt niet mee in de hoofdscore, want km wordt nooit gefactureerd |
| **Fout in euro** | Alleen herstellingen | \|Σ aantal × verkoopprijs (model) − Σ aantal × verkoopprijs (gold)\| per bon, plus de som over de set |
| Onderhoud: extra onderdeel gevonden | Alleen onderhoud | Recall en precisie op de onderdelen naast het forfait. Dat is de bron van het lek, en laag c moet beslissen of die onderdelen aangerekend worden |

De opmerking scoren we in deze ronde niet. We bekijken ze alleen.

Elke score wordt apart getoond per type (herstelling en onderhoud), per invoerweg (spraak en foto) en per bron
(database en aangepast).

## 4. Haiku 5.5 tegenover Sonnet 5.5

**Opzet**

- Dezelfde prompt, hetzelfde JSON-schema (`output_config.format`, met artikelcodes als enum) en dezelfde context.
- Alleen het model en de effort verschillen:
  - Sonnet 5.5 op effort `low`, zoals in het appplan
  - Haiku 5.5 op `low` en op `medium` (`medium` is daar de standaard)
- Elk geval loopt 3 keer, om te zien of het model stabiel is. Een temperatuur instellen kan niet meer.
- Het aantal calls is 20 × 2 invoerwegen × 3 herhalingen per configuratie: 120 calls voor Sonnet en 240 voor Haiku.

**Kost meten**

- Per call `response.usage` (input- en outputtokens) en de latency opslaan.
- Rapporteren per configuratie en per invoerweg:
  - de kost per bon
  - de **kost per juiste factuur** (kost gedeeld door het aandeel "factuur juist")
  - de p50- en p95-latency
- Prijzen van de Anthropic API: Sonnet 5.5 $2 / $10 en Haiku 5.5 $0,10 / $0,50 per miljoen tokens. Het script zet ze in
  één tabel, zodat je ze makkelijk vervangt door die van de gekozen cloudprovider.

**Geschatte kost van een volledige run**: ongeveer € 3 voor Sonnet, ongeveer € 0,30 voor Haiku, en ongeveer € 1
eenmalig voor het genereren van de teksten met Opus.

**Rapport** in `eval/results/<datum>/`:

- de ruwe `runs.jsonl`
- een `summary.md` met een tabel per model, effort, type en invoerweg
- een **lijst met verschillen**: de gevallen waar Haiku en Sonnet een ander antwoord geven, naast elkaar, om één voor
  één te bekijken

**Beslisregel, vooraf vastgelegd.** Haiku mag het spraakpad overnemen als:

- het hoogstens 1 geval meer **fout** heeft dan Sonnet. Per geval telt de meerderheid van de herhalingen: een geval
  is juist als meer dan de helft van de herhalingen juist is, en anders fout of onzeker, naargelang wat vaker
  voorkomt. Onzekere gevallen tellen niet mee voor deze regel, maar worden apart getoond
- het geen enkel verzonnen onderdeel heeft, **over alle herhalingen**: één verzonnen onderdeel in één herhaling is
  genoeg om te falen. Een verzonnen onderdeel geeft een klacht, ook als het maar af en toe gebeurt. `onbekend` voor
  een onderdeel dat wel gebruikt is, telt niet als verzonnen; `onbekend` zonder gemist onderdeel wel
- het randgeval met het onbekende onderdeel in elke herhaling juist is
- de fout in euro op de herstellingen gemiddeld niet hoger is dan bij Sonnet

Bij 20 gevallen zie je alleen grote verschillen. Dat is goed genoeg om Haiku uit te sluiten of verder te testen, niet
om een klein verschil te bewijzen. Bij twijfel breiden we de set uit, en het script werkt op elk aantal gevallen.

**Uitkomst van de vergelijking** (11 november 2026, `eval/results/2026-11-11-vergelijking`, 360 calls, ongeveer
$0,95):

- **Haiku `medium` haalt de regel.** 0 gevallen fout (Sonnet ook 0), geen verzonnen onderdeel in 60 runs, het
  randgeval 3/3 juist, en een gemiddelde fout van € 14,70 op de herstellingen tegenover € 44,09 bij Sonnet.
- **Haiku `low` haalt hem niet.** 4 verzonnen onderdelen in 60 runs (c01 en c20), en een fout van € 46,79.
- **Het verschil in euro zegt weinig.** Het komt bijna helemaal van c01, het geval met het testdata-probleem (§6):
  Sonnet antwoordt daar telkens `onbekend`, wat verdedigbaar is maar als ontbrekend bedrag telt.
- **Beslissing:** Haiku `medium` is kandidaat voor het spraakpad, te bevestigen met de echte bonnen (zie Beslissingen,
  punt 5). Deze run liep nog met `max_tokens` 16000 en de oude vraag naar de opmerking (punt 6); een volgende run komt
  in een nieuwe map.

## 5. Provider en regio

Volgens het appplan moet de eval draaien op de provider en regio die in productie gebruikt worden, en die zijn nog niet
gekozen. Daarom:

- komt er één functie die de client maakt: Anthropic API, Amazon Bedrock of Google Vertex AI
- draaien we nu op de Anthropic API, wat kan omdat de data fictief is
- draaien we dezelfde eval opnieuw zodra de EU-regio gekozen is

Die tweede run controleert meteen of Haiku 5.5, Sonnet 5.5 en structured output daar beschikbaar zijn.

## 6. Beperkingen

- **De testteksten komen uit dezelfde modelfamilie.** Opus 5.5 schrijft de inspreekteksten, en Haiku en Sonnet zijn
  Claude-modellen uit dezelfde familie. Teksten in een stijl die de modellen zelf zouden schrijven, zijn voor hen
  waarschijnlijk makkelijker dan wat een technieker echt zegt. De synthetische score is daardoor eerder te optimistisch.
- **De echte toets zijn de nalezing en de echte bonnen.** De nalezing van de 20 teksten moet nagaan of ze klinken als
  een technieker en niet als een model. De ongeveer tien echte bonnen (zelf ingesproken in het Vlaams en met de hand
  ingevuld en gefotografeerd) zijn de enige test van echt dialect, achtergrondlawaai, echt handschrift en slechte
  foto's. Een model wordt pas vastgelegd na die echte bonnen, en die bekijken we één voor één, niet als percentage.
- **De inspreekteksten zijn nagelezen door Claude Code, niet door een mens.** In `cases.jsonl` staat daarom
  `nagelezen_door: "claude-code"` bij alle 20. Een model las dus de teksten van een ander model uit dezelfde familie,
  en dat versterkt de eerste beperking: wat voor een model natuurlijk klinkt, valt bij die nalezing minder op. De
  nalezing ving wel inhoudelijke fouten op (een verzonnen oorzaak, een dubbelzinnig aantal km, een samenvatting die het
  antwoord verklapte). Of de teksten klinken als een Vlaamse technieker, moet nog door een mens beoordeeld worden.
- **De gerenderde bonnen zijn geen handschrift.** Ze testen de lay-out en het lezen van een formulier, niet het
  ontcijferen van slordig schrift.
- **De seed is regelmatig.** Er zijn maar 7 soorten herstelling en 3 soorten onderhoud, dus de 20 gevallen dekken de
  variatie van de seed, niet die van de praktijk.
- **De opmerking past niet altijd bij de melding.** De seed kiest de opmerking van een herstelling los van de melding
  en het toestel. Zo heeft c01 (werfbon 814) een printplaat van een binnenunit bij een storing aan een ventilatie
  (Zehnder ComfoAir). De gold klopt met de database, maar zo'n combinatie komt in de praktijk niet voor. Een model dat
  het onderdeel uit de context afleidt in plaats van uit wat de technieker zegt, kan daar fout gaan, of net juist
  uitkomen om de verkeerde reden. Zulke gevallen bekijken we apart in de lijst met verschillen.
- **20 gevallen** tonen alleen grote verschillen tussen modellen (zie de beslisregel).

## 7. Structuur in de repo

```
eval/
  data/gold.jsonl         # bevroren uit de database, zonder persoonsgegevens
  data/cases.jsonl        # inspreektekst + pad naar de afbeelding + gold, per geval
  data/bonnen/*.png       # gerenderde bonformulieren
  prompts/extractie.md    # systeemprompt + catalogus
  schema.py               # Pydantic-model van de bon (= JSON-schema voor structured output)
  afgeleide_lijnen.py     # ARB-TECH, VERPL en forfait uit type, toestel en uren
  export_gold.py          # stap 1, met de controle op persoonsgegevens
  maak_cases.py           # stap 2 (Opus + PIL)
  run_eval.py             # stap 4: --model --effort --pad spraak|foto --herhaal 3
  score.py                # stap 3
  results/
```

## 8. Volgorde

1. `export_gold.py` schrijven en de 20 bonnen selecteren
2. De teksten en afbeeldingen genereren, die jij dan naleest
3. `afgeleide_lijnen.py`, `run_eval.py` en `score.py` schrijven
4. Eerst 1 run met Sonnet als controle, daarna de volledige vergelijking
5. De ongeveer tien echte bonnen toevoegen en één voor één bekijken
