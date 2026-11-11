// Logica achter scripts/testaccounts.ts, los van Supabase zodat ze te testen is.

import { randomBytes } from "node:crypto";

export const TESTACCOUNTS = {
  technieker: "technieker@verbeke.test",
  administratie: "administratie@verbeke.test",
} as const;

export type Soort = keyof typeof TESTACCOUNTS;

export type Medewerker = { id: number; rol: string; actief: boolean; auth_user_id: string | null };

/** Per interventie op de peildatum: wie erop staat. */
export type Inplanning = { interventie_id: number; medewerker_id: number };

/**
 * De technieker voor de testaccount: actief, met de meeste interventies (herstelling of onderhoud) op de
 * peildatum. Bij gelijke stand het laagste id, zodat het script altijd dezelfde kiest.
 */
export function kiesTechnieker(medewerkers: Medewerker[], inplanning: Inplanning[]): Medewerker {
  const techniekers = new Map(medewerkers.filter((m) => m.actief && m.rol === "technieker").map((m) => [m.id, m]));
  const aantal = new Map<number, number>();
  for (const r of inplanning) {
    if (techniekers.has(r.medewerker_id)) aantal.set(r.medewerker_id, (aantal.get(r.medewerker_id) ?? 0) + 1);
  }
  const volgorde = [...aantal.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (volgorde.length === 0) throw new Error("Geen actieve technieker met een interventie op de peildatum.");
  return techniekers.get(volgorde[0][0])!;
}

/** De eerste actieve medewerker met rol administratie (laagste id). */
export function kiesAdministratie(medewerkers: Medewerker[]): Medewerker {
  const kandidaat = medewerkers
    .filter((m) => m.actief && m.rol === "administratie")
    .sort((a, b) => a.id - b.id)[0];
  if (!kandidaat) throw new Error("Geen actieve medewerker met rol administratie.");
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
