// Statuslabels: nakijken (twijfel), in orde, ingesproken, automatisch.

import type { ReactNode } from "react";

import s from "./bouwstenen.module.css";

export type LabelSoort = "nakijken" | "inOrde" | "ingesproken" | "automatisch";
const MAAT = { groot: s.labelGroot, klein: s.labelKlein, mini: s.labelMini } as const;

export function Label({
  soort,
  maat = "groot",
  children,
}: {
  soort: LabelSoort;
  maat?: keyof typeof MAAT;
  children: ReactNode;
}) {
  return <span className={`${s.label} ${s[soort]} ${MAAT[maat]}`}>{children}</span>;
}
