"use server";

import { redirect } from "next/navigation";

import { serverClient } from "@/lib/supabase/server";

export type AanmeldStaat = { fout: string | null; email: string };

export async function aanmelden(_vorige: AanmeldStaat, form: FormData): Promise<AanmeldStaat> {
  const email = String(form.get("email") ?? "").trim();
  const wachtwoord = String(form.get("wachtwoord") ?? "");
  if (!email || !wachtwoord) return { fout: "Vul je e-mailadres en wachtwoord in.", email };

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
  // Geen onderscheid tussen onbekend adres en fout wachtwoord: dat zou verraden welke adressen bestaan.
  if (error) return { fout: "Aanmelden lukt niet. Kijk je e-mailadres en wachtwoord na.", email };
  redirect("/");
}

export async function afmelden(): Promise<void> {
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect("/login");
}
