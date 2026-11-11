"use client";

// Opname of foto naar de bucket (met de sessie, via de storage-policy) en dan POST /api/verwerk. Gedeeld door T3
// (inspreken) en het foto-pad in T2. De route krijgt alleen het pad, dus geen limiet op de grootte van de body.

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { browserClient } from "../supabase/browser";

export const BUCKET = "werfbon-opnames";

export type VerwerkStand =
  | { stand: "klaar" }
  | { stand: "uploaden" }
  | { stand: "verwerken" }
  | { stand: "fout"; fout: string };

export type Bestand = { blob: Blob; soort: "audio" | "foto"; extensie: string; mediatype: string };

/** {medewerker}/{interventie}/{uuid}.{ext}: de vorm die is_mijn_opnamepad() verwacht. */
export function opnamePad(medewerkerId: number, interventieId: number, extensie: string, uuid: string): string {
  return `${medewerkerId}/${interventieId}/${uuid}.${extensie}`;
}

export function useVerwerk(medewerkerId: number, interventieId: number) {
  const router = useRouter();
  const [stand, setStand] = useState<VerwerkStand>({ stand: "klaar" });

  const verstuur = useCallback(
    async ({ blob, soort, extensie, mediatype }: Bestand): Promise<boolean> => {
      setStand({ stand: "uploaden" });
      const pad = opnamePad(medewerkerId, interventieId, extensie, crypto.randomUUID());
      const { error } = await browserClient().storage.from(BUCKET).upload(pad, blob, { contentType: mediatype, upsert: false });
      if (error) {
        setStand({ stand: "fout", fout: "Het bestand kon niet worden opgeladen. Kijk je verbinding na en probeer opnieuw." });
        return false;
      }

      setStand({ stand: "verwerken" });
      let antwoord: Response;
      try {
        antwoord = await fetch("/api/verwerk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interventie_id: interventieId, pad, soort, mediatype }),
        });
      } catch {
        setStand({ stand: "fout", fout: "Geen verbinding met de server. Probeer opnieuw." });
        return false;
      }
      const data = (await antwoord.json().catch(() => ({}))) as { werfbon_id?: number; melding?: string };
      if (!antwoord.ok || !data.werfbon_id) {
        setStand({ stand: "fout", fout: data.melding ?? "Er ging iets mis bij het verwerken. Probeer opnieuw." });
        return false;
      }
      router.push(`/bon/${data.werfbon_id}`);
      return true;
    },
    [medewerkerId, interventieId, router],
  );

  return { stand, verstuur, herstel: () => setStand({ stand: "klaar" }) };
}

/**
 * Een foto van de gsm is vaak 3–5 MB en 4000 px breed. Claude heeft aan 1600 px genoeg; kleiner is sneller
 * opgeladen en goedkoper. Altijd JPEG, ook als de camera HEIC of PNG gaf (het API aanvaardt geen HEIC).
 */
export async function verkleinFoto(bestand: File, maxZijde = 1600): Promise<Blob> {
  const beeld = await createImageBitmap(bestand);
  const schaal = Math.min(1, maxZijde / Math.max(beeld.width, beeld.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(beeld.width * schaal);
  canvas.height = Math.round(beeld.height * schaal);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("geen canvas");
  ctx.drawImage(beeld, 0, 0, canvas.width, canvas.height);
  beeld.close();
  return new Promise((ok, fout) =>
    canvas.toBlob((b) => (b ? ok(b) : fout(new Error("foto niet om te zetten"))), "image/jpeg", 0.85),
  );
}
