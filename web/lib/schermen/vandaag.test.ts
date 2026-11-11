import { describe, expect, it } from "vitest";

import {
  type Interventie,
  aantalTekst,
  adres,
  dagGrenzen,
  kaartKlant,
  kaartOmschrijving,
  kaartTitel,
  kaarten,
} from "./vandaag";

const klant = { type: "particulier", voornaam: "Jan", achternaam: "De Smet", straat: "Kerkstraat", huisnummer: "12", gemeente: "Erpe-Mere" };

function interventie(id: number, uur: string, bonnen: Interventie["bonnen"] = []): Interventie {
  return {
    id,
    type: "herstelling",
    gepland_start: `2026-11-05T${uur}:00+01:00`,
    omschrijving: "verwarmt niet",
    klant,
    toestel: null,
    bonnen,
  };
}

describe("kaarten", () => {
  it("sorteert op uur en maakt de vroegste zonder bon actief", () => {
    const r = kaarten([interventie(2, "11:00"), interventie(1, "08:30"), interventie(3, "14:30")]);
    expect(r.map((k) => [k.interventie.id, k.status, k.actief, k.label.tekst])).toEqual([
      [1, "bezig", true, "Bon nog in te spreken"],
      [2, "gepland", false, "Gepland"],
      [3, "gepland", false, "Gepland"],
    ]);
  });

  it("slaat een bevestigde bon over voor de warmterand", () => {
    const r = kaarten([
      interventie(1, "08:30", [{ id: 10, status: "ingegeven" }]),
      interventie(2, "11:00"),
    ]);
    expect(r[0]).toMatchObject({ status: "bevestigd", actief: false, label: { soort: "inOrde", tekst: "Bevestigd" } });
    expect(r[1]).toMatchObject({ status: "bezig", actief: true });
  });

  it("een conceptbon is nog te bevestigen, en kan de actieve zijn", () => {
    const r = kaarten([interventie(1, "08:30", [{ id: 10, status: "concept" }]), interventie(2, "11:00")]);
    expect(r[0]).toMatchObject({ status: "teBevestigen", actief: true, label: { soort: "nakijken", tekst: "Nog te bevestigen" } });
    expect(r[1]).toMatchObject({ status: "gepland", actief: false });
  });

  it("alles bevestigd: geen enkele kaart actief", () => {
    const r = kaarten([interventie(1, "08:30", [{ id: 10, status: "gefactureerd" }])]);
    expect(r.every((k) => !k.actief)).toBe(true);
  });

  it("zonder uur achteraan", () => {
    const zonder = { ...interventie(1, "08:30"), gepland_start: null };
    expect(kaarten([zonder, interventie(2, "16:00")]).map((k) => k.interventie.id)).toEqual([2, 1]);
  });
});

describe("teksten", () => {
  it("titel uit type en toestel", () => {
    expect(kaartTitel({ type: "herstelling", toestel: { toesteltype: "warmtepomp", merk: "Panasonic", model: "Aquarea 9 kW" } })).toBe(
      "Herstelling warmtepomp",
    );
    expect(kaartTitel({ type: "herstelling", toestel: null })).toBe("Herstelling");
  });

  it("omschrijving met en zonder toestel", () => {
    expect(
      kaartOmschrijving({ toestel: { toesteltype: "ventilatie", merk: "Zehnder", model: "ComfoAir Q450" }, omschrijving: "jaarlijks onderhoud" }),
    ).toBe("Zehnder ComfoAir Q450 · jaarlijks onderhoud");
    expect(kaartOmschrijving({ toestel: null, omschrijving: "Lek onder de boiler" })).toBe("Lek onder de boiler");
    expect(kaartOmschrijving({ toestel: null, omschrijving: null })).toBe("");
  });

  it("klant en adres", () => {
    expect(kaartKlant(klant)).toBe("Fam. De Smet · Erpe-Mere");
    expect(adres(klant)).toBe("Kerkstraat 12, Erpe-Mere");
    expect(kaartKlant({ type: "bedrijf", bedrijfsnaam: "Bakkerij Van Hecke", gemeente: "Lede" })).toBe("Bakkerij Van Hecke · Lede");
  });

  it("aantal", () => {
    expect(aantalTekst(0)).toBe("Geen interventies vandaag");
    expect(aantalTekst(1)).toBe("1 interventie vandaag");
    expect(aantalTekst(3)).toBe("3 interventies vandaag");
  });
});

describe("dagGrenzen", () => {
  it("winter: middernacht Brussel is 23:00 UTC de dag ervoor", () => {
    expect(dagGrenzen("2026-11-05")).toEqual({ van: "2026-11-04T23:00:00.000Z", tot: "2026-11-05T23:00:00.000Z" });
  });

  it("zomer: 22:00 UTC", () => {
    expect(dagGrenzen("2026-07-01").van).toBe("2026-06-30T22:00:00.000Z");
  });

  it("dag van de tijdwissel is 23 uur lang", () => {
    const { van, tot } = dagGrenzen("2026-03-29");
    expect((Date.parse(tot) - Date.parse(van)) / 3_600_000).toBe(23);
  });

  it("weigert iets anders dan een datum", () => {
    expect(() => dagGrenzen("5 november")).toThrow();
  });
});
