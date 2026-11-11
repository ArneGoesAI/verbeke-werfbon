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

import { writeFileSync } from "node:fs";
import path from "node:path";

import nextEnv from "@next/env";

import {
  type Inplanning,
  type Medewerker,
  type Soort,
  TESTACCOUNTS,
  controleerKoppeling,
  envBestand,
  kiesAdministratie,
  kiesTechnieker,
  maakWachtwoord,
} from "../lib/beheer/testaccounts";
import { maakDienstClient } from "../lib/supabase/dienst-kern";
import { REPO } from "../lib/verwerking/testhulp";

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
    technieker: kiesTechnieker(medewerkers, inplanning),
    administratie: kiesAdministratie(medewerkers),
  };
  console.log(`Peildatum ${peildatum}: technieker = medewerker ${gekozen.technieker.id} ` +
    `(${inplanning.filter((r) => r.medewerker_id === gekozen.technieker.id).length} interventies), ` +
    `administratie = medewerker ${gekozen.administratie.id}`);

  // Eerst alle controles, pas dan schrijven: een bezette koppeling stopt alles voor er iets verandert.
  for (const soort of ["technieker", "administratie"] as const) {
    const bestaand = await zoekGebruiker(TESTACCOUNTS[soort]);
    controleerKoppeling(gekozen[soort], bestaand ?? "nog-niet-aangemaakt");
    const elders = medewerkers.find((m) => bestaand && m.auth_user_id === bestaand && m.id !== gekozen[soort].id);
    if (elders) throw new Error(`${TESTACCOUNTS[soort]} hangt al aan medewerker ${elders.id}. Gestopt.`);
  }

  const wachtwoorden = { technieker: maakWachtwoord(), administratie: maakWachtwoord() };
  for (const soort of ["technieker", "administratie"] as const) {
    const gebruikerId = await zetGebruiker(TESTACCOUNTS[soort], wachtwoorden[soort]);
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

  const bestand = path.join(REPO, ".env.testaccounts");
  writeFileSync(bestand, envBestand(wachtwoorden), { mode: 0o600 });
  console.log(`Wachtwoorden geschreven naar ${bestand}`);
}

main().catch((fout: unknown) => {
  console.error(fout instanceof Error ? fout.message : fout);
  process.exit(1);
});
