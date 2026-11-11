"use server";

// Bevestigen vanuit T4. De logica staat in lib/schermen/bevestig.ts.

import { redirect } from "next/navigation";

import { bevestigBon } from "@/lib/schermen/bevestig";
import type { BevestigInvoer } from "@/lib/schermen/voorstel";
import { huidigeMedewerker } from "@/lib/sessie";
import { serverClient } from "@/lib/supabase/server";

export type BevestigStaat = { fout: string | null };

export async function bevestig(werfbonId: number, invoer: BevestigInvoer): Promise<BevestigStaat> {
  const ik = await huidigeMedewerker();
  if (!ik || ik.rol !== "technieker") return { fout: "Je bent niet meer aangemeld als technieker." };
  const r = await bevestigBon(await serverClient(), ik.id, werfbonId, invoer);
  if (r.fout) return { fout: r.fout };
  redirect("/vandaag");
}
