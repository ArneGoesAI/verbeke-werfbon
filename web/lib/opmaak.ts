// Getallen, bedragen, datums en namen zoals de mockups ze tonen (nl-BE). Puur, zonder React of Supabase.

const NBSP = " "; // tussen € en bedrag: nooit afbreken

/** € 1.234,56 — altijd twee decimalen. Supabase geeft numeric soms als tekst terug. */
export function bedrag(waarde: number | string): string {
  const n = Number(waarde);
  if (!Number.isFinite(n)) throw new Error(`Geen bedrag: ${String(waarde)}`);
  const tekst = Math.abs(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}€${NBSP}${tekst}`;
}

/** 1,5 · 2 · 1,25 — zonder overbodige nullen, zonder duizendtalpunt in kleine aantallen. */
export function aantal(waarde: number | string): string {
  const n = Number(waarde);
  if (!Number.isFinite(n)) throw new Error(`Geen aantal: ${String(waarde)}`);
  return n.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

export function uren(waarde: number | string): string {
  return `${aantal(waarde)} uur`;
}

export function km(waarde: number | string): string {
  return `${aantal(waarde)} km`;
}

/** "Donderdag 5 november" uit een datum zonder tijd (2026-11-05), los van de tijdzone van de server. */
export function dagTitel(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) throw new Error(`Geen datum: ${isoDatum}`);
  const tekst = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDatum}T12:00:00Z`));
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** "08:30" in Belgische tijd. */
export function tijd(moment: string | Date): string {
  return new Intl.DateTimeFormat("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels",
  }).format(typeof moment === "string" ? new Date(moment) : moment);
}

/** Goeiemorgen tot 12 u, goeiemiddag tot 18 u, daarna goeieavond (Belgische tijd). */
export function groet(nu: Date = new Date()): string {
  const uur = Number(
    new Intl.DateTimeFormat("nl-BE", { hour: "numeric", hour12: false, timeZone: "Europe/Brussels" }).format(nu),
  );
  if (uur < 12) return "Goeiemorgen";
  if (uur < 18) return "Goeiemiddag";
  return "Goeieavond";
}

export type KlantNaam = {
  type: string;
  voornaam?: string | null;
  achternaam?: string | null;
  bedrijfsnaam?: string | null;
};

/** "Fam. De Smet" voor een particulier, de bedrijfsnaam voor een bedrijf. */
export function klantnaam(k: KlantNaam): string {
  if (k.type === "bedrijf" && k.bedrijfsnaam) return k.bedrijfsnaam;
  if (k.achternaam) return `Fam. ${k.achternaam}`;
  return k.bedrijfsnaam ?? "Onbekende klant";
}

/** "JV" uit voornaam en achternaam; bij "Van Hecke" telt de eerste letter van de achternaam. */
export function initialen(voornaam: string, achternaam: string): string {
  return `${voornaam.trim().charAt(0)}${achternaam.trim().charAt(0)}`.toUpperCase();
}
