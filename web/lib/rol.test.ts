import { describe, expect, it } from "vitest";

import { bestemmingVoorRol } from "./rol";

describe("bestemmingVoorRol", () => {
  it("stuurt de technieker naar vandaag", () => expect(bestemmingVoorRol("technieker")).toBe("/vandaag"));
  it("stuurt administratie en zaakvoerder naar de administratie", () => {
    expect(bestemmingVoorRol("administratie")).toBe("/administratie");
    expect(bestemmingVoorRol("zaakvoerder")).toBe("/administratie");
  });
  it("heeft niets voor andere rollen of zonder medewerker", () => {
    expect(bestemmingVoorRol("werfleider")).toBeNull();
    expect(bestemmingVoorRol(null)).toBeNull();
  });
});
