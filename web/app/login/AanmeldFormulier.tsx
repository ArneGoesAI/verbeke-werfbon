"use client";

import { useActionState } from "react";

import { type AanmeldStaat, aanmelden } from "../acties";
import s from "./login.module.css";

export function AanmeldFormulier() {
  const [staat, actie, bezig] = useActionState<AanmeldStaat, FormData>(aanmelden, { fout: null, email: "" });
  return (
    <form action={actie} className={s.formulier}>
      <label className={s.veld}>
        <span>E-mailadres</span>
        <input name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={staat.email} />
      </label>
      <label className={s.veld}>
        <span>Wachtwoord</span>
        <input name="wachtwoord" type="password" autoComplete="current-password" required />
      </label>
      {staat.fout && (
        <p role="alert" className={s.fout}>
          {staat.fout}
        </p>
      )}
      <button type="submit" className={s.knop} disabled={bezig}>
        {bezig ? "Even geduld…" : "Aanmelden"}
      </button>
    </form>
  );
}
