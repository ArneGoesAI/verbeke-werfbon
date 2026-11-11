// De dienstclient zonder de "server-only"-bewaking, voor de scripts (tsx kent de react-server-conditie niet).
// In de app altijd via dienst.ts importeren.
//
// Deze client gebruikt de secret key en passeert RLS. Hij heeft geen sessie: geen cookies, niets bewaard.

import { createClient } from "@supabase/supabase-js";

import { type DienstConfig, dienstConfig } from "./config";

export function maakDienstClient(config: DienstConfig = dienstConfig()) {
  return createClient(config.url, config.geheimeSleutel, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
