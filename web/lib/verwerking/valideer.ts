// Validatie van de modeloutput: eerst het schema (hetzelfde als de structured output, dus geen tweede definitie),
// dan de inhoudelijke grenzen. Een overtreding is een fout; er wordt niets stil gecorrigeerd.

import { Ajv } from "ajv";

import { AFGELEIDE_CODES } from "./afgeleide-lijnen";
import { SCHEMA } from "./gegenereerd";
import type { Extractie } from "./types";

export const MAX_UREN = 12;

const ajv = new Ajv({ allErrors: false, strict: true });
const controleerSchema = ajv.compile<Extractie>(SCHEMA);

export type Validatie = { ok: true; extractie: Extractie } | { ok: false; fout: string };

export function valideer(tekst: string | null | undefined): Validatie {
  if (!tekst) return { ok: false, fout: "lege output" };

  let data: unknown;
  try {
    data = JSON.parse(tekst);
  } catch (e) {
    return { ok: false, fout: `geen geldige JSON: ${(e as Error).message.slice(0, 60)}` };
  }

  if (!controleerSchema(data)) {
    const eerste = controleerSchema.errors![0];
    const plaats = eerste.instancePath || "/";
    return { ok: false, fout: `past niet in het schema: ${plaats}: ${eerste.message ?? eerste.keyword}` };
  }

  const { uren, km, onderdelen } = data;
  if (uren < 0 || uren > MAX_UREN) return { ok: false, fout: `uren buiten 0–${MAX_UREN}: ${uren}` };
  if (km !== null && km < 0) return { ok: false, fout: `km negatief: ${km}` };
  for (const [i, o] of onderdelen.entries()) {
    if (!(o.aantal > 0)) return { ok: false, fout: `onderdeel ${i} (${o.code}): aantal moet groter dan 0 zijn` };
    if (AFGELEIDE_CODES.has(o.code)) return { ok: false, fout: `onderdeel ${i}: afgeleide code ${o.code}` };
  }
  return { ok: true, extractie: data };
}
