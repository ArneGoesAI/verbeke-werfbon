// Dezelfde gevallen als eval/tests/test_afgeleide_lijnen.py.

import { describe, expect, it } from "vitest";

import { AFGELEIDE_CODES, afgeleideLijnen, normaliseer, onderdelenUit, volledigeLijnen } from "./afgeleide-lijnen";
import { laadGevallen } from "./testhulp";

describe("herstelling", () => {
  it("arbeid is uren plus verplaatsing", () => {
    expect(afgeleideLijnen("herstelling", null, 2.5)).toEqual([
      { code: "ARB-TECH", aantal: 2.5 },
      { code: "VERPL", aantal: 1 },
    ]);
  });

  it("met onderdeel", () => {
    expect(volledigeLijnen("herstelling", null, 2, [{ code: "OND-POMP", aantal: 1 }])).toEqual([
      { code: "ARB-TECH", aantal: 2 },
      { code: "OND-POMP", aantal: 1 },
      { code: "VERPL", aantal: 1 },
    ]);
  });

  it("toestel maakt niet uit", () => {
    expect(afgeleideLijnen("herstelling", "warmtepomp", 1.5)).toEqual(afgeleideLijnen("herstelling", null, 1.5));
  });

  it("kwartieren", () => {
    expect(afgeleideLijnen("herstelling", null, 1.25)[0]).toEqual({ code: "ARB-TECH", aantal: 1.25 });
  });

  it("nul uren geeft geen arbeidslijn", () => {
    expect(afgeleideLijnen("herstelling", null, 0)).toEqual([{ code: "VERPL", aantal: 1 }]);
  });

  it("onbekend onderdeel blijft staan", () => {
    expect(volledigeLijnen("herstelling", "ventilatie", 2.5, [{ code: "onbekend", aantal: 1 }])).toContainEqual({
      code: "onbekend",
      aantal: 1,
    });
  });
});

describe("onderhoud", () => {
  it.each([
    ["warmtepomp", "ARB-ONDERH-WP"],
    ["ventilatie", "ARB-ONDERH-VENT"],
    ["zonneboiler", "ARB-ONDERH-ZB"],
  ])("forfait voor %s", (toestel, code) => {
    expect(afgeleideLijnen("onderhoud", toestel, 1.5)).toEqual([{ code, aantal: 1 }]);
  });

  it("geen arbeid en geen verplaatsing", () => {
    const codes = afgeleideLijnen("onderhoud", "warmtepomp", 2).map((l) => l.code);
    expect(codes).not.toContain("ARB-TECH");
    expect(codes).not.toContain("VERPL");
  });

  it("met extra onderdeel", () => {
    expect(volledigeLijnen("onderhoud", "ventilatie", 1.5, [{ code: "VENT-FILT", aantal: 1 }])).toEqual([
      { code: "ARB-ONDERH-VENT", aantal: 1 },
      { code: "VENT-FILT", aantal: 1 },
    ]);
  });

  it("zonder toestel is een fout", () => {
    expect(() => afgeleideLijnen("onderhoud", null, 1)).toThrow();
  });

  it("onbekend toestel is een fout", () => {
    expect(() => afgeleideLijnen("onderhoud", "boiler", 1)).toThrow();
  });
});

describe("fouten", () => {
  it.each(["installatie", "plaatsbezoek", ""])("type %j is een fout", (type) => {
    expect(() => afgeleideLijnen(type, null, 8)).toThrow();
  });

  it.each([...AFGELEIDE_CODES].sort())("afgeleide code %s tussen de onderdelen is een fout", (code) => {
    expect(() => volledigeLijnen("herstelling", null, 1, [{ code, aantal: 1 }])).toThrow();
  });
});

describe("normaliseer", () => {
  it("dezelfde code wordt samengeteld", () => {
    expect(
      normaliseer([
        { code: "WP-KOEL", aantal: 1 },
        { code: "WP-KOEL", aantal: 1 },
      ]),
    ).toEqual([{ code: "WP-KOEL", aantal: 2 }]);
  });

  it("gesorteerd op code en extra velden weg", () => {
    expect(
      normaliseer([
        { code: "VERPL", aantal: 1 },
        { code: "onbekend", aantal: 1, omschrijving: "x" } as { code: string; aantal: number },
        { code: "ARB-TECH", aantal: 2.0 },
      ]),
    ).toEqual([
      { code: "ARB-TECH", aantal: 2 },
      { code: "VERPL", aantal: 1 },
      { code: "onbekend", aantal: 1 },
    ]);
  });

  it("tekst wordt een getal", () => {
    expect(normaliseer([{ code: "X", aantal: "1.5" }])).toEqual([{ code: "X", aantal: 1.5 }]);
  });
});

describe("alle gevallen", () => {
  // De gold-onderdelen plus de afgeleide lijnen geven voor elk geval exact de gold-lijnen.
  const gevallen = laadGevallen();

  it("cases.jsonl heeft 20 gevallen", () => {
    expect(gevallen).toHaveLength(20);
  });

  it.each(gevallen.map((g) => [g.case_id, g] as const))("%s", (_, g) => {
    const toestel = g.context.toestel?.type ?? null;
    expect(volledigeLijnen(g.type, toestel, g.gold.uren, onderdelenUit(g.gold.lijnen))).toEqual(
      normaliseer(g.gold.lijnen),
    );
  });
});
