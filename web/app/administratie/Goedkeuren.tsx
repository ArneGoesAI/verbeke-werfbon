"use client";

// "Goedkeuren en versturen" met een bevestigingsstap. Versturen zet alleen de status: er gaat geen mail weg.

import { useActionState, useEffect, useState } from "react";

import { Knop } from "@/components/Knop";

import { type GoedkeurStaat, keurGoed } from "./acties";
import s from "./administratie.module.css";

export function Goedkeuren({
  factuurId,
  nummer,
  klant,
  totaal,
  filter,
}: {
  factuurId: number;
  nummer: string;
  klant: string;
  totaal: string;
  filter: string;
}) {
  const [vragen, setVragen] = useState(false);
  const [staat, actie, bezig] = useActionState<GoedkeurStaat, FormData>(keurGoed, { fout: null });

  // Een andere factuur gekozen: de vraag opnieuw dicht.
  useEffect(() => setVragen(false), [factuurId]);

  if (!vragen) {
    return (
      <div className={s.acties}>
        <Knop className={s.goedkeurKnop} onClick={() => setVragen(true)}>
          Goedkeuren en versturen
        </Knop>
      </div>
    );
  }

  return (
    <form action={actie} className={s.bevestigVak} aria-live="polite">
      <input type="hidden" name="factuur" value={factuurId} />
      <input type="hidden" name="filter" value={filter} />
      <span className={s.bevestigVraag}>
        {nummer} voor {klant} goedkeuren? Totaal {totaal}.
      </span>
      <span className={s.bevestigUitleg}>De factuur gaat naar &ldquo;verstuurd&rdquo; en de bon naar &ldquo;gefactureerd&rdquo;. Dit kan je hier niet ongedaan maken.</span>
      {staat.fout && (
        <span className={s.fout} role="alert">
          {staat.fout}
        </span>
      )}
      <div className={s.acties}>
        <Knop type="submit" className={s.goedkeurKnop} disabled={bezig}>
          {bezig ? "Even goedkeuren…" : "Ja, goedkeuren"}
        </Knop>
        <Knop soort="omlijnd" className={s.goedkeurKnop} onClick={() => setVragen(false)} disabled={bezig}>
          Annuleren
        </Knop>
      </div>
    </form>
  );
}
