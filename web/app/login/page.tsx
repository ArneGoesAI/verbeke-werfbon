import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { huidigeMedewerker } from "@/lib/sessie";

import { AanmeldFormulier } from "./AanmeldFormulier";
import s from "./login.module.css";

export const metadata = { title: "Aanmelden · Werfbon" };

export default async function LoginPagina() {
  if (await huidigeMedewerker()) redirect("/");
  return (
    <main className={s.pagina}>
      <div className={s.merk}>
        <Logo grootte={56} />
        <div className={s.merkTekst}>
          <span className={s.naam}>verbeke</span>
          <span className={s.ondertitel}>installatietechniek</span>
        </div>
      </div>
      <h1 className={s.titel}>Aanmelden</h1>
      <AanmeldFormulier />
    </main>
  );
}
