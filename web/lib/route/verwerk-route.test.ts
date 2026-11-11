// De route met nagemaakte sessie, database en verwerk(): geen Supabase, geen API-calls.

import { describe, expect, it, vi } from "vitest";

import type { Context } from "../verwerking/types";
import type { Resultaat } from "../verwerking/verwerk";
import { bonRij, lijnRijen, opnameRij } from "./bouw-bon";
import { type DienstAfh, type RouteAfh, type SessieAfh, leesVerzoek, padHoortBij, verwerkVerzoek } from "./verwerk-route";

const IK = 18;
const INTERVENTIE = 501;
const PAD = `${IK}/${INTERVENTIE}/abc.webm`;
const herstelling: Context = { type: "herstelling", omschrijving: "Lek", toestel: null };

const antwoord = {
  model_antwoord: "claude-haiku-5-5",
  stop_reason: "end_turn",
  ruwe_output: "{}",
  usage: { input_tokens: 100, output_tokens: 40, cache_creation_input_tokens: 0, cache_read_input_tokens: 900 },
  latency_s: 1,
  request_id: "req",
};

const goed: Resultaat = {
  ok: true,
  transcript: "anderhalf uur, nieuwe klep",
  transcriptie: null,
  extractie: {
    uren: 1.5,
    km: 21.4,
    onderdelen: [
      { code: "OND-VENTIEL", aantal: 1, omschrijving: null, bronzin: "nieuwe klep" },
      { code: "onbekend", aantal: 1, omschrijving: "zwart doosje", bronzin: "dat zwart doosken" },
    ],
    opmerking: "",
  },
  lijnen: [
    { code: "ARB-TECH", aantal: 1.5 },
    { code: "OND-VENTIEL", aantal: 1 },
    { code: "VERPL", aantal: 1 },
  ],
  onbekend: [{ code: "onbekend", aantal: 1, omschrijving: "zwart doosje", bronzin: "dat zwart doosken" }],
  antwoord,
};

function opstelling(o: {
  pad?: boolean;
  ctx?: Context | null;
  bonnen?: { id: number; status: string }[];
  resultaat?: Resultaat | Error;
  lijnenFout?: boolean;
  ids?: Record<string, number>;
} = {}) {
  const sessie: SessieAfh = {
    ikId: IK,
    isMijnOpnamepad: vi.fn(async () => o.pad ?? true),
    interventie: vi.fn(async () => (o.ctx === undefined ? herstelling : o.ctx)),
    download: vi.fn(async () => new Blob(["x"])),
  };
  const dienst = {
    peildatum: vi.fn(async () => "2026-11-05"),
    eigenBonnen: vi.fn(async () => o.bonnen ?? []),
    artikelIds: vi.fn(async () => new Map(Object.entries(o.ids ?? { "ARB-TECH": 1, "OND-VENTIEL": 2, VERPL: 3 }))),
    maakBon: vi.fn(async () => 900),
    maakLijnen: vi.fn(async () => {
      if (o.lijnenFout) throw new Error("lijnen mislukt");
    }),
    maakOpname: vi.fn(async () => {}),
    verwijderConceptbon: vi.fn(async () => {}),
  } satisfies DienstAfh;
  const verwerk = vi.fn(async () => {
    if (o.resultaat instanceof Error) throw o.resultaat;
    return o.resultaat ?? goed;
  });
  const afh: RouteAfh = { sessie: async () => sessie, dienst: () => dienst, verwerk };
  return { afh, sessie, dienst, verwerk };
}

const verzoek = { interventie_id: INTERVENTIE, pad: PAD, soort: "audio", mediatype: "audio/webm" };

describe("verzoek lezen", () => {
  it("aanvaardt een geldig verzoek", () => {
    expect(leesVerzoek(verzoek)).toEqual(verzoek);
  });

  it("weigert ontbrekende of vreemde velden", () => {
    expect(leesVerzoek(null)).toBeNull();
    expect(leesVerzoek({ ...verzoek, interventie_id: "501" })).toBeNull();
    expect(leesVerzoek({ ...verzoek, interventie_id: 1.5 })).toBeNull();
    expect(leesVerzoek({ ...verzoek, soort: "video" })).toBeNull();
    expect(leesVerzoek({ ...verzoek, pad: "" })).toBeNull();
  });

  it("pad: medewerker, interventie, bestand", () => {
    expect(padHoortBij(PAD, IK, INTERVENTIE)).toBe(true);
    expect(padHoortBij(`${IK}/999/abc.webm`, IK, INTERVENTIE)).toBe(false);
    expect(padHoortBij(`7/${INTERVENTIE}/abc.webm`, IK, INTERVENTIE)).toBe(false);
    expect(padHoortBij(`${IK}/${INTERVENTIE}/`, IK, INTERVENTIE)).toBe(false);
    expect(padHoortBij(`${IK}/${INTERVENTIE}/a/b.webm`, IK, INTERVENTIE)).toBe(false);
  });
});

describe("verwerkVerzoek", () => {
  it("400 bij een ongeldig verzoek, 401 zonder sessie", async () => {
    const { afh } = opstelling();
    expect((await verwerkVerzoek({}, afh)).status).toBe(400);
    expect((await verwerkVerzoek(verzoek, { ...afh, sessie: async () => null })).status).toBe(401);
  });

  it("403 bij een pad van een ander of voor een andere interventie, zonder verwerk", async () => {
    const vreemd = opstelling({ pad: false });
    expect((await verwerkVerzoek(verzoek, vreemd.afh)).status).toBe(403);
    const ander = opstelling();
    expect((await verwerkVerzoek({ ...verzoek, pad: `${IK}/777/abc.webm` }, ander.afh)).status).toBe(403);
    expect(ander.sessie.isMijnOpnamepad).not.toHaveBeenCalled();
    expect(vreemd.verwerk).not.toHaveBeenCalled();
  });

  it("422 voor een ander type interventie, 404 als ze niet zichtbaar is", async () => {
    const plaatsbezoek = opstelling({ ctx: { type: "plaatsbezoek", omschrijving: "", toestel: null } });
    expect((await verwerkVerzoek(verzoek, plaatsbezoek.afh)).status).toBe(422);
    expect(plaatsbezoek.verwerk).not.toHaveBeenCalled();
    expect((await verwerkVerzoek(verzoek, opstelling({ ctx: null }).afh)).status).toBe(404);
  });

  it("422 voor een fotoformaat dat Claude niet leest", async () => {
    const { afh, verwerk } = opstelling();
    const r = await verwerkVerzoek({ ...verzoek, pad: `${IK}/${INTERVENTIE}/a.heic`, soort: "foto", mediatype: "image/heic" }, afh);
    expect(r.status).toBe(422);
    expect(verwerk).not.toHaveBeenCalled();
  });

  it("409 als er al een bevestigde bon is", async () => {
    const { afh, verwerk } = opstelling({ bonnen: [{ id: 5, status: "ingegeven" }] });
    expect((await verwerkVerzoek(verzoek, afh)).status).toBe(409);
    expect(verwerk).not.toHaveBeenCalled();
  });

  it("schrijft bon, lijnen en opname", async () => {
    const { afh, dienst, verwerk } = opstelling();
    const r = await verwerkVerzoek(verzoek, afh);
    expect(r).toEqual({ status: 200, body: { werfbon_id: 900 } });
    expect(verwerk).toHaveBeenCalledWith(herstelling, expect.objectContaining({ soort: "audio", bestandsnaam: "abc.webm" }));
    expect(dienst.maakBon).toHaveBeenCalledWith({
      interventie_id: INTERVENTIE,
      technieker_id: IK,
      datum: "2026-11-05",
      uren: 1.5,
      km: 21,
      opmerkingen: null,
      status: "concept",
      bron: "spraak",
    });
    expect(dienst.maakLijnen).toHaveBeenCalledWith(900, [
      { artikel_id: 1, aantal: 1.5 },
      { artikel_id: 2, aantal: 1 },
      { artikel_id: 3, aantal: 1 },
    ]);
    expect(dienst.maakOpname).toHaveBeenCalledWith(
      expect.objectContaining({ werfbon_id: 900, type: "audio", storage_pad: PAD, input_tokens: 1000, output_tokens: 40 }),
    );
    expect(dienst.verwijderConceptbon).not.toHaveBeenCalled();
  });

  it("vervangt een bestaande conceptbon pas na het schrijven van de nieuwe", async () => {
    const { afh, dienst } = opstelling({ bonnen: [{ id: 7, status: "concept" }] });
    expect((await verwerkVerzoek(verzoek, afh)).status).toBe(200);
    expect(dienst.verwijderConceptbon).toHaveBeenCalledWith(7, IK);
    expect(dienst.maakOpname.mock.invocationCallOrder[0]).toBeLessThan(dienst.verwijderConceptbon.mock.invocationCallOrder[0]);
  });

  it("ruimt de nieuwe bon op als de lijnen mislukken, en laat de oude staan", async () => {
    const { afh, dienst } = opstelling({ bonnen: [{ id: 7, status: "concept" }], lijnenFout: true });
    await expect(verwerkVerzoek(verzoek, afh)).rejects.toThrow("lijnen mislukt");
    expect(dienst.verwijderConceptbon).toHaveBeenCalledTimes(1);
    expect(dienst.verwijderConceptbon).toHaveBeenCalledWith(900, IK);
  });

  it("schrijft niets als een code niet in de catalogus staat", async () => {
    const { afh, dienst } = opstelling({ ids: { "ARB-TECH": 1, VERPL: 3 } });
    await expect(verwerkVerzoek(verzoek, afh)).rejects.toThrow(/OND-VENTIEL/);
    expect(dienst.maakBon).not.toHaveBeenCalled();
  });

  it("mislukte verwerking: 422, opname zonder bon bewaard", async () => {
    const mislukt: Resultaat = { ok: false, fout: "lege transcriptie", transcript: "", transcriptie: null, antwoord: null };
    const { afh, dienst } = opstelling({ resultaat: mislukt });
    const r = await verwerkVerzoek(verzoek, afh);
    expect(r.status).toBe(422);
    expect(r.body.melding).toMatch(/hoorde niets/);
    expect(dienst.maakBon).not.toHaveBeenCalled();
    expect(dienst.maakOpname).toHaveBeenCalledWith(expect.objectContaining({ werfbon_id: null, extractie: null, transcript: "" }));
  });

  it("API-fout: 502, opname toch bewaard", async () => {
    const { afh, dienst } = opstelling({ resultaat: new Error("overloaded") });
    const r = await verwerkVerzoek(verzoek, afh);
    expect(r.status).toBe(502);
    expect(dienst.maakOpname).toHaveBeenCalledWith(expect.objectContaining({ werfbon_id: null, model: null }));
  });

  it("foto: bron foto, mediatype door naar verwerk", async () => {
    const { afh, dienst, verwerk } = opstelling();
    const foto = { ...verzoek, pad: `${IK}/${INTERVENTIE}/a.jpg`, soort: "foto", mediatype: "image/jpeg" };
    expect((await verwerkVerzoek(foto, afh)).status).toBe(200);
    expect(verwerk).toHaveBeenCalledWith(herstelling, expect.objectContaining({ soort: "foto", mediatype: "image/jpeg" }));
    expect(dienst.maakBon).toHaveBeenCalledWith(expect.objectContaining({ bron: "foto" }));
  });
});

describe("bouw-bon", () => {
  it("opmerking leeg → null, km null → 0", () => {
    const r = { ...goed, extractie: { ...goed.extractie, km: null, opmerking: "  " } } as Extract<Resultaat, { ok: true }>;
    const rij = bonRij(r, { interventieId: 1, ikId: 2, datum: "2026-11-05", soort: "foto" });
    expect(rij).toMatchObject({ km: 0, opmerkingen: null, bron: "foto" });
  });

  it("lijnRijen gooit bij een onbekende code", () => {
    expect(() => lijnRijen([{ code: "X", aantal: 1 }], new Map())).toThrow(/X/);
  });

  it("opnameRij zonder resultaat", () => {
    expect(opnameRij(null, { interventieId: 1, ikId: 2, soort: "audio", pad: "p", werfbonId: null })).toMatchObject({
      transcript: null,
      extractie: null,
      input_tokens: null,
    });
  });
});
