# Stap 8, deel 3: de werfbon-app in `web/`

Status: in uitvoering (2026-11-12). Pakket A (delen 1–4) is klaar. Pakket B (delen 5–9) is gebouwd en de flow is
één keer echt getest (route, Haiku, bevestigen, conceptfactuur); de schermvergelijking in de browser en een echte
spraakopname staan nog open. Pakket C (delen 10–11) is gebouwd en read-only getest op live; FA-2026-00377 is op live
goedgekeurd via het scherm; `opruimen --echt` wacht op akkoord. Zie [Stand](#stand). Dit plan werkt deel 3 uit
van `verbeke-data/docs/plan-stap-8.md`. Houd het bij als een beslissing verandert.

## Context

Deel 1 (migratie 0004) staat live: `werfbon_opnames`, bucket `werfbon-opnames`, RLS, `bevestig_werfbon`,
`keur_factuur_goed` (read-only nagekeken op 2026-11-11). Deel 2, de kern in `web/lib/verwerking/`, is gemerged
(PR #10). Het ontwerp in `docs/ontwerp/` is goedgekeurd. Deel 3 maakt er een app van: inloggen, vier schermen voor
de technieker (T1–T4), één voor de administratie (A1), de route `/api/verwerk`, twee testaccounts en een
opruimscript.

Vastgesteld bij het lezen:
- `peildatum()` = 2026-11-05 is "vandaag" van de fictieve data. Op die dag staan 3 geplande interventies
  (1 herstelling, 2 onderhoud), zonder bon, maar verdeeld over verschillende techniekers.
- Er bestaan nog geen conceptfacturen; A1 vult zich pas via de app.
- `werfbon_lijnen` heeft geen bronzin-kolom. Het toestel komt uit `onderhoudscontracten` (alleen bij een contract).

## Beslissingen (2026-11-11)

1. **Bronzin** komt uit `werfbon_opnames.extractie`, gekoppeld op artikelcode. Geen migratie.
2. **"Terug naar technieker"** valt weg uit A1. Alleen "Goedkeuren en versturen". Afkeuren blijft buiten 0004.
3. **Menu A1**: alleen "Conceptfacturen". Werfbonnen, Verstuurde facturen en Klanten vallen weg.
4. **Onbekend onderdeel**: Bevestigen kan pas als elk geel vak opgelost is, met "Kies artikel" of
   "Niet aanrekenen".

Het bijgewerkte ontwerp (`docs/ontwerp/`, 2026-11-11) verwerkt beslissingen 2–4 al: A1 heeft alleen
"Conceptfacturen" in het menu en geen knop "Terug naar technieker"; T4 heeft naast "Kies artikel" de knop
"Niet aanrekenen" (omlijnd `#D9B76A`, tekst `#6E4700`) en boven Bevestigen de tekst "Los eerst het gele vak op, dan
kan je bevestigen."

Wat niet getekend is maar wel nodig, in de huisstijl van `Main.dc.html`: een loginscherm, een verwerkingstoestand na
het stoppen van de opname, invulvelden om uren, km en aantallen aan te passen in T4, de uitgeschakelde stand van
Bevestigen (de mockup tekent hem actief), en een bevestigingsstap bij "Goedkeuren en versturen".

## Werkwijze

- Drie PR's: **PR A** delen 1–4 (fundament), **PR B** delen 5–9 (technieker), **PR C** delen 10–11
  (administratie en afwerking).
- Elk deel eindigt met `npm --prefix web test`, `npm --prefix web run typecheck` en de controle die erbij staat.
- Geen Tailwind: CSS Modules plus CSS-variabelen in `app/globals.css`, zodat de waarden uit de mockups 1-op-1 over te
  nemen zijn. Lettertypes via `next/font/google` (Fraunces 600/700, Figtree 400–700).
- Afhankelijkheden vastgepind: `@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7, `server-only` 0.0.1.
- Calls die geld kosten (Claude, Voxtral) en schrijven naar de gedeelde database gebeuren pas na akkoord, telkens
  met de kost erbij.

## Stand

| Deel | Stand |
|---|---|
| 1. Supabase-clients | **Klaar** |
| 2. Huisstijl | **Klaar** |
| 3. Testaccounts en opruimscript | **Klaar**: testaccounts op live (`technieker@verbeke.test` → medewerker 18, `administratie@verbeke.test` → medewerker 4), `test:logins`, `opruimen` (droog nagekeken) |
| 4. Inloggen | **Klaar**, met tijdelijke pagina's `/vandaag` en `/administratie` |
| 5. T1 Vandaag | **Code klaar**, queries nagekeken met `test:schermen`; schermvergelijking in de browser nog te doen |
| 6. T2 Interventie | **Code klaar**, idem; interventie van een collega onzichtbaar (nagekeken) |
| 7. Route `POST /api/verwerk` | **Klaar**: tests met nep-afhankelijkheden, en één echte call met een foto (`test:flow`) |
| 8. T3 Inspreken en foto-pad | **Code klaar**; echte spraakopname in de browser en op een gsm nog te doen |
| 9. T4 Voorstel en Bevestigen | **Klaar** via `test:flow` (zelfde code als de server action); T4 in de browser nog te bekijken |
| 10. A1 Conceptfacturen | **Code klaar**, read-only nagekeken met `test:administratie` en in de browser (1360 × 900 en 390 breed, bevestigingsstap geopend en geannuleerd); FA-2026-00377 goedgekeurd via het scherm |
| 11. Afwerking | `CLAUDE.md`, `README` en dit plan bijgewerkt; status in `verbeke-data` en `opruimen --echt` nog te doen |

Gedaan in pakket A, met wat erbij kwam:
- `web/lib/supabase/`: `config.ts` (sleutels inlezen, stopt bij een publishable key op de plaats van de secret key),
  `browser.ts`, `server.ts`, `dienst.ts` (met `server-only`) en `dienst-kern.ts` (voor de scripts). Een clientimport
  van `dienst.ts` laat de build falen; dat is één keer nagegaan met een tijdelijke pagina.
- `next.config.ts` laadt de root-`.env` met `forceReload`. Zonder dat geeft `@next/env` de eerdere lading van `web/`
  (zonder sleutels) uit de cache terug, en zag de app de Supabase-sleutels niet.
- `web/scripts/testaccounts.ts`: idempotent, koppelt nooit over een bestaande koppeling heen, schrijft de
  wachtwoorden naar `.env.testaccounts` (in `.gitignore` via `.env.*`), nooit naar het scherm. De keuzelogica staat
  in `lib/beheer/testaccounts.ts` met tests.
- `web/scripts/test-logins.ts` (alleen lezen): beide accounts aanmelden met de publishable key en RLS nakijken.
  Resultaat op 2026-11-12: ALLES OK (anon ziet geen bonnen; technieker ziet zichzelf, 0 facturen, 70 interventies;
  administratie ziet 38 medewerkers en 372 facturen).
- `/login`, `proxy.ts`, `lib/rol.ts`, `lib/sessie.ts`, `app/acties.ts` (aanmelden, afmelden).
- Getest in de browser: zonder login naar `/login`; fout wachtwoord geeft de gele melding.
- Huisstijl: `components/` met `Knop`/`KnopLink` (primair, omlijnd, petrol, petrolWit, nakijkOmlijnd; maten
  standaard 56, groot 64, klein 44), `Label` (groot, klein, mini), `Kaart` (met warmterand voor "actief"),
  `NakijkVak`; `lib/opmaak.ts` (bedrag met harde spatie na €, aantal, uren, km, dagtitel, tijd in Belgische tijd,
  groet, klantnaam, initialen) met tests. `/huisstijl` (alleen in ontwikkeling) speelt `Main.dc.html` na: naast elkaar
  op 1200 px gelijk, knoppen en labels nagemeten (hoogte, hoeken, lettergrootte, kleur).
- `web/scripts/opruimen.ts`: droog als standaard, `--echt`, `--ook-accounts`. Selectie en veiligheidscontroles in
  `lib/beheer/opruimen.ts` met tests: stopt bij een bon die geen app-bon is, een factuur die ook bij een andere bon
  hoort, of een factuur die betaald of vervallen is. Na `--echt` controleert het zelf dat er niets overblijft.
  Droog op live (2026-11-12): geen app-data; met `--ook-accounts` precies de twee testgebruikers en medewerkers 4
  en 18.

Gedaan in pakket B (code, nog zonder echte call of schrijven op live):
- `lib/schermen/vandaag.ts` (kaartstatus, titels, `dagGrenzen` voor de peildatum in Belgische tijd),
  `lib/schermen/queries.ts` (queries op een client met sessie; `laad.ts` geeft ze de cookiesessie),
  `lib/schermen/voorstel.ts` (rijen, gele vakken, aanpassingen, `controleer` voor Bevestigen), alle met tests.
- `lib/route/verwerk-route.ts` met injecteerbare afhankelijkheden (`afhankelijkheden.ts` = sessie voor lezen,
  secret key voor schrijven), `bouw-bon.ts`; `app/api/verwerk/route.ts`.
- `lib/client/useVerwerk.ts`: opladen naar de bucket met de sessie, dan de route. Foto's worden in de browser
  verkleind tot 1600 px JPEG (ook HEIC wordt zo JPEG).
- Schermen `/vandaag`, `/interventie/[id]`, `/interventie/[id]/inspreken`, `/bon/[id]`; server action `bevestig`.
- `scripts/test-schermen.ts` (`npm --prefix web run test:schermen`, alleen lezen): queries van T1/T2 met de
  testaccount, plus RLS op een interventie en opnamepad van een collega. Resultaat 2026-11-12: ALLES OK.
- `MAX_UREN` staat nu in `lib/verwerking/grenzen.ts`, zodat de browser hem kan gebruiken zonder Ajv en de catalogus
  (met prijzen) mee te laden. Nagekeken in de build: geen `verkoopprijs` in de clientbundels.

Echte test op 2026-11-12, met akkoord (`npm --prefix web run test:flow`, zelfde code als de app, zonder browser):
- `--stap concept`: foto van testgeval c13-wb501 met de sessie in de bucket, dan `verwerkVerzoek` met de echte
  afhankelijkheden op interventie 1063. Route 200 in 4,0 s, bon WB-2026-00853 (concept, bron foto, 5 november):
  1,5 u, 28 km, Temperatuursensor × 1 met citaat, forfait "Automatisch". Gelijk aan de gold van c13.
  Eén Haiku-call: 6.069 input- en 305 outputtokens, ongeveer $0,001.
- `--stap bevestig --bon 853`: `bevestigBon` → bon `ingegeven`, conceptfactuur FA-2026-00377 (btw 6%, € 217,
  de jaarprijs van het contract). Read-only als administratie: totaal = `factuurvoorstel` = som van de lijnen.
  Waarschuwing "onderdeel op onderhoudsbon, niet aangerekend: OND-SENS × 1", zoals 0003 het wil.
- `opruimen` droog toont precies die app-data (bon 853, factuur 377, opname 2, één bestand). Nog niet opgeruimd:
  de data dient straks voor A1 (deel 10).
- Voor dit script staan de route-afhankelijkheden in `lib/route/afhankelijkheden-kern.ts` en het bevestigen in
  `lib/schermen/bevestig.ts`, zonder `server-only`; de app gebruikt ze via `afhankelijkheden.ts` en de server action.
- Niet getest met echte data: een geel vak (c13 had er geen; wel in de unit tests), het spraakpad (Voxtral) en
  "Opnieuw inspreken" op live.

Afwijkingen en keuzes in pakket B:
- **Vervangen van een conceptbon**: eerst de nieuwe bon volledig schrijven, pas daarna de oude weg (het plan zei
  eerst weg). Mislukt het schrijven, dan blijft het oude voorstel staan. Bleef er toch een oude staan, dan toont de
  app de nieuwste (hoogste id).
- **Route**: 409 als er al een bevestigde bon is; 502 bij een API-fout (opname wel bewaard). `km` wordt afgerond:
  `werfbonnen.km` is een integer. `input_tokens` in `werfbon_opnames` telt ook de cachetokens.
- **Bevestigen** loopt niet in één transactie (bijwerken, lijnen vervangen, `bevestig_werfbon`). Mislukt een stap,
  dan blijft de bon een concept en kan de technieker opnieuw bevestigen.
- **Onderhoud zonder contract**: geen forfait af te leiden; bevestigen kan, zonder forfaitlijn. De administratie
  krijgt de waarschuwing "onderhoud zonder contract".
- **T2**: de titel is "Onderhoud warmtepomp" (type + toestel), niet een samenvatting van de melding zoals in de
  mockup: die bestaat niet in de data.
- **T4**: een niet-aangerekend onderdeel blijft als grijze regel zichtbaar, met "Ongedaan maken".

Gedaan in pakket C (2026-11-12):
- `lib/schermen/waarschuwing.ts` (puur, met tests): kort label per waarschuwing ("Niet getekend", "Veel uren",
  "Geen contract", "Onderdeel bij onderhoud", en "Uren wijken af" voor de vijfde waarschuwing van 0003, die het plan
  niet noemde), status "Klaar" of het label van de eerste, filter en selectie uit de URL, bedragen op de cent
  (btw = totaal excl. × tarief; de som van de lijnen dient als controle en geeft een melding als ze afwijkt), duur.
- `lib/schermen/administratie.ts`: conceptfacturen met klant, bon, technieker, interventietype en toestel;
  waarschuwingen via `factuurwaarschuwingen()` per bon; lijnen en de laatste opname met een signed URL (10 min);
  `keurFactuurGoed` met leesbare fouten (al goedgekeurd, geen administratie). Via `laad-administratie.ts` met de
  cookiesessie; `scripts/test-administratie.ts` rechtstreeks.
- `/administratie`: menu met alleen "Conceptfacturen" en het aantal, afmelden onderaan; filters "Alle (n)" en
  "Na te kijken (n)"; de hele rij is klikbaar (link in de eerste cel); zonder `?factuur=` het eerste in de lijst.
  Detail met lijnen, btw, totaal, alle waarschuwingen in een geel vak, de opmerking van de technieker (daar staan de
  niet-aangerekende onderdelen uit T4), en de opname (afspeelknop, duur uit het bestand, transcript) of de foto.
- "Goedkeuren en versturen" vraagt eerst bevestiging (nummer, klant, totaal; "kan je hier niet ongedaan maken"), dan
  server action `keurGoed` → `keur_factuur_goed` → terug naar de lijst met dezelfde filter.
- `scripts/test-administratie.ts` (`npm --prefix web run test:administratie`): standaard alleen lezen; met
  `--goedkeuren <id>` schrijft het. Resultaat op 2026-11-12, alleen lezen: ALLES OK. FA-2026-00377 (Fam. Desmet,
  onderhoud warmtepomp, € 217 + btw 6% € 13,02 = € 230,02), totaal = som van de lijnen = `factuurvoorstel`, status
  "Onderdeel bij onderhoud", foto te openen via de signed URL. De technieker ziet geen facturen en krijgt 42501 op
  `keur_factuur_goed`.
- In de browser (2026-11-12, als administratie): breedtes van tabel en detail gelijk aan de mockup (623 en 429 px op
  1360). Factuurnummer en bedrag breken niet meer af; het menu is sticky zodat "Afmelden" in beeld blijft, en wordt
  onder 800 px een balk bovenaan.
- Goedgekeurd op live, met akkoord (2026-11-12): FA-2026-00377 via "Goedkeuren en versturen" in het scherm. Read-only
  nagekeken: factuur `verstuurd` (€ 217 excl. btw), bon WB-2026-00853 `gefactureerd`, geen conceptfacturen meer;
  A1 toont de lege lijst.
- Keuzes: de duur van een opname staat niet in de database; de speler leest ze uit het bestand (bij webm van
  MediaRecorder soms pas na het afspelen, dan zonder duur). Een factuur met meer bonnen (alleen in oude data) toont
  de eerste bon en de waarschuwingen van alle bonnen.

Afwijking van het plan: de technieker die het script koos (meeste interventies op de peildatum) heeft er maar één.
T1 zal dus één kaart tonen, niet drie zoals in de mockup. Voor een volledig T1 is een andere keuze of extra
inplanning nodig; te beslissen bij deel 5.

## Delen

### Deel 1. Supabase-clients en sleutels — klaar
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- `web/lib/supabase/browser.ts`, `server.ts` (sessie uit cookies, via `@supabase/ssr`) en `dienst.ts` (secret key,
  `import "server-only"`, alleen voor de route en de scripts).
- **Test:** vitest dat `dienst.ts` en `server.ts` niet buiten de server te importeren zijn; `next build` slaagt.

### Deel 2. Huisstijl en bouwstenen — klaar
- `app/globals.css` met de kleuren uit de README als variabelen; `components/`: `Logo` (SVG uit `Main.dc.html`),
  `Knop` (warmte 56 px, omlijnd, petrol-licht 44 px), `Label` (nakijken, in orde, ingesproken, automatisch),
  `Kaart`, `NakijkVak` (geel vak met icoon).
- Hulpfuncties in `lib/opmaak.ts`: bedrag `€ 1.234,56`, aantal `1,5`, datum "Donderdag 5 november", groet volgens
  het uur, klantnaam (`Fam. {achternaam}` of bedrijfsnaam), initialen.
- **Test:** vitest voor `opmaak.ts`; een dev-pagina `/huisstijl` die `Main.dc.html` naspeelt, naast elkaar
  vergeleken in de browser op 1200 px.

### Deel 3. Testaccounts en opruimscript — klaar
- `web/scripts/testaccounts.ts` (secret key, idempotent): maakt `technieker@verbeke.test` en
  `administratie@verbeke.test` aan met `auth.admin.createUser` (e-mail bevestigd, wachtwoord willekeurig),
  koppelt ze via `medewerkers.auth_user_id`. Technieker = de actieve technieker met de meeste herstellingen en
  onderhouden op `peildatum()`; administratie = de eerste actieve medewerker met rol `administratie`.
  Wachtwoorden naar `.env.testaccounts` in de repo-root.
- `web/scripts/opruimen.ts`, standaard droog (toont alleen wat weg zou gaan), pas met `--echt` uitvoeren:
  1. bonnen met `bron in ('spraak','foto')` (alleen de app maakt die) en hun facturen (`factuur_id`), ook
     goedgekeurde: `factuur_id` op null, factuur weg (lijnen cascade), bon weg (lijnen cascade);
  2. alle rijen in `werfbon_opnames` en alle objecten in bucket `werfbon-opnames`;
  3. met `--ook-accounts`: `auth_user_id` op null en de twee testgebruikers verwijderen (alleen op die e-mails).
  Stopt als iets anders dan die selectie geraakt zou worden. Sequences schuiven op (gat in nummering): aanvaard.
- **Test:** vitest voor de selectielogica (met een nep-client); `opruimen` droog op live.

### Deel 4. Inloggen — klaar
- `/login`: logo, e-mail, wachtwoord, knop "Aanmelden" (56 px). Server action met `signInWithPassword`; één
  foutmelding voor onbekend adres en fout wachtwoord.
- `proxy.ts` (Next 16): sessie verversen, zonder sessie naar `/login` (behalve `/api/`, die geeft zelf 401).
- `/` stuurt door volgens rol (eigen rij uit `medewerkers`, via RLS): technieker → `/vandaag`, administratie of
  zaakvoerder → `/administratie`, anders "Geen toegang". Een verkeerde rol wordt naar het eigen scherm gestuurd.
  Afmelden komt in T1 (initialen-knop) en onderaan het menu van A1; nu op de tijdelijke pagina's.

### Deel 5. T1 Vandaag (`/vandaag`)
- Server component met de sessie: `peildatum()`, eigen interventies van die dag van type herstelling of onderhoud
  (RLS beperkt al tot eigen), met klant, contract-toestel en eigen bonnen.
- Pure functie `lib/schermen/vandaag.ts`: kaartstatus per interventie. Geen bon → "Gepland"; de vroegste zonder
  bevestigde bon is "Nu bezig" (warmterand, label "Bon nog in te spreken"); conceptbon → "Nog te bevestigen"
  (nakijken); bevestigd → "Bevestigd" (in orde). Titel "Herstelling warmtepomp" uit type + toesteltype.
- **Test:** vitest voor `vandaag.ts`; schermvergelijking met `T1-Vandaag.dc.html` op 390 × 844.

### Deel 6. T2 Interventie (`/interventie/[id]`)
- Klant met adres, toestel (alleen als er een contract is), melding = `interventies.omschrijving`.
- Knoppen "Bon inspreken" en "Foto van papieren bon" (verborgen `<input type=file accept=image/* capture=environment>`).
  Is er al een conceptbon: hoofdknop wordt "Voorstel nakijken"; bevestigd: label "Bevestigd", geen knoppen.
- **Test:** schermvergelijking met `T2-Interventie.dc.html`; interventie van een collega → 404.

### Deel 7. Route `POST /api/verwerk`
- Invoer `{ interventie_id, pad, soort: "audio" | "foto", mediatype }`. Het bestand staat al in de bucket (de app
  uploadt met de sessie; de route krijgt alleen het pad, dus geen limiet op de body).
- Stappen: sessie → `mijn_medewerker_id()`; `is_mijn_opnamepad(pad)` en tweede segment = `interventie_id` →
  context bouwen (`type`, `omschrijving`, toestel uit het contract, zelfde vorm als `eval/export_gold.py`) → bestand
  downloaden met de sessie → `verwerk()` uit `lib/verwerking/verwerk.ts` → wegschrijven met de secret key:
  - een bestaande conceptbon van mij op deze interventie verwijderen ("Opnieuw inspreken" vervangt);
  - `werfbonnen` in `concept`, `bron` spraak/foto, `datum = peildatum()`, `uren`, `km` (null → 0), `opmerkingen` =
    opmerking van het model, `nummer` leeg (de trigger vult);
  - `werfbon_lijnen` voor `lijnen` (code → `artikelen.id`);
  - `werfbon_opnames` met transcript, extractie, model en tokens.
  Mislukt een stap na de bon: bon weer verwijderen. Mislukt `verwerk()`: opname toch bewaren (zonder bon), 422 met
  de fout. Geen refusal-fallback.
- Pure functie `lib/route/bouw-bon.ts` (rijen uit het resultaat) en de route met injecteerbare afhankelijkheden.
  `runtime = "nodejs"`, `maxDuration = 60`.
- **Test:** vitest met nep-Supabase en nep-`verwerk` (vreemd pad → 403, ander type → 422, vervangen van een
  conceptbon, opruimen bij een fout). Daarna één echte call met een testgeval als tekst (±$0,01).

### Deel 8. T3 Inspreken (`/interventie/[id]/inspreken`) en het foto-pad
- Client component: `getUserMedia` + `MediaRecorder` (webm/opus, op iOS audio/mp4), teller, 15 balkjes uit een
  `AnalyserNode`, auto-stop na 3 minuten, "Annuleren" gooit weg. Na "Tik om te stoppen": uploaden naar
  `{medewerker}/{interventie}/{uuid}.{ext}`, `POST /api/verwerk`, ondertussen "Even verwerken…" op hetzelfde donkere
  scherm, dan naar `/bon/[id]`. Fout → melding met "Opnieuw inspreken".
- Een hook `useVerwerk` (uploaden + route) die het foto-pad uit T2 ook gebruikt.
- **Test:** microfoon geweigerd → duidelijke melding; echte opname in Chrome op localhost, daarna op een gsm
  (https nodig: `next dev --experimental-https` in het lokale netwerk). Kost: Voxtral $0,0035/min + één Haiku-call.

### Deel 9. T4 Voorstel (`/bon/[id]`) en Bevestigen
- Server laadt bon (RLS), lijnen met artikelnaam (geen prijzen), opname-extractie, klant.
- Pure functie `lib/schermen/voorstel.ts`: rijen met naam, aantal, bronzinnen (op code uit de extractie) of label
  "Automatisch" (codes uit `AFGELEIDE_CODES`), en de onbekende onderdelen als gele vakken.
- Aanpassen in de client: tik op "Gewerkt"/"Gereden" → getalveld; tik op een onderdeel → − / + / verwijderen.
  Afgeleide lijnen herberekend met `afgeleideLijnen()` uit `lib/verwerking/afgeleide-lijnen.ts`. "Kies artikel" opent
  een lijst uit `artikelen` (zonder arbeid en verplaatsing, met zoekveld); "Niet aanrekenen" sluit het vak.
  Zolang er een geel vak open is: Bevestigen uitgeschakeld en erboven "Los eerst het gele vak op, dan kan je
  bevestigen."; de tekst verdwijnt als alles opgelost is.
- Server action `bevestig`: controle (uren 0–`MAX_UREN`, km ≥ 0, aantal > 0, code in de catalogus), dan met de
  sessie: `werfbonnen` bijwerken (niet-aangerekende onderdelen erbij in `opmerkingen`, zodat de administratie ze
  ziet), lijnen vervangen, `rpc("bevestig_werfbon")`. Daarna naar `/vandaag`.
- **Test:** vitest voor `voorstel.ts` en de controle; schermvergelijking met `T4-Voorstel.dc.html`; volledige flow
  met de testaccount: inspreken → aanpassen → bevestigen → read-only nagekeken: bon `ingegeven`, conceptfactuur met
  totaal = `factuurvoorstel`.

### Deel 10. A1 Conceptfacturen (`/administratie`)
- Menu met alleen "Conceptfacturen" en het aantal. Tabel: facturen in `concept` met bon, klant, type, excl. btw en
  status. Status uit `factuurwaarschuwingen(werfbon_id)`: leeg → "Klaar", anders een kort label voor de eerste
  (pure functie `lib/schermen/waarschuwing.ts`: "Niet getekend", "Onderdeel bij onderhoud", "Veel uren",
  "Geen contract"). Filters "Alle (n)" en "Na te kijken (n)" via `?filter=`; geselecteerde rij via `?factuur=`.
- Detail: nummers, klant, type, particulier/bedrijf, btw; `factuur_lijnen` als "omschrijving · aantal × prijs";
  btw en totaal; alle waarschuwingen in een geel vak; de opname met afspeelknop (signed URL, 10 min), wie insprak,
  duur, transcript; bij een foto de foto.
- "Goedkeuren en versturen" → bevestigingsstap → `rpc("keur_factuur_goed")` → lijst ververst. (Versturen = alleen
  de status; er gaat geen mail weg.)
- **Test:** vitest voor `waarschuwing.ts` en bedragen; schermvergelijking met `A1-Conceptfacturen.dc.html` op
  1360 × 900; de factuur uit deel 9 goedkeuren → read-only: factuur `verstuurd`, bon `gefactureerd`.

### Deel 11. Afwerking
- `CLAUDE.md` en `README` bijwerken: commando's, sleutels, testaccounts, opruimscript, wat gebouwd is.
- In `verbeke-data` (aparte PR): status van `docs/plan-stap-8.md` deel 3.
- Ten slotte `opruimen --echt` (na akkoord), zodat live weer zonder app-data staat.

Niet in dit plan: deploy op Vercel, afkeuren/terugsturen, andere menu-items in A1.

## Verificatie, van begin tot eind
1. `npm --prefix web test`, `typecheck`, `next build` groen; `score.py --zelftest` en de Python-tests onveranderd groen.
2. Met de technieker op een gsm: T1 toont de interventies van 5 november → T2 → inspreken → T4 met citaten,
   "Automatisch" en een geel vak → oplossen → Bevestigen → T1 toont "Bevestigd". Ook één keer via foto.
3. Met de administratie: de nieuwe conceptfactuur staat in A1 met juiste bedragen en waarschuwingen → goedkeuren.
4. RLS in de praktijk: technieker ziet geen facturen, geen bon van een collega, geen andere interventies.
5. Schermen naast de mockups op 390 × 844 en 1360 × 900.
6. `opruimen` droog toont precies de app-data; `--echt` laat live zoals vóór de test (read-only nagekeken).
