// De kern van de app (lib/verwerking/verwerk.ts) draaien op gevallen uit eval/data/cases.jsonl, zonder database.
// Schrijft runs.jsonl in het formaat van eval/run_eval.py, zodat eval/score.py het zonder aanpassing scoort.
//
//   npm --prefix web run test:gevallen -- --invoer tekst,foto --uit ../eval/results/2026-11-12-app-tekst
//   npm --prefix web run test:gevallen -- --invoer audio      --uit ../eval/results/2026-11-12-app-audio
//   npm --prefix web run test:gevallen -- --invoer tekst,foto --droog     # toont wat er zou gebeuren, gratis
//
// Invoer:
//   tekst  spraakpad met de inspreektekst uit cases.jsonl (Voxtral overgeslagen). Te vergelijken met de eval.
//   foto   fotopad met de png uit eval/data/bonnen/.
//   audio  spraakpad met een eigen opname eval/data/opnames/<case_id>.<ext>, via Voxtral. Die map staat in
//          .gitignore: een stem is een persoonsgegeven.
// Een onderbroken run hervat; API-fouten worden bij de volgende run opnieuw geprobeerd.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import Anthropic from "@anthropic-ai/sdk";
import nextEnv from "@next/env";

import { EFFORT, MODEL } from "../lib/verwerking/extraheer";
import { REPO, laadGevallen, type Geval } from "../lib/verwerking/testhulp";
import { TranscriptieFout } from "../lib/verwerking/transcribeer";
import { verwerk, type VerwerkInvoer } from "../lib/verwerking/verwerk";

const STANDAARD_GEVALLEN = ["c02-wb711", "c14-wb322", "c17-wb774", "c19-wb847"];
const OPNAMES = path.join(REPO, "eval", "data", "opnames");
const AUDIO_TYPES: Record<string, string> = {
  ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm", ".ogg": "audio/ogg",
};
type Soort = "tekst" | "foto" | "audio";

const { values: args } = parseArgs({
  options: {
    invoer: { type: "string", default: "tekst,foto" },
    cases: { type: "string", default: STANDAARD_GEVALLEN.join(",") },
    herhaal: { type: "string", default: "3" },
    uit: { type: "string" },
    droog: { type: "boolean", default: false },
  },
});

function opnameVoor(caseId: string): string | null {
  if (!existsSync(OPNAMES)) return null;
  // Hoofdletters maken niet uit: C02-wb711.m4a is ook goed.
  const naam = readdirSync(OPNAMES).find(
    (f) => path.parse(f).name.toLowerCase() === caseId.toLowerCase() && path.extname(f).toLowerCase() in AUDIO_TYPES,
  );
  return naam ? path.join(OPNAMES, naam) : null;
}

function invoerVoor(g: Geval, soort: Soort): VerwerkInvoer {
  if (soort === "tekst") return { soort: "tekst", tekst: g.invoer.spraak };
  if (soort === "foto") {
    return { soort: "foto", bestand: new Blob([readFileSync(path.join(REPO, g.invoer.foto))]), mediatype: "image/png" };
  }
  const pad = opnameVoor(g.case_id)!;
  const type = AUDIO_TYPES[path.extname(pad).toLowerCase()];
  return { soort: "audio", bestand: new Blob([readFileSync(pad)], { type }), bestandsnaam: path.basename(pad) };
}

const config = { model: MODEL, effort: EFFORT, provider: "anthropic" };
const sleutel = (caseId: string, soort: Soort, h: number) => `${caseId}|${soort}|${h}`;

async function main() {
  const soorten = args.invoer!.split(",").map((s) => s.trim()) as Soort[];
  const onbekendeSoort = soorten.filter((s) => !["tekst", "foto", "audio"].includes(s));
  if (onbekendeSoort.length) throw new Error(`Onbekende invoer: ${onbekendeSoort.join(", ")}`);
  if (soorten.includes("audio") && soorten.includes("tekst")) {
    // Beide zijn het spraakpad: in één map zou score.py ze samen tellen.
    throw new Error("Draai audio en tekst in aparte mappen (--uit).");
  }
  const herhaal = Number(args.herhaal);

  const alle = laadGevallen();
  const ids = args.cases!.split(",").map((s) => s.trim());
  const onbekend = ids.filter((id) => !alle.some((g) => g.case_id === id));
  if (onbekend.length) throw new Error(`Onbekende case_id's: ${onbekend.join(", ")}`);
  const gevallen = alle.filter((g) => ids.includes(g.case_id));
  const nietNagelezen = gevallen.filter((g) => !g.nagelezen_door).map((g) => g.case_id);
  if (nietNagelezen.length) throw new Error(`Niet nagelezen: ${nietNagelezen.join(", ")}`);
  if (soorten.includes("audio")) {
    const zonder = gevallen.filter((g) => !opnameVoor(g.case_id)).map((g) => g.case_id);
    if (zonder.length) {
      throw new Error(`Geen opname in eval/data/opnames/ voor: ${zonder.join(", ")} (${Object.keys(AUDIO_TYPES).join(", ")})`);
    }
  }

  const taken = gevallen.flatMap((g) => soorten.flatMap((s) => Array.from({ length: herhaal }, (_, i) => [g, s, i + 1] as const)));

  if (args.droog) {
    for (const [g, s] of taken.filter(([, , h]) => h === 1)) {
      const bron = s === "tekst" ? `${g.invoer.spraak.slice(0, 70)}…` : s === "foto" ? g.invoer.foto : opnameVoor(g.case_id);
      console.log(`${g.case_id} ${s.padEnd(5)} ${g.context.type.padEnd(11)} ${bron}`);
    }
    const voxtral = taken.filter(([, s]) => s === "audio").length;
    console.error(
      `\nDroog: ${taken.length} Claude-calls (${MODEL}, effort ${EFFORT})` +
        (voxtral ? ` en ${voxtral} Voxtral-transcripties` : "") + ". Er is niets verstuurd.",
    );
    return;
  }

  if (!args.uit) throw new Error("--uit is verplicht, bv. ../eval/results/2026-11-12-app-tekst");
  nextEnv.loadEnvConfig(REPO);
  const uit = path.resolve(args.uit, "runs.jsonl");
  mkdirSync(path.dirname(uit), { recursive: true });
  const klaar = new Set(
    existsSync(uit)
      ? readFileSync(uit, "utf-8").split("\n").filter((r) => r.trim()).map((r) => JSON.parse(r))
          .filter((r) => !r.api_fout).map((r) => sleutel(r.case_id, r.invoer, r.herhaling))
      : [],
  );
  const teDoen = taken.filter(([g, s, h]) => !klaar.has(sleutel(g.case_id, s, h)));
  console.log(`${taken.length} runs in totaal, ${taken.length - teDoen.length} al gedaan, ${teDoen.length} te doen.`);

  const client = new Anthropic();
  let fouten = 0;
  for (const [i, [g, soort, herhaling]] of teDoen.entries()) {
    const basis = {
      config, case_id: g.case_id, pad: soort === "foto" ? "foto" : "spraak", invoer: soort, herhaling,
      tijdstip: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
    };
    let rij: Record<string, unknown>;
    try {
      const r = await verwerk(g.context, invoerVoor(g, soort), { client });
      rij = {
        ...basis,
        ...(r.antwoord ?? { stop_reason: null, ruwe_output: "", usage: null, latency_s: null }),
        transcript: r.transcript,
        transcriptie: r.transcriptie && { model: r.transcriptie.model, audio_s: r.transcriptie.audio_s, latency_s: r.transcriptie.latency_s },
        app_fout: r.ok ? null : r.fout,
      };
    } catch (e) {
      const bron = e instanceof TranscriptieFout ? "voxtral" : e instanceof Anthropic.APIError ? "anthropic" : "fout";
      rij = { ...basis, api_fout: `${bron}: ${(e as Error).message}` };
      fouten++;
    }
    appendFileSync(uit, JSON.stringify(rij) + "\n", "utf-8");
    const status = rij.api_fout ?? rij.app_fout ?? "ok";
    console.log(`  [${i + 1}/${teDoen.length}] ${g.case_id} ${soort} #${herhaling}: ${status}`);
  }
  console.log(`Resultaten in ${uit}.` + (fouten ? ` ${fouten} API-fout(en): draai opnieuw om ze te herhalen.` : ""));
  console.log(`Scoren: .venv/bin/python eval/score.py --resultaten ${path.relative(REPO, path.dirname(uit))}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
