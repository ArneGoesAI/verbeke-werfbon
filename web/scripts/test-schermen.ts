// Draait de queries van T1 en T2 met de testaccount van de technieker (publishable key, dus door RLS) en
// controleert dat een interventie van een collega onzichtbaar is. Alleen lezen. Wachtwoorden uit .env.testaccounts.
//
//   npm --prefix web run test:schermen

import { readFileSync } from "node:fs";
import path from "node:path";

import nextEnv from "@next/env";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import { tijd } from "../lib/opmaak";
import { dagGrenzen, kaartKlant, kaartOmschrijving, kaartTitel, kaarten } from "../lib/schermen/vandaag";
import { laadInterventie, laadVandaag, peildatum } from "../lib/schermen/queries";
import { publiekeConfig } from "../lib/supabase/config";
import { REPO } from "../lib/verwerking/testhulp";

nextEnv.loadEnvConfig(REPO);
const bestand = Object.fromEntries(
  readFileSync(path.join(REPO, ".env.testaccounts"), "utf8")
    .split("\n")
    .filter((r) => r.includes("=") && !r.startsWith("#"))
    .map((r) => [r.slice(0, r.indexOf("=")), r.slice(r.indexOf("=") + 1)]),
);

const { url, publiekeSleutel } = publiekeConfig();
let fouten = 0;
const controleer = (ok: boolean, tekst: string) => {
  console.log(`  ${ok ? "ok  " : "FOUT"} ${tekst}`);
  if (!ok) fouten++;
};

async function aanmelden(soort: "TECHNIEKER" | "ADMINISTRATIE"): Promise<{ db: SupabaseClient; id: number }> {
  const db = createClient(url, publiekeSleutel, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({
    email: bestand[`${soort}_EMAIL`],
    password: bestand[`${soort}_WACHTWOORD`],
  });
  if (error || !data.user) throw new Error(`aanmelden ${soort.toLowerCase()} mislukt`);
  const { data: ik } = await db.from("medewerkers").select("id").eq("auth_user_id", data.user.id).single<{ id: number }>();
  return { db, id: ik!.id };
}

async function main() {
  const tech = await aanmelden("TECHNIEKER");
  console.log(`technieker (medewerker ${tech.id}):`);
  const { datum, interventies } = await laadVandaag(tech.db, tech.id);
  controleer(datum === "2026-11-05", `peildatum ${datum}`);
  controleer(interventies.length > 0, `${interventies.length} interventie(s) vandaag`);
  for (const k of kaarten(interventies)) {
    const i = k.interventie;
    console.log(
      `       #${i.id} ${i.gepland_start ? tijd(i.gepland_start) : "--:--"} ${kaartTitel(i)} | ${kaartOmschrijving(i)} | ` +
        `${kaartKlant(i.klant)} | ${k.label.tekst}${k.actief ? " (actief)" : ""}`,
    );
    const los = await laadInterventie(tech.db, tech.id, i.id);
    controleer(los?.id === i.id, `T2 laadt interventie ${i.id}`);
  }

  // Een interventie van een collega op dezelfde dag, gezocht met de administratie.
  const admin = await aanmelden("ADMINISTRATIE");
  const { van, tot } = dagGrenzen(await peildatum(admin.db));
  const { data: andere } = await admin.db
    .from("interventies")
    .select("id, interventie_techniekers(medewerker_id)")
    .gte("gepland_start", van)
    .lt("gepland_start", tot);
  const vreemd = (andere ?? []).find(
    (r: { interventie_techniekers: { medewerker_id: number }[] }) =>
      !r.interventie_techniekers.some((t) => t.medewerker_id === tech.id),
  ) as { id: number } | undefined;
  if (vreemd) {
    controleer((await laadInterventie(tech.db, tech.id, vreemd.id)) === null, `interventie ${vreemd.id} van een collega: niet zichtbaar`);
    const { data: pad } = await tech.db.rpc("is_mijn_opnamepad", { p_naam: `${tech.id}/${vreemd.id}/x.webm` });
    controleer(pad === false, "opnamepad voor die interventie wordt geweigerd");
  } else {
    console.log("       (geen interventie van een collega op de peildatum gevonden)");
  }
  const eigen = interventies[0];
  if (eigen) {
    const { data: pad } = await tech.db.rpc("is_mijn_opnamepad", { p_naam: `${tech.id}/${eigen.id}/x.webm` });
    controleer(pad === true, `opnamepad voor eigen interventie ${eigen.id} wordt aanvaard`);
  }

  const { data: artikelen } = await tech.db.from("artikelen").select("code, omschrijving, categorie");
  controleer((artikelen?.length ?? 0) > 0, `catalogus zichtbaar (${artikelen?.length} artikelen)`);

  await tech.db.auth.signOut({ scope: "local" });
  await admin.db.auth.signOut({ scope: "local" });
  console.log(fouten === 0 ? "ALLES OK" : `${fouten} fout(en)`);
  process.exit(fouten === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
