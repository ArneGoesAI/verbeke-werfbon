# Samenvatting werfbon-eval

### Per config

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | 2 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | – | – |

### Per type

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · herstelling | 2 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | – | – |

### Per invoerweg

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · foto | 1 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | – | – |
| claude-sonnet-5-5 / low · spraak | 1 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | – | – |

### Per bron

| | n | Factuur juist | Uren | Precisie | Recall | Aantal | Onbekend | Bron | Geldig | Km | Fout € (herst.) | Onderh. extra recall | Onderh. extra precisie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low · database | 2 | 100% | 100% | 100% | 100% | 100% | – | 100% | 100% | 100% | € 0.00 | – | – |

### Kost en latency

| Config | Pad | Calls | Kost per bon | Kost per juiste factuur | p50 | p95 | Stabiel |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 / low | foto | 1 | $0.0149 | $0.0149 | 4.30 s | 4.30 s | 100% |
| claude-sonnet-5-5 / low | spraak | 1 | $0.0099 | $0.0099 | 5.03 s | 5.03 s | 100% |

