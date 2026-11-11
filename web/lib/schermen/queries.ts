// Queries voor de schermen van de technieker, op een client met de sessie van de gebruiker: RLS beperkt al tot de
// eigen interventies en bonnen. De filters op medewerker staan er toch bij, zodat het scherm niet stil verandert als
// de policies ooit ruimer worden. De app gebruikt ze via laad.ts; scripts/test-schermen.ts rechtstreeks.

import type { SupabaseClient } from "@supabase/supabase-js";

import { type BonStatus, type Interventie, dagGrenzen } from "./vandaag";

type Supabase = SupabaseClient;

const INTERVENTIE_VELDEN = `
  id, type, gepland_start, omschrijving, status,
  klant:klanten(type, voornaam, achternaam, bedrijfsnaam, straat, huisnummer, gemeente),
  contract:onderhoudscontracten(toesteltype, merk, model),
  interventie_techniekers!inner(medewerker_id),
  werfbonnen(id, status, technieker_id)
`;

type Rij = {
  id: number;
  type: string;
  gepland_start: string | null;
  omschrijving: string | null;
  status: string;
  klant: Interventie["klant"];
  contract: { toesteltype: string; merk: string; model: string } | null;
  werfbonnen: { id: number; status: BonStatus; technieker_id: number }[];
};

function naarInterventie(r: Rij, ikId: number): Interventie {
  return {
    id: r.id,
    type: r.type,
    gepland_start: r.gepland_start,
    omschrijving: r.omschrijving,
    klant: r.klant,
    toestel: r.contract,
    bonnen: (r.werfbonnen ?? []).filter((b) => b.technieker_id === ikId).map(({ id, status }) => ({ id, status })),
  };
}

/** De peildatum ("vandaag" van de fictieve data), uit de database. */
export async function peildatum(db: Supabase): Promise<string> {
  const { data, error } = await db.rpc("peildatum");
  if (error || typeof data !== "string") throw new Error(`peildatum: ${error?.message ?? "geen datum"}`);
  return data;
}

/** T1: eigen herstellingen en onderhouden op de peildatum. */
export async function laadVandaag(db: Supabase, ikId: number): Promise<{ datum: string; interventies: Interventie[] }> {
  const datum = await peildatum(db);
  const { van, tot } = dagGrenzen(datum);
  const { data, error } = await db
    .from("interventies")
    .select(INTERVENTIE_VELDEN)
    .eq("interventie_techniekers.medewerker_id", ikId)
    .in("type", ["herstelling", "onderhoud"])
    .neq("status", "geannuleerd")
    .gte("gepland_start", van)
    .lt("gepland_start", tot)
    .order("gepland_start");
  if (error) throw new Error(`interventies: ${error.message}`);
  return { datum, interventies: (data as unknown as Rij[]).map((r) => naarInterventie(r, ikId)) };
}

/** T2 en T3: één eigen interventie, of null (onbestaand of van een collega). */
export async function laadInterventie(db: Supabase, ikId: number, id: number): Promise<Interventie | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const { data, error } = await db
    .from("interventies")
    .select(INTERVENTIE_VELDEN)
    .eq("id", id)
    .eq("interventie_techniekers.medewerker_id", ikId)
    .maybeSingle();
  if (error) throw new Error(`interventie ${id}: ${error.message}`);
  return data ? naarInterventie(data as unknown as Rij, ikId) : null;
}

export type BonVoorT4 = {
  id: number;
  status: BonStatus;
  uren: number;
  km: number;
  opmerkingen: string | null;
  interventie: Interventie;
  lijnen: { code: string; aantal: number }[];
  extractie: unknown; // werfbon_opnames.extractie van de laatste opname bij deze bon
  catalogus: { code: string; omschrijving: string; categorie: string }[]; // zonder prijzen
};

/** T4: een eigen bon met lijnen, opname-extractie en de catalogus (namen, geen prijzen). */
export async function laadBon(db: Supabase, ikId: number, id: number): Promise<BonVoorT4 | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const { data: bon, error } = await db
    .from("werfbonnen")
    .select("id, status, uren, km, opmerkingen, interventie_id, technieker_id, werfbon_lijnen(aantal, artikel:artikelen(code))")
    .eq("id", id)
    .eq("technieker_id", ikId)
    .maybeSingle();
  if (error) throw new Error(`werfbon ${id}: ${error.message}`);
  if (!bon) return null;
  const b = bon as unknown as {
    id: number;
    status: BonStatus;
    uren: number | string;
    km: number;
    opmerkingen: string | null;
    interventie_id: number;
    werfbon_lijnen: { aantal: number | string; artikel: { code: string } | null }[];
  };

  const [interventie, opname, catalogus] = await Promise.all([
    laadInterventie(db, ikId, b.interventie_id),
    db
      .from("werfbon_opnames")
      .select("extractie")
      .eq("werfbon_id", id)
      .order("aangemaakt_op", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("artikelen").select("code, omschrijving, categorie").order("omschrijving"),
  ]);
  if (!interventie) return null;
  if (opname.error) throw new Error(`opname: ${opname.error.message}`);
  if (catalogus.error) throw new Error(`artikelen: ${catalogus.error.message}`);

  return {
    id: b.id,
    status: b.status,
    uren: Number(b.uren),
    km: b.km,
    opmerkingen: b.opmerkingen,
    interventie,
    lijnen: b.werfbon_lijnen
      .filter((l) => l.artikel)
      .map((l) => ({ code: l.artikel!.code, aantal: Number(l.aantal) })),
    extractie: (opname.data as { extractie: unknown } | null)?.extractie ?? null,
    catalogus: catalogus.data as BonVoorT4["catalogus"],
  };
}
