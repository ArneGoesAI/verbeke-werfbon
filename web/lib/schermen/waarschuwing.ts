// A1 Conceptfacturen: status, filters en bedragen. Puur, zonder Supabase, zodat het te testen is.
// De waarschuwingen komen uit factuurwaarschuwingen() (verbeke-data, migratie 0003); de teksten hier volgen die.

export type FactuurStatus = { soort: "inOrde" | "nakijken"; tekst: string };

// Volgorde en begin van de teksten zoals factuurwaarschuwingen() ze geeft.
const KORT: [string, string][] = [
  ["niet getekend", "Niet getekend"],
  ["ongewoon veel uren", "Veel uren"],
  ["onderhoud zonder contract", "Geen contract"],
  ["onderdeel op onderhoudsbon", "Onderdeel bij onderhoud"],
  ["arbeid op de bon", "Uren wijken af"],
];

/** Kort label voor één waarschuwing; een onbekende tekst blijft zichtbaar, met een hoofdletter. */
export function kortLabel(waarschuwing: string): string {
  const t = waarschuwing.trim();
  const treffer = KORT.find(([begin]) => t.toLowerCase().startsWith(begin));
  if (treffer) return treffer[1];
  const zonderDetail = t.split(":")[0].trim();
  return zonderDetail.charAt(0).toUpperCase() + zonderDetail.slice(1);
}

/** Leeg → "Klaar"; anders het label van de eerste waarschuwing. */
export function factuurStatus(waarschuwingen: string[]): FactuurStatus {
  if (waarschuwingen.length === 0) return { soort: "inOrde", tekst: "Klaar" };
  return { soort: "nakijken", tekst: kortLabel(waarschuwingen[0]) };
}

/** De volledige tekst voor het gele vak in het detail: met hoofdletter, zoals een zin. */
export function waarschuwingZin(waarschuwing: string): string {
  const t = waarschuwing.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export type Filter = "alle" | "nakijken";

export function leesFilter(waarde: string | string[] | undefined): Filter {
  return waarde === "nakijken" ? "nakijken" : "alle";
}

export function filterFacturen<T extends { waarschuwingen: string[] }>(lijst: T[], filter: Filter): T[] {
  return filter === "nakijken" ? lijst.filter((f) => f.waarschuwingen.length > 0) : lijst;
}

/** Welke factuur het detail toont: de gevraagde als ze in de lijst staat, anders de eerste. */
export function kiesFactuur<T extends { id: number }>(lijst: T[], gevraagd: string | string[] | undefined): T | null {
  const id = typeof gevraagd === "string" ? Number(gevraagd) : NaN;
  return lijst.find((f) => f.id === id) ?? lijst[0] ?? null;
}

/** Afronden op de cent, zonder de fout van 1,005 → 1,00. */
export function opDeCent(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type FactuurLijn = { omschrijving: string; aantal: number; eenheidsprijs: number };

export function lijnBedrag(l: Pick<FactuurLijn, "aantal" | "eenheidsprijs">): number {
  return opDeCent(Number(l.aantal) * Number(l.eenheidsprijs));
}

export type Bedragen = { exclBtw: number; btw: number; totaal: number; somLijnen: number };

/**
 * Btw en totaal uit het totaal excl. btw van de factuur. `somLijnen` dient als controle: de database rekent het
 * totaal uit factuurvoorstel(), dus het moet gelijk zijn aan de som van de lijnen.
 */
export function bedragen(totaalExclBtw: number, btwTarief: number, lijnen: Pick<FactuurLijn, "aantal" | "eenheidsprijs">[]): Bedragen {
  const exclBtw = opDeCent(Number(totaalExclBtw));
  const btw = opDeCent((exclBtw * Number(btwTarief)) / 100);
  const somLijnen = opDeCent(lijnen.reduce((t, l) => t + lijnBedrag(l), 0));
  return { exclBtw, btw, totaal: opDeCent(exclBtw + btw), somLijnen };
}

/** "0:41" uit seconden; null als de duur (nog) onbekend is, zoals bij webm uit MediaRecorder. */
export function duur(seconden: number | null | undefined): string | null {
  if (seconden == null || !Number.isFinite(seconden) || seconden < 0) return null;
  const s = Math.round(seconden);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
