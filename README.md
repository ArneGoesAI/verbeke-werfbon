# verbeke-werfbon

Een evaluatie die beslist welk AI-model werfbonnen omzet in facturen: het goedkope en snelle Claude Haiku 5.5, of het
sterkere Claude Sonnet 5.5. Het bedrijf is fictief, de aanpak is die van een echt project.

## Het probleem

Een technieker van "Verbeke Installatietechniek" (warmtepompen, ventilatie, sanitair) sluit een interventie af door een
werfbon in te spreken in de auto of een papieren bon te fotograferen. De app moet daaruit halen hoeveel uur er gewerkt
is, hoeveel km er gereden is en welk materiaal er geplaatst is, met de juiste artikelcode uit de catalogus. Daar komt
de factuur uit.

Een fout kost hier echt geld. Een vergeten onderdeel betekent omzet die verloren gaat. Een **verzonnen onderdeel** is
erger: de klant krijgt een factuur voor iets wat nooit geplaatst is. De vraag is dus niet "welk model is het slimst",
maar "welk model is goed genoeg, en wat kost het".

## De aanpak

1. **Ground truth uit de database.** 20 bonnen, gestratificeerd gekozen over alle soorten herstelling en onderhoud,
   plus 4 lastige randgevallen: een technieker die zich verbetert ("twee uur… nee, anderhalf"), een aantal hoger dan
   1, een onderdeel dat niet in de catalogus staat, en een bon zonder km. Zonder persoonsgegevens, read-only gelezen
   en daarna bevroren.
2. **Realistische invoer.** Voor elke bon een ingesproken tekst in Vlaamse spreektaal ("de pomp", "dat vat", "een
   kwartierke") en een afbeelding van een ingevulde papieren bon. Automatische controles weigeren teksten die het
   antwoord verklappen, zoals een artikelcode of een exact cijfer.
3. **Het model doet alleen wat een model moet doen.** Het geeft uren, km, onderdelen en een opmerking terug, via
   structured output met de catalogus als vaste lijst. Arbeid, verplaatsing en het onderhoudsforfait rekent gewone
   code zelf uit. Zo kan het model die lijnen niet fout hebben.
4. **Eén hoofdscore: is de factuur juist?** Uren en alle factuurlijnen met hun aantallen moeten exact kloppen. Een
   model dat zegt "dit onderdeel ken ik niet" (`onbekend`) telt als **onzeker**, niet als fout: dan kijkt een mens het
   na, en er gaat geen foute factuur de deur uit.
5. **De beslisregel lag vast vóór de run.** Haiku mag het spraakpad overnemen als het hoogstens 1 geval meer fout
   heeft dan Sonnet, nooit een onderdeel verzint (ook niet in één van de herhalingen), het onbekende onderdeel altijd
   herkent, en gemiddeld geen grotere fout in euro maakt.
6. **Elke bon loopt 3 keer**, om te zien of het model stabiel antwoordt. Dat geeft 360 calls voor de drie
   configuraties hieronder.

## Resultaten

Spraakpad, 20 bonnen × 3 herhalingen per configuratie. De run staat in `eval/results/2026-11-11-vergelijking/`.

| Configuratie | Factuur juist | Onzeker | Fout | Verzonnen onderdelen | Fout € per herstelbon | Kost per bon | Beslisregel |
|---|---|---|---|---|---|---|---|
| Sonnet 5.5, effort low (referentie) | 88% | 10% | 2% | 0 | € 44,09 | $0,0063 | – |
| Haiku 5.5, effort low | 93% | 0% | 7% | **4** | € 46,79 | $0,0002 | niet gehaald |
| **Haiku 5.5, effort medium** | **97%** | 3% | 0% | **0** | € 14,70 | $0,0003 | **gehaald** |

Op het fotopad zijn alle drie de configuraties 100% juist.

## De beslissing

**Haiku 5.5 op effort medium is de kandidaat voor het spraakpad**, te bevestigen met echte bonnen.

- Haiku op effort low valt af: het verzon in 4 van de 60 runs een onderdeel. Bij een factuur is dat de fout die je
  niet wilt.
- De kost is bij dit volume geen argument: ongeveer $1,50 per maand voor Sonnet tegenover $0,07 voor Haiku. Haiku
  wint op kwaliteit, niet op prijs.
- De run vond ook een productierisico: één Sonnet-run bleef zijn opmerking doorschrijven tot 16.000 tokens. Daarom
  staat `max_tokens` nu op 2000 en vraagt de prompt een opmerking van hoogstens twee zinnen.

## Beperkingen

- **20 gevallen tonen alleen grote verschillen.** Dat volstaat om een model uit te sluiten of verder te testen, niet
  om een klein verschil te bewijzen.
- **De testteksten zijn synthetisch.** Claude Opus 5.5 schreef ze, en een model uit dezelfde familie las ze na. Echt
  dialect, lawaai in de auto en slordig handschrift zitten er niet in. De gerenderde bonnen zijn geen
  echt handschrift. De score is daardoor eerder te optimistisch.
- **De testdata is regelmatiger dan de praktijk.** In één geval (c01) hoort het onderdeel niet bij het toestel. Daar
  is "onbekend" een verdedigbaar antwoord, en dat geval verklaart bijna het hele verschil in euro tussen Sonnet en
  Haiku medium.
- **Volgende stap:** een tiental echte bonnen, zelf ingesproken en met de hand ingevuld, die we één voor één
  bekijken, en dezelfde eval opnieuw in de EU-regio die in productie gebruikt wordt.

## Van eval naar app

De gekozen configuratie draait nu ook in de app ([`web/`](web/), Next.js). Een spraakopname gaat eerst door Voxtral
(Mistral) naar tekst, een foto gaat rechtstreeks naar Claude. Daarna volgt Haiku 5.5 op effort medium, met exact
dezelfde prompt en hetzelfde schema als de eval. Die exporteert Python naar de app, zodat ze niet uit elkaar kunnen
groeien. Een testscript stuurt de gevallen uit de eval door de kern van de app, en `score.py` scoort het resultaat
zoals een gewone eval-run.

De app heeft twee kanten. De technieker ziet zijn interventies van vandaag, spreekt een bon in of fotografeert de
papieren bon, en krijgt een voorstel te zien: elke lijn met het citaat waar ze vandaan komt, of het label
"Automatisch". Een onderdeel dat het model niet kent, wordt een geel vak dat eerst opgelost moet zijn. Na
"Bevestigen" maakt de database een conceptfactuur. De administratie ziet die conceptfacturen met hun bedragen,
waarschuwingen (niet getekend, onderdeel bij onderhoud, …) en de opname of foto, en keurt ze goed. De technieker ziet
nooit prijzen; wat iemand ziet, bepaalt row level security in Supabase. De app draait nog niet online.

## Meer weten

- Het volledige plan, met alle beslissingen en de redenen erachter: [`docs/eval-plan.md`](docs/eval-plan.md)
- De code: [`eval/`](eval/), in Python 3.9. Hoe je ze draait, staat in [`CLAUDE.md`](CLAUDE.md).
