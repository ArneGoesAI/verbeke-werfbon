// Draait voor elk verzoek: ververst de Supabase-sessie in de cookies en stuurt wie niet is aangemeld naar /login.
// Dit is een snelle eerste controle; elk scherm controleert zelf nog (lib/sessie.ts) en RLS beslist over de data.

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { publiekeConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let antwoord = NextResponse.next({ request });
  const { url, publiekeSleutel } = publiekeConfig();
  const supabase = createServerClient(url, publiekeSleutel, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lijst, headers) => {
        for (const { name, value } of lijst) request.cookies.set(name, value);
        antwoord = NextResponse.next({ request });
        for (const { name, value, options } of lijst) antwoord.cookies.set(name, value, options);
        for (const [naam, waarde] of Object.entries(headers ?? {})) antwoord.headers.set(naam, waarde);
      },
    },
  });

  // getClaims controleert de handtekening van het token; ververst het zo nodig (en zet dan nieuwe cookies).
  const { data } = await supabase.auth.getClaims();
  const pad = request.nextUrl.pathname;
  const open = pad === "/login" || pad.startsWith("/api/"); // een route geeft zelf 401, geen doorverwijzing
  if (!data?.claims && !open) {
    const naarLogin = NextResponse.redirect(new URL("/login", request.url));
    for (const c of antwoord.cookies.getAll()) naarLogin.cookies.set(c);
    return naarLogin;
  }
  return antwoord;
}

export const config = {
  // Niet voor statische bestanden en afbeeldingen.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
