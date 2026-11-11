// Naspeling van docs/ontwerp/Main.dc.html met de echte bouwstenen, om ze naast de mockup te leggen.
// Alleen in ontwikkeling: in productie bestaat deze pagina niet.

import { notFound } from "next/navigation";

import { Kaart } from "@/components/Kaart";
import { Knop } from "@/components/Knop";
import { Label } from "@/components/Label";
import { Logo } from "@/components/Logo";
import { NakijkVak } from "@/components/NakijkVak";

import s from "./huisstijl.module.css";

const STALEN = [
  ["Warmte", "#C2531E", "hoofdactie"],
  ["Petrol", "#1F5662", "informatie"],
  ["Inkt", "#2A2420", "tekst"],
  ["Kalk", "#FAF6F0", "achtergrond"],
  ["Nakijken", "#FCEFD2", "twijfel"],
  ["In orde", "#E2F0E4", "bevestigd"],
] as const;

export default function Huisstijl() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className={s.pagina}>
      <div className={s.kop}>
        <div className={s.merk}>
          <Logo />
          <div className={s.merkTekst}>
            <span className={s.naam}>verbeke</span>
            <span className={s.ondertitel}>installatietechniek</span>
          </div>
        </div>
        <span className={s.gedempt}>Huisstijl · werfbon-app</span>
      </div>

      <div className={s.raster}>
        <section className={s.blok}>
          <h2>Kleuren</h2>
          <div className={s.stalen}>
            {STALEN.map(([naam, kleur, rol]) => (
              <div key={naam} className={s.staal}>
                <div style={{ background: kleur, border: naam === "Kalk" ? "1px solid #E3D8CC" : undefined }} />
                <strong>{naam}</strong>
                <span>
                  {kleur} · {rol}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={s.blok}>
          <h2>Typografie</h2>
          <div className={s.typo}>
            <span className={s.groet}>Goeiemorgen, Jonas</span>
            <span className={s.uitleg}>Fraunces 600 · titels en begroeting</span>
            <span className={s.lees}>Vertel gewoon wat je gedaan hebt. De app maakt er een bon van, jij kijkt na.</span>
            <span className={s.uitleg}>Figtree · tekst, knoppen en cijfers (min. 16 px op mobiel)</span>
          </div>
        </section>

        <section className={s.blok}>
          <h2>Knoppen</h2>
          <div className={s.rij}>
            <Knop>Bevestigen</Knop>
            <Knop soort="omlijnd">Opnieuw inspreken</Knop>
            <Knop soort="petrol" maat="klein">
              Kies artikel
            </Knop>
          </div>
        </section>

        <section className={s.blok}>
          <h2>Labels</h2>
          <div className={s.rij}>
            <Label soort="nakijken">Nog na te kijken</Label>
            <Label soort="inOrde">Bevestigd</Label>
            <Label soort="ingesproken">Ingesproken</Label>
            <Label soort="automatisch">Automatisch</Label>
          </div>
        </section>

        {/* Niet in Main.dc.html: de bouwstenen uit T1 en T4. */}
        <section className={s.blok}>
          <h2>Kaarten (T1)</h2>
          <div className={s.smal}>
            <Kaart actief>
              <Label soort="nakijken" maat="klein">
                Bon nog in te spreken
              </Label>
              <strong style={{ fontSize: 19 }}>Herstelling warmtepomp</strong>
            </Kaart>
            <Kaart>
              <Label soort="automatisch" maat="klein">
                Gepland
              </Label>
              <strong style={{ fontSize: 19 }}>Onderhoud ventilatie</strong>
            </Kaart>
          </div>
        </section>

        <section className={s.blok}>
          <h2>Nakijkvak en knoppen (T2, T4)</h2>
          <div className={s.smal}>
            <NakijkVak tekst={'"dat klein zwart doosken" staat niet in de catalogus. Ik heb niet gegokt.'}>
              <Knop soort="petrolWit" maat="klein">
                Kies artikel
              </Knop>
              <Knop soort="nakijkOmlijnd" maat="klein">
                Niet aanrekenen
              </Knop>
            </NakijkVak>
            <Knop maat="groot" breed>
              Bon inspreken
            </Knop>
            <Knop breed disabled>
              Bevestigen (uitgeschakeld)
            </Knop>
          </div>
        </section>
      </div>
    </main>
  );
}
