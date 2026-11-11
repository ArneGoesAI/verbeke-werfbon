// T1 Vandaag: welke kaart welke status krijgt. Puur, zonder Supabase, zodat het te testen is.

import { klantnaam, type KlantNaam } from "../opmaak";

export type BonStatus = "concept" | "op_papier" | "ingegeven" | "gefactureerd";

export type Klant = KlantNaam & {
  straat?: string | null;
  huisnummer?: string | null;
  gemeente?: string | null;
};

export type ToestelInfo = { toesteltype: string; merk: string; model: string };

/** Een interventie zoals de schermen ze nodig hebben (uit interventies, klanten, onderhoudscontracten, werfbonnen). */
export type Interventie = {
  id: number;
  type: string;
  gepland_start: string | null;
  omschrijving: string | null;
  klant: Klant | null;
  toestel: ToestelInfo | null;
  bonnen: { id: number; status: BonStatus }[]; // alleen de eigen bonnen
};

export type KaartStatus = "gepland" | "bezig" | "teBevestigen" | "bevestigd";

export type KaartInfo = {
  interventie: Interventie;
  status: KaartStatus;
  actief: boolean; // warmterand: de vroegste zonder bevestigde bon
  label: { soort: "nakijken" | "inOrde" | "automatisch"; tekst: string };
};

const TYPE_NAAM: Record<string, string> = {
  herstelling: "Herstelling",
  onderhoud: "Onderhoud",
  installatie: "Installatie",
  plaatsbezoek: "Plaatsbezoek",
};

export function typeNaam(type: string): string {
  return TYPE_NAAM[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

/** "Herstelling warmtepomp"; zonder contract alleen "Herstelling". */
export function kaartTitel(i: Pick<Interventie, "type" | "toestel">): string {
  return i.toestel ? `${typeNaam(i.type)} ${i.toestel.toesteltype}` : typeNaam(i.type);
}

/** "Panasonic Aquarea 9 kW · verwarmt niet" of alleen de melding. */
export function kaartOmschrijving(i: Pick<Interventie, "toestel" | "omschrijving">): string {
  const delen = [i.toestel ? `${i.toestel.merk} ${i.toestel.model}` : null, i.omschrijving?.trim() || null];
  return delen.filter(Boolean).join(" · ");
}

/** "Fam. De Smet · Erpe-Mere" */
export function kaartKlant(k: Klant | null): string {
  if (!k) return "";
  return [klantnaam(k), k.gemeente].filter(Boolean).join(" · ");
}

/** "Kerkstraat 12, Erpe-Mere" */
export function adres(k: Klant | null): string {
  if (!k) return "";
  const straat = [k.straat, k.huisnummer].filter(Boolean).join(" ");
  return [straat, k.gemeente].filter(Boolean).join(", ");
}

/** Bevestigd = de bon is door de technieker bevestigd (of kwam op papier binnen). */
export function bonStand(bonnen: Interventie["bonnen"]): "geen" | "concept" | "bevestigd" {
  if (bonnen.some((b) => b.status !== "concept")) return "bevestigd";
  if (bonnen.some((b) => b.status === "concept")) return "concept";
  return "geen";
}

/** De nieuwste conceptbon (hoogste id), voor het geval een oude bij het vervangen bleef staan. */
export function eigenConceptbon(bonnen: Interventie["bonnen"]): number | null {
  const ids = bonnen.filter((b) => b.status === "concept").map((b) => b.id);
  return ids.length ? Math.max(...ids) : null;
}

function tijdstip(i: Interventie): number {
  return i.gepland_start ? Date.parse(i.gepland_start) : Number.POSITIVE_INFINITY;
}

/**
 * Status per kaart, in volgorde van het geplande uur. De vroegste interventie zonder bevestigde bon is "nu bezig"
 * (warmterand). Een conceptbon is "nog te bevestigen", een bevestigde bon "bevestigd", de rest "gepland".
 */
export function kaarten(interventies: Interventie[]): KaartInfo[] {
  const volgorde = [...interventies].sort((a, b) => tijdstip(a) - tijdstip(b) || a.id - b.id);
  const actief = volgorde.find((i) => bonStand(i.bonnen) !== "bevestigd")?.id ?? null;
  return volgorde.map((interventie) => {
    const stand = bonStand(interventie.bonnen);
    const isActief = interventie.id === actief;
    if (stand === "bevestigd") {
      return { interventie, status: "bevestigd", actief: false, label: { soort: "inOrde", tekst: "Bevestigd" } };
    }
    if (stand === "concept") {
      return {
        interventie,
        status: "teBevestigen",
        actief: isActief,
        label: { soort: "nakijken", tekst: "Nog te bevestigen" },
      };
    }
    if (isActief) {
      return { interventie, status: "bezig", actief: true, label: { soort: "nakijken", tekst: "Bon nog in te spreken" } };
    }
    return { interventie, status: "gepland", actief: false, label: { soort: "automatisch", tekst: "Gepland" } };
  });
}

/** "3 interventies vandaag" */
export function aantalTekst(n: number): string {
  if (n === 0) return "Geen interventies vandaag";
  return `${n} ${n === 1 ? "interventie" : "interventies"} vandaag`;
}

/** Offset van Europe/Brussels op een moment, in minuten (60 in de winter, 120 in de zomer). */
function brusselsOffset(moment: Date): number {
  const deel = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Brussels", timeZoneName: "longOffset" })
    .formatToParts(moment)
    .find((d) => d.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(deel ?? "");
  if (!m) return 0; // "GMT" zonder offset
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function middernachtBrussel(isoDatum: string): Date {
  const utc = new Date(`${isoDatum}T00:00:00Z`);
  // Twee keer: de offset op middernacht zelf, niet op de UTC-gok (verschilt alleen rond een tijdwissel).
  const eerste = new Date(utc.getTime() - brusselsOffset(utc) * 60_000);
  return new Date(utc.getTime() - brusselsOffset(eerste) * 60_000);
}

/** Begin en einde (exclusief) van een kalenderdag in Belgische tijd, als ISO-tijdstippen in UTC. */
export function dagGrenzen(isoDatum: string): { van: string; tot: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) throw new Error(`Geen datum: ${isoDatum}`);
  const volgende = new Date(`${isoDatum}T12:00:00Z`);
  volgende.setUTCDate(volgende.getUTCDate() + 1);
  return {
    van: middernachtBrussel(isoDatum).toISOString(),
    tot: middernachtBrussel(volgende.toISOString().slice(0, 10)).toISOString(),
  };
}
