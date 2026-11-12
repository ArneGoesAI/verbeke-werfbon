import { describe, expect, it } from "vitest";

import {
  ALLE_TESTMAILS,
  type Medewerker,
  controleerKoppeling,
  controleerWachtwoord,
  envBestand,
  extraSjabloon,
  kiesAdministratie,
  kiesTechnieker,
  leesEnv,
  maakWachtwoord,
} from "./testaccounts";

const m = (id: number, rol: string, actief = true, auth_user_id: string | null = null): Medewerker => ({
  id,
  rol,
  actief,
  auth_user_id,
});

describe("kiesTechnieker", () => {
  const medewerkers = [m(1, "technieker"), m(2, "technieker"), m(3, "technieker", false), m(4, "werfleider")];

  it("kiest de technieker met de meeste interventies", () => {
    const inplanning = [
      { interventie_id: 10, medewerker_id: 1 },
      { interventie_id: 11, medewerker_id: 2 },
      { interventie_id: 12, medewerker_id: 2 },
    ];
    expect(kiesTechnieker(medewerkers, inplanning).id).toBe(2);
  });

  it("negeert inactieve techniekers en andere rollen", () => {
    const inplanning = [
      { interventie_id: 10, medewerker_id: 3 },
      { interventie_id: 11, medewerker_id: 3 },
      { interventie_id: 12, medewerker_id: 4 },
      { interventie_id: 13, medewerker_id: 4 },
      { interventie_id: 14, medewerker_id: 1 },
    ];
    expect(kiesTechnieker(medewerkers, inplanning).id).toBe(1);
  });

  it("kiest bij gelijke stand het laagste id", () => {
    const inplanning = [
      { interventie_id: 10, medewerker_id: 2 },
      { interventie_id: 11, medewerker_id: 1 },
    ];
    expect(kiesTechnieker(medewerkers, inplanning).id).toBe(1);
  });

  it("stopt zonder kandidaat", () => {
    expect(() => kiesTechnieker(medewerkers, [])).toThrow(/Geen 1e actieve technieker/);
  });

  it("kiest op plaats 1 de volgende in de rij, en stopt als die er niet is", () => {
    const inplanning = [
      { interventie_id: 10, medewerker_id: 1 },
      { interventie_id: 11, medewerker_id: 2 },
      { interventie_id: 12, medewerker_id: 2 },
    ];
    expect(kiesTechnieker(medewerkers, inplanning, 1).id).toBe(1);
    expect(() => kiesTechnieker(medewerkers, inplanning.slice(1), 1)).toThrow(/Geen 2e actieve technieker/);
  });
});

describe("kiesAdministratie", () => {
  it("kiest de actieve met het laagste id", () => {
    expect(kiesAdministratie([m(9, "administratie"), m(5, "administratie", false), m(7, "administratie")]).id).toBe(7);
  });

  it("stopt zonder kandidaat", () => {
    expect(() => kiesAdministratie([m(1, "zaakvoerder")])).toThrow(/administratie/);
  });

  it("kiest op plaats 1 de tweede actieve", () => {
    const lijst = [m(9, "administratie"), m(5, "administratie", false), m(7, "administratie")];
    expect(kiesAdministratie(lijst, 1).id).toBe(9);
    expect(() => kiesAdministratie(lijst, 2)).toThrow(/3e actieve/);
  });
});

describe("controleerKoppeling", () => {
  it("laat een vrije of al naar de testgebruiker wijzende medewerker toe", () => {
    expect(() => controleerKoppeling(m(1, "technieker"), "test-uuid")).not.toThrow();
    expect(() => controleerKoppeling(m(1, "technieker", true, "test-uuid"), "test-uuid")).not.toThrow();
  });

  it("stopt bij een koppeling aan een andere login", () => {
    expect(() => controleerKoppeling(m(1, "technieker", true, "ander-uuid"), "test-uuid")).toThrow(/andere login/);
  });
});

describe("wachtwoord en bestand", () => {
  it("maakt telkens een ander wachtwoord van 24 veilige tekens", () => {
    const a = maakWachtwoord();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(maakWachtwoord()).not.toBe(a);
  });

  it("schrijft beide accounts in het bestand", () => {
    const inhoud = envBestand({ technieker: "aaa", administratie: "bbb" });
    expect(inhoud).toContain("TECHNIEKER_EMAIL=technieker@verbeke.test\nTECHNIEKER_WACHTWOORD=aaa");
    expect(inhoud).toContain("ADMINISTRATIE_WACHTWOORD=bbb");
  });
});

describe("extra logins", () => {
  it("leest het sjabloon terug, met lege wachtwoorden", () => {
    const env = leesEnv(extraSjabloon());
    expect(env.TECHNIEKER_EMAIL).toBe("technieker2@verbeke.test");
    expect(env.ADMINISTRATIE_EMAIL).toBe("administratie2@verbeke.test");
    expect(env.TECHNIEKER_WACHTWOORD).toBe("");
  });

  it("houdt een = in een wachtwoord", () => {
    expect(leesEnv("A=b=c\n# X=y\n").A).toBe("b=c");
    expect(leesEnv("# X=y").X).toBeUndefined();
  });

  it("weigert een leeg, kort of door spaties omgeven wachtwoord, zonder de waarde te tonen", () => {
    expect(() => controleerWachtwoord("", "W")).toThrow(/leeg/);
    expect(() => controleerWachtwoord("kort-geheim", "W")).toThrow(/12 tekens/);
    expect(() => controleerWachtwoord(" lang-genoeg-geheim", "W")).toThrow(/spatie/);
    try {
      controleerWachtwoord("kort-geheim", "W");
    } catch (e) {
      expect((e as Error).message).not.toContain("kort-geheim");
    }
    expect(controleerWachtwoord("lang-genoeg-geheim", "W")).toBe("lang-genoeg-geheim");
  });

  it("opruimen kent alle vier de testlogins", () => {
    expect(ALLE_TESTMAILS).toEqual([
      "technieker@verbeke.test",
      "administratie@verbeke.test",
      "technieker2@verbeke.test",
      "administratie2@verbeke.test",
    ]);
  });
});
