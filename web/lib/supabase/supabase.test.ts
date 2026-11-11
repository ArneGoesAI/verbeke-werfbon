import { describe, expect, it } from "vitest";

import { ConfigFout, dienstConfig, publiekeConfig } from "./config";

const PUBLIEK = {
  NEXT_PUBLIC_SUPABASE_URL: "https://voorbeeld.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("publiekeConfig", () => {
  it("leest url en publishable key", () => {
    expect(publiekeConfig(PUBLIEK)).toEqual({
      url: "https://voorbeeld.supabase.co",
      publiekeSleutel: "sb_publishable_test",
    });
  });

  it("stopt bij een ontbrekende waarde", () => {
    expect(() => publiekeConfig({ ...PUBLIEK, NEXT_PUBLIC_SUPABASE_URL: "" })).toThrow(ConfigFout);
    expect(() => publiekeConfig({ ...PUBLIEK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toThrow(
      /PUBLISHABLE_KEY ontbreekt/,
    );
  });

  it("stopt bij een url zonder schema", () => {
    expect(() => publiekeConfig({ ...PUBLIEK, NEXT_PUBLIC_SUPABASE_URL: "voorbeeld.supabase.co" })).toThrow(
      /geen URL/,
    );
  });
});

describe("dienstConfig", () => {
  it("vraagt de secret key", () => {
    expect(() => dienstConfig(PUBLIEK)).toThrow(/SUPABASE_SECRET_KEY ontbreekt/);
    expect(dienstConfig({ ...PUBLIEK, SUPABASE_SECRET_KEY: "sb_secret_test" }).geheimeSleutel).toBe("sb_secret_test");
  });

  it("weigert een publishable key op de plaats van de secret key", () => {
    expect(() => dienstConfig({ ...PUBLIEK, SUPABASE_SECRET_KEY: "sb_publishable_test" })).toThrow(/geen secret key/);
  });
});

describe("server-only", () => {
  // Buiten de react-server-conditie (zoals in een clientbundel) gooit "server-only" bij het importeren.
  it("dienst.ts laat zich niet importeren buiten de server", async () => {
    await expect(import("./dienst")).rejects.toThrow(/Server Component/);
  });

  it("server.ts laat zich niet importeren buiten de server", async () => {
    await expect(import("./server")).rejects.toThrow(/Server Component/);
  });

  it("de kern voor de scripts wel", async () => {
    const kern = await import("./dienst-kern");
    const client = kern.maakDienstClient({ ...publiekeConfig(PUBLIEK), geheimeSleutel: "sb_secret_test" });
    expect(typeof client.from).toBe("function");
  });
});
