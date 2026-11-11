// De echte afhankelijkheden van POST /api/verwerk, op meegegeven clients: lezen met de sessie (RLS), schrijven met
// de secret key. Zonder "server-only", zodat scripts/test-flow.ts dezelfde code draait; de app gebruikt
// afhankelijkheden.ts.

import type { SupabaseClient } from "@supabase/supabase-js";

import { verwerk } from "../verwerking/verwerk";
import type { DienstAfh, RouteAfh, SessieAfh } from "./verwerk-route";

export const BUCKET = "werfbon-opnames";

export async function sessieAfh(db: SupabaseClient): Promise<SessieAfh | null> {
  const { data: ik, error } = await db.rpc("mijn_medewerker_id");
  if (error || typeof ik !== "number") return null;
  return {
    ikId: ik,
    async isMijnOpnamepad(pad) {
      const { data, error } = await db.rpc("is_mijn_opnamepad", { p_naam: pad });
      if (error) throw new Error(`is_mijn_opnamepad: ${error.message}`);
      return data === true;
    },
    async interventie(id) {
      const { data, error } = await db
        .from("interventies")
        .select("type, omschrijving, contract:onderhoudscontracten(toesteltype, merk, model)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`interventie ${id}: ${error.message}`);
      if (!data) return null;
      const r = data as unknown as {
        type: string;
        omschrijving: string | null;
        contract: { toesteltype: string; merk: string; model: string } | null;
      };
      // Zelfde vorm als de context in eval/export_gold.py.
      return {
        type: r.type,
        omschrijving: r.omschrijving ?? "",
        toestel: r.contract ? { type: r.contract.toesteltype, merk: r.contract.merk, model: r.contract.model } : null,
      };
    },
    async download(pad) {
      const { data, error } = await db.storage.from(BUCKET).download(pad);
      if (error || !data) throw new Error(`download ${pad}: ${error?.message ?? "leeg"}`);
      return data;
    },
  };
}

export function dienstAfh(db: SupabaseClient): DienstAfh {
  const controleer = (wat: string, error: { message: string } | null) => {
    if (error) throw new Error(`${wat}: ${error.message}`);
  };
  return {
    async peildatum() {
      const { data, error } = await db.rpc("peildatum");
      controleer("peildatum", error);
      return data as string;
    },
    async eigenBonnen(interventieId, ikId) {
      const { data, error } = await db
        .from("werfbonnen")
        .select("id, status")
        .eq("interventie_id", interventieId)
        .eq("technieker_id", ikId);
      controleer("werfbonnen", error);
      return data ?? [];
    },
    async artikelIds(codes) {
      if (codes.length === 0) return new Map();
      const { data, error } = await db.from("artikelen").select("id, code").in("code", codes);
      controleer("artikelen", error);
      return new Map((data ?? []).map((a: { id: number; code: string }) => [a.code, a.id]));
    },
    async maakBon(rij) {
      // nummer vult de trigger werfbon_nummer_invullen.
      const { data, error } = await db.from("werfbonnen").insert(rij).select("id").single();
      controleer("werfbon", error);
      return (data as { id: number }).id;
    },
    async maakLijnen(werfbonId, rijen) {
      if (rijen.length === 0) return;
      const { error } = await db.from("werfbon_lijnen").insert(rijen.map((r) => ({ ...r, werfbon_id: werfbonId })));
      controleer("werfbon_lijnen", error);
    },
    async maakOpname(rij) {
      const { error } = await db.from("werfbon_opnames").insert(rij);
      controleer("werfbon_opnames", error);
    },
    async verwijderConceptbon(werfbonId, ikId) {
      const { error } = await db
        .from("werfbonnen")
        .delete()
        .eq("id", werfbonId)
        .eq("technieker_id", ikId)
        .eq("status", "concept")
        .is("factuur_id", null);
      controleer("werfbon verwijderen", error);
    },
  };
}

export function maakAfhankelijkheden(
  sessieDb: () => Promise<SupabaseClient>,
  dienstDb: () => SupabaseClient,
): RouteAfh {
  return {
    sessie: async () => sessieAfh(await sessieDb()),
    dienst: () => dienstAfh(dienstDb()),
    verwerk: (ctx, invoer) => verwerk(ctx, invoer),
    log: (tekst) => console.error(`[api/verwerk] ${tekst}`),
  };
}
