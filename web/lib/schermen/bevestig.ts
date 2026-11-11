// Bevestigen van een conceptbon op een client met de sessie van de technieker: RLS en de kolomrechten van migratie
// 0004 laten alleen de eigen conceptbon toe. De statusovergang en de conceptfactuur doet bevestig_werfbon in de
// database. De app roept dit aan via de server action in app/bon/[id]/acties.ts; scripts/test-flow.ts rechtstreeks.

import type { SupabaseClient } from "@supabase/supabase-js";

import { type BevestigInvoer, controleer } from "./voorstel";

export type BevestigUitkomst = { fout: string; factuurId?: undefined } | { fout: null; factuurId: number | null };

export async function bevestigBon(
  db: SupabaseClient,
  ikId: number,
  werfbonId: number,
  invoer: BevestigInvoer,
): Promise<BevestigUitkomst> {
  if (!Number.isSafeInteger(werfbonId) || werfbonId <= 0) return { fout: "Onbekende bon." };
  const { data, error } = await db
    .from("werfbonnen")
    .select("id, status, interventie:interventies(type, contract:onderhoudscontracten(toesteltype))")
    .eq("id", werfbonId)
    .eq("technieker_id", ikId)
    .maybeSingle();
  if (error) return { fout: "De bon kon niet worden geladen. Probeer opnieuw." };
  const bon = data as unknown as {
    status: string;
    interventie: { type: string; contract: { toesteltype: string } | null } | null;
  } | null;
  if (!bon || !bon.interventie) return { fout: "Deze bon is niet van jou." };
  if (bon.status !== "concept") return { fout: "Deze bon is al bevestigd." };

  const { data: artikelen, error: artikelFout } = await db.from("artikelen").select("id, code");
  if (artikelFout || !artikelen) return { fout: "De catalogus kon niet worden geladen. Probeer opnieuw." };
  const ids = new Map(artikelen.map((a: { id: number; code: string }) => [a.code, a.id]));

  const c = controleer(
    invoer,
    { type: bon.interventie.type, toesteltype: bon.interventie.contract?.toesteltype ?? null },
    new Set(ids.keys()),
  );
  if (!c.ok) return { fout: c.fout };

  // Niet in één transactie: lukt een stap niet, dan blijft de bon een concept en kan de technieker opnieuw
  // bevestigen (de aanpassingen staan nog in het scherm).
  const bijwerken = await db.from("werfbonnen").update({ uren: c.uren, km: c.km, opmerkingen: c.opmerkingen }).eq("id", werfbonId);
  if (bijwerken.error) return { fout: "De bon kon niet worden bijgewerkt. Probeer opnieuw." };

  const weg = await db.from("werfbon_lijnen").delete().eq("werfbon_id", werfbonId);
  if (weg.error) return { fout: "De lijnen konden niet worden bijgewerkt. Probeer opnieuw." };
  if (c.lijnen.length > 0) {
    const erbij = await db
      .from("werfbon_lijnen")
      .insert(c.lijnen.map((l) => ({ werfbon_id: werfbonId, artikel_id: ids.get(l.code)!, aantal: l.aantal })));
    if (erbij.error) return { fout: "De lijnen konden niet worden opgeslagen. Probeer opnieuw." };
  }

  const bevestigd = await db.rpc("bevestig_werfbon", { p_werfbon_id: werfbonId });
  if (bevestigd.error) {
    console.error("[bevestig]", bevestigd.error.message);
    return { fout: "Bevestigen lukte niet. Probeer opnieuw." };
  }
  return { fout: null, factuurId: (bevestigd.data as number | null) ?? null };
}
