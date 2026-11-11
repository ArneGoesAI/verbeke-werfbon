"use client";

// Afspeelknop voor de opname bij een bon (signed URL, 10 minuten geldig). De duur komt uit het bestand zelf: de
// database bewaart ze niet. Bij webm uit MediaRecorder kent de browser de duur soms pas na het afspelen.

import { useEffect, useRef, useState } from "react";

import { duur } from "@/lib/schermen/waarschuwing";

import s from "./administratie.module.css";

export function OpnameSpeler({ url, wie, transcript }: { url: string | null; wie: string; transcript: string | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [speelt, setSpeelt] = useState(false);
  const [seconden, setSeconden] = useState<number | null>(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    setSpeelt(false);
    setSeconden(null);
    setFout(false);
  }, [url]);

  const wissel = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setFout(true));
    else a.pause();
  };

  const lengte = duur(seconden);
  const onderschrift = fout
    ? "Afspelen lukt niet. Herlaad de pagina."
    : [lengte, transcript ? "omgezet naar tekst" : null].filter(Boolean).join(" · ") || "spraakopname";

  return (
    <div className={s.opname}>
      <div className={s.opnameKop}>
        <button
          type="button"
          className={s.speel}
          aria-label={speelt ? "Opname pauzeren" : "Opname afspelen"}
          onClick={wissel}
          disabled={!url}
        >
          {speelt ? (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" fill="#FFFFFF" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="#FFFFFF" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4 L20 12 L7 20 Z" fill="#FFFFFF" />
            </svg>
          )}
        </button>
        <div className={s.opnameTekst}>
          <span className={s.opnameWie}>Ingesproken door {wie}</span>
          <span className={s.opnameDuur}>{url ? onderschrift : "Het bestand is niet te openen."}</span>
        </div>
      </div>
      {transcript && <span className={s.transcript}>&ldquo;{transcript}&rdquo;</span>}
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setSeconden(e.currentTarget.duration)}
          onDurationChange={(e) => setSeconden(e.currentTarget.duration)}
          onPlay={() => setSpeelt(true)}
          onPause={() => setSpeelt(false)}
          onEnded={() => setSpeelt(false)}
          onError={() => setFout(true)}
        />
      )}
    </div>
  );
}
