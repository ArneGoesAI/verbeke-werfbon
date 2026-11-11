"use client";

// "Foto van papieren bon": camera openen, foto verkleinen, opladen en verwerken. Tijdens het verwerken vervangt een
// melding de knoppen, zodat er niet twee keer verstuurd wordt.

import { useRef } from "react";

import { IcoonCamera } from "@/components/Iconen";
import { Knop } from "@/components/Knop";
import { useVerwerk, verkleinFoto } from "@/lib/client/useVerwerk";

import s from "../../technieker.module.css";

export function FotoKnop({
  medewerkerId,
  interventieId,
  soort = "omlijnd",
  maat = "groot",
}: {
  medewerkerId: number;
  interventieId: number;
  soort?: "omlijnd" | "primair";
  maat?: "groot" | "standaard";
}) {
  const invoer = useRef<HTMLInputElement>(null);
  const { stand, verstuur } = useVerwerk(medewerkerId, interventieId);
  const bezig = stand.stand === "uploaden" || stand.stand === "verwerken";

  async function gekozen(e: React.ChangeEvent<HTMLInputElement>) {
    const bestand = e.target.files?.[0];
    e.target.value = ""; // dezelfde foto opnieuw kiezen moet ook een change geven
    if (!bestand) return;
    let blob: Blob;
    try {
      blob = await verkleinFoto(bestand);
    } catch {
      blob = bestand; // de route weigert een formaat dat Claude niet leest; dan komt de melding van daar
    }
    await verstuur({ blob, soort: "foto", extensie: "jpg", mediatype: blob.type || bestand.type || "image/jpeg" });
  }

  return (
    <>
      <input
        ref={invoer}
        type="file"
        accept="image/*"
        capture="environment"
        className={s.verborgen}
        onChange={gekozen}
        aria-hidden="true"
        tabIndex={-1}
      />
      {bezig ? (
        <div className={s.bezig} role="status">
          {stand.stand === "uploaden" ? "Foto opladen…" : "Even verwerken…"}
        </div>
      ) : (
        <Knop soort={soort} maat={maat} breed onClick={() => invoer.current?.click()}>
          <IcoonCamera />
          Foto van papieren bon
        </Knop>
      )}
      {stand.stand === "fout" && (
        <p role="alert" className={s.fout}>
          {stand.fout}
        </p>
      )}
    </>
  );
}
