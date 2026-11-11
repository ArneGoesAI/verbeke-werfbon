# Error analysis: controlerun v2, Sonnet 5.5, effort low

Run: 20 gevallen × 2 invoerwegen × 1 herhaling = 40 calls, ongeveer $0,25. De testdata is aangepast na de eerste
controlerun (`../2026-11-11-controle`):
- **B:** nog maar één bon toont een artikelcode (c04).
- **C:** Opus kreeg bij het genereren geen catalogusnamen meer, alleen een generieke omschrijving.
- **Nalezing:** bij c03, c06 en c14 is die omschrijving uit de tekst gehaald. Er staat nu alleen "de pomp" of "dat
  vat".

**Resultaat:** 38 van de 40 facturen zijn juist. Het fotopad haalt 20/20, het spraakpad 18/20. De twee fouten volgen
hieronder.

## c01-wb814, spraak: `onbekend` in plaats van `OND-PCB`

- **Invoer**
  - Context: "Storing ventilatie: lawaai of werkt niet (Zehnder ComfoAir Q450)".
  - Tekst: "De print van die ventilatie van Zehnder vervangen … Eén nieuwe print erin gestoken".
- **Gold:** `OND-PCB` (Printplaat binnenunit).
- **Model:** `onbekend`, met de omschrijving "Printplaat voor ventilatie-unit Zehnder ComfoAir Q450 (de catalogus heeft
  enkel een printplaat voor een binnenunit, niet voor ventilatie)".
- **Oorzaak: de testdata.** Dit is de beperking uit §6: de seed zet een printplaat van een binnenunit bij een storing
  aan een ventilatie. Het model merkt die tegenstrijdigheid op en gokt niet. Dat volgt het prompt ("weet je niet
  zeker welk artikel het is, gebruik dan onbekend"). Op het fotopad was het wel juist, omdat daar "1x print
  binnenunit" op de bon staat, en dat is letterlijk de catalogusnaam.
- **Kost:** € 485 fout in euro, de prijs van de printplaat die niet aangerekend wordt.

## c14-wb322, spraak: `onbekend` in plaats van `OND-PRES`

- **Invoer**
  - Context: "Jaarlijks onderhoud warmtepomp Daikin".
  - Tekst: "Bij het nakijken zag ik da dat vat bijna leeg stond, dus da heb ik vervangen, één nieuw vat gestoken".
- **Gold:** `OND-PRES` (Expansievat 18 l).
- **Model:** `onbekend`, met de omschrijving "Vat (niet duidelijk welk type: expansievat of buffervat)". In de
  opmerking staat dat het type nagevraagd moet worden.
- **Oorzaak: de testdata, met opzet.** Bij de nalezing heb ik "dat vat dat de druk opvangt" ingekort tot "dat vat",
  om de dubbelzinnigheid tussen expansievat en buffervat te testen. Een vakman leidt uit "bijna leeg" bij een
  onderhoud af dat het om het expansievat gaat: het voordruk is weg, en een buffervat staat niet "leeg". Het model
  doet die afleiding niet en kiest de voorzichtige weg.
- **Prompt:** de regel "gok nooit een code" duwt het model naar `onbekend` zodra er twijfel is. Dat is een bewuste
  afweging. Een gemist onderdeel kost een correctie, een verkeerd onderdeel geeft een klacht.

## Wat dit zegt

1. **De opgekuiste set onderscheidt nu iets.** Het spraakpad zakt naar 90%, het fotopad blijft op 100%.
2. **Het fotopad is nog altijd makkelijk.** Ook zonder code staat de catalogusnaam vaak bijna letterlijk op de bon
   ("print binnenunit", "3-wegklep", "temp. sensor"), en de opmerking op de bon noemt het onderdeel nog eens
   ("expansievat bijna leeg -> vervangen").
3. **Beide fouten zijn veilige fouten.** Het model zegt "onbekend", vraagt in de opmerking om na te kijken en
   verzint geen code. In de praktijk krijgt de technieker of de administratie een vraag, en geen foute factuur.
   De scorer telt dat als "factuur fout", wat volgens de definitie klopt: iemand moet iets corrigeren. Hij maakt
   echter geen onderscheid met een gegokte, foute code.
4. **Bijzonderheid:** in beide outputs eindigt de opmerking op ".}". Dat is een losse accolade binnen de tekst. Het
   is geldige JSON en de opmerking wordt niet gescoord, maar we houden het in het oog bij Haiku.

## Mogelijke aanpassingen (te beslissen)

- **De scorer:** "onbekend waar de gold een code heeft" apart rapporteren als **onzeker** naast **fout**. De
  hoofdscore verandert dan niet, maar de beslisregel kan het verschil zien tussen voorzichtig en verzonnen.
- **c01:** in de lijst met verschillen als seedprobleem markeren, of het geval vervangen door een bon waar de
  opmerking bij het toestel past.
- **c14:** zo houden. Het is een goed geval om te zien of Haiku gokt (bijvoorbeeld `WP-BUF-200`) of ook voorzichtig is.
