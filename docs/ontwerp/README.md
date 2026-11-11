# Ontwerp werfbon-app

Goedgekeurd ontwerp voor stap 8, deel 3. De `.dc.html`-bestanden zijn de mockups: bouw de schermen hiernaar na in
Next.js. Het zijn geen bestanden om rechtstreeks in de app te gebruiken.

## Huisstijl

| Rol | Kleur |
|---|---|
| Warmte (hoofdactie, knoppen) | `#C2531E` (hover/tekst-link `#A8441A`) |
| Petrol (informatie, secundaire acties) | `#1F5662`, licht `#DDEBEE` |
| Inkt (tekst) | `#2A2420`, zacht `#4A3F38`, gedempt `#6B5F57` |
| Kalk (achtergrond) | `#FAF6F0`, kaart `#FFFFFF`, rand `#EDE4DA`, menu `#F3ECE3` |
| Nakijken (twijfel) | achtergrond `#FCEFD2`, tekst `#6E4700` |
| In orde | achtergrond `#E2F0E4`, tekst `#245332` |
| Automatisch-label | achtergrond `#F0E8DF`, tekst `#4A3F38` |

- Lettertypes (Google Fonts): **Fraunces** 600/700 voor titels, **Figtree** 400–700 voor tekst en knoppen.
- Mobiel: tekst minstens 16 px, knoppen minstens 56 px hoog (werkhandschoenen, zon op het scherm), afgeronde hoeken
  16–20 px.
- Logo: afgerond vierkant in `#C2531E` met een dak en een golf in wit (zie de SVG in `Main.dc.html`).

## Principes

1. De AI stelt voor, de mens beslist ("Klopt dit?").
2. Elke lijn toont waar ze vandaan komt: het citaat van de technieker of het label "Automatisch".
3. Twijfel is zichtbaar, nooit verstopt: een onderdeel `onbekend` wordt een geel vak "Nog na te kijken". Bevestigen kan pas als elk geel vak een artikel kreeg ("Kies artikel") of op "Niet aanrekenen" staat.
4. De technieker ziet geen prijzen; de administratie wel.

## Schermen

| Bestand | Scherm |
|---|---|
| `Main.dc.html` | Huisstijl |
| `T1-Vandaag.dc.html` | Technieker: interventies van vandaag |
| `T2-Interventie.dc.html` | Technieker: interventie met "Bon inspreken" en "Foto van papieren bon" |
| `T3-Inspreken.dc.html` | Technieker: opname bezig |
| `T4-Voorstel.dc.html` | Technieker: voorstel nakijken en bevestigen |
| `A1-Conceptfacturen.dc.html` | Administratie: conceptfacturen met detail en goedkeuren (desktop); het menu toont enkel Conceptfacturen, afkeuren is bewust weggelaten |

Namen en de bedragen van FA-2026-01219 en -01220 zijn voorbeelden. FA-2026-01218 volgt de echte regels
(1,5 × € 62 + € 45, btw 6%).
