// Toegang tot de bestanden die eval/exporteer_voor_app.py maakt. Nooit met de hand aanpassen: Python is de bron.

import { readFileSync } from "node:fs";

import catalogusJson from "./gegenereerd/catalogus.json";
import instellingenJson from "./gegenereerd/instellingen.json";
import schemaJson from "./gegenereerd/schema.json";

export type Artikel = {
  code: string;
  omschrijving: string;
  categorie: string;
  eenheid: string;
  verkoopprijs: number;
  [veld: string]: unknown;
};

/** Het JSON-schema voor output_config.format (= json_schema(maak_werfbon_model(...)) in Python). */
export const SCHEMA: Record<string, unknown> = schemaJson;

export const CATALOGUS: ReadonlyMap<string, Artikel> = new Map(
  (catalogusJson as Artikel[]).map((a) => [a.code, a]),
);

export const MAX_TOKENS: number = instellingenJson.max_tokens;

// De prompt als tekstbestand, zodat hij leesbaar blijft in de PR. Bij de route op Vercel (deel 3) moet dit bestand
// mee in de functiebundel (outputFileTracingIncludes).
let systeemprompt: string | undefined;
export function SYSTEEMPROMPT(): string {
  systeemprompt ??= readFileSync(new URL("./gegenereerd/systeemprompt.md", import.meta.url), "utf-8");
  return systeemprompt;
}
