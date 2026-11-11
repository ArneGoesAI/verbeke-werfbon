# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | 40 | 95% | 100% | 92% | 92% | 100% | 100% | 100% | 100% | 100% | € 485.00 | 90% | 90% |

### Per type

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · herstelling | 22 | 95% | 100% | 94% | 94% | 100% | 100% | 100% | 100% | 100% | € 485.00 | – | – |
| claude-sonnet-5-5 / low · onderhoud | 18 | 94% | 100% | 90% | 90% | 100% | – | 100% | 100% | 100% | – | 90% | 90% |

### Per invoerweg

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · foto | 20 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · spraak | 20 | 90% | 100% | 85% | 85% | 100% | 100% | 100% | 100% | 100% | € 485.00 | 80% | 80% |

### Per bron

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · aangepast | 8 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | € 0.00 | 100% | 100% |
| claude-sonnet-5-5 / low · database | 32 | 94% | 100% | 90% | 90% | 100% | – | 100% | 100% | 100% | € 485.00 | 88% | 88% |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | foto | 20 | $0.0085 | $0.0085 | 2.09 s | 5.99 s | 100% |
| claude-sonnet-5-5 / low | spraak | 20 | $0.0041 | $0.0046 | 2.28 s | 8.31 s | 100% |

