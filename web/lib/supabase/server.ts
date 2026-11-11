// Supabase op de server (server components, server actions, routes), met de sessie van de gebruiker uit de cookies.
// RLS bepaalt wat de gebruiker ziet. Per verzoek een nieuwe client: de sessie hoort bij dat ene verzoek.

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publiekeConfig } from "./config";

export async function serverClient() {
  const koekjes = await cookies(); // eerst: maakt het scherm dynamisch, ook als de config hierna faalt
  const { url, publiekeSleutel } = publiekeConfig();
  return createServerClient(url, publiekeSleutel, {
    cookies: {
      getAll: () => koekjes.getAll(),
      setAll: (lijst) => {
        try {
          for (const { name, value, options } of lijst) koekjes.set(name, value, options);
        } catch {
          // Een server component mag geen cookies zetten. Geen probleem: proxy.ts ververst de sessie (deel 4).
        }
      },
    },
  });
}
