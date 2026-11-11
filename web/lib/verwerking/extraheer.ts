// De Claude-call: hetzelfde verzoek als verzoek() in eval/run_eval.py. Zelfde systeemprompt, schema, max_tokens en
// koppen in de gebruikersinhoud. Bewust geen refusal-fallback: die zou een ander model laten antwoorden dan het
// model dat de eval koos.

import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";

import { MAX_TOKENS, SCHEMA, SYSTEEMPROMPT } from "./gegenereerd";
import type { Context, Effort } from "./types";

/** De keuze uit de eval (eval/results/2026-11-11-vergelijking): Haiku op effort medium. */
export const MODEL = "claude-haiku-5-5";
export const EFFORT: Effort = "medium";

export const FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type FotoType = (typeof FOTO_TYPES)[number];

export type Invoer =
  | { soort: "tekst"; tekst: string } // ingesproken tekst (transcript van Voxtral, of de tekst uit een testgeval)
  | { soort: "foto"; base64: string; mediatype: FotoType };

export class InvoerFout extends Error {}

export function contextTekst(ctx: Context): string {
  const regels = [`Type interventie: ${ctx.type}`, `Omschrijving: ${ctx.omschrijving}`];
  if (ctx.toestel) regels.push(`Toestel: ${ctx.toestel.type}, ${ctx.toestel.merk} ${ctx.toestel.model}`);
  return "Context van de interventie:\n" + regels.join("\n");
}

export function gebruikersinhoud(ctx: Context, invoer: Invoer): Anthropic.ContentBlockParam[] {
  const inhoud: Anthropic.ContentBlockParam[] = [{ type: "text", text: contextTekst(ctx) }];
  if (invoer.soort === "tekst") {
    inhoud.push({ type: "text", text: "Ingesproken tekst van de technieker:\n" + invoer.tekst });
  } else {
    if (!(FOTO_TYPES as readonly string[]).includes(invoer.mediatype)) {
      // HEIC en andere formaten aanvaardt het API niet; de app moet JPEG, PNG of WebP sturen.
      throw new InvoerFout(`fotoformaat ${invoer.mediatype} niet ondersteund (alleen ${FOTO_TYPES.join(", ")})`);
    }
    inhoud.push({ type: "image", source: { type: "base64", media_type: invoer.mediatype, data: invoer.base64 } });
    inhoud.push({ type: "text", text: "Hierboven: foto van de ingevulde werfbon." });
  }
  return inhoud;
}

export function verzoek(
  ctx: Context,
  invoer: Invoer,
  opties: { model?: string; effort?: Effort } = {},
): MessageCreateParamsNonStreaming {
  return {
    model: opties.model ?? MODEL,
    max_tokens: MAX_TOKENS,
    // Zelfde prompt voor elke call: cachen. (Onder de minimumlengte van het model gebeurt er gewoon niets.)
    system: [{ type: "text", text: SYSTEEMPROMPT(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: gebruikersinhoud(ctx, invoer) }],
    output_config: { effort: opties.effort ?? EFFORT, format: { type: "json_schema", schema: SCHEMA } },
  };
}

export type ModelAntwoord = {
  model_antwoord: string;
  stop_reason: string | null;
  ruwe_output: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  latency_s: number;
  request_id: string | null;
};

/** Eén call. API-fouten gaan als exception naar boven (Anthropic.APIError). */
export async function extraheer(client: Anthropic, req: MessageCreateParamsNonStreaming): Promise<ModelAntwoord> {
  const start = performance.now();
  const { data: response, request_id } = await client.messages.create(req).withResponse();
  const latency_s = Math.round(performance.now() - start) / 1000;
  const u = response.usage;
  return {
    model_antwoord: response.model,
    stop_reason: response.stop_reason,
    ruwe_output: response.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
    usage: {
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    },
    latency_s,
    request_id: request_id ?? null,
  };
}
