// Het verzoek moet gelijk zijn aan dat van eval/run_eval.py. De referentie maakt eval/exporteer_voor_app.py.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { InvoerFout, gebruikersinhoud, verzoek } from "./extraheer";
import { SCHEMA, SYSTEEMPROMPT } from "./gegenereerd";
import referentie from "./gegenereerd/referentie_inhoud.json";
import { REPO, laadGevallen } from "./testhulp";

type Blok = { type: string; text?: string; source?: { media_type: string; data: string } };

function vergelijkbaar(blokken: Blok[]) {
  return blokken.map((b) =>
    b.type === "image"
      ? {
          type: "image",
          media_type: b.source!.media_type,
          sha256_base64: createHash("sha256").update(b.source!.data, "ascii").digest("hex"),
        }
      : b,
  );
}

describe("gebruikersinhoud is gelijk aan die van de eval", () => {
  const ref = referentie as Record<string, { spraak: unknown[]; foto: unknown[] }>;

  it.each(laadGevallen().map((g) => [g.case_id, g] as const))("%s", (_, g) => {
    const spraak = gebruikersinhoud(g.context, { soort: "tekst", tekst: g.invoer.spraak });
    expect(vergelijkbaar(spraak as Blok[])).toEqual(ref[g.case_id].spraak);

    const base64 = readFileSync(path.join(REPO, g.invoer.foto)).toString("base64");
    const foto = gebruikersinhoud(g.context, { soort: "foto", base64, mediatype: "image/png" });
    expect(vergelijkbaar(foto as Blok[])).toEqual(ref[g.case_id].foto);
  });
});

describe("verzoek", () => {
  const g = laadGevallen()[0];
  const req = verzoek(g.context, { soort: "tekst", tekst: "test" });

  it("Haiku op effort medium, max_tokens uit de eval", () => {
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req.max_tokens).toBe(2000);
    expect(req.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema: SCHEMA } });
  });

  it("systeemprompt met cache en ingevulde catalogus", () => {
    expect(req.system).toEqual([{ type: "text", text: SYSTEEMPROMPT(), cache_control: { type: "ephemeral" } }]);
    expect(SYSTEEMPROMPT()).not.toContain("{catalogus}");
    expect(SYSTEEMPROMPT()).toContain("- OND-POMP:");
  });

  it("geen fallback of andere extra's", () => {
    expect(Object.keys(req).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
  });

  it("HEIC wordt geweigerd", () => {
    expect(() =>
      gebruikersinhoud(g.context, { soort: "foto", base64: "", mediatype: "image/heic" as "image/png" }),
    ).toThrow(InvoerFout);
  });
});
