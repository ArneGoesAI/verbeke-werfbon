// T2 Interventie: klant, toestel, melding en de twee manieren om een bon te maken
// (docs/ontwerp/T2-Interventie.dc.html). Een interventie van een collega geeft 404.

import Link from "next/link";
import { notFound } from "next/navigation";

import { IcoonMicrofoon, IcoonTerug } from "@/components/Iconen";
import { KnopLink } from "@/components/Knop";
import { Label } from "@/components/Label";
import { klantnaam, tijd } from "@/lib/opmaak";
import { laadInterventie } from "@/lib/schermen/laad";
import { adres, bonStand, eigenConceptbon, kaartTitel, typeNaam } from "@/lib/schermen/vandaag";
import { vereisScherm } from "@/lib/sessie";

import s from "../../technieker.module.css";
import { FotoKnop } from "./FotoKnop";

export const metadata = { title: "Interventie · Werfbon" };

export default async function InterventiePagina({ params }: { params: Promise<{ id: string }> }) {
  const ik = await vereisScherm("/vandaag");
  const { id } = await params;
  const i = await laadInterventie(ik.id, Number(id));
  if (!i) notFound();

  const stand = bonStand(i.bonnen);
  const concept = eigenConceptbon(i.bonnen);
  const verwerkbaar = i.type === "herstelling" || i.type === "onderhoud";

  return (
    <main className={`${s.pagina} ${s.paginaT2}`}>
      <Link href="/vandaag" className={s.terug}>
        <IcoonTerug />
        Vandaag
      </Link>

      <div className={s.blok}>
        <span className={s.boventitel}>
          {i.gepland_start ? `${tijd(i.gepland_start)} · ` : ""}
          {typeNaam(i.type)}
        </span>
        <h1 className={s.titelT2}>{kaartTitel(i)}</h1>
      </div>

      <div className={s.gegevens}>
        <div className={s.veld}>
          <span className={s.veldNaam}>Klant</span>
          <span className={s.veldWaarde}>{i.klant ? klantnaam(i.klant) : "Onbekende klant"}</span>
          <span className={s.veldTekst}>{adres(i.klant)}</span>
        </div>
        {i.toestel && (
          <>
            <div className={s.scheiding} />
            <div className={s.veld}>
              <span className={s.veldNaam}>Toestel</span>
              <span className={s.veldWaarde}>
                {i.toestel.merk} {i.toestel.model}
              </span>
            </div>
          </>
        )}
        {i.omschrijving && (
          <>
            <div className={s.scheiding} />
            <div className={s.veld}>
              <span className={s.veldNaam}>Melding</span>
              <span className={s.melding}>{i.omschrijving}</span>
            </div>
          </>
        )}
      </div>

      <div className={s.vuller} />

      {stand === "bevestigd" && (
        <div className={s.uitleg}>
          <Label soort="inOrde">Bevestigd</Label>
          <span className={s.uitlegTekst}>De bon is bevestigd en staat klaar voor de administratie.</span>
        </div>
      )}

      {stand !== "bevestigd" && !verwerkbaar && (
        <div className={s.uitleg}>
          <span className={s.uitlegTekst}>Voor een {i.type} maak je in de app geen bon.</span>
        </div>
      )}

      {stand === "concept" && concept !== null && (
        <>
          <div className={s.uitleg}>
            <span className={s.uitlegTitel}>Er staat een voorstel klaar</span>
            <span className={s.uitlegTekst}>Kijk het na en bevestig. Opnieuw inspreken vervangt het voorstel.</span>
          </div>
          <div className={s.knoppen}>
            <KnopLink href={`/bon/${concept}`} maat="groot" breed>
              Voorstel nakijken
            </KnopLink>
            <KnopLink href={`/interventie/${i.id}/inspreken`} soort="omlijnd" breed>
              <IcoonMicrofoon />
              Opnieuw inspreken
            </KnopLink>
          </div>
        </>
      )}

      {stand === "geen" && verwerkbaar && (
        <>
          <div className={s.uitleg}>
            <span className={s.uitlegTitel}>Klaar met de interventie?</span>
            <span className={s.uitlegTekst}>
              Vertel wat je deed: hoe lang, hoeveel kilometer en wat je vervangen hebt. Of fotografeer je papieren bon.
            </span>
          </div>
          <div className={s.knoppen}>
            <KnopLink href={`/interventie/${i.id}/inspreken`} maat="groot" breed>
              <IcoonMicrofoon />
              Bon inspreken
            </KnopLink>
            <FotoKnop medewerkerId={ik.id} interventieId={i.id} />
          </div>
        </>
      )}
    </main>
  );
}
