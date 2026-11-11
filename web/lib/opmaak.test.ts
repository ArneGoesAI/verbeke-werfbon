import { describe, expect, it } from "vitest";

import { aantal, bedrag, dagTitel, groet, initialen, klantnaam, km, tijd, uren } from "./opmaak";

const NBSP = " ";

describe("bedrag", () => {
  it("toont euro met twee decimalen en komma", () => {
    expect(bedrag(138)).toBe(`€${NBSP}138,00`);
    expect(bedrag(8.28)).toBe(`€${NBSP}8,28`);
    expect(bedrag("146.28")).toBe(`€${NBSP}146,28`);
  });
  it("zet een punt tussen de duizendtallen", () => expect(bedrag(1234.5)).toBe(`€${NBSP}1.234,50`));
  it("rekent het voorbeeld uit het ontwerp: 1,5 × € 62 + € 45", () => expect(bedrag(1.5 * 62 + 45)).toBe(`€${NBSP}138,00`));
  it("weigert onzin", () => expect(() => bedrag("abc")).toThrow());
});

describe("aantal, uren en km", () => {
  it("laat overbodige nullen weg", () => {
    expect(aantal(1.5)).toBe("1,5");
    expect(aantal("2.00")).toBe("2");
    expect(aantal(1.25)).toBe("1,25");
  });
  it("zet de eenheid erachter", () => {
    expect(uren(1.5)).toBe("1,5 uur");
    expect(km(21)).toBe("21 km");
  });
});

describe("datum en tijd", () => {
  it("geeft de dag met hoofdletter", () => expect(dagTitel("2026-11-05")).toBe("Donderdag 5 november"));
  it("hangt niet af van de tijdzone", () => expect(dagTitel("2026-01-01")).toBe("Donderdag 1 januari"));
  it("weigert een datum met tijd", () => expect(() => dagTitel("2026-11-05T08:00")).toThrow());
  it("toont de tijd in Belgische tijd", () => {
    expect(tijd("2026-11-05T07:30:00Z")).toBe("08:30"); // wintertijd: UTC+1
    expect(tijd("2026-07-01T06:30:00Z")).toBe("08:30"); // zomertijd: UTC+2
  });
});

describe("groet", () => {
  it("volgt het uur in België", () => {
    expect(groet(new Date("2026-11-05T07:00:00Z"))).toBe("Goeiemorgen");
    expect(groet(new Date("2026-11-05T11:00:00Z"))).toBe("Goeiemiddag"); // 12 u
    expect(groet(new Date("2026-11-05T17:00:00Z"))).toBe("Goeieavond"); // 18 u
  });
});

describe("klantnaam en initialen", () => {
  it("particulier als familie, bedrijf met naam", () => {
    expect(klantnaam({ type: "particulier", voornaam: "An", achternaam: "De Smet" })).toBe("Fam. De Smet");
    expect(klantnaam({ type: "bedrijf", bedrijfsnaam: "Bakkerij Van Hecke" })).toBe("Bakkerij Van Hecke");
  });
  it("valt terug als iets ontbreekt", () => {
    expect(klantnaam({ type: "bedrijf", achternaam: "Peeters" })).toBe("Fam. Peeters");
    expect(klantnaam({ type: "particulier" })).toBe("Onbekende klant");
  });
  it("maakt initialen", () => {
    expect(initialen("jonas", "Verhoeven")).toBe("JV");
    expect(initialen(" Els ", "Van Hecke")).toBe("EV");
  });
});
