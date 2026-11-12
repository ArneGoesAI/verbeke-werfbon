// Maakt de twee testaccounts aan (of zet ze opnieuw goed) en koppelt ze aan een medewerker.
//
//   npm --prefix web run testaccounts
//
// - technieker@verbeke.test     → de actieve technieker met de meeste herstellingen en onderhouden op peildatum()
// - administratie@verbeke.test  → de eerste actieve medewerker met rol administratie
//
// Schrijft naar de gedeelde database (auth.users en medewerkers.auth_user_id), met SUPABASE_SECRET_KEY.
// Idempotent: een bestaande testgebruiker krijgt een nieuw wachtwoord, een bestaande koppeling blijft.
// De wachtwoorden komen in .env.testaccounts in de repo-root (valt onder .env.* in .gitignore), nooit op het scherm.
// Opruimen: scripts/opruimen.ts --ook-accounts.
//
//   npm --prefix web run testaccounts -- --extra
//
// Twee extra logins met zelfgekozen wachtwoorden: technieker2@verbeke.test (de volgende technieker in dezelfde rij)
// en administratie2@verbeke.test (de tweede actieve administratie). De wachtwoorden komen uit .env.extra-accounts in
// de repo-root; bestaat dat niet, dan maakt het script een leeg sjabloon en stopt het. Het bestand wordt nooit
// overschreven en de wachtwoorden komen nooit op het scherm. Test daarna met test:logins -- --extra.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import nextEnv from "@next/env";

import {
  EXTRA_ACCOUNTS,
  type Inplanning,
  type Medewerker,
  type Soort,
  TESTACCOUNTS,
  controleerKoppeling,
  controleerWachtwoord,
  envBestand,
  extraSjabloon,
  kiesAdministratie,
  kiesTechnieker,
  leesEnv,
  maakWachtwoord,
} from "../lib/beheer/testaccounts";
import { maakDienstClient } from "../lib/supabase/dienst-kern";
import { REPO } from "../lib/verwerking/testhulp";

const { values: opties } = parseArgs({ options: { extra: { type: "boolean", default: false } } });
const extra = opties.extra ?? false;
const accounts = extra ? EXTRA_ACCOUNTS : TESTACCOUNTS;
const plaats = extra ? 1 : 0;
const extraBestand = path.join(REPO, ".env.extra-accounts");

/** Met --extra: de zelfgekozen wachtwoorden, nagekeken vóór er iets naar de database gaat. */
function leesExtraWachtwoorden(): Record<Soort, string> {
  if (!existsSync(extraBestand)) {
    writeFileSync(extraBestand, extraSjabloon(), { mode: 0o600 });
    throw new Error(`${extraBestand} aangemaakt. Vul de twee wachtwoorden in en draai opnieuw. Niets aangepast.`);
  }
  const env = leesEnv(readFileSync(extraBestand, "utf8"));
  for (const soort of ["technieker", "administratie"] as const) {
    const sleutel = `${soort.toUpperCase()}_EMAIL`;
    if (env[sleutel] !== EXTRA_ACCOUNTS[soort]) {
      throw new Error(`${sleutel} in .env.extra-accounts moet ${EXTRA_ACCOUNTS[soort]} zijn. Niets aangepast.`);
    }
  }
  return {
    technieker: controleerWachtwoord(env.TECHNIEKER_WACHTWOORD, "TECHNIEKER_WACHTWOORD"),
    administratie: controleerWachtwoord(env.ADMINISTRATIE_WACHTWOORD, "ADMINISTRATIE_WACHTWOORD"),
  };
}

nextEnv.loadEnvConfig(REPO);
const db = maakDienstClient();

function stop(wat: string, fout: { message: string } | null): never {
  throw new Error(`${wat}: ${fout?.message ?? "onbekende fout"}`);
}

async function zoekGebruiker(email: string): Promise<string | null> {
  // Hooguit enkele gebruikers in dit project: één pagina volstaat, maar we lopen ze voor de zekerheid af.
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) stop("Gebruikers ophalen", error);
    const treffer = data.users.find((u) => u.email === email);
    if (treffer) return treffer.id;
    if (data.users.length < 200) return null;
  }
}

async function zetGebruiker(email: string, wachtwoord: string): Promise<string> {
  const bestaand = await zoekGebruiker(email);
  if (bestaand) {
    const { error } = await db.auth.admin.updateUserById(bestaand, { password: wachtwoord });
    if (error) stop(`Wachtwoord van ${email}`, error);
    console.log(`  ${email}: bestond al, nieuw wachtwoord gezet`);
    return bestaand;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password: wachtwoord, email_confirm: true });
  if (error || !data.user) stop(`Gebruiker ${email} aanmaken`, error);
  console.log(`  ${email}: aangemaakt`);
  return data.user.id;
}

async function main() {
  // Eerst de wachtwoorden: een fout erin stopt alles voor er iets gelezen of geschreven wordt.
  const extraWachtwoorden = extra ? leesExtraWachtwoorden() : null;
  const { data: peildatum, error: e1 } = await db.rpc("peildatum");
  if (e1) stop("peildatum()", e1);

  const { data: medewerkers, error: e2 } = await db
    .from("medewerkers")
    .select("id, rol, actief, auth_user_id")
    .returns<Medewerker[]>();
  if (e2 || !medewerkers) stop("Medewerkers ophalen", e2);

  const volgendeDag = new Date(`${peildatum}T00:00:00Z`);
  volgendeDag.setUTCDate(volgendeDag.getUTCDate() + 1);
  const { data: interventies, error: e3 } = await db
    .from("interventies")
    .select("id, interventie_techniekers(medewerker_id)")
    .in("type", ["herstelling", "onderhoud"])
    .gte("gepland_start", `${peildatum}T00:00:00`)
    .lt("gepland_start", volgendeDag.toISOString().slice(0, 10) + "T00:00:00")
    .returns<{ id: number; interventie_techniekers: { medewerker_id: number }[] }[]>();
  if (e3 || !interventies) stop("Interventies ophalen", e3);
  const inplanning: Inplanning[] = interventies.flatMap((i) =>
    i.interventie_techniekers.map((t) => ({ interventie_id: i.id, medewerker_id: t.medewerker_id })),
  );

  const gekozen: Record<Soort, Medewerker> = {
    technieker: kiesTechnieker(medewerkers, inplanning, plaats),
    administratie: kiesAdministratie(medewerkers, plaats),
  };
  console.log(`Peildatum ${peildatum}: technieker = medewerker ${gekozen.technieker.id} ` +
    `(${inplanning.filter((r) => r.medewerker_id === gekozen.technieker.id).length} interventies), ` +
    `administratie = medewerker ${gekozen.administratie.id}`);

  // Eerst alle controles, pas dan schrijven: een bezette koppeling stopt alles voor er iets verandert.
  for (const soort of ["technieker", "administratie"] as const) {
    const bestaand = await zoekGebruiker(accounts[soort]);
    controleerKoppeling(gekozen[soort], bestaand ?? "nog-niet-aangemaakt");
    const elders = medewerkers.find((m) => bestaand && m.auth_user_id === bestaand && m.id !== gekozen[soort].id);
    if (elders) throw new Error(`${accounts[soort]} hangt al aan medewerker ${elders.id}. Gestopt.`);
  }

  const wachtwoorden = extraWachtwoorden ?? { technieker: maakWachtwoord(), administratie: maakWachtwoord() };
  for (const soort of ["technieker", "administratie"] as const) {
    const gebruikerId = await zetGebruiker(accounts[soort], wachtwoorden[soort]);
    if (gekozen[soort].auth_user_id !== gebruikerId) {
      const { error } = await db
        .from("medewerkers")
        .update({ auth_user_id: gebruikerId })
        .eq("id", gekozen[soort].id)
        .is("auth_user_id", null); // nooit een bestaande koppeling overschrijven
      if (error) stop(`Koppeling medewerker ${gekozen[soort].id}`, error);
      console.log(`  medewerker ${gekozen[soort].id} gekoppeld`);
    }
  }

  if (extra) {
    console.log(`Wachtwoorden uit ${extraBestand} gezet.`);
    return;
  }
  const bestand = path.join(REPO, ".env.testaccounts");
  writeFileSync(bestand, envBestand(wachtwoorden), { mode: 0o600 });
  console.log(`Wachtwoorden geschreven naar ${bestand}`);
}

main().catch((fout: unknown) => {
  console.error(fout instanceof Error ? fout.message : fout);
  process.exit(1);
});
