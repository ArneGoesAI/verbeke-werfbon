import { describe, expect, it } from "vitest";

import {
  type BevestigInvoer,
  type CatalogusArtikel,
  afgeleideRijen,
  bouwVoorstel,
  controleer,
  extractieOnderdelen,
  kiesArtikel,
  kiesbaar,
  leesGetal,
  namen,
  nietAanrekenen,
  openVakken,
  verwijder,
  wijzigAantal,
} from "./voorstel";

const CATALOGUS: CatalogusArtikel[] = [
  { code: "ARB-TECH", omschrijving: "Arbeid technieker", categorie: "arbeid" },
  { code: "ARB-ONDERH-WP", omschrijving: "Jaarlijks onderhoud warmtepomp", categorie: "arbeid" },
  { code: "VERPL", omschrijving: "Verplaatsingskosten", categorie: "verplaatsing" },
  { code: "KM", omschrijving: "Kilometervergoeding", categorie: "verplaatsing" },
  { code: "OND-VENTIEL", omschrijving: "Driewegklep", categorie: "onderdeel" },
  { code: "OND-SENS", omschrijving: "Temperatuursensor", categorie: "onderdeel" },
];
const CODES = new Set(CATALOGUS.map((a) => a.code));

const extractie = {
  uren: 1.5,
  km: 21,
  opmerking: "",
  onderdelen: [
    { code: "OND-VENTIEL", aantal: 1, omschrijving: null, bronzin: "die klep met drie wegen zat muurvast" },
    { code: "onbekend", aantal: 1, omschrijving: "zwart doosje", bronzin: "dat klein zwart doosken" },
  ],
};

const bon = {
  uren: 1.5,
  km: 21,
  opmerkingen: null,
  lijnen: [
    { code: "ARB-TECH", aantal: 1.5 },
    { code: "OND-VENTIEL", aantal: 1 },
    { code: "VERPL", aantal: 1 },
  ],
};

describe("bouwVoorstel", () => {
  it("onderdelen met citaat, afgeleide lijnen apart, onbekend als geel vak", () => {
    const v = bouwVoorstel(bon, extractie, CATALOGUS);
    expect(v.onderdelen).toEqual([
      { sleutel: "lijn-OND-VENTIEL", code: "OND-VENTIEL", naam: "Driewegklep", aantal: 1, bronzinnen: ["die klep met drie wegen zat muurvast"] },
    ]);
    expect(v.onbekend).toEqual([
      { sleutel: "onbekend-0", omschrijving: "zwart doosje", bronzin: "dat klein zwart doosken", aantal: 1, oplossing: null },
    ]);
    expect(openVakken(v)).toBe(1);
  });

  it("zonder extractie (bv. mislukte opname): rijen zonder citaat, geen gele vakken", () => {
    const v = bouwVoorstel(bon, null, CATALOGUS);
    expect(v.onderdelen[0].bronzinnen).toEqual([]);
    expect(v.onbekend).toEqual([]);
    expect(extractieOnderdelen({ onderdelen: "kapot" })).toEqual([]);
  });

  it("afgeleide rijen voor herstelling en onderhoud", () => {
    const n = namen(CATALOGUS);
    expect(afgeleideRijen("herstelling", null, 1.5, n)).toEqual([
      { code: "ARB-TECH", tekst: "Arbeid technieker · 1,5 u" },
      { code: "VERPL", tekst: "Verplaatsingskosten" },
    ]);
    expect(afgeleideRijen("herstelling", null, 0, n)).toEqual([{ code: "VERPL", tekst: "Verplaatsingskosten" }]);
    expect(afgeleideRijen("onderhoud", "warmtepomp", 1, n)).toEqual([{ code: "ARB-ONDERH-WP", tekst: "Jaarlijks onderhoud warmtepomp" }]);
    expect(afgeleideRijen("onderhoud", null, 1, n)).toEqual([]);
  });

  it("kiesbaar: geen arbeid of verplaatsing", () => {
    expect(kiesbaar(CATALOGUS).map((a) => a.code)).toEqual(["OND-VENTIEL", "OND-SENS"]);
  });
});

describe("aanpassen", () => {
  const v = bouwVoorstel(bon, extractie, CATALOGUS);

  it("+ en −, niet tot nul", () => {
    const plus = wijzigAantal(v, "lijn-OND-VENTIEL", 1);
    expect(plus.onderdelen[0].aantal).toBe(2);
    expect(wijzigAantal(v, "lijn-OND-VENTIEL", -1).onderdelen[0].aantal).toBe(1);
  });

  it("verwijderen", () => {
    expect(verwijder(v, "lijn-OND-VENTIEL").onderdelen).toEqual([]);
  });

  it("kies artikel: nieuw onderdeel met het citaat, vak weg", () => {
    const k = kiesArtikel(v, "onbekend-0", CATALOGUS[5]);
    expect(k.onbekend).toEqual([]);
    expect(k.onderdelen.at(-1)).toMatchObject({ code: "OND-SENS", naam: "Temperatuursensor", aantal: 1, bronzinnen: ["dat klein zwart doosken"] });
    expect(openVakken(k)).toBe(0);
  });

  it("kies artikel dat er al staat: aantallen samen", () => {
    const k = kiesArtikel(v, "onbekend-0", CATALOGUS[4]);
    expect(k.onderdelen).toHaveLength(1);
    expect(k.onderdelen[0]).toMatchObject({ code: "OND-VENTIEL", aantal: 2 });
    expect(k.onderdelen[0].bronzinnen).toHaveLength(2);
  });

  it("niet aanrekenen sluit het vak, en is terug te draaien", () => {
    const n = nietAanrekenen(v, "onbekend-0");
    expect(openVakken(n)).toBe(0);
    expect(openVakken(nietAanrekenen(n, "onbekend-0", false))).toBe(1);
  });

  it("leesGetal", () => {
    expect(leesGetal("1,5")).toBe(1.5);
    expect(leesGetal(" 2.25 ")).toBe(2.25);
    expect(leesGetal("21")).toBe(21);
    expect(leesGetal("")).toBeNull();
    expect(leesGetal("-1")).toBeNull();
    expect(leesGetal("1,2,3")).toBeNull();
  });
});

describe("controleer", () => {
  const herstelling = { type: "herstelling", toesteltype: null };
  const goed: BevestigInvoer = {
    uren: 1.5,
    km: 21,
    onderdelen: [{ code: "OND-VENTIEL", aantal: 1 }],
    onbekend: [{ omschrijving: "zwart doosje", bronzin: "dat klein zwart doosken", aantal: 1, oplossing: { soort: "nietAanrekenen" } }],
    opmerking: "klant was niet thuis",
  };

  it("geeft de volledige lijnen en de opmerkingen", () => {
    expect(controleer(goed, herstelling, CODES)).toEqual({
      ok: true,
      uren: 1.5,
      km: 21,
      lijnen: [
        { code: "ARB-TECH", aantal: 1.5 },
        { code: "OND-VENTIEL", aantal: 1 },
        { code: "VERPL", aantal: 1 },
      ],
      opmerkingen: "klant was niet thuis\nNiet aangerekend: zwart doosje × 1",
    });
  });

  it("onderhoud: forfait in plaats van arbeid", () => {
    const r = controleer({ ...goed, onbekend: [], opmerking: null }, { type: "onderhoud", toesteltype: "warmtepomp" }, CODES);
    expect(r).toMatchObject({ ok: true, lijnen: [{ code: "ARB-ONDERH-WP", aantal: 1 }, { code: "OND-VENTIEL", aantal: 1 }], opmerkingen: null });
  });

  it("onderhoud zonder contract: geen forfait, wel bevestigen", () => {
    const r = controleer({ ...goed, onbekend: [] }, { type: "onderhoud", toesteltype: null }, CODES);
    expect(r).toMatchObject({ ok: true, lijnen: [{ code: "OND-VENTIEL", aantal: 1 }] });
  });

  it("weigert een open geel vak", () => {
    const r = controleer({ ...goed, onbekend: [{ ...goed.onbekend[0], oplossing: null }] }, herstelling, CODES);
    expect(r).toEqual({ ok: false, fout: "Los eerst het gele vak op, dan kan je bevestigen." });
  });

  it("weigert uren buiten 0–12, kommagetal-km en negatieve km", () => {
    expect(controleer({ ...goed, uren: 13 }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, uren: -1 }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, uren: 1.333 }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, km: 2.5 }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, km: -3 }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, uren: 0, km: 0 }, herstelling, CODES).ok).toBe(true);
  });

  it("weigert een code buiten de catalogus, een afgeleide code of aantal 0", () => {
    expect(controleer({ ...goed, onderdelen: [{ code: "XYZ", aantal: 1 }] }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, onderdelen: [{ code: "ARB-TECH", aantal: 1 }] }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, onderdelen: [{ code: "onbekend", aantal: 1 }] }, herstelling, CODES).ok).toBe(false);
    expect(controleer({ ...goed, onderdelen: [{ code: "OND-SENS", aantal: 0 }] }, herstelling, CODES).ok).toBe(false);
  });
});
