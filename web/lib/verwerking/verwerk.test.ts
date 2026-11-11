// De kern met een nagemaakte Claude-client en Voxtral: geen API-calls.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import type { Transcriptie } from "./transcribeer";
import type { Context } from "./types";
import { verwerk } from "./verwerk";

const herstelling: Context = { type: "herstelling", omschrijving: "Lek onder de boiler", toestel: null };
const onderhoud: Context = {
  type: "onderhoud",
  omschrijving: "Jaarlijks onderhoud",
  toestel: { type: "ventilatie", merk: "Zehnder", model: "ComfoAir Q450" },
};

function nepClient(output: unknown, stop_reason = "end_turn") {
  const create = vi.fn((_req: unknown) => ({
    withResponse: async () => ({
      data: {
        model: "claude-haiku-5-5",
        stop_reason,
        content: [{ type: "text", text: typeof output === "string" ? output : JSON.stringify(output) }],
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
      request_id: "req_test",
    }),
  }));
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

const nepTranscriptie = (tekst: string) =>
  vi.fn(async (): Promise<Transcriptie> => ({ tekst, model: "voxtral-mini-transcribe-3", audio_s: 20, latency_s: 1 }));

const extractie = {
  uren: 2.5,
  km: null,
  onderdelen: [
    { code: "OND-VENTIEL", aantal: 1, omschrijving: null, bronzin: "ne nieuwe klep" },
    { code: "onbekend", aantal: 1, omschrijving: "sifon", bronzin: "nen sifon" },
  ],
  opmerking: "Klep vervangen.",
};

describe("verwerk", () => {
  it("audio: transcript gaat naar Claude, lijnen met afgeleide, onbekend apart", async () => {
    const { client, create } = nepClient(extractie);
    const transcribeerFn = nepTranscriptie("ik heb ne nieuwe klep gestoken");
    const r = await verwerk(
      herstelling,
      { soort: "audio", bestand: new Blob(["x"]), bestandsnaam: "a.m4a" },
      { client, transcribeerFn },
    );

    expect(transcribeerFn).toHaveBeenCalledOnce();
    const req = create.mock.calls[0][0] as { messages: { content: { text?: string }[] }[] };
    expect(req.messages[0].content[1].text).toBe("Ingesproken tekst van de technieker:\nik heb ne nieuwe klep gestoken");

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.transcript).toBe("ik heb ne nieuwe klep gestoken");
    expect(r.lijnen).toEqual([
      { code: "ARB-TECH", aantal: 2.5 },
      { code: "OND-VENTIEL", aantal: 1 },
      { code: "VERPL", aantal: 1 },
    ]);
    expect(r.onbekend).toEqual([extractie.onderdelen[1]]);
    expect(r.extractie.km).toBeNull();
  });

  it("foto: geen Voxtral, beeld als base64", async () => {
    const { client, create } = nepClient({ ...extractie, onderdelen: [] });
    const transcribeerFn = nepTranscriptie("mag niet gebeuren");
    const r = await verwerk(
      onderhoud,
      { soort: "foto", bestand: new Blob([new Uint8Array([1, 2, 3])]), mediatype: "image/jpeg" },
      { client, transcribeerFn },
    );
    expect(transcribeerFn).not.toHaveBeenCalled();
    const req = create.mock.calls[0][0] as { messages: { content: { type: string; source?: { data: string } }[] }[] };
    expect(req.messages[0].content[1]).toMatchObject({ type: "image", source: { data: "AQID" } });
    expect(r.ok && r.lijnen).toEqual([{ code: "ARB-ONDERH-VENT", aantal: 1 }]);
    expect(r.transcript).toBeNull();
  });

  it("ongeldige output: fout, geen lijnen", async () => {
    const { client } = nepClient({ ...extractie, uren: 30 });
    const r = await verwerk(herstelling, { soort: "tekst", tekst: "x" }, { client });
    expect(r).toMatchObject({ ok: false, fout: expect.stringMatching(/uren buiten/) });
  });

  it("refusal of max_tokens: fout, geen fallback", async () => {
    const { client, create } = nepClient("", "refusal");
    const r = await verwerk(herstelling, { soort: "tekst", tekst: "x" }, { client });
    expect(r).toMatchObject({ ok: false, fout: "stop_reason refusal" });
    expect(create).toHaveBeenCalledOnce();
  });

  it("lege transcriptie: geen Claude-call", async () => {
    const { client, create } = nepClient(extractie);
    const r = await verwerk(
      herstelling,
      { soort: "audio", bestand: new Blob(["x"]), bestandsnaam: "a.m4a" },
      { client, transcribeerFn: nepTranscriptie("") },
    );
    expect(r).toMatchObject({ ok: false, fout: "lege transcriptie" });
    expect(create).not.toHaveBeenCalled();
  });

  it("installatie wordt niet verwerkt", async () => {
    const { client, create } = nepClient(extractie);
    const r = await verwerk({ ...herstelling, type: "installatie" }, { soort: "tekst", tekst: "x" }, { client });
    expect(r.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
