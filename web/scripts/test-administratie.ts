// Draait de queries van A1 met de testaccount van de administratie (publishable key, dus door RLS). Standaard alleen
// lezen: conceptfacturen, waarschuwingen, bedragen, opname; plus dat de technieker geen facturen ziet.
// Met --goedkeuren <factuur_id> SCHRIJFT het op live (keur_factuur_goed) en kijkt het daarna read-only na.
//
//   npm --prefix web run test:administratie
//   npm --prefix web run test:administratie -- --goedkeuren <factuur_id>
//
// Wachtwoorden uit .env.testaccounts; ze komen nooit op het scherm.

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import nextEnv from "@next/env";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import { keurFactuurGoed, laadConceptfacturen, laadFactuurDetail } from "../lib/schermen/administratie";
import { bedragen, filterFacturen } from "../lib/schermen/waarschuwing";
import { publiekeConfig } from "../lib/supabase/config";
import { REPO } from "../lib/verwerking/testhulp";

nextEnv.loadEnvConfig(REPO);
const bestand = Object.fromEntries(
  readFileSync(path.join(REPO, ".env.testaccounts"), "utf8")
    .split("\n")
    .filter((r) => r.includes("=") && !r.startsWith("#"))
    .map((r) => [r.slice(0, r.indexOf("=")), r.slice(r.indexOf("=") + 1)]),
);

const { values: arg } = parseArgs({ options: { goedkeuren: { type: "string" } } });

const { url, publiekeSleutel } = publiekeConfig();
let fouten = 0;
const controleer = (ok: boolean, tekst: string) => {
  console.log(`  ${ok ? "ok  " : "FOUT"} ${tekst}`);
  if (!ok) fouten++;
};

async function aanmelden(soort: "TECHNIEKER" | "ADMINISTRATIE"): Promise<SupabaseClient> {
  const db = createClient(url, publiekeSleutel, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({
    email: bestand[`${soort}_EMAIL`],
    password: bestand[`${soort}_WACHTWOORD`],
  });
  if (error || !data.user) throw new Error(`aanmelden ${soort.toLowerCase()} mislukt`);
  return db;
}

async function lezen(admin: SupabaseClient) {
  const lijst = await laadConceptfacturen(admin);
  console.log(`administratie: ${lijst.length} conceptfactuur/-facturen, ${filterFacturen(lijst, "nakijken").length} na te kijken`);
  for (const f of lijst) {
    const { lijnen, opname } = await laadFactuurDetail(admin, f);
    const b = bedragen(f.totaalExclBtw, f.btwTarief, lijnen);
    console.log(
      `       #${f.id} ${f.nummer} · ${f.bon?.nummer ?? "geen bon"} · ${f.klantNaam} · ${f.titel} · ` +
        `excl. ${b.exclBtw}, btw ${f.btwTarief}% ${b.btw}, totaal ${b.totaal} · ${f.status.tekst}`,
    );
    for (const l of lijnen) console.log(`         ${l.omschrijving} · ${l.aantal} × ${l.eenheidsprijs}`);
    for (const w of f.waarschuwingen) console.log(`         ! ${w}`);
    controleer(b.somLijnen === b.exclBtw, `${f.nummer}: totaal = som van de lijnen`);
    if (f.bon) {
      const { data: voorstel, error } = await admin.rpc("factuurvoorstel", { p_werfbon_id: f.bon.id });
      if (error) throw new Error(`factuurvoorstel: ${error.message}`);
      const som = bedragen(0, 0, voorstel as { aantal: number; eenheidsprijs: number }[]).somLijnen;
      controleer(som === b.exclBtw, `${f.nummer}: totaal = factuurvoorstel (${som})`);
    }
    if (opname) {
      controleer(!!opname.url, `${f.nummer}: signed URL voor de ${opname.soort}`);
      if (opname.url) {
        const r = await fetch(opname.url, { method: "GET", headers: { Range: "bytes=0-0" } });
        controleer(r.ok, `${f.nummer}: bestand te openen (${r.status}, ${r.headers.get("content-type")})`);
      }
    } else {
      console.log(`         (geen opname)`);
    }
  }
  return lijst;
}

async function main() {
  const admin = await aanmelden("ADMINISTRATIE");
  const lijst = await lezen(admin);

  const tech = await aanmelden("TECHNIEKER");
  const { count } = await tech.from("facturen").select("*", { count: "exact", head: true });
  controleer(count === 0, "technieker ziet geen facturen");
  const { error: weigering } = await tech.rpc("keur_factuur_goed", { p_factuur_id: lijst[0]?.id ?? 0 });
  controleer(!!weigering, `technieker kan niet goedkeuren (${weigering?.code ?? "geen fout!"})`);
  await tech.auth.signOut();

  if (arg.goedkeuren) {
    const id = Number(arg.goedkeuren);
    const f = lijst.find((x) => x.id === id);
    if (!f) throw new Error(`factuur ${id} staat niet in concept`);
    console.log(`goedkeuren: ${f.nummer} (SCHRIJFT op live)`);
    const r = await keurFactuurGoed(admin, id);
    controleer(r.fout === null, `goedgekeurd${r.fout ? `: ${r.fout}` : ""}`);
    const { data: na } = await admin.from("facturen").select("status").eq("id", id).single();
    controleer(na?.status === "verstuurd", `factuur ${na?.status}`);
    if (f.bon) {
      const { data: bon } = await admin.from("werfbonnen").select("status").eq("id", f.bon.id).single();
      controleer(bon?.status === "gefactureerd", `bon ${bon?.status}`);
    }
    const nogEens = await keurFactuurGoed(admin, id);
    controleer(nogEens.fout === "Deze factuur is al goedgekeurd.", "tweede keer goedkeuren wordt geweigerd");
  }

  await admin.auth.signOut();
  console.log(fouten === 0 ? "ALLES OK" : `${fouten} fout(en)`);
  process.exit(fouten === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
