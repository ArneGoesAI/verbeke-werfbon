# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium | 12 | 92% | 8% | 0% | 100% | 89% | 89% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 67% | 67% |

### Per type

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium · herstelling | 9 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | – | – |
| claude-haiku-5-5 / medium · onderhoud | 3 | 67% | 33% | 0% | 100% | 67% | 67% | 100% | – | 100% | 100% | 100% | – | 67% | 67% |

### Per invoerweg

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium · spraak | 12 | 92% | 8% | 0% | 100% | 89% | 89% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 67% | 67% |

### Per bron

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium · aangepast | 6 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | – | – |
| claude-haiku-5-5 / medium · database | 6 | 83% | 17% | 0% | 100% | 83% | 83% | 100% | – | 100% | 100% | 100% | € 0.00 | 67% | 67% |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium | spraak | 12 | $0.0004 | $0.0004 | 2.96 s | 3.59 s | 75% |

### Facturen die niet juist zijn

- claude-haiku-5-5 / medium · c14-wb322 · spraak #1: **onzeker** — uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1

