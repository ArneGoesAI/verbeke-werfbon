// Hulp voor tests en het testscript: de gevallen uit eval/data/cases.jsonl lezen. Niet gebruiken in de app.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Context, Lijn } from "./types";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const CASES = path.join(REPO, "eval", "data", "cases.jsonl");

export type Geval = {
  case_id: string;
  type: string;
  context: Context;
  gold: { uren: number; km: number | null; lijnen: Lijn[]; opmerking: string };
  invoer: { spraak: string; foto: string };
  nagelezen_door: string | null;
  testdata_probleem: string | null;
};

export function laadGevallen(): Geval[] {
  return readFileSync(CASES, "utf-8")
    .split("\n")
    .filter((r) => r.trim())
    .map((r) => JSON.parse(r) as Geval);
}
