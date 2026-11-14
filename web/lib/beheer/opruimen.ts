// Logica achter scripts/opruimen.ts: bepaalt wat weg mag, los van Supabase zodat ze te testen is.
//
// App-data herken je aan de bron: alleen de app (route /api/verwerk) maakt bonnen met bron spraak of foto, en alleen
// bevestig_werfbon maakt daar facturen bij. werfbon_opnames en bucket werfbon-opnames zijn helemaal van de app.
// Bij twijfel stopt de opruiming in plaats van iets over te slaan of mee te nemen.

import { ALLE_TESTMAILS } from "./testaccounts";

export const APP_BRONNEN = ["spraak", "foto"] as const;

export type Bon = { id: number; bron: string; factuur_id: number | null };
export type Factuur = { id: number; status: string };
export type Gebruiker = { id: string; email: string | null };
export type Koppeling = { medewerker_id: number; auth_user_id: string };

export type Invoer = {
  appBonnen: Bon[]; // bonnen met bron spraak of foto
  facturen: Factuur[]; // de facturen waar die bonnen naar wijzen
  bonnenOpFacturen: Bon[]; // alle bonnen (van elke bron) die naar een van die facturen wijzen
  opnameIds: number[];
  opnamePaden: string[]; // storage_pad uit werfbon_opnames
  bestanden: string[]; // objecten in de bucket
  gebruikers: Gebruiker[]; // alle gebruikers in auth.users
  koppelingen: Koppeling[]; // medewerkers met een auth_user_id
};

export type Opruiming = {
  bonIds: number[];
  factuurIds: number[];
  opnameIds: number[];
  bestanden: string[];
  gebruikerIds: string[]; // alleen met --ook-accounts
  ontkoppelMedewerkers: number[]; // alleen met --ook-accounts
};

export class OpruimFout extends Error {}

// Facturen die de app maakt: concept (bevestigd door de technieker) en verstuurd (goedgekeurd). Betaald of vervallen
// komt in de app niet voor; zo'n factuur hoort niet bij een test.
const APP_FACTUURSTATUSSEN = new Set(["concept", "verstuurd"]);
const TESTMAILS: ReadonlySet<string> = new Set(ALLE_TESTMAILS);

export function bepaalOpruiming(invoer: Invoer, opties: { ookAccounts: boolean }): Opruiming {
  for (const b of invoer.appBonnen) {
    if (!(APP_BRONNEN as readonly string[]).includes(b.bron)) {
      throw new OpruimFout(`Bon ${b.id} heeft bron ${b.bron}: geen app-bon.`);
    }
  }
  const bonIds = invoer.appBonnen.map((b) => b.id);
  const appBon = new Set(bonIds);

  const factuurIds = [...new Set(invoer.appBonnen.flatMap((b) => (b.factuur_id === null ? [] : [b.factuur_id])))];
  const factuurStatus = new Map(invoer.facturen.map((f) => [f.id, f.status]));
  for (const id of factuurIds) {
    const status = factuurStatus.get(id);
    if (status === undefined) throw new OpruimFout(`Factuur ${id} niet gevonden.`);
    if (!APP_FACTUURSTATUSSEN.has(status)) {
      throw new OpruimFout(`Factuur ${id} heeft status ${status}: niet van een test. Gestopt.`);
    }
  }
  for (const b of invoer.bonnenOpFacturen) {
    if (b.factuur_id !== null && factuurIds.includes(b.factuur_id) && !appBon.has(b.id)) {
      throw new OpruimFout(`Factuur ${b.factuur_id} hoort ook bij bon ${b.id} (bron ${b.bron}). Gestopt.`);
    }
  }

  const bestanden = [...new Set([...invoer.bestanden, ...invoer.opnamePaden])].sort();

  let gebruikerIds: string[] = [];
  let ontkoppelMedewerkers: number[] = [];
  if (opties.ookAccounts) {
    gebruikerIds = invoer.gebruikers.filter((g) => g.email !== null && TESTMAILS.has(g.email)).map((g) => g.id);
    const weg = new Set(gebruikerIds);
    ontkoppelMedewerkers = invoer.koppelingen.filter((k) => weg.has(k.auth_user_id)).map((k) => k.medewerker_id);
  }

  return {
    bonIds: [...bonIds].sort((a, b) => a - b),
    factuurIds: factuurIds.sort((a, b) => a - b),
    opnameIds: [...invoer.opnameIds].sort((a, b) => a - b),
    bestanden,
    gebruikerIds,
    ontkoppelMedewerkers: ontkoppelMedewerkers.sort((a, b) => a - b),
  };
}

export function isLeeg(o: Opruiming): boolean {
  return Object.values(o).every((lijst) => lijst.length === 0);
}

export function samenvatting(o: Opruiming): string {
  const rij = (naam: string, lijst: (number | string)[]) =>
    `  ${naam.padEnd(24)} ${String(lijst.length).padStart(4)}${lijst.length && lijst.length <= 10 ? `  (${lijst.join(", ")})` : ""}`;
  return [
    rij("werfbonnen (+ lijnen)", o.bonIds),
    rij("facturen (+ lijnen)", o.factuurIds),
    rij("werfbon_opnames", o.opnameIds),
    rij("bestanden in de bucket", o.bestanden),
    rij("koppelingen medewerker", o.ontkoppelMedewerkers),
    rij("testgebruikers", o.gebruikerIds),
  ].join("\n");
}
