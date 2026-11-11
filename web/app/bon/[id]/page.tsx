// T4 Voorstel: "Klopt dit?" (docs/ontwerp/T4-Voorstel.dc.html). De server laadt de bon (RLS), het scherm zelf is
// een clientcomponent omdat de technieker aanpast. Geen prijzen.

import { notFound, redirect } from "next/navigation";

import { klantnaam } from "@/lib/opmaak";
import { laadBon } from "@/lib/schermen/laad";
import { typeNaam } from "@/lib/schermen/vandaag";
import { bouwVoorstel, kiesbaar, namen } from "@/lib/schermen/voorstel";
import { vereisScherm } from "@/lib/sessie";

import { VoorstelScherm } from "./VoorstelScherm";

export const metadata = { title: "Voorstel · Werfbon" };

export default async function BonPagina({ params }: { params: Promise<{ id: string }> }) {
  const ik = await vereisScherm("/vandaag");
  const { id } = await params;
  const bon = await laadBon(ik.id, Number(id));
  if (!bon) notFound();
  if (bon.status !== "concept") redirect(`/interventie/${bon.interventie.id}`);

  const i = bon.interventie;
  const onderwerp = i.toestel?.toesteltype ?? typeNaam(i.type).toLowerCase();
  return (
    <VoorstelScherm
      werfbonId={bon.id}
      interventieId={i.id}
      kop={[i.klant ? klantnaam(i.klant) : null, onderwerp].filter(Boolean).join(" · ")}
      type={i.type}
      toesteltype={i.toestel?.toesteltype ?? null}
      begin={bouwVoorstel(bon, bon.extractie, bon.catalogus)}
      namen={Object.fromEntries(namen(bon.catalogus))}
      kiesbaar={kiesbaar(bon.catalogus)}
    />
  );
}
