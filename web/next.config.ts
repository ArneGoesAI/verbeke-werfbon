import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Eén .env voor de hele repo: die in de root (naast eval/). Op Vercel staan de variabelen in het project; er is daar
// geen .env, en dan laadt dit niets (geen fout). Variabelen die al gezet zijn, overschrijft @next/env nooit.
// forceReload: Next heeft web/ al geladen (zonder .env) en zou die lading anders uit de cache teruggeven.
loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  // De "N"-badge van next dev viel linksonder over de naam in het menu van A1, en zou rechtsonder over de brede knoppen
  // van T1–T4 vallen. Uit: fouten tijdens het bouwen of draaien toont Next nog altijd. Alleen in ontwikkeling.
  devIndicators: false,
  // De systeemprompt wordt bij het draaien gelezen (lib/verwerking/gegenereerd.ts): mee in de functie van de route.
  outputFileTracingIncludes: { "/api/verwerk": ["./lib/verwerking/gegenereerd/systeemprompt.md"] },
};

export default nextConfig;
