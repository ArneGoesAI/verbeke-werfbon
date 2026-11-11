# Error analysis: controlerun Sonnet 5.5, effort low

Run: 20 gevallen × 2 invoerwegen × 1 herhaling = 40 calls, ongeveer $0,25.

## Gevallen die niet "factuur juist" zijn

Geen. Alle 40 antwoorden zijn juist. Ik heb ze ook los van `score.py` nagekeken: ik zette de ruwe JSON zelf om met
`afgeleide_lijnen` en vergeleek dat met de gold. Alle 40 waren `end_turn`, geldig en door `claude-sonnet-5-5` zelf
beantwoord.

Er valt dus niets per geval te analyseren. Wat wel analyse vraagt, is **waarom alles juist is**. Een score van 100% op
de controlerun betekent dat de set Sonnet niet onderscheidt, en waarschijnlijk Haiku ook niet.

## Wat de valkuilen deden

| Valkuil | Geval | Spraak | Foto |
|---|---|---|---|
| Correctie "twee uur… nee, anderhalf" | c17 | 1,5 ✓ | 1,5 ✓ (doorstreepte "2u") |
| Twee kilo koelmiddel | c18 | `WP-KOEL` × 2 ✓ | `WP-KOEL` × 2 ✓ |
| Onderdeel niet in de catalogus | c19 | `onbekend`, "servomotor van de bypassklep" ✓ | `onbekend` ✓ |
| Geen km | c20 | `null` ✓ | `null` ✓ |
| "koelmiddel nagekeken", geen onderdeel | c10 | geen onderdeel ✓ | ✓ |
| "zeefkes proper gemaakt", geen onderdeel | c09 | geen onderdeel ✓ | ✓ |
| "lager versleten? opvolgen", geen onderdeel | c11 | geen onderdeel ✓ | ✓ |
| Volkstaal: "voelerke", "matjes", "witte buis", "klep" | c05, c13, c15, c16, c04, c02 | allemaal juist | – |

De prompt en het model doen wat ze moeten doen. De kans is klein dat de oorzaak bij de scorer ligt. De zelftest en
de nepruns met ingebouwde fouten tonen dat de scorer fouten wel ziet, en ik heb de 40 antwoorden ook met de hand
nagekeken.

## Waarom het te makkelijk is: de oorzaak ligt bij de testdata

1. **Op 5 van de 14 bonnen met een onderdeel staat de artikelcode letterlijk.** Het gaat om "1x OND-PCB",
   "1x OND-VENTIEL", "1 m SAN-BUIS" en twee keer "1X VENT-FILT" (c01, c02, c04, c15, c16). Dat komt van de 30%-kans
   op een code in `maak_cases.py`. De andere bonnen zijn ook duidelijk: "exp. vat 18L", "pomp vervangen", "sensor".
   Het fotopad test zo vooral of het model een strak gerenderd formulier kan lezen.
2. **De catalogus lekt in de inspreekteksten.** Opus kreeg bij het genereren de catalogusnaam "Expansievat 18 l"
   mee. In 3 teksten zegt de technieker daarom "van achttien liter" (c06, c14, c20). Dat is precies de sleutel om
   `OND-PRES` te kiezen. Een echte technieker zegt eerder "het vat".
3. **De seed is regelmatig (§6).** Er is hoogstens één onderdeel per bon, het aantal is altijd 1 (behalve in de
   randgevallen), en elke volkstaal-omschrijving past maar bij één artikel. Er is geen verwarring tussen gelijkaardige
   artikels, zoals "vat" voor `WP-BUF-200` of `OND-PRES`, of "ventiel" voor `VENT-VENT` of `OND-VENTIEL`.
4. **Elk randgeval test één ding, en dat duidelijk.** De correctie staat in één zin, het onbekende onderdeel wordt
   uitvoerig beschreven, en het koelmiddel wordt herhaald ("twee kilo, ja, twee kilo in totaal").
5. **Eén herhaling.** Over de stabiliteit zegt deze run nog niets.

## Wat dit betekent voor de vergelijking

De beslisregel vergelijkt Haiku met Sonnet. Als Sonnet al 20/20 haalt, toont de regel alleen of Haiku ook 20/20
haalt of er duidelijk onder zakt. Is Haiku ook 100%, dan weten we vooral dat de set te makkelijk is. We weten dan
niet dat Haiku goed genoeg is voor echte bonnen. Dat staat al in §6 ("eerder te optimistisch"), en deze run
bevestigt het.

## Opties om samen te beslissen

| | Wat | Kost | Effect |
|---|---|---|---|
| A | Zo doorgaan met de volledige vergelijking | ± $0,75 Sonnet, ± $0,10 Haiku | Toont of Haiku op een makkelijke set al faalt. Uitsluiten kan, goedkeuren niet. |
| B | De bonnen opnieuw renderen zonder artikelcodes, of met hoogstens 1 | 0 API, alleen PIL | Het fotopad gaat over het herkennen van materiaal, niet over het lezen van codes |
| C | Bij het genereren de catalogusnaam weglaten (alleen een generieke naam als "vat"), en de 20 teksten opnieuw laten schrijven en nalezen | ± $0,50 Opus | Haalt het lek "achttien liter" weg |
| D | 5 tot 10 moeilijkere gevallen toevoegen: twee onderdelen op één bon, aantal > 1 bij een gewoon onderdeel, een vat dat het buffervat kan zijn, een correctie van een onderdeel ("de pomp… nee, de klep"), iets wat gekuist en niet vervangen is | Opus + nalezen | Maakt verschillen tussen de modellen zichtbaar |
| E | Wachten op de ongeveer tien echte bonnen (§2) | – | De enige echte toets. Die verandert niets aan de synthetische set |

Mijn voorstel: **B en C** nu, want ze zijn goedkoop en halen twee lekken uit de testdata. Daarna de volledige
vergelijking (A). **D** heeft pas zin als Haiku op de opgekuiste set ook 100% haalt.
