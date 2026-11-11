import { describe, expect, it } from "vitest";

import {
  type Medewerker,
  controleerKoppeling,
  envBestand,
  kiesAdministratie,
  kiesTechnieker,
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
    expect(() => kiesTechnieker(medewerkers, [])).toThrow(/Geen actieve technieker/);
  });
});

describe("kiesAdministratie", () => {
  it("kiest de actieve met het laagste id", () => {
    expect(kiesAdministratie([m(9, "administratie"), m(5, "administratie", false), m(7, "administratie")]).id).toBe(7);
  });

  it("stopt zonder kandidaat", () => {
    expect(() => kiesAdministratie([m(1, "zaakvoerder")])).toThrow(/administratie/);
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
