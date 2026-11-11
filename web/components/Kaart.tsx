// Witte kaart met rand. "actief" krijgt de warmterand (de interventie die nu bezig is, T1).

import Link from "next/link";
import type { ReactNode } from "react";

import s from "./bouwstenen.module.css";

export function Kaart({ actief = false, href, children }: { actief?: boolean; href?: string; children: ReactNode }) {
  const klassen = `${s.kaart} ${actief ? s.kaartActief : ""}`;
  return href ? (
    <Link href={href} className={klassen}>
      {children}
    </Link>
  ) : (
    <div className={klassen}>{children}</div>
  );
}
