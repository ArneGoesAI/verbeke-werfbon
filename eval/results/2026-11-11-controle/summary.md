# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | 40 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |

### Per type

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · herstelling | 22 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | – | – |
| claude-sonnet-5-5 / low · onderhoud | 18 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | – | 100% | 100% |

### Per invoerweg

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · foto | 20 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · spraak | 20 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |

### Per bron

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · aangepast | 8 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · database | 32 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | 100% | 100% |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | foto | 20 | $0.0086 | $0.0086 | 2.42 s | 6.03 s | 100% |
| claude-sonnet-5-5 / low | spraak | 20 | $0.0039 | $0.0039 | 2.25 s | 6.19 s | 100% |

