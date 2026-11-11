// Het gele vak "Nog na te kijken" (T4): twijfel is zichtbaar, nooit verstopt.

import type { ReactNode } from "react";

import s from "./bouwstenen.module.css";

export function NakijkVak({
  titel = "Nog na te kijken",
  tekst,
  children,
}: {
  titel?: string;
  tekst?: ReactNode;
  children?: ReactNode; // knoppen
}) {
  return (
    <div className={s.nakijkVak} role="group" aria-label={titel}>
      <div className={s.nakijkKop}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 L21 19 H3 Z" fill="none" stroke="#6E4700" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M12 10 v4 M12 16.5 v0.5" stroke="#6E4700" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span>{titel}</span>
      </div>
      {tekst && <span className={s.nakijkTekst}>{tekst}</span>}
      {children && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>}
    </div>
  );
}
