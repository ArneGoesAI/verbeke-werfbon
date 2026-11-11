# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | 40 | 95% | 5% | 0% | 100% | 92% | 92% | 100% | 100% | 100% | 100% | 100% | € 485.00 | 90% | 90% |

### Per type

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · herstelling | 22 | 95% | 5% | 0% | 100% | 94% | 94% | 100% | 100% | 100% | 100% | 100% | € 485.00 | – | – |
| claude-sonnet-5-5 / low · onderhoud | 18 | 94% | 6% | 0% | 100% | 90% | 90% | 100% | – | 100% | 100% | 100% | – | 90% | 90% |

### Per invoerweg

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · foto | 20 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · spraak | 20 | 90% | 10% | 0% | 100% | 85% | 85% | 100% | 100% | 100% | 100% | 100% | € 485.00 | 80% | 80% |

### Per bron

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · aangepast | 8 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · database | 32 | 94% | 6% | 0% | 100% | 90% | 90% | 100% | – | 100% | 100% | 100% | € 485.00 | 88% | 88% |

### Per config, zonder gevallen met een testdata-probleem

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | 38 | 97% | 3% | 0% | 100% | 96% | 96% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 90% | 90% |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | foto | 20 | $0.0085 | $0.0085 | 2.09 s | 5.99 s | 100% |
| claude-sonnet-5-5 / low | spraak | 20 | $0.0041 | $0.0046 | 2.28 s | 8.31 s | 100% |

### Facturen die niet juist zijn

- claude-sonnet-5-5 / low · c01-wb814 · spraak #1: **onzeker** — uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 _(testdata-probleem)_
- claude-sonnet-5-5 / low · c14-wb322 · spraak #1: **onzeker** — uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1

### Gevallen met een testdata-probleem

- c01-wb814: De seed zet een printplaat van een binnenunit (OND-PCB) bij een storing aan een ventilatie (Zehnder ComfoAir Q450). Die combinatie bestaat in de praktijk niet; 'onbekend' is hier een verdedigbaar antwoord. Zie §6 van docs/eval-plan.md.

