// T1 Vandaag: de eigen herstellingen en onderhouden op de peildatum (docs/ontwerp/T1-Vandaag.dc.html).

import { Kaart } from "@/components/Kaart";
import { Label } from "@/components/Label";
import { Logo } from "@/components/Logo";
import { dagTitel, groet, initialen, tijd } from "@/lib/opmaak";
import { laadVandaag } from "@/lib/schermen/laad";
import { aantalTekst, kaartKlant, kaartOmschrijving, kaartTitel, kaarten } from "@/lib/schermen/vandaag";
import { vereisScherm } from "@/lib/sessie";

import { afmelden } from "../acties";
import s from "../technieker.module.css";

export const metadata = { title: "Vandaag · Werfbon" };

export default async function Vandaag() {
  const ik = await vereisScherm("/vandaag");
  const { datum, interventies } = await laadVandaag(ik.id);
  const lijst = kaarten(interventies);

  return (
    <main className={s.pagina}>
      <div className={s.kop}>
        <Logo grootte={40} />
        <details className={s.profiel}>
          <summary className={s.initialen} aria-label="Profiel">
            {initialen(ik.voornaam, ik.achternaam)}
          </summary>
          <div className={s.profielMenu}>
            <span className={s.profielNaam}>
              {ik.voornaam} {ik.achternaam}
            </span>
            <form action={afmelden}>
              <button type="submit">Afmelden</button>
            </form>
          </div>
        </details>
      </div>

      <div className={s.groet}>
        <span className={s.datum}>{dagTitel(datum)}</span>
        <h1 className={s.titel}>
          {groet()}, {ik.voornaam}
        </h1>
        <span className={s.aantal}>{aantalTekst(lijst.length)}</span>
      </div>

      <div className={s.lijst}>
        {lijst.length === 0 && <p className={s.leeg}>Er staat vandaag niets voor je ingepland.</p>}
        {lijst.map(({ interventie: i, actief, label }) => (
          <Kaart key={i.id} actief={actief} href={`/interventie/${i.id}`}>
            <div className={s.kaartKop}>
              <span className={`${s.uur} ${actief ? s.uurActief : ""}`}>
                {i.gepland_start ? tijd(i.gepland_start) : "Geen uur"}
                {actief ? " · Nu bezig" : ""}
              </span>
              <Label soort={label.soort} maat="klein">
                {label.tekst}
              </Label>
            </div>
            <span className={s.kaartTitel}>{kaartTitel(i)}</span>
            {kaartOmschrijving(i) && <span className={s.kaartTekst}>{kaartOmschrijving(i)}</span>}
            <span className={s.kaartKlant}>{kaartKlant(i.klant)}</span>
          </Kaart>
        ))}
      </div>
    </main>
  );
}
