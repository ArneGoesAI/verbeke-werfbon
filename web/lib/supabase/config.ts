// De Supabase-instellingen uit de omgeving. Eén .env in de repo-root (zie next.config.ts); op Vercel in het project.
//
// - NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publiek, ook in de browser. Wat iemand mag,
//   bepaalt RLS (migratie 0004 in verbeke-data), niet deze sleutel.
// - SUPABASE_SECRET_KEY: passeert RLS. Alleen op de server (route /api/verwerk) en in de scripts.

export class ConfigFout extends Error {}

export type PubliekeConfig = { url: string; publiekeSleutel: string };
export type DienstConfig = PubliekeConfig & { geheimeSleutel: string };

type Omgeving = Record<string, string | undefined>;

function verplicht(waarde: string | undefined, naam: string): string {
  if (!waarde) throw new ConfigFout(`${naam} ontbreekt in .env`);
  return waarde;
}

/**
 * Next.js vervangt `process.env.NEXT_PUBLIC_…` alleen bij letterlijke toegang. Daarom staan de namen hier voluit
 * en niet in een lus.
 */
export function publiekeConfig(
  env: Omgeving = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): PubliekeConfig {
  const url = verplicht(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  if (!/^https?:\/\//.test(url)) throw new ConfigFout("NEXT_PUBLIC_SUPABASE_URL is geen URL");
  return {
    url,
    publiekeSleutel: verplicht(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function dienstConfig(env: Omgeving = process.env): DienstConfig {
  const geheimeSleutel = verplicht(env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY");
  // Een publishable key op de plaats van de secret key zou stil "niets zien" door RLS: liever meteen stoppen.
  if (geheimeSleutel.startsWith("sb_publishable_")) {
    throw new ConfigFout("SUPABASE_SECRET_KEY bevat een publishable key, geen secret key");
  }
  return { ...publiekeConfig(env), geheimeSleutel };
}
