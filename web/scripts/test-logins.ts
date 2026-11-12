// Meldt beide testaccounts aan zoals de app (publishable key, dus door RLS) en controleert wat ze zien.
// Alleen lezen. Wachtwoorden uit .env.testaccounts (scripts/testaccounts.ts); ze komen nooit op het scherm.
//
//   npm --prefix web run test:logins
//   npm --prefix web run test:logins -- --extra   # de extra logins uit .env.extra-accounts

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import nextEnv from "@next/env";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import { leesEnv } from "../lib/beheer/testaccounts";
import { bestemmingVoorRol } from "../lib/rol";
import { publiekeConfig } from "../lib/supabase/config";
import { REPO } from "../lib/verwerking/testhulp";

nextEnv.loadEnvConfig(REPO);
// .env.testaccounts hoort niet bij de bestanden die @next/env laadt: zelf inlezen.
const { values: opties } = parseArgs({ options: { extra: { type: "boolean", default: false } } });
const bestand = leesEnv(
  readFileSync(path.join(REPO, opties.extra ? ".env.extra-accounts" : ".env.testaccounts"), "utf8"),
);

const { url, publiekeSleutel } = publiekeConfig();
let fouten = 0;
const controleer = (ok: boolean, tekst: string) => {
  console.log(`  ${ok ? "ok  " : "FOUT"} ${tekst}`);
  if (!ok) fouten++;
};

async function telZichtbaar(db: SupabaseClient, tabel: string): Promise<number> {
  const { count, error } = await db.from(tabel).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${tabel}: ${error.message}`);
  return count ?? 0;
}

async function test(soort: "TECHNIEKER" | "ADMINISTRATIE", verwacht: "/vandaag" | "/administratie") {
  console.log(`${soort.toLowerCase()}:`);
  const db = createClient(url, publiekeSleutel, { auth: { persistSession: false, autoRefreshToken: false } });

  const fout = await db.auth.signInWithPassword({ email: bestand[`${soort}_EMAIL`], password: "fout-wachtwoord" });
  controleer(fout.error !== null, "fout wachtwoord wordt geweigerd");

  const { data, error } = await db.auth.signInWithPassword({
    email: bestand[`${soort}_EMAIL`],
    password: bestand[`${soort}_WACHTWOORD`],
  });
  controleer(!error && !!data.user, "aanmelden lukt");
  if (error || !data.user) return;

  const { data: ik } = await db
    .from("medewerkers")
    .select("id, rol")
    .eq("auth_user_id", data.user.id)
    .maybeSingle<{ id: number; rol: string }>();
  controleer(!!ik, `eigen medewerker gevonden (id ${ik?.id})`);
  controleer(bestemmingVoorRol(ik?.rol) === verwacht, `doorgestuurd naar ${verwacht}`);

  const medewerkers = await telZichtbaar(db, "medewerkers");
  const facturen = await telZichtbaar(db, "facturen");
  const interventies = await telZichtbaar(db, "interventies");
  if (soort === "TECHNIEKER") {
    controleer(medewerkers === 1, `ziet alleen zichzelf in medewerkers (${medewerkers})`);
    controleer(facturen === 0, `ziet geen facturen (${facturen})`);
    controleer(interventies > 0, `ziet eigen interventies (${interventies})`);
  } else {
    controleer(medewerkers > 1, `ziet alle medewerkers (${medewerkers})`);
    controleer(facturen > 0, `ziet facturen (${facturen})`);
  }
  await db.auth.signOut({ scope: "local" });
}

async function main() {
  const anoniem = createClient(url, publiekeSleutel, { auth: { persistSession: false } });
  console.log("zonder login:");
  controleer((await telZichtbaar(anoniem, "werfbonnen")) === 0, "ziet geen werfbonnen");
  await test("TECHNIEKER", "/vandaag");
  await test("ADMINISTRATIE", "/administratie");
  console.log(fouten === 0 ? "ALLES OK" : `${fouten} fout(en)`);
  process.exit(fouten === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
