# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / low | 120 | 97% | 0% | 3% | 100% | 95% | 100% | 95% | 100% | 96% | 100% | 100% | € 1544.00 | 100% | 100% |
| claude-haiku-5-5 / medium | 120 | 98% | 2% | 0% | 100% | 97% | 97% | 100% | 100% | 100% | 100% | 100% | € 485.00 | 97% | 97% |
| claude-sonnet-5-5 / low | 120 | 94% | 5% | 1% | 99% | 92% | 92% | 100% | 100% | 100% | 99% | 99% | € 1455.00 | 90% | 90% |

### Per type

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / low · herstelling | 66 | 94% | 0% | 6% | 100% | 92% | 100% | 92% | 100% | 94% | 100% | 100% | € 1544.00 | – | – |
| claude-haiku-5-5 / low · onderhoud | 54 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | – | 100% | 100% |
| claude-haiku-5-5 / medium · herstelling | 66 | 98% | 2% | 0% | 100% | 98% | 98% | 100% | 100% | 100% | 100% | 100% | € 485.00 | – | – |
| claude-haiku-5-5 / medium · onderhoud | 54 | 98% | 2% | 0% | 100% | 97% | 97% | 100% | – | 100% | 100% | 100% | – | 97% | 97% |
| claude-sonnet-5-5 / low · herstelling | 66 | 95% | 5% | 0% | 100% | 94% | 94% | 100% | 100% | 100% | 100% | 100% | € 1455.00 | – | – |
| claude-sonnet-5-5 / low · onderhoud | 54 | 93% | 6% | 2% | 98% | 90% | 90% | 100% | – | 100% | 98% | 98% | – | 90% | 90% |

### Per invoerweg

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / low · foto | 60 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-haiku-5-5 / low · spraak | 60 | 93% | 0% | 7% | 100% | 91% | 100% | 90% | 100% | 93% | 100% | 100% | € 1544.00 | 100% | 100% |
| claude-haiku-5-5 / medium · foto | 60 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-haiku-5-5 / medium · spraak | 60 | 97% | 3% | 0% | 100% | 95% | 95% | 100% | 100% | 100% | 100% | 100% | € 485.00 | 93% | 93% |
| claude-sonnet-5-5 / low · foto | 60 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · spraak | 60 | 88% | 10% | 2% | 98% | 85% | 85% | 100% | 100% | 100% | 98% | 98% | € 1455.00 | 80% | 80% |

### Per bron

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / low · aangepast | 24 | 96% | 0% | 4% | 100% | 95% | 100% | 94% | 100% | 100% | 100% | 100% | € 89.00 | 100% | 100% |
| claude-haiku-5-5 / low · database | 96 | 97% | 0% | 3% | 100% | 95% | 100% | 95% | – | 95% | 100% | 100% | € 1455.00 | 100% | 100% |
| claude-haiku-5-5 / medium · aangepast | 24 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-haiku-5-5 / medium · database | 96 | 98% | 2% | 0% | 100% | 97% | 97% | 100% | – | 100% | 100% | 100% | € 485.00 | 96% | 96% |
| claude-sonnet-5-5 / low · aangepast | 24 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · database | 96 | 93% | 6% | 1% | 99% | 90% | 90% | 100% | – | 100% | 99% | 99% | € 1455.00 | 88% | 88% |

### Per config, zonder gevallen met een testdata-probleem

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / low | 114 | 99% | 0% | 1% | 100% | 99% | 100% | 99% | 100% | 96% | 100% | 100% | € 89.00 | 100% | 100% |
| claude-haiku-5-5 / medium | 114 | 99% | 1% | 0% | 100% | 99% | 99% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 97% | 97% |
| claude-sonnet-5-5 / low | 114 | 96% | 3% | 1% | 99% | 96% | 96% | 100% | 100% | 100% | 99% | 99% | € 0.00 | 90% | 90% |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / low | foto | 60 | $0.0004 | $0.0004 | 1.99 s | 2.76 s | 100% |
| claude-haiku-5-5 / low | spraak | 60 | $0.0002 | $0.0002 | 1.49 s | 3.44 s | 95% |
| claude-haiku-5-5 / medium | foto | 60 | $0.0005 | $0.0005 | 2.24 s | 2.96 s | 100% |
| claude-haiku-5-5 / medium | spraak | 60 | $0.0003 | $0.0003 | 2.19 s | 4.30 s | 90% |
| claude-sonnet-5-5 / low | foto | 60 | $0.0079 | $0.0079 | 2.08 s | 3.16 s | 100% |
| claude-sonnet-5-5 / low | spraak | 60 | $0.0063 | $0.0072 | 2.19 s | 4.14 s | 95% |

### Beslisregel (spraak, tegenover claude-sonnet-5-5 / low)

**claude-haiku-5-5 / low**: nog niet
- ✓ factuur (per geval bij meerderheid): hoogstens 1 geval meer fout (1 tegenover 0; fout: c01-wb814 (testdata-probleem)). Onzeker telt niet mee: geen tegenover c01-wb814 (testdata-probleem), c14-wb322
- ✗ geen verzonnen onderdeel, over alle herhalingen (4 van 60 runs, 4 onderdeel/onderdelen: c01-wb814, c20-wb712)
- ✓ randgeval onbekend onderdeel juist (3/3)
- ✗ fout in euro niet hoger (gem. € 46.79 tegenover € 44.09)

**claude-haiku-5-5 / medium**: mag het spraakpad overnemen
- ✓ factuur (per geval bij meerderheid): hoogstens 1 geval meer fout (0 tegenover 0; fout: geen). Onzeker telt niet mee: geen tegenover c01-wb814 (testdata-probleem), c14-wb322
- ✓ geen verzonnen onderdeel, over alle herhalingen (0 van 60 runs, 0 onderdeel/onderdelen)
- ✓ randgeval onbekend onderdeel juist (3/3)
- ✓ fout in euro niet hoger (gem. € 14.70 tegenover € 44.09)

### Facturen die niet juist zijn

- claude-haiku-5-5 / low · c01-wb814 · spraak #1: **fout** — uren 2.5, km 23: ARB-TECH×2.5, OND-PCB×2, VERPL×1 _(testdata-probleem)_
- claude-haiku-5-5 / low · c01-wb814 · spraak #2: **fout** — uren 2.5, km 23: ARB-TECH×2.5, OND-PCB×2, VERPL×1 _(testdata-probleem)_
- claude-haiku-5-5 / low · c01-wb814 · spraak #3: **fout** — uren 2.5, km 23: ARB-TECH×2.5, OND-PCB×2, VERPL×1 _(testdata-probleem)_
- claude-haiku-5-5 / low · c20-wb712 · spraak #2: **fout** — uren 3, km None: ARB-TECH×3, OND-PRES×2, VERPL×1
- claude-haiku-5-5 / medium · c01-wb814 · spraak #1: **onzeker** — uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 _(testdata-probleem)_
- claude-haiku-5-5 / medium · c14-wb322 · spraak #1: **onzeker** — uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1
- claude-sonnet-5-5 / low · c01-wb814 · spraak #1: **onzeker** — uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 _(testdata-probleem)_
- claude-sonnet-5-5 / low · c01-wb814 · spraak #2: **onzeker** — uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 _(testdata-probleem)_
- claude-sonnet-5-5 / low · c01-wb814 · spraak #3: **onzeker** — uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 _(testdata-probleem)_
- claude-sonnet-5-5 / low · c11-wb360 · spraak #2: **fout** — ongeldig
- claude-sonnet-5-5 / low · c14-wb322 · spraak #1: **onzeker** — uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1
- claude-sonnet-5-5 / low · c14-wb322 · spraak #2: **onzeker** — uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1
- claude-sonnet-5-5 / low · c14-wb322 · spraak #3: **onzeker** — uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1

### Gevallen met een testdata-probleem

- c01-wb814: De seed zet een printplaat van een binnenunit (OND-PCB) bij een storing aan een ventilatie (Zehnder ComfoAir Q450). Die combinatie bestaat in de praktijk niet; 'onbekend' is hier een verdedigbaar antwoord. Zie §6 van docs/eval-plan.md.

### Ongeldige outputs

- claude-sonnet-5-5 / low · c11-wb360 · spraak #2: stop_reason max_tokens

