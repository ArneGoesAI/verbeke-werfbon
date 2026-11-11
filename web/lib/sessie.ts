// Wie is aangemeld, en past dat bij dit scherm? Alleen op de server.

import "server-only";

import { redirect } from "next/navigation";

import { type Bestemming, bestemmingVoorRol } from "./rol";
import { serverClient } from "./supabase/server";

export type Ik = { id: number; voornaam: string; achternaam: string; rol: string };

/** De actieve medewerker achter de login, of null. RLS laat alleen de eigen rij (of alles, voor de administratie) zien. */
export async function huidigeMedewerker(): Promise<Ik | null> {
  const supabase = await serverClient();
  const { data: gebruiker } = await supabase.auth.getUser(); // controleert het token bij Supabase Auth
  if (!gebruiker.user) return null;
  const { data } = await supabase
    .from("medewerkers")
    .select("id, voornaam, achternaam, rol")
    .eq("auth_user_id", gebruiker.user.id)
    .eq("actief", true)
    .maybeSingle<Ik>();
  return data;
}

/** Voor een scherm: zonder login naar /login, met de verkeerde rol naar het eigen scherm. */
export async function vereisScherm(scherm: Bestemming): Promise<Ik> {
  const ik = await huidigeMedewerker();
  if (!ik) redirect("/login");
  const eigen = bestemmingVoorRol(ik.rol);
  if (eigen !== scherm) redirect(eigen ?? "/");
  return ik;
}
