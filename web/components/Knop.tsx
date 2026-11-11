// Knoppen uit de huisstijl. Met href wordt het een link (zelfde uiterlijk), anders een <button>.

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import s from "./bouwstenen.module.css";

export type KnopSoort = "primair" | "omlijnd" | "petrol" | "petrolWit" | "nakijkOmlijnd";
export type KnopMaat = "standaard" | "groot" | "klein";

type Gemeen = { soort?: KnopSoort; maat?: KnopMaat; breed?: boolean; children: ReactNode; className?: string };

export function knopKlassen({ soort = "primair", maat = "standaard", breed = false, className }: Omit<Gemeen, "children">) {
  return [s.knop, s[soort], s[maat], breed ? s.breed : "", className ?? ""].filter(Boolean).join(" ");
}

export function Knop(props: Gemeen & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { soort, maat, breed, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={knopKlassen({ soort, maat, breed, className })} {...rest}>
      {children}
    </button>
  );
}

export function KnopLink(props: Gemeen & { href: string; "aria-label"?: string }) {
  const { soort, maat, breed, className, children, href, ...rest } = props;
  return (
    <Link href={href} className={knopKlassen({ soort, maat, breed, className })} {...rest}>
      {children}
    </Link>
  );
}
