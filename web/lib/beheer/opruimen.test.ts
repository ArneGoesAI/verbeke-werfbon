import { describe, expect, it } from "vitest";

import { type Invoer, OpruimFout, bepaalOpruiming, isLeeg, samenvatting } from "./opruimen";

const leeg: Invoer = {
  appBonnen: [],
  facturen: [],
  bonnenOpFacturen: [],
  opnameIds: [],
  opnamePaden: [],
  bestanden: [],
  gebruikers: [],
  koppelingen: [],
};

const volledig: Invoer = {
  appBonnen: [
    { id: 902, bron: "spraak", factuur_id: 7001 },
    { id: 901, bron: "foto", factuur_id: null }, // nog concept
  ],
  facturen: [{ id: 7001, status: "verstuurd" }],
  bonnenOpFacturen: [{ id: 902, bron: "spraak", factuur_id: 7001 }],
  opnameIds: [3, 1, 2],
  opnamePaden: ["18/55/a.webm", "18/55/b.jpg"],
  bestanden: ["18/55/a.webm", "18/55/c.webm"], // c: geüpload maar nooit verwerkt
  gebruikers: [
    { id: "u-tech", email: "technieker@verbeke.test" },
    { id: "u-adm", email: "administratie@verbeke.test" },
    { id: "u-echt", email: "iemand@voorbeeld.be" },
  ],
  koppelingen: [
    { medewerker_id: 18, auth_user_id: "u-tech" },
    { medewerker_id: 4, auth_user_id: "u-adm" },
    { medewerker_id: 2, auth_user_id: "u-echt" },
  ],
};

describe("bepaalOpruiming", () => {
  it("neemt app-bonnen, hun facturen, opnames en bestanden mee", () => {
    const o = bepaalOpruiming(volledig, { ookAccounts: false });
    expect(o.bonIds).toEqual([901, 902]);
    expect(o.factuurIds).toEqual([7001]);
    expect(o.opnameIds).toEqual([1, 2, 3]);
    expect(o.bestanden).toEqual(["18/55/a.webm", "18/55/b.jpg", "18/55/c.webm"]);
  });

  it("laat de accounts staan zonder --ook-accounts", () => {
    const o = bepaalOpruiming(volledig, { ookAccounts: false });
    expect(o.gebruikerIds).toEqual([]);
    expect(o.ontkoppelMedewerkers).toEqual([]);
  });

  it("neemt met --ook-accounts alleen de twee testgebruikers mee", () => {
    const o = bepaalOpruiming(volledig, { ookAccounts: true });
    expect(o.gebruikerIds).toEqual(["u-tech", "u-adm"]);
    expect(o.ontkoppelMedewerkers).toEqual([4, 18]);
  });

  it("stopt bij een bon die geen app-bon is", () => {
    const fout = { ...volledig, appBonnen: [{ id: 5, bron: "papier", factuur_id: null }] };
    expect(() => bepaalOpruiming(fout, { ookAccounts: false })).toThrow(OpruimFout);
  });

  it("stopt als een factuur ook bij een papieren bon hoort", () => {
    const fout = {
      ...volledig,
      bonnenOpFacturen: [...volledig.bonnenOpFacturen, { id: 40, bron: "papier", factuur_id: 7001 }],
    };
    expect(() => bepaalOpruiming(fout, { ookAccounts: false })).toThrow(/ook bij bon 40/);
  });

  it("stopt bij een betaalde of ontbrekende factuur", () => {
    expect(() =>
      bepaalOpruiming({ ...volledig, facturen: [{ id: 7001, status: "betaald" }] }, { ookAccounts: false }),
    ).toThrow(/status betaald/);
    expect(() => bepaalOpruiming({ ...volledig, facturen: [] }, { ookAccounts: false })).toThrow(/niet gevonden/);
  });

  it("geeft niets bij een lege database", () => {
    expect(isLeeg(bepaalOpruiming(leeg, { ookAccounts: true }))).toBe(true);
  });
});

describe("samenvatting", () => {
  it("toont aantallen en korte lijsten", () => {
    const tekst = samenvatting(bepaalOpruiming(volledig, { ookAccounts: true }));
    expect(tekst).toContain("werfbonnen (+ lijnen)       2  (901, 902)");
    expect(tekst).toContain("testgebruikers              2  (u-tech, u-adm)");
  });
});
