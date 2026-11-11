// T3 Inspreken (docs/ontwerp/T3-Inspreken.dc.html). De opname zelf draait in de browser (Opname.tsx).

import { notFound, redirect } from "next/navigation";

import { klantnaam } from "@/lib/opmaak";
import { laadInterventie } from "@/lib/schermen/laad";
import { bonStand, typeNaam } from "@/lib/schermen/vandaag";
import { vereisScherm } from "@/lib/sessie";

import { Opname } from "./Opname";

export const metadata = { title: "Bon inspreken · Werfbon" };

export default async function Inspreken({ params }: { params: Promise<{ id: string }> }) {
  const ik = await vereisScherm("/vandaag");
  const { id } = await params;
  const i = await laadInterventie(ik.id, Number(id));
  if (!i) notFound();
  if (bonStand(i.bonnen) === "bevestigd" || (i.type !== "herstelling" && i.type !== "onderhoud")) {
    redirect(`/interventie/${i.id}`);
  }
  const onderwerp = i.toestel?.toesteltype ?? typeNaam(i.type).toLowerCase();
  const kop = [i.klant ? klantnaam(i.klant) : null, onderwerp].filter(Boolean).join(" · ");
  return <Opname medewerkerId={ik.id} interventieId={i.id} kop={kop} />;
}
