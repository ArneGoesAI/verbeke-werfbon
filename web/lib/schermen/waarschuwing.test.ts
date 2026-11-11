import { describe, expect, it } from "vitest";

import { bedrag } from "../opmaak";
import {
  bedragen,
  duur,
  factuurStatus,
  filterFacturen,
  kiesFactuur,
  kortLabel,
  leesFilter,
  lijnBedrag,
  opDeCent,
  waarschuwingZin,
} from "./waarschuwing";

describe("kortLabel", () => {
  it("geeft een kort label voor elke tekst van factuurwaarschuwingen()", () => {
    expect(kortLabel("niet getekend door de klant")).toBe("Niet getekend");
    expect(kortLabel("ongewoon veel uren: 9.5")).toBe("Veel uren");
    expect(kortLabel("onderhoud zonder contract: geen jaarprijs")).toBe("Geen contract");
    expect(kortLabel("onderdeel op onderhoudsbon, niet aangerekend: OND-SENS × 1")).toBe("Onderdeel bij onderhoud");
    expect(kortLabel("arbeid op de bon (2 u) wijkt af van de uren (1.5 u)")).toBe("Uren wijken af");
  });

  it("toont een onbekende waarschuwing toch, zonder detail na de dubbele punt", () => {
    expect(kortLabel("iets nieuws: details")).toBe("Iets nieuws");
  });
});

describe("factuurStatus", () => {
  it("is Klaar zonder waarschuwingen", () => {
    expect(factuurStatus([])).toEqual({ soort: "inOrde", tekst: "Klaar" });
  });

  it("neemt de eerste waarschuwing", () => {
    expect(factuurStatus(["niet getekend door de klant", "ongewoon veel uren: 9"])).toEqual({
      soort: "nakijken",
      tekst: "Niet getekend",
    });
  });
});

describe("waarschuwingZin", () => {
  it("zet een hoofdletter vooraan", () => {
    expect(waarschuwingZin("niet getekend door de klant")).toBe("Niet getekend door de klant");
  });
});

describe("filters en selectie", () => {
  const lijst = [
    { id: 1, waarschuwingen: [] },
    { id: 2, waarschuwingen: ["niet getekend door de klant"] },
    { id: 3, waarschuwingen: ["ongewoon veel uren: 9"] },
  ];

  it("leest de filter uit de URL, standaard alle", () => {
    expect(leesFilter("nakijken")).toBe("nakijken");
    expect(leesFilter(undefined)).toBe("alle");
    expect(leesFilter("iets")).toBe("alle");
    expect(leesFilter(["nakijken"])).toBe("alle");
  });

  it("filtert op na te kijken", () => {
    expect(filterFacturen(lijst, "alle").map((f) => f.id)).toEqual([1, 2, 3]);
    expect(filterFacturen(lijst, "nakijken").map((f) => f.id)).toEqual([2, 3]);
  });

  it("kiest de gevraagde factuur, anders de eerste", () => {
    expect(kiesFactuur(lijst, "3")?.id).toBe(3);
    expect(kiesFactuur(lijst, "99")?.id).toBe(1);
    expect(kiesFactuur(lijst, "abc")?.id).toBe(1);
    expect(kiesFactuur(lijst, undefined)?.id).toBe(1);
    expect(kiesFactuur([], "1")).toBeNull();
  });
});

describe("bedragen", () => {
  it("rekent het voorbeeld uit het ontwerp: 1,5 × € 62 + € 45, btw 6%", () => {
    const lijnen = [
      { aantal: 1.5, eenheidsprijs: 62 },
      { aantal: 1, eenheidsprijs: 45 },
    ];
    expect(lijnBedrag(lijnen[0])).toBe(93);
    const b = bedragen(138, 6, lijnen);
    expect(b).toEqual({ exclBtw: 138, btw: 8.28, totaal: 146.28, somLijnen: 138 });
    expect(bedrag(b.totaal)).toBe("€ 146,28");
  });

  it("aanvaardt numeric als tekst, zoals Supabase het teruggeeft", () => {
    const b = bedragen("217.00" as unknown as number, "6.00" as unknown as number, [
      { aantal: "1.00" as unknown as number, eenheidsprijs: "217.00" as unknown as number },
    ]);
    expect(b).toEqual({ exclBtw: 217, btw: 13.02, totaal: 230.02, somLijnen: 217 });
  });

  it("rekent btw 21% en rondt af op de cent", () => {
    expect(bedragen(100.05, 21, []).btw).toBe(21.01);
    expect(opDeCent(1.005)).toBe(1.01);
    expect(lijnBedrag({ aantal: 0.33, eenheidsprijs: 10.5 })).toBe(3.47);
  });
});

describe("duur", () => {
  it("toont minuten en seconden", () => {
    expect(duur(41)).toBe("0:41");
    expect(duur(125.6)).toBe("2:06");
  });

  it("geeft null bij een onbekende duur", () => {
    expect(duur(Infinity)).toBeNull();
    expect(duur(NaN)).toBeNull();
    expect(duur(null)).toBeNull();
  });
});
