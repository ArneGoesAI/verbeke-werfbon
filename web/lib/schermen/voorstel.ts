// T4 Voorstel: de bon als rijen met hun bron (citaat of "Automatisch"), de gele vakken, de aanpassingen van de
// technieker en de controle bij Bevestigen. Puur: draait in de browser (scherm) en op de server (controle).
// Geen prijzen: de technieker ziet alleen namen en aantallen.

import { AFGELEIDE_CODES, afgeleideLijnen, normaliseer, onderdelenUit, volledigeLijnen } from "../verwerking/afgeleide-lijnen";
import { MAX_UREN } from "../verwerking/grenzen";
import type { Lijn } from "../verwerking/types";
import { aantal as aantalTekst } from "../opmaak";

export type CatalogusArtikel = { code: string; omschrijving: string; categorie: string };

export type OnderdeelRij = { sleutel: string; code: string; naam: string; aantal: number; bronzinnen: string[] };

export type Oplossing = null | { soort: "nietAanrekenen" };

/** Een onderdeel met code "onbekend": geel vak tot het een artikel krijgt of op "Niet aanrekenen" staat. */
export type GeelVak = { sleutel: string; omschrijving: string | null; bronzin: string; aantal: number; oplossing: Oplossing };

export type Voorstel = { uren: number; km: number; onderdelen: OnderdeelRij[]; onbekend: GeelVak[]; opmerking: string | null };

type ExtractieOnderdeel = { code: string; aantal: number; omschrijving: string | null; bronzin: string };

/** De onderdelen uit werfbon_opnames.extractie, voorzichtig gelezen: een oude of lege extractie geeft []. */
export function extractieOnderdelen(extractie: unknown): ExtractieOnderdeel[] {
  const lijst = (extractie as { onderdelen?: unknown } | null)?.onderdelen;
  if (!Array.isArray(lijst)) return [];
  return lijst
    .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null && typeof o.code === "string")
    .map((o) => ({
      code: o.code as string,
      aantal: typeof o.aantal === "number" ? o.aantal : 1,
      omschrijving: typeof o.omschrijving === "string" ? o.omschrijving : null,
      bronzin: typeof o.bronzin === "string" ? o.bronzin : "",
    }));
}

export function namen(catalogus: CatalogusArtikel[]): Map<string, string> {
  return new Map(catalogus.map((a) => [a.code, a.omschrijving]));
}

/** Wat de technieker mag kiezen bij "Kies artikel": geen arbeid en geen verplaatsing (die vult de code aan). */
export function kiesbaar(catalogus: CatalogusArtikel[]): CatalogusArtikel[] {
  return catalogus.filter((a) => a.categorie !== "arbeid" && a.categorie !== "verplaatsing" && !AFGELEIDE_CODES.has(a.code));
}

export function bouwVoorstel(
  bon: { uren: number; km: number; opmerkingen: string | null; lijnen: Lijn[] },
  extractie: unknown,
  catalogus: CatalogusArtikel[],
): Voorstel {
  const naam = namen(catalogus);
  const uitModel = extractieOnderdelen(extractie);
  const onderdelen = onderdelenUit(normaliseer(bon.lijnen)).map((l) => ({
    sleutel: `lijn-${l.code}`,
    code: l.code,
    naam: naam.get(l.code) ?? l.code,
    aantal: l.aantal,
    bronzinnen: uitModel.filter((o) => o.code === l.code && o.bronzin).map((o) => o.bronzin),
  }));
  const onbekend = uitModel
    .filter((o) => o.code === "onbekend")
    .map((o, i) => ({ sleutel: `onbekend-${i}`, omschrijving: o.omschrijving, bronzin: o.bronzin, aantal: o.aantal, oplossing: null }));
  return { uren: bon.uren, km: bon.km, onderdelen, onbekend, opmerking: bon.opmerkingen };
}

export type AfgeleideRij = { code: string; tekst: string };

/** "Arbeid technieker · 1,5 u", "Verplaatsing" of het forfait. Onderhoud zonder toestel: geen forfait af te leiden. */
export function afgeleideRijen(type: string, toesteltype: string | null, uren: number, naam: Map<string, string>): AfgeleideRij[] {
  let lijnen: Lijn[];
  try {
    lijnen = afgeleideLijnen(type, toesteltype, uren);
  } catch {
    return [];
  }
  return lijnen.map((l) => ({
    code: l.code,
    tekst: l.code === "ARB-TECH" ? `${naam.get(l.code) ?? "Arbeid technieker"} · ${aantalTekst(l.aantal)} u` : (naam.get(l.code) ?? l.code),
  }));
}

export function openVakken(v: Voorstel): number {
  return v.onbekend.filter((g) => g.oplossing === null).length;
}

// ── Aanpassingen (de technieker beslist) ──

export function zetUren(v: Voorstel, uren: number): Voorstel {
  return { ...v, uren };
}

export function zetKm(v: Voorstel, km: number): Voorstel {
  return { ...v, km };
}

/** + of −; tot 0 of lager gaat niet (daarvoor is er "Verwijderen"). */
export function wijzigAantal(v: Voorstel, sleutel: string, delta: number): Voorstel {
  return {
    ...v,
    onderdelen: v.onderdelen.map((o) => {
      if (o.sleutel !== sleutel) return o;
      const nieuw = Math.round((o.aantal + delta) * 100) / 100;
      return nieuw > 0 ? { ...o, aantal: nieuw } : o;
    }),
  };
}

export function verwijder(v: Voorstel, sleutel: string): Voorstel {
  return { ...v, onderdelen: v.onderdelen.filter((o) => o.sleutel !== sleutel) };
}

/** "Kies artikel": het gele vak wordt een gewone rij, met zijn citaat. Zelfde code al aanwezig → aantallen opgeteld. */
export function kiesArtikel(v: Voorstel, sleutel: string, artikel: CatalogusArtikel): Voorstel {
  const vak = v.onbekend.find((g) => g.sleutel === sleutel);
  if (!vak) return v;
  const onbekend = v.onbekend.filter((g) => g.sleutel !== sleutel);
  const bestaand = v.onderdelen.find((o) => o.code === artikel.code);
  const onderdelen = bestaand
    ? v.onderdelen.map((o) =>
        o === bestaand ? { ...o, aantal: o.aantal + vak.aantal, bronzinnen: [...o.bronzinnen, vak.bronzin].filter(Boolean) } : o,
      )
    : [
        ...v.onderdelen,
        { sleutel: `gekozen-${sleutel}`, code: artikel.code, naam: artikel.omschrijving, aantal: vak.aantal, bronzinnen: [vak.bronzin].filter(Boolean) },
      ];
  return { ...v, onbekend, onderdelen };
}

export function nietAanrekenen(v: Voorstel, sleutel: string, ja = true): Voorstel {
  return {
    ...v,
    onbekend: v.onbekend.map((g) => (g.sleutel === sleutel ? { ...g, oplossing: ja ? { soort: "nietAanrekenen" } : null } : g)),
  };
}

// ── Controle bij Bevestigen (op de server, met de echte catalogus) ──

/** Wat de browser naar de server action stuurt. */
export type BevestigInvoer = {
  uren: number;
  km: number;
  onderdelen: { code: string; aantal: number }[];
  onbekend: { omschrijving: string | null; bronzin: string; aantal: number; oplossing: Oplossing }[];
  opmerking: string | null;
};

export type Controle =
  | { ok: true; uren: number; km: number; lijnen: Lijn[]; opmerkingen: string | null }
  | { ok: false; fout: string };

const isGetal = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function controleer(
  invoer: BevestigInvoer,
  ctx: { type: string; toesteltype: string | null },
  catalogusCodes: ReadonlySet<string>,
): Controle {
  if (!isGetal(invoer.uren) || invoer.uren < 0 || invoer.uren > MAX_UREN) {
    return { ok: false, fout: `Gewerkt moet tussen 0 en ${MAX_UREN} uur liggen.` };
  }
  if (Math.round(invoer.uren * 100) !== invoer.uren * 100) return { ok: false, fout: "Gewerkt: hoogstens twee cijfers na de komma." };
  if (!isGetal(invoer.km) || !Number.isInteger(invoer.km) || invoer.km < 0) {
    return { ok: false, fout: "Gereden moet een geheel aantal kilometer zijn, 0 of meer." };
  }
  if (!Array.isArray(invoer.onderdelen) || !Array.isArray(invoer.onbekend)) return { ok: false, fout: "Ongeldig voorstel." };
  for (const o of invoer.onderdelen) {
    if (typeof o?.code !== "string" || !catalogusCodes.has(o.code) || AFGELEIDE_CODES.has(o.code)) {
      return { ok: false, fout: `Onbekend artikel: ${String(o?.code)}.` };
    }
    if (!isGetal(o.aantal) || o.aantal <= 0) return { ok: false, fout: `Het aantal voor ${o.code} moet groter dan 0 zijn.` };
  }
  if (invoer.onbekend.some((g) => g?.oplossing?.soort !== "nietAanrekenen")) {
    return { ok: false, fout: "Los eerst het gele vak op, dan kan je bevestigen." };
  }

  let lijnen: Lijn[];
  if (ctx.type === "onderhoud" && ctx.toesteltype === null) {
    // Onderhoud zonder contract: geen forfait. De administratie ziet de waarschuwing "onderhoud zonder contract".
    lijnen = normaliseer(invoer.onderdelen);
  } else {
    try {
      lijnen = volledigeLijnen(ctx.type, ctx.toesteltype, invoer.uren, invoer.onderdelen);
    } catch (e) {
      return { ok: false, fout: e instanceof Error ? e.message : String(e) };
    }
  }

  // Niet aangerekende onderdelen in de opmerkingen, zodat de administratie ze ziet.
  const niet = invoer.onbekend.map((g) => `Niet aangerekend: ${(g.omschrijving || g.bronzin || "onderdeel").trim()} × ${aantalTekst(g.aantal)}`);
  const opmerkingen = [invoer.opmerking?.trim(), ...niet].filter(Boolean).join("\n") || null;
  return { ok: true, uren: invoer.uren, km: invoer.km, lijnen, opmerkingen };
}

/** "1,5" of "1.5" → 1.5; leeg of onzin → null. */
export function leesGetal(tekst: string): number | null {
  const t = tekst.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
