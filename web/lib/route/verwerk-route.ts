// POST /api/verwerk, zonder Next en zonder Supabase: alle toegang loopt via afhankelijkheden, zodat de tests met
// nagemaakte versies werken. De echte staan in afhankelijkheden.ts.
//
// Volgorde: sessie → pad van mij en van deze interventie → context → bestand → verwerk() → wegschrijven.
// Eerst de nieuwe bon volledig, pas daarna een oude conceptbon weg: mislukt het schrijven, dan blijft het oude
// voorstel staan en verdwijnt de half geschreven nieuwe bon. De opname wordt altijd bewaard, ook als verwerk()
// mislukt (dan zonder bon). Geen refusal-fallback.

import { FOTO_TYPES } from "../verwerking/extraheer";
import type { Context } from "../verwerking/types";
import type { Resultaat, VerwerkInvoer } from "../verwerking/verwerk";
import { type BonRij, type LijnRij, type OpnameRij, type Soort, bonRij, lijnRijen, opnameRij } from "./bouw-bon";

export type Verzoek = { interventie_id: number; pad: string; soort: Soort; mediatype: string };

export type SessieAfh = {
  ikId: number;
  isMijnOpnamepad(pad: string): Promise<boolean>;
  /** Met de sessie, dus door RLS: null als de interventie niet van mij is. */
  interventie(id: number): Promise<Context | null>;
  download(pad: string): Promise<Blob>;
};

export type DienstAfh = {
  peildatum(): Promise<string>;
  eigenBonnen(interventieId: number, ikId: number): Promise<{ id: number; status: string }[]>;
  artikelIds(codes: string[]): Promise<Map<string, number>>;
  maakBon(rij: BonRij): Promise<number>;
  maakLijnen(werfbonId: number, rijen: LijnRij[]): Promise<void>;
  maakOpname(rij: OpnameRij): Promise<void>;
  /** Alleen een conceptbon van deze technieker; lijnen gaan mee (cascade). */
  verwijderConceptbon(werfbonId: number, ikId: number): Promise<void>;
};

export type RouteAfh = {
  sessie(): Promise<SessieAfh | null>;
  dienst(): DienstAfh;
  verwerk(ctx: Context, invoer: VerwerkInvoer): Promise<Resultaat>;
  log?(tekst: string): void;
};

export type Antwoord = { status: number; body: { werfbon_id?: number; fout?: string; melding?: string } };

const fout = (status: number, fout: string, melding: string): Antwoord => ({ status, body: { fout, melding } });

export function leesVerzoek(data: unknown): Verzoek | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.interventie_id !== "number" || !Number.isSafeInteger(d.interventie_id) || d.interventie_id <= 0) return null;
  if (typeof d.pad !== "string" || d.pad.length === 0 || d.pad.length > 300) return null;
  if (d.soort !== "audio" && d.soort !== "foto") return null;
  if (typeof d.mediatype !== "string") return null;
  return { interventie_id: d.interventie_id, pad: d.pad, soort: d.soort, mediatype: d.mediatype };
}

/** Het tweede segment van {medewerker}/{interventie}/{bestand} moet de interventie uit het verzoek zijn. */
export function padHoortBij(pad: string, ikId: number, interventieId: number): boolean {
  const delen = pad.split("/");
  return delen.length === 3 && delen[0] === String(ikId) && delen[1] === String(interventieId) && delen[2] !== "";
}

function meldingVoor(r: Resultaat): string {
  if (!r.ok && r.fout === "lege transcriptie") return "Ik hoorde niets. Spreek opnieuw in, dicht bij de gsm.";
  return "Er kon geen bon gemaakt worden. Probeer opnieuw, of fotografeer de papieren bon.";
}

export async function verwerkVerzoek(data: unknown, afh: RouteAfh): Promise<Antwoord> {
  const log = afh.log ?? (() => {});
  const v = leesVerzoek(data);
  if (!v) return fout(400, "ongeldig verzoek", "Er ging iets mis bij het versturen.");

  const sessie = await afh.sessie();
  if (!sessie) return fout(401, "niet aangemeld", "Je bent niet meer aangemeld. Meld je opnieuw aan.");
  const ikId = sessie.ikId;

  if (!padHoortBij(v.pad, ikId, v.interventie_id) || !(await sessie.isMijnOpnamepad(v.pad))) {
    return fout(403, "pad hoort niet bij jou of bij deze interventie", "Deze interventie is niet van jou.");
  }
  if (v.soort === "foto" && !(FOTO_TYPES as readonly string[]).includes(v.mediatype)) {
    return fout(422, `fotoformaat ${v.mediatype} niet ondersteund`, "Dit soort foto kan ik niet lezen. Neem een nieuwe foto.");
  }

  const ctx = await sessie.interventie(v.interventie_id);
  if (!ctx) return fout(404, "interventie niet gevonden", "Deze interventie is niet van jou.");
  if (ctx.type !== "herstelling" && ctx.type !== "onderhoud") {
    return fout(422, `type ${ctx.type} wordt niet verwerkt`, `Voor een ${ctx.type} maak je in de app geen bon.`);
  }

  const dienst = afh.dienst();
  const bestaand = await dienst.eigenBonnen(v.interventie_id, ikId);
  if (bestaand.some((b) => b.status !== "concept")) {
    return fout(409, "er is al een bevestigde bon", "De bon van deze interventie is al bevestigd.");
  }

  const bestand = await sessie.download(v.pad);
  const invoer: VerwerkInvoer =
    v.soort === "audio"
      ? { soort: "audio", bestand, bestandsnaam: v.pad.split("/")[2] }
      : { soort: "foto", bestand, mediatype: v.mediatype as (typeof FOTO_TYPES)[number] };

  const basis = { interventieId: v.interventie_id, ikId, soort: v.soort, pad: v.pad };
  let resultaat: Resultaat;
  try {
    resultaat = await afh.verwerk(ctx, invoer);
  } catch (e) {
    const tekst = e instanceof Error ? e.message : String(e);
    log(`verwerk faalde: ${tekst}`);
    await bewaarOpname(dienst, opnameRij(null, { ...basis, werfbonId: null }), log);
    return fout(502, tekst, "De verwerking lukt nu niet. Probeer zo dadelijk opnieuw.");
  }
  if (!resultaat.ok) {
    log(`geen bon: ${resultaat.fout}`);
    await bewaarOpname(dienst, opnameRij(resultaat, { ...basis, werfbonId: null }), log);
    return fout(422, resultaat.fout, meldingVoor(resultaat));
  }

  const datum = await dienst.peildatum();
  const ids = await dienst.artikelIds([...new Set(resultaat.lijnen.map((l) => l.code))]);
  const lijnen = lijnRijen(resultaat.lijnen, ids); // gooit vóór er iets geschreven is
  const bonId = await dienst.maakBon(bonRij(resultaat, { ...basis, datum }));
  try {
    await dienst.maakLijnen(bonId, lijnen);
    await dienst.maakOpname(opnameRij(resultaat, { ...basis, werfbonId: bonId }));
  } catch (e) {
    await dienst.verwijderConceptbon(bonId, ikId);
    throw e;
  }

  // "Opnieuw inspreken" vervangt: de oude voorstellen weg. Hun opnames blijven (werfbon_id wordt null).
  for (const oud of bestaand) {
    try {
      await dienst.verwijderConceptbon(oud.id, ikId);
    } catch (e) {
      log(`oude conceptbon ${oud.id} niet verwijderd: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { status: 200, body: { werfbon_id: bonId } };
}

async function bewaarOpname(dienst: DienstAfh, rij: OpnameRij, log: (t: string) => void) {
  try {
    await dienst.maakOpname(rij);
  } catch (e) {
    log(`opname niet bewaard: ${e instanceof Error ? e.message : e}`);
  }
}
