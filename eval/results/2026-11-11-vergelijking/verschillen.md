# Verschillen tussen configs

Gevallen waar de configs niet dezelfde antwoorden geven, met de gold erbij. Eén voor één te bekijken.

## c01-wb814 (spraak, OND-PCB) — testdata-probleem

- **gold**: uren 2.5, km 23: ARB-TECH×2.5, OND-PCB×1, VERPL×1
- **claude-haiku-5-5 / low**: uren 2.5, km 23: ARB-TECH×2.5, OND-PCB×2, VERPL×1 (3×)
- **claude-haiku-5-5 / medium**: uren 2.5, km 23: ARB-TECH×2.5, OND-PCB×1, VERPL×1 (2×); uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 (1×)
- **claude-sonnet-5-5 / low**: uren 2.5, km 23: ARB-TECH×2.5, VERPL×1, onbekend×1 (3×)

## c11-wb360 (spraak, ventilatie)

- **gold**: uren 1.5, km 16: ARB-ONDERH-VENT×1
- **claude-haiku-5-5 / low**: uren 1.5, km 16: ARB-ONDERH-VENT×1 (3×)
- **claude-haiku-5-5 / medium**: uren 1.5, km 16: ARB-ONDERH-VENT×1 (3×)
- **claude-sonnet-5-5 / low**: uren 1.5, km 16: ARB-ONDERH-VENT×1 (2×); ongeldig (1×)

## c14-wb322 (spraak, warmtepomp + OND-PRES)

- **gold**: uren 1.5, km 9: ARB-ONDERH-WP×1, OND-PRES×1
- **claude-haiku-5-5 / low**: uren 1.5, km 9: ARB-ONDERH-WP×1, OND-PRES×1 (3×)
- **claude-haiku-5-5 / medium**: uren 1.5, km 9: ARB-ONDERH-WP×1, OND-PRES×1 (2×); uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1 (1×)
- **claude-sonnet-5-5 / low**: uren 1.5, km 9: ARB-ONDERH-WP×1, onbekend×1 (3×)

## c20-wb712 (spraak, bon zonder km)

- **gold**: uren 3, km None: ARB-TECH×3, OND-PRES×1, VERPL×1
- **claude-haiku-5-5 / low**: uren 3, km None: ARB-TECH×3, OND-PRES×1, VERPL×1 (2×); uren 3, km None: ARB-TECH×3, OND-PRES×2, VERPL×1 (1×)
- **claude-haiku-5-5 / medium**: uren 3, km None: ARB-TECH×3, OND-PRES×1, VERPL×1 (3×)
- **claude-sonnet-5-5 / low**: uren 3, km None: ARB-TECH×3, OND-PRES×1, VERPL×1 (3×)

