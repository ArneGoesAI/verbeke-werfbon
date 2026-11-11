// Supabase in de browser, met de sessie van de gebruiker (cookies). Alles wat hiermee gelezen of geschreven wordt,
// gaat door RLS.

import { createBrowserClient } from "@supabase/ssr";

import { publiekeConfig } from "./config";

export function browserClient() {
  const { url, publiekeSleutel } = publiekeConfig();
  return createBrowserClient(url, publiekeSleutel);
}
