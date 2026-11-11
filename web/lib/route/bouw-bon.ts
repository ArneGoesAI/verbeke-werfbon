// Rijen voor werfbonnen, werfbon_lijnen en werfbon_opnames uit het resultaat van verwerk(). Puur.

import type { Resultaat } from "../verwerking/verwerk";
import type { Lijn } from "../verwerking/types";

export type Soort = "audio" | "foto";

export type BonRij = {
  interventie_id: number;
  technieker_id: number;
  datum: string;
  uren: number;
  km: number;
  opmerkingen: string | null;
  status: "concept";
  bron: "spraak" | "foto";
};

export type LijnRij = { artikel_id: number; aantal: number };

export type OpnameRij = {
  interventie_id: number;
  technieker_id: number;
  werfbon_id: number | null;
  type: Soort;
  storage_pad: string;
  transcript: string | null;
  extractie: unknown;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

type Basis = { interventieId: number; ikId: number };

export function bonRij(r: Extract<Resultaat, { ok: true }>, b: Basis & { datum: string; soort: Soort }): BonRij {
  return {
    interventie_id: b.interventieId,
    technieker_id: b.ikId,
    datum: b.datum,
    uren: r.extractie.uren,
    // werfbonnen.km is een integer; het model mag 21,5 zeggen. Afronden is hier geen correctie van de inhoud.
    km: Math.round(r.extractie.km ?? 0),
    opmerkingen: r.extractie.opmerking.trim() || null,
    status: "concept",
    bron: b.soort === "audio" ? "spraak" : "foto",
  };
}

export class OnbekendArtikel extends Error {}

/** Code → artikel_id. Een code die niet in de live catalogus staat, is een fout: dan klopt de bevroren catalogus niet. */
export function lijnRijen(lijnen: Lijn[], artikelIds: ReadonlyMap<string, number>): LijnRij[] {
  return lijnen.map((l) => {
    const id = artikelIds.get(l.code);
    if (id === undefined) throw new OnbekendArtikel(`artikel ${l.code} staat niet in de catalogus`);
    return { artikel_id: id, aantal: l.aantal };
  });
}

/** De opname, ook als de verwerking mislukte (dan zonder bon en zonder extractie). */
export function opnameRij(
  r: Resultaat | null,
  b: Basis & { soort: Soort; pad: string; werfbonId: number | null },
): OpnameRij {
  const u = r?.antwoord?.usage;
  return {
    interventie_id: b.interventieId,
    technieker_id: b.ikId,
    werfbon_id: b.werfbonId,
    type: b.soort,
    storage_pad: b.pad,
    transcript: r?.transcript ?? null,
    extractie: r?.ok ? r.extractie : null,
    model: r?.antwoord?.model_antwoord ?? null,
    // Alle invoertokens, ook die uit de cache: zo is de kost per opname na te rekenen.
    input_tokens: u ? u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens : null,
    output_tokens: u?.output_tokens ?? null,
  };
}
