# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium | 24 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |

### Per type

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium · herstelling | 18 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | – | – |
| claude-haiku-5-5 / medium · onderhoud | 6 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | – | 100% | 100% |

### Per invoerweg

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium · foto | 12 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-haiku-5-5 / medium · spraak | 12 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |

### Per bron

| | n | Factuur juist | Onzeker | Fout | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium · aangepast | 12 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | – | – |
| claude-haiku-5-5 / medium · database | 12 | 100% | 0% | 0% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | 100% | 100% |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 / medium | foto | 12 | $0.0005 | $0.0005 | 2.52 s | 2.86 s | 100% |
| claude-haiku-5-5 / medium | spraak | 12 | $0.0003 | $0.0003 | 2.54 s | 3.63 s | 100% |

