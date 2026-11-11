// De queries van administratie.ts met de sessie uit de cookies. Alleen op de server.

import "server-only";

import { serverClient } from "../supabase/server";
import * as q from "./administratie";

export type { Conceptfactuur, FactuurDetail, Opname } from "./administratie";

export async function laadConceptfacturen(): Promise<q.Conceptfactuur[]> {
  return q.laadConceptfacturen(await serverClient());
}

export async function laadFactuurDetail(factuur: q.Conceptfactuur): Promise<q.FactuurDetail> {
  return q.laadFactuurDetail(await serverClient(), factuur);
}
