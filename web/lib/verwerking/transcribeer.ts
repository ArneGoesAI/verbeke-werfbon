// Spraak naar tekst met Voxtral (Mistral). Alleen voor het spraakpad; een foto gaat rechtstreeks naar Claude.
// API: POST https://api.mistral.ai/v1/audio/transcriptions (multipart), nagekeken op 2026-11-11.

export const VOXTRAL_MODEL = "voxtral-mini-transcribe-3";
const URL_TRANSCRIPTIE = "https://api.mistral.ai/v1/audio/transcriptions";

export type Transcriptie = {
  tekst: string;
  model: string;
  audio_s: number | null; // usage.prompt_audio_seconds: daarop rekent Mistral af
  latency_s: number;
};

export class TranscriptieFout extends Error {}

export async function transcribeer(
  audio: Blob,
  bestandsnaam: string,
  opties: { apiSleutel?: string; fetchFn?: typeof fetch } = {},
): Promise<Transcriptie> {
  const sleutel = opties.apiSleutel ?? process.env.MISTRAL_API_KEY;
  if (!sleutel) throw new TranscriptieFout("MISTRAL_API_KEY ontbreekt");

  const form = new FormData();
  form.append("model", VOXTRAL_MODEL);
  form.append("file", audio, bestandsnaam);
  form.append("language", "nl"); // Vlaamse spreektaal: vast op Nederlands, geen automatische taalherkenning

  const start = performance.now();
  const antwoord = await (opties.fetchFn ?? fetch)(URL_TRANSCRIPTIE, {
    method: "POST",
    headers: { Authorization: `Bearer ${sleutel}` },
    body: form,
  });
  const latency_s = Math.round(performance.now() - start) / 1000;

  if (!antwoord.ok) {
    const tekst = await antwoord.text().catch(() => "");
    throw new TranscriptieFout(`${antwoord.status}: ${tekst.slice(0, 200)}`);
  }
  const data = (await antwoord.json()) as {
    model?: string;
    text?: string;
    usage?: { prompt_audio_seconds?: number };
  };
  if (typeof data.text !== "string") throw new TranscriptieFout("antwoord zonder tekst");
  return {
    tekst: data.text.trim(),
    model: data.model ?? VOXTRAL_MODEL,
    audio_s: data.usage?.prompt_audio_seconds ?? null,
    latency_s,
  };
}
