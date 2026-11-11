// Ruimt de data op die de app op live heeft gemaakt. Standaard droog: toont alleen wat weg zou gaan.
//
//   npm --prefix web run opruimen                          # droog
//   npm --prefix web run opruimen -- --echt                # bonnen, facturen, opnames en bestanden weg
//   npm --prefix web run opruimen -- --echt --ook-accounts # ook de twee testgebruikers en hun koppeling
//
// Wat weg gaat, staat in lib/beheer/opruimen.ts: bonnen met bron spraak of foto, de facturen die daaruit kwamen
// (ook goedgekeurde), alle rijen in werfbon_opnames en alle bestanden in bucket werfbon-opnames. Stopt bij twijfel.
// Met SUPABASE_SECRET_KEY. Sequences schuiven niet terug: een gat in de nummering is aanvaard (fictieve data).

import { parseArgs } from "node:util";

import nextEnv from "@next/env";

import {
  APP_BRONNEN,
  type Bon,
  type Factuur,
  type Opruiming,
  bepaalOpruiming,
  isLeeg,
  samenvatting,
} from "../lib/beheer/opruimen";
import { maakDienstClient } from "../lib/supabase/dienst-kern";
import { REPO } from "../lib/verwerking/testhulp";

const BUCKET = "werfbon-opnames";
const { values: opties } = parseArgs({
  options: { echt: { type: "boolean", default: false }, "ook-accounts": { type: "boolean", default: false } },
});

nextEnv.loadEnvConfig(REPO);
const db = maakDienstClient();

function stop(wat: string, fout: { message: string } | null): never {
  throw new Error(`${wat}: ${fout?.message ?? "onbekende fout"}`);
}

/** Alle objecten in de bucket, ook in submappen ({medewerker}/{interventie}/{bestand}). */
async function bestandenIn(map = ""): Promise<string[]> {
  const uit: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(map, { limit: 1000, offset });
    if (error) stop(`Bucket ${BUCKET}/${map}`, error);
    for (const item of data) {
      const pad = map ? `${map}/${item.name}` : item.name;
      if (item.id === null) uit.push(...(await bestandenIn(pad))); // een map
      else uit.push(pad);
    }
    if (data.length < 1000) return uit;
  }
}

async function alleGebruikers() {
  const uit: { id: string; email: string | null }[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) stop("Gebruikers ophalen", error);
    uit.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null })));
    if (data.users.length < 200) return uit;
  }
}

async function verzamel() {
  const { data: appBonnen, error: e1 } = await db
    .from("werfbonnen")
    .select("id, bron, factuur_id")
    .in("bron", [...APP_BRONNEN])
    .returns<Bon[]>();
  if (e1 || !appBonnen) stop("App-bonnen", e1);

  const factuurIds = [...new Set(appBonnen.flatMap((b) => (b.factuur_id ? [b.factuur_id] : [])))];
  let facturen: Factuur[] = [];
  let bonnenOpFacturen: Bon[] = [];
  if (factuurIds.length > 0) {
    const f = await db.from("facturen").select("id, status").in("id", factuurIds).returns<Factuur[]>();
    if (f.error || !f.data) stop("Facturen", f.error);
    facturen = f.data;
    const b = await db.from("werfbonnen").select("id, bron, factuur_id").in("factuur_id", factuurIds).returns<Bon[]>();
    if (b.error || !b.data) stop("Bonnen op die facturen", b.error);
    bonnenOpFacturen = b.data;
  }

  const { data: opnames, error: e2 } = await db
    .from("werfbon_opnames")
    .select("id, storage_pad")
    .returns<{ id: number; storage_pad: string }[]>();
  if (e2 || !opnames) stop("Opnames", e2);

  const { data: koppelingen, error: e3 } = await db
    .from("medewerkers")
    .select("id, auth_user_id")
    .not("auth_user_id", "is", null)
    .returns<{ id: number; auth_user_id: string }[]>();
  if (e3 || !koppelingen) stop("Koppelingen", e3);

  return {
    appBonnen,
    facturen,
    bonnenOpFacturen,
    opnameIds: opnames.map((o) => o.id),
    opnamePaden: opnames.map((o) => o.storage_pad),
    bestanden: await bestandenIn(),
    gebruikers: await alleGebruikers(),
    koppelingen: koppelingen.map((k) => ({ medewerker_id: k.id, auth_user_id: k.auth_user_id })),
  };
}

async function voerUit(o: Opruiming) {
  // Volgorde: eerst de verwijzing bon → factuur los, dan de facturen (lijnen cascade), dan opnames en bonnen.
  if (o.bonIds.length > 0) {
    const { error } = await db.from("werfbonnen").update({ factuur_id: null }).in("id", o.bonIds);
    if (error) stop("factuur_id op null", error);
  }
  if (o.factuurIds.length > 0) {
    const { error } = await db.from("facturen").delete().in("id", o.factuurIds);
    if (error) stop("Facturen verwijderen", error);
  }
  if (o.opnameIds.length > 0) {
    const { error } = await db.from("werfbon_opnames").delete().in("id", o.opnameIds);
    if (error) stop("Opnames verwijderen", error);
  }
  if (o.bonIds.length > 0) {
    const { error } = await db.from("werfbonnen").delete().in("id", o.bonIds);
    if (error) stop("Bonnen verwijderen", error);
  }
  for (let i = 0; i < o.bestanden.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(o.bestanden.slice(i, i + 100));
    if (error) stop("Bestanden verwijderen", error);
  }
  if (o.ontkoppelMedewerkers.length > 0) {
    const { error } = await db
      .from("medewerkers")
      .update({ auth_user_id: null })
      .in("id", o.ontkoppelMedewerkers)
      .in("auth_user_id", o.gebruikerIds); // alleen koppelingen naar een testgebruiker
    if (error) stop("Koppelingen losmaken", error);
  }
  for (const id of o.gebruikerIds) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) stop(`Gebruiker ${id} verwijderen`, error);
  }
}

async function main() {
  const ookAccounts = opties["ook-accounts"] ?? false;
  const opruiming = bepaalOpruiming(await verzamel(), { ookAccounts });
  console.log(`${opties.echt ? "Opruimen" : "Droog (niets aangepast)"}${ookAccounts ? ", met testaccounts" : ""}:`);
  console.log(samenvatting(opruiming));
  if (isLeeg(opruiming)) {
    console.log("Niets op te ruimen.");
    return;
  }
  if (!opties.echt) {
    console.log("Draai met --echt om dit te verwijderen.");
    return;
  }
  await voerUit(opruiming);

  const na = bepaalOpruiming(await verzamel(), { ookAccounts });
  if (!isLeeg(na)) throw new Error(`Na het opruimen blijft nog iets over:\n${samenvatting(na)}`);
  console.log("Opgeruimd. Een tweede droge run vindt niets meer.");
}

main().catch((fout: unknown) => {
  console.error(fout instanceof Error ? fout.message : fout);
  process.exit(1);
});
