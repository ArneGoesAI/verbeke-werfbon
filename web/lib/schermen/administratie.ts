// Queries en de goedkeuring voor A1 Conceptfacturen, op een client met de sessie van de administratie: RLS laat
// facturen alleen aan de administratie zien. De app gebruikt ze via laad-administratie.ts en de server action in
// app/administratie/acties.ts; scripts/test-administratie.ts rechtstreeks.

import type { SupabaseClient } from "@supabase/supabase-js";

import { klantnaam } from "../opmaak";
import { type Klant, type ToestelInfo, kaartTitel } from "./vandaag";
import { type FactuurLijn, type FactuurStatus, factuurStatus } from "./waarschuwing";

type Supabase = SupabaseClient;

export const BUCKET = "werfbon-opnames";
const GELDIG_SECONDEN = 10 * 60;

const FACTUUR_VELDEN = `
  id, nummer, factuurdatum, btw_tarief, totaal_excl_btw, status,
  klant:klanten(type, voornaam, achternaam, bedrijfsnaam, straat, huisnummer, gemeente),
  werfbonnen(
    id, nummer, uren, km, opmerkingen, getekend_door_klant, bron,
    technieker:medewerkers(voornaam, achternaam),
    interventie:interventies(type, contract:onderhoudscontracten(toesteltype, merk, model))
  )
`;

type BonRij = {
  id: number;
  nummer: string;
  uren: number | string;
  km: number;
  opmerkingen: string | null;
  getekend_door_klant: boolean;
  bron: string;
  technieker: { voornaam: string; achternaam: string } | null;
  interventie: { type: string; contract: ToestelInfo | null } | null;
};

type FactuurRij = {
  id: number;
  nummer: string;
  factuurdatum: string;
  btw_tarief: number | string;
  totaal_excl_btw: number | string;
  status: string;
  klant: Klant | null;
  werfbonnen: BonRij[];
};

export type Conceptfactuur = {
  id: number;
  nummer: string;
  factuurdatum: string;
  btwTarief: number;
  totaalExclBtw: number;
  klant: Klant | null;
  klantNaam: string;
  particulier: boolean;
  type: string; // interventietype van de (eerste) bon
  titel: string; // "Herstelling warmtepomp"
  bon: {
    id: number;
    nummer: string;
    uren: number;
    km: number;
    opmerkingen: string | null;
    bron: string;
    technieker: { voornaam: string; achternaam: string } | null;
  } | null;
  waarschuwingen: string[];
  status: FactuurStatus;
};

function naarConcept(r: FactuurRij, waarschuwingen: string[]): Conceptfactuur {
  // Een factuur uit de app hoort bij precies één bon; oude data kan er meer hebben. Het detail toont de eerste.
  const bonnen = [...(r.werfbonnen ?? [])].sort((a, b) => a.id - b.id);
  const b = bonnen[0] ?? null;
  const type = b?.interventie?.type ?? "";
  return {
    id: r.id,
    nummer: r.nummer,
    factuurdatum: r.factuurdatum,
    btwTarief: Number(r.btw_tarief),
    totaalExclBtw: Number(r.totaal_excl_btw),
    klant: r.klant,
    klantNaam: r.klant ? klantnaam(r.klant) : "Onbekende klant",
    particulier: r.klant?.type !== "bedrijf",
    type,
    titel: type ? kaartTitel({ type, toestel: b?.interventie?.contract ?? null }) : "",
    bon: b
      ? {
          id: b.id,
          nummer: b.nummer,
          uren: Number(b.uren),
          km: b.km,
          opmerkingen: b.opmerkingen,
          bron: b.bron,
          technieker: b.technieker,
        }
      : null,
    waarschuwingen,
    status: factuurStatus(waarschuwingen),
  };
}

async function waarschuwingenVoor(db: Supabase, bonIds: number[]): Promise<string[]> {
  const alle: string[] = [];
  for (const id of bonIds) {
    const { data, error } = await db.rpc("factuurwaarschuwingen", { p_werfbon_id: id });
    if (error) throw new Error(`factuurwaarschuwingen ${id}: ${error.message}`);
    alle.push(...((data as string[] | null) ?? []));
  }
  return alle;
}

/** Alle facturen in concept, oudste nummer eerst, met hun waarschuwingen. */
export async function laadConceptfacturen(db: Supabase): Promise<Conceptfactuur[]> {
  const { data, error } = await db
    .from("facturen")
    .select(FACTUUR_VELDEN)
    .eq("status", "concept")
    .order("nummer");
  if (error) throw new Error(`facturen: ${error.message}`);
  const rijen = data as unknown as FactuurRij[];
  return Promise.all(rijen.map(async (r) => naarConcept(r, await waarschuwingenVoor(db, (r.werfbonnen ?? []).map((b) => b.id)))));
}

export type Opname = {
  soort: "audio" | "foto";
  url: string | null; // signed URL, 10 minuten geldig; null als het bestand niet te openen is
  transcript: string | null;
  aangemaaktOp: string;
};

export type FactuurDetail = { lijnen: FactuurLijn[]; opname: Opname | null };

/** Lijnen van een factuur en de laatste opname van de bon, met een signed URL voor het bestand. */
export async function laadFactuurDetail(db: Supabase, factuur: Pick<Conceptfactuur, "id" | "bon">): Promise<FactuurDetail> {
  const [lijnen, opname] = await Promise.all([
    db.from("factuur_lijnen").select("omschrijving, aantal, eenheidsprijs").eq("factuur_id", factuur.id).order("id"),
    factuur.bon
      ? db
          .from("werfbon_opnames")
          .select("type, storage_pad, transcript, aangemaakt_op")
          .eq("werfbon_id", factuur.bon.id)
          .order("aangemaakt_op", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (lijnen.error) throw new Error(`factuur_lijnen: ${lijnen.error.message}`);
  if (opname.error) throw new Error(`opname: ${opname.error.message}`);

  let o: Opname | null = null;
  const rij = opname.data as { type: "audio" | "foto"; storage_pad: string; transcript: string | null; aangemaakt_op: string } | null;
  if (rij) {
    const { data: ondertekend, error } = await db.storage.from(BUCKET).createSignedUrl(rij.storage_pad, GELDIG_SECONDEN);
    if (error) console.error("[opname]", error.message);
    o = { soort: rij.type, url: ondertekend?.signedUrl ?? null, transcript: rij.transcript, aangemaaktOp: rij.aangemaakt_op };
  }

  return {
    lijnen: (lijnen.data as { omschrijving: string; aantal: number | string; eenheidsprijs: number | string }[]).map((l) => ({
      omschrijving: l.omschrijving,
      aantal: Number(l.aantal),
      eenheidsprijs: Number(l.eenheidsprijs),
    })),
    opname: o,
  };
}

/** Goedkeuren en versturen: keur_factuur_goed zet de factuur op verstuurd en de bon op gefactureerd. Geen mail. */
export async function keurFactuurGoed(db: Supabase, factuurId: number): Promise<{ fout: string | null }> {
  if (!Number.isSafeInteger(factuurId) || factuurId <= 0) return { fout: "Onbekende factuur." };
  const { error } = await db.rpc("keur_factuur_goed", { p_factuur_id: factuurId });
  if (!error) return { fout: null };
  console.error("[goedkeuren]", error.message);
  if (error.message.includes("alleen een conceptfactuur")) return { fout: "Deze factuur is al goedgekeurd." };
  if (error.code === "42501") return { fout: "Alleen de administratie kan facturen goedkeuren." };
  return { fout: "Goedkeuren lukte niet. Probeer opnieuw." };
}
