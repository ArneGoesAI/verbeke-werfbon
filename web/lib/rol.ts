// Waar iemand na het aanmelden heen gaat. Wat iemand mag zien, bepaalt RLS; dit kiest alleen het scherm.

export type Bestemming = "/vandaag" | "/administratie";

export function bestemmingVoorRol(rol: string | null | undefined): Bestemming | null {
  if (rol === "technieker") return "/vandaag";
  if (rol === "administratie" || rol === "zaakvoerder") return "/administratie"; // zelfde rollen als is_administratie()
  return null;
}
