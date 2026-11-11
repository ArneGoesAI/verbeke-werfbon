import { describe, expect, it } from "vitest";

import { valideer } from "./valideer";

const geldig = {
  uren: 2.5,
  km: 18,
  onderdelen: [{ code: "OND-VENTIEL", aantal: 1, omschrijving: null, bronzin: "er ne nieuwe in gestoken" }],
  opmerking: "Klep hing vast, vervangen.",
};

const met = (wijziging: Record<string, unknown>) => JSON.stringify({ ...geldig, ...wijziging });

describe("valideer", () => {
  it("geldige output", () => {
    const v = valideer(JSON.stringify(geldig));
    expect(v).toEqual({ ok: true, extractie: geldig });
  });

  it("km null en onbekend onderdeel zijn geldig", () => {
    const v = valideer(
      met({ km: null, onderdelen: [{ code: "onbekend", aantal: 1, omschrijving: "sifon", bronzin: "nen sifon" }] }),
    );
    expect(v.ok).toBe(true);
  });

  it("lege output", () => {
    expect(valideer("")).toEqual({ ok: false, fout: "lege output" });
    expect(valideer(null)).toEqual({ ok: false, fout: "lege output" });
  });

  it("geen JSON", () => {
    expect(valideer('{"uren": 2').ok).toBe(false);
  });

  it.each([
    ["onbekende code", { onderdelen: [{ code: "ARB-TECH", aantal: 1, omschrijving: null, bronzin: "x" }] }],
    ["veld te veel", { extra: 1 }],
    ["km geen geheel getal", { km: 1.5 }],
    ["uren als tekst", { uren: "2" }],
    ["bronzin ontbreekt", { onderdelen: [{ code: "OND-POMP", aantal: 1, omschrijving: null }] }],
  ])("buiten het schema: %s", (_, wijziging) => {
    const v = valideer(met(wijziging));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fout).toMatch(/^past niet in het schema/);
  });

  it.each([
    ["13 uren", { uren: 13 }, /uren buiten/],
    ["negatieve uren", { uren: -1 }, /uren buiten/],
    ["negatieve km", { km: -5 }, /km negatief/],
    ["aantal 0", { onderdelen: [{ ...geldig.onderdelen[0], aantal: 0 }] }, /aantal/],
  ])("buiten de grenzen: %s", (_, wijziging, fout) => {
    const v = valideer(met(wijziging));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fout).toMatch(fout);
  });

  it("12 uren mag nog", () => {
    expect(valideer(met({ uren: 12 })).ok).toBe(true);
  });
});
