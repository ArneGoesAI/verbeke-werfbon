// Logica achter scripts/testaccounts.ts, los van Supabase zodat ze te testen is.

import { randomBytes } from "node:crypto";

export const TESTACCOUNTS = {
  technieker: "technieker@verbeke.test",
  administratie: "administratie@verbeke.test",
} as const;

/** Twee extra logins met een wachtwoord dat de gebruiker zelf kiest (scripts/testaccounts.ts --extra). */
export const EXTRA_ACCOUNTS = {
  technieker: "technieker2@verbeke.test",
  administratie: "administratie2@verbeke.test",
} as const;

/** Alle testlogins: opruimen --ook-accounts neemt precies deze mee. */
export const ALLE_TESTMAILS: readonly string[] = [...Object.values(TESTACCOUNTS), ...Object.values(EXTRA_ACCOUNTS)];

export type Soort = keyof typeof TESTACCOUNTS;

export type Medewerker = { id: number; rol: string; actief: boolean; auth_user_id: string | null };

/** Per interventie op de peildatum: wie erop staat. */
export type Inplanning = { interventie_id: number; medewerker_id: number };

/**
 * De technieker voor de testaccount: actief, met de meeste interventies (herstelling of onderhoud) op de
 * peildatum. Bij gelijke stand het laagste id, zodat het script altijd dezelfde kiest. `plaats` 1 is de volgende in
 * die rij (voor de extra login).
 */
export function kiesTechnieker(medewerkers: Medewerker[], inplanning: Inplanning[], plaats = 0): Medewerker {
  const techniekers = new Map(medewerkers.filter((m) => m.actief && m.rol === "technieker").map((m) => [m.id, m]));
  const aantal = new Map<number, number>();
  for (const r of inplanning) {
    if (techniekers.has(r.medewerker_id)) aantal.set(r.medewerker_id, (aantal.get(r.medewerker_id) ?? 0) + 1);
  }
  const volgorde = [...aantal.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (volgorde.length <= plaats) {
    throw new Error(`Geen ${plaats + 1}e actieve technieker met een interventie op de peildatum.`);
  }
  return techniekers.get(volgorde[plaats][0])!;
}

/** De eerste actieve medewerker met rol administratie (laagste id); `plaats` 1 is de tweede. */
export function kiesAdministratie(medewerkers: Medewerker[], plaats = 0): Medewerker {
  const kandidaat = medewerkers
    .filter((m) => m.actief && m.rol === "administratie")
    .sort((a, b) => a.id - b.id)[plaats];
  if (!kandidaat) throw new Error(`Geen ${plaats + 1}e actieve medewerker met rol administratie.`);
  return kandidaat;
}

/**
 * Een gekozen medewerker mag alleen aan de testgebruiker hangen, of aan niemand. Hangt hij aan een andere login,
 * dan stopt het script: dat is geen testaccount en die koppeling blijft van iemand anders.
 */
export function controleerKoppeling(m: Medewerker, testgebruikerId: string): void {
  if (m.auth_user_id !== null && m.auth_user_id !== testgebruikerId) {
    throw new Error(`Medewerker ${m.id} is al gekoppeld aan een andere login. Gestopt, niets aangepast.`);
  }
}

/** 24 tekens, base64url: genoeg entropie en zonder tekens die in een .env-bestand problemen geven. */
export function maakWachtwoord(): string {
  return randomBytes(18).toString("base64url");
}

export function envBestand(wachtwoorden: Record<Soort, string>): string {
  return [
    "# Testaccounts voor de werfbon-app. Gemaakt door web/scripts/testaccounts.ts. Nooit committen.",
    `TECHNIEKER_EMAIL=${TESTACCOUNTS.technieker}`,
    `TECHNIEKER_WACHTWOORD=${wachtwoorden.technieker}`,
    `ADMINISTRATIE_EMAIL=${TESTACCOUNTS.administratie}`,
    `ADMINISTRATIE_WACHTWOORD=${wachtwoorden.administratie}`,
    "",
  ].join("\n");
}

/** Leest KEY=waarde-regels; lege regels en commentaar (#) tellen niet. */
export function leesEnv(inhoud: string): Record<string, string> {
  return Object.fromEntries(
    inhoud
      .split("\n")
      .filter((r) => r.includes("=") && !r.trimStart().startsWith("#"))
      .map((r) => [r.slice(0, r.indexOf("=")).trim(), r.slice(r.indexOf("=") + 1)]),
  );
}

/** Een zelfgekozen wachtwoord: minstens 12 tekens, geen spaties aan het begin of einde. De waarde komt nooit in een fout. */
export function controleerWachtwoord(waarde: string | undefined, naam: string): string {
  if (!waarde) throw new Error(`${naam} is leeg in .env.extra-accounts.`);
  if (waarde !== waarde.trim()) throw new Error(`${naam} begint of eindigt met een spatie.`);
  if (waarde.length < 12) throw new Error(`${naam} is korter dan 12 tekens.`);
  return waarde;
}

/** Het sjabloon dat de gebruiker invult. Zelfde sleutels als .env.testaccounts, zodat test-logins het kan lezen. */
export function extraSjabloon(): string {
  return [
    "# Extra testlogins voor de werfbon-app. Vul de wachtwoorden zelf in (minstens 12 tekens). Nooit committen.",
    "# Daarna: npm --prefix web run testaccounts -- --extra",
    `TECHNIEKER_EMAIL=${EXTRA_ACCOUNTS.technieker}`,
    "TECHNIEKER_WACHTWOORD=",
    `ADMINISTRATIE_EMAIL=${EXTRA_ACCOUNTS.administratie}`,
    "ADMINISTRATIE_WACHTWOORD=",
    "",
  ].join("\n");
}
