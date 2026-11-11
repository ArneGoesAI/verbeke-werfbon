// De volledige flow van de technieker, met dezelfde code als de app maar zonder browser. KOST GELD en SCHRIJFT op
// live (bucket, werfbonnen, werfbon_lijnen, werfbon_opnames, facturen). Daarna: npm --prefix web run opruimen.
//
//   npm --prefix web run test:flow -- --stap concept [--geval c13-wb501] [--interventie <id>]
//       foto van het testgeval → bucket (sessie) → verwerkVerzoek (route-logica, één Haiku-call) → conceptbon
//   npm --prefix web run test:flow -- --stap bevestig --bon <werfbon_id>
//       gele vakken op "Niet aanrekenen" → bevestigBon (server action) → read-only nakijken als administratie
//
// Wachtwoorden uit .env.testaccounts; ze komen nooit op het scherm.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import nextEnv from "@next/env";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import { maakAfhankelijkheden } from "../lib/route/afhankelijkheden-kern";
import { verwerkVerzoek } from "../lib/route/verwerk-route";
import { bevestigBon } from "../lib/schermen/bevestig";
import { laadBon, laadVandaag } from "../lib/schermen/queries";
import { afgeleideRijen, bouwVoorstel, namen, nietAanrekenen, openVakken } from "../lib/schermen/voorstel";
import { publiekeConfig } from "../lib/supabase/config";
import { maakDienstClient } from "../lib/supabase/dienst-kern";
import { REPO, laadGevallen } from "../lib/verwerking/testhulp";

nextEnv.loadEnvConfig(REPO);
const bestand = Object.fromEntries(
  readFileSync(path.join(REPO, ".env.testaccounts"), "utf8")
    .split("\n")
    .filter((r) => r.includes("=") && !r.startsWith("#"))
    .map((r) => [r.slice(0, r.indexOf("=")), r.slice(r.indexOf("=") + 1)]),
);

const { values: arg } = parseArgs({
  options: {
    stap: { type: "string" },
    geval: { type: "string", default: "c13-wb501" },
    interventie: { type: "string" },
    bon: { type: "string" },
  },
});

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

async function toonVoorstel(db: SupabaseClient, ikId: number, bonId: number) {
  const bon = await laadBon(db, ikId, bonId);
  if (!bon) throw new Error(`bon ${bonId} niet zichtbaar voor de technieker`);
  const v = bouwVoorstel(bon, bon.extractie, bon.catalogus);
  console.log(`  T4 "${bon.interventie.id}": gewerkt ${v.uren} u, gereden ${v.km} km`);
  for (const o of v.onderdelen) console.log(`       ${o.naam} × ${o.aantal}  ${o.bronzinnen.map((z) => `"${z}"`).join(" ")}`);
  for (const a of afgeleideRijen(bon.interventie.type, bon.interventie.toestel?.toesteltype ?? null, v.uren, namen(bon.catalogus))) {
    console.log(`       ${a.tekst}  [Automatisch]`);
  }
  for (const g of v.onbekend) console.log(`       GEEL VAK: "${g.bronzin || g.omschrijving}" × ${g.aantal}`);
  if (v.opmerking) console.log(`       opmerking: ${v.opmerking}`);
  return { bon, v };
}

async function concept() {
  const geval = laadGevallen().find((g) => g.case_id === arg.geval);
  if (!geval) throw new Error(`testgeval ${arg.geval} niet gevonden`);
  const tech = await aanmelden("TECHNIEKER");
  const { interventies } = await laadVandaag(tech.db, tech.id);
  const interventie = arg.interventie ? Number(arg.interventie) : interventies[0]?.id;
  if (!interventie) throw new Error("geen interventie vandaag");
  console.log(`technieker ${tech.id}, interventie ${interventie}, foto van ${geval.case_id}`);

  // 1. Opladen met de sessie, zoals useVerwerk in de browser.
  const pad = `${tech.id}/${interventie}/${randomUUID()}.png`;
  const foto = readFileSync(path.join(REPO, geval.invoer.foto));
  const upload = await tech.db.storage.from("werfbon-opnames").upload(pad, foto, { contentType: "image/png", upsert: false });
  controleer(!upload.error, `foto opgeladen (${Math.round(foto.length / 1024)} kB)`);
  if (upload.error) return;

  // 2. De route-logica met de echte afhankelijkheden: sessie van de technieker, secret key om te schrijven.
  const afh = maakAfhankelijkheden(async () => tech.db, () => maakDienstClient());
  const start = performance.now();
  const r = await verwerkVerzoek({ interventie_id: interventie, pad, soort: "foto", mediatype: "image/png" }, afh);
  console.log(`  route: ${r.status} ${JSON.stringify(r.body)} in ${Math.round(performance.now() - start) / 1000} s`);
  controleer(r.status === 200 && !!r.body.werfbon_id, "conceptbon gemaakt");
  if (!r.body.werfbon_id) return;

  const { data: opname } = await tech.db
    .from("werfbon_opnames")
    .select("model, input_tokens, output_tokens")
    .eq("werfbon_id", r.body.werfbon_id)
    .single();
  console.log(`  opname: ${JSON.stringify(opname)}`);
  const { data: bon } = await tech.db.from("werfbonnen").select("nummer, status, bron, datum").eq("id", r.body.werfbon_id).single();
  console.log(`  bon: ${JSON.stringify(bon)}`);
  controleer(bon?.status === "concept" && bon?.bron === "foto", "status concept, bron foto");
  await toonVoorstel(tech.db, tech.id, r.body.werfbon_id);
  await tech.db.auth.signOut();
}

async function bevestig() {
  const bonId = Number(arg.bon);
  const tech = await aanmelden("TECHNIEKER");
  const { bon, v: begin } = await toonVoorstel(tech.db, tech.id, bonId);
  let v = begin;
  for (const g of v.onbekend) v = nietAanrekenen(v, g.sleutel);
  controleer(openVakken(v) === 0, `${begin.onbekend.length} geel vak/vakken op "Niet aanrekenen"`);

  const r = await bevestigBon(tech.db, tech.id, bonId, {
    uren: v.uren,
    km: v.km,
    onderdelen: v.onderdelen.map(({ code, aantal }) => ({ code, aantal })),
    onbekend: v.onbekend.map(({ omschrijving, bronzin, aantal, oplossing }) => ({ omschrijving, bronzin, aantal, oplossing })),
    opmerking: v.opmerking,
  });
  controleer(r.fout === null, `bevestigd${r.fout ? `: ${r.fout}` : `, factuur ${r.factuurId}`}`);
  if (r.fout !== null) return;

  const { data: naBon } = await tech.db.from("werfbonnen").select("status, ingegeven_op, opmerkingen").eq("id", bonId).single();
  controleer(naBon?.status === "ingegeven", `bon ${naBon?.status}, ingegeven op ${naBon?.ingegeven_op}`);
  const { count } = await tech.db.from("facturen").select("*", { count: "exact", head: true });
  controleer(count === 0, "technieker ziet geen facturen");
  await tech.db.auth.signOut();

  // Read-only als administratie: de conceptfactuur volgt factuurvoorstel.
  const admin = await aanmelden("ADMINISTRATIE");
  const { data: f } = await admin.db
    .from("facturen")
    .select("nummer, status, btw_tarief, totaal_excl_btw, factuur_lijnen(omschrijving, aantal, eenheidsprijs)")
    .eq("id", r.factuurId!)
    .single();
  const fac = f as unknown as {
    nummer: string;
    status: string;
    btw_tarief: number;
    totaal_excl_btw: number;
    factuur_lijnen: { omschrijving: string; aantal: number; eenheidsprijs: number }[];
  };
  console.log(`  factuur ${fac.nummer}: ${fac.status}, btw ${fac.btw_tarief}%, excl. btw ${fac.totaal_excl_btw}`);
  for (const l of fac.factuur_lijnen) console.log(`       ${l.omschrijving} · ${l.aantal} × ${l.eenheidsprijs}`);
  const { data: voorstel, error } = await admin.db.rpc("factuurvoorstel", { p_werfbon_id: bonId });
  if (error) throw new Error(`factuurvoorstel: ${error.message}`);
  const som = (lijst: { aantal: number; eenheidsprijs: number }[]) =>
    Math.round(lijst.reduce((t, l) => t + Number(l.aantal) * Number(l.eenheidsprijs), 0) * 100) / 100;
  controleer(fac.status === "concept", "factuur in concept");
  controleer(Number(fac.totaal_excl_btw) === som(voorstel), `totaal = factuurvoorstel (${som(voorstel)})`);
  controleer(Number(fac.totaal_excl_btw) === som(fac.factuur_lijnen), "totaal = som van de factuurlijnen");
  const { data: waarschuwingen } = await admin.db.rpc("factuurwaarschuwingen", { p_werfbon_id: bonId });
  console.log(`  waarschuwingen: ${JSON.stringify(waarschuwingen)}`);
  console.log(`  opmerkingen op de bon: ${JSON.stringify(naBon?.opmerkingen)}`);
  await admin.db.auth.signOut();
  void bon;
}

async function main() {
  if (arg.stap === "concept") await concept();
  else if (arg.stap === "bevestig" && arg.bon) await bevestig();
  else throw new Error("gebruik: --stap concept | --stap bevestig --bon <id>");
  console.log(fouten === 0 ? "ALLES OK" : `${fouten} fout(en)`);
  process.exit(fouten === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
