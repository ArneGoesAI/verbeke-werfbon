"use client";

// De opname: microfoon → MediaRecorder (webm/opus, op iOS mp4), teller, 15 balkjes uit een AnalyserNode, stopt
// vanzelf na 3 minuten. "Annuleren" gooit alles weg. Na "Tik om te stoppen": opladen en verwerken via useVerwerk,
// ondertussen "Even verwerken…" op hetzelfde donkere scherm.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useVerwerk } from "@/lib/client/useVerwerk";

import s from "./inspreken.module.css";

export const MAX_SECONDEN = 180;
const BALKJES = 15;

type Formaat = { mimeType: string; extensie: string; mediatype: string };

const FORMATEN: Formaat[] = [
  { mimeType: "audio/webm;codecs=opus", extensie: "webm", mediatype: "audio/webm" },
  { mimeType: "audio/mp4", extensie: "m4a", mediatype: "audio/mp4" }, // Safari op iOS
  { mimeType: "audio/ogg;codecs=opus", extensie: "ogg", mediatype: "audio/ogg" },
];

function kiesFormaat(): Formaat | null {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATEN.find((f) => MediaRecorder.isTypeSupported(f.mimeType)) ?? null;
}

export function teller(seconden: number): string {
  const s = Math.floor(seconden);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Stand = "starten" | "opnemen" | "geweigerd" | "niet-ondersteund" | "gestopt";

export function Opname({ medewerkerId, interventieId, kop }: { medewerkerId: number; interventieId: number; kop: string }) {
  const router = useRouter();
  const { stand: verwerking, verstuur, herstel } = useVerwerk(medewerkerId, interventieId);
  const [stand, setStand] = useState<Stand>("starten");
  const [seconden, setSeconden] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stroom = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const stukken = useRef<Blob[]>([]);
  const weggooien = useRef(false);
  const balkjes = useRef<(HTMLDivElement | null)[]>([]);
  // Elke start krijgt een nummer. Een start die nog op de microfoon wacht terwijl de pagina al weg is (of opnieuw
  // gestart werd, zoals Strict Mode in ontwikkeling doet), sluit zijn microfoon meteen weer.
  const generatie = useRef(0);
  const terug = `/interventie/${interventieId}`;

  const opruimen = useCallback(() => {
    stroom.current?.getTracks().forEach((t) => t.stop());
    stroom.current = null;
    void audio.current?.close().catch(() => {});
    audio.current = null;
  }, []);

  const start = useCallback(async () => {
    const mijn = ++generatie.current;
    herstel();
    setSeconden(0);
    setStand("starten");
    const formaat = kiesFormaat();
    if (!formaat || !navigator.mediaDevices?.getUserMedia) {
      setStand("niet-ondersteund");
      return;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      if (mijn === generatie.current) setStand("geweigerd");
      return;
    }
    if (mijn !== generatie.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    stroom.current = media;
    stukken.current = [];
    weggooien.current = false;

    const rec = new MediaRecorder(media, { mimeType: formaat.mimeType });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) stukken.current.push(e.data);
    };
    rec.onstop = () => {
      opruimen();
      if (weggooien.current) return;
      setStand("gestopt");
      const blob = new Blob(stukken.current, { type: formaat.mediatype });
      void verstuur({ blob, soort: "audio", extensie: formaat.extensie, mediatype: formaat.mediatype });
    };
    rec.start(1000);
    recorder.current = rec;

    // Balkjes: los van de opname. Lukt het niet (bv. AudioContext geblokkeerd), dan blijven ze gewoon stil.
    try {
      const ctx = new AudioContext();
      audio.current = ctx;
      void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const teken = () => {
        if (audio.current !== ctx) return;
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < BALKJES; i++) {
          const el = balkjes.current[i];
          if (el) el.style.height = `${8 + Math.round((data[i + 1] / 255) * 64)}px`;
        }
        requestAnimationFrame(teken);
      };
      requestAnimationFrame(teken);
    } catch {
      /* geen balkjes */
    }
    setStand("opnemen");
  }, [herstel, opruimen, verstuur]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const annuleer = useCallback(() => {
    weggooien.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    opruimen();
    router.push(terug);
  }, [opruimen, router, terug]);

  // Starten bij het openen; bij het verlaten van de pagina alles weggooien.
  useEffect(() => {
    void start();
    return () => {
      generatie.current++;
      weggooien.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      opruimen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij het openen
  }, []);

  // Teller en automatische stop.
  useEffect(() => {
    if (stand !== "opnemen") return;
    const begin = Date.now();
    const klok = setInterval(() => {
      const verstreken = (Date.now() - begin) / 1000;
      setSeconden(verstreken);
      if (verstreken >= MAX_SECONDEN) stop();
    }, 250);
    return () => clearInterval(klok);
  }, [stand, stop]);

  const bezig = verwerking.stand === "uploaden" || verwerking.stand === "verwerken";
  const fout = verwerking.stand === "fout" ? verwerking.fout : null;

  return (
    <main className={s.scherm}>
      <div className={s.kop}>
        {bezig ? (
          <span />
        ) : (
          <button type="button" className={s.annuleer} onClick={annuleer}>
            Annuleren
          </button>
        )}
        <span className={s.onderwerp}>{kop}</span>
      </div>

      <div className={s.vuller} />

      {(stand === "opnemen" || stand === "starten") && !bezig && !fout && (
        <>
          <span className={s.teller} aria-live="off">
            {teller(seconden)}
          </span>
          <div className={s.balkjes} aria-hidden="true">
            {Array.from({ length: BALKJES }, (_, i) => (
              <div key={i} ref={(el) => void (balkjes.current[i] = el)} className={s.balkje} />
            ))}
          </div>
          <div className={s.uitleg}>
            <span className={s.uitlegTitel}>{stand === "starten" ? "Microfoon openen…" : "Ik luister"}</span>
            <span className={s.uitlegTekst}>
              Spreek gewoon zoals je praat. Een vergissing verbeteren mag: &ldquo;twee uur… nee, anderhalf&rdquo;.
            </span>
            {seconden >= MAX_SECONDEN - 30 && (
              <span className={s.uitlegTekst}>Nog {Math.max(0, Math.ceil(MAX_SECONDEN - seconden))} seconden.</span>
            )}
          </div>
        </>
      )}

      {bezig && (
        <div className={s.uitleg} role="status">
          <div className={s.puls} aria-hidden="true" />
          <span className={s.uitlegTitel}>Even verwerken…</span>
          <span className={s.uitlegTekst}>
            {verwerking.stand === "uploaden" ? "De opname wordt opgeladen." : "Ik maak er een bon van. Dat duurt een tiental seconden."}
          </span>
        </div>
      )}

      {(stand === "geweigerd" || stand === "niet-ondersteund" || fout) && !bezig && (
        <div className={s.uitleg} role="alert">
          <span className={s.uitlegTitel}>
            {stand === "geweigerd" ? "Geen toegang tot de microfoon" : stand === "niet-ondersteund" ? "Opnemen lukt hier niet" : "Dat lukte niet"}
          </span>
          <span className={s.uitlegTekst}>
            {stand === "geweigerd"
              ? "Sta de microfoon toe voor deze site in je browser en probeer opnieuw. Of fotografeer je papieren bon."
              : stand === "niet-ondersteund"
                ? "Deze browser kan geen geluid opnemen. Fotografeer je papieren bon."
                : fout}
          </span>
        </div>
      )}

      <div className={s.vuller} />

      {stand === "opnemen" && !bezig && (
        <>
          <button type="button" className={s.stop} onClick={stop} aria-label="Stoppen en verwerken">
            <div className={s.stopVierkant} />
          </button>
          <span className={s.stopTekst}>Tik om te stoppen</span>
        </>
      )}

      {(stand === "geweigerd" || fout) && !bezig && (
        <div className={s.knoppen}>
          <button type="button" className={s.opnieuw} onClick={() => void start()}>
            Opnieuw inspreken
          </button>
          <Link href={terug} className={s.terugKnop}>
            Terug naar de interventie
          </Link>
        </div>
      )}
      {stand === "niet-ondersteund" && (
        <div className={s.knoppen}>
          <Link href={terug} className={s.terugKnop}>
            Terug naar de interventie
          </Link>
        </div>
      )}
    </main>
  );
}
