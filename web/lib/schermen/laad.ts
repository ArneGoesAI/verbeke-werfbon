// De queries van queries.ts met de sessie uit de cookies. Alleen op de server.

import "server-only";

import { serverClient } from "../supabase/server";
import * as q from "./queries";
import type { Interventie } from "./vandaag";

export type { BonVoorT4 } from "./queries";

export async function laadVandaag(ikId: number): Promise<{ datum: string; interventies: Interventie[] }> {
  return q.laadVandaag(await serverClient(), ikId);
}

export async function laadInterventie(ikId: number, id: number): Promise<Interventie | null> {
  return q.laadInterventie(await serverClient(), ikId, id);
}

export async function laadBon(ikId: number, id: number): Promise<q.BonVoorT4 | null> {
  return q.laadBon(await serverClient(), ikId, id);
}
