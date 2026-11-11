// De kern van de verwerking, zonder database en zonder HTTP:
//   audio → Voxtral → tekst ┐
//   foto ───────────────────┴→ Claude (Haiku, medium) → validatie → afgeleide lijnen
// De route (deel 3) haalt het bestand uit de bucket, bouwt de context uit de database en schrijft het resultaat weg.

import Anthropic from "@anthropic-ai/sdk";

import { onderdelenUit, volledigeLijnen } from "./afgeleide-lijnen";
import { extraheer, type FotoType, type Invoer, type ModelAntwoord, verzoek } from "./extraheer";
import { type Transcriptie, transcribeer } from "./transcribeer";
import type { Context, Extractie, Lijn, Onderdeel } from "./types";
import { valideer } from "./valideer";

export type VerwerkInvoer =
  | { soort: "audio"; bestand: Blob; bestandsnaam: string }
  | { soort: "foto"; bestand: Blob; mediatype: FotoType }
  | { soort: "tekst"; tekst: string }; // alleen voor de test: slaat Voxtral over

export type Resultaat =
  | {
      ok: true;
      transcript: string | null;
      transcriptie: Transcriptie | null;
      extractie: Extractie;
      lijnen: Lijn[]; // factuurlijnen met bekende code, inclusief afgeleide (ARB-TECH, VERPL of forfait)
      onbekend: Onderdeel[]; // onderdelen met code "onbekend": kunnen geen lijn worden, na te kijken
      antwoord: ModelAntwoord;
    }
  | {
      ok: false;
      fout: string;
      transcript: string | null;
      transcriptie: Transcriptie | null;
      antwoord: ModelAntwoord | null;
    };

export type Afhankelijkheden = {
  client?: Anthropic;
  transcribeerFn?: typeof transcribeer;
  model?: string;
};

export async function verwerk(
  ctx: Context,
  invoer: VerwerkInvoer,
  afh: Afhankelijkheden = {},
): Promise<Resultaat> {
  if (ctx.type !== "herstelling" && ctx.type !== "onderhoud") {
    return { ok: false, fout: `type ${ctx.type} wordt niet verwerkt`, transcript: null, transcriptie: null, antwoord: null };
  }

  let transcriptie: Transcriptie | null = null;
  let modelInvoer: Invoer;
  if (invoer.soort === "audio") {
    transcriptie = await (afh.transcribeerFn ?? transcribeer)(invoer.bestand, invoer.bestandsnaam);
    if (!transcriptie.tekst) {
      return { ok: false, fout: "lege transcriptie", transcript: "", transcriptie, antwoord: null };
    }
    modelInvoer = { soort: "tekst", tekst: transcriptie.tekst };
  } else if (invoer.soort === "tekst") {
    modelInvoer = { soort: "tekst", tekst: invoer.tekst };
  } else {
    const base64 = Buffer.from(await invoer.bestand.arrayBuffer()).toString("base64");
    modelInvoer = { soort: "foto", base64, mediatype: invoer.mediatype };
  }
  const transcript = modelInvoer.soort === "tekst" ? modelInvoer.tekst : null;

  const client = afh.client ?? new Anthropic();
  const antwoord = await extraheer(client, verzoek(ctx, modelInvoer, { model: afh.model }));

  if (antwoord.stop_reason !== "end_turn") {
    // max_tokens of refusal: de output is onvolledig of ontbreekt. Geen fallback (zie extraheer.ts).
    return { ok: false, fout: `stop_reason ${antwoord.stop_reason}`, transcript, transcriptie, antwoord };
  }
  const v = valideer(antwoord.ruwe_output);
  if (!v.ok) return { ok: false, fout: v.fout, transcript, transcriptie, antwoord };

  const { extractie } = v;
  const onbekend = extractie.onderdelen.filter((o) => o.code === "onbekend");
  const bekend = onderdelenUit(extractie.onderdelen).filter((o) => o.code !== "onbekend");
  const lijnen = volledigeLijnen(ctx.type, ctx.toestel?.type ?? null, extractie.uren, bekend);
  return { ok: true, transcript, transcriptie, extractie, lijnen, onbekend, antwoord };
}
