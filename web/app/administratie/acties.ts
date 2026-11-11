"use server";

// Goedkeuren en versturen vanuit A1. De logica staat in lib/schermen/administratie.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { bestemmingVoorRol } from "@/lib/rol";
import { keurFactuurGoed } from "@/lib/schermen/administratie";
import { leesFilter } from "@/lib/schermen/waarschuwing";
import { huidigeMedewerker } from "@/lib/sessie";
import { serverClient } from "@/lib/supabase/server";

export type GoedkeurStaat = { fout: string | null };

export async function keurGoed(_vorige: GoedkeurStaat, form: FormData): Promise<GoedkeurStaat> {
  const ik = await huidigeMedewerker();
  if (!ik || bestemmingVoorRol(ik.rol) !== "/administratie") return { fout: "Je bent niet meer aangemeld als administratie." };
  const r = await keurFactuurGoed(await serverClient(), Number(form.get("factuur")));
  if (r.fout) return r;
  revalidatePath("/administratie");
  const filter = leesFilter(String(form.get("filter") ?? ""));
  redirect(filter === "nakijken" ? "/administratie?filter=nakijken" : "/administratie");
}
