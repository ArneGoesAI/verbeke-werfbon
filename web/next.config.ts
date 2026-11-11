import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Eén .env voor de hele repo: die in de root (naast eval/). Op Vercel staan de variabelen in het project.
// forceReload: Next heeft web/ al geladen (zonder .env) en zou die lading anders uit de cache teruggeven.
loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  // De systeemprompt wordt bij het draaien gelezen (lib/verwerking/gegenereerd.ts): mee in de functie van de route.
  outputFileTracingIncludes: { "/api/verwerk": ["./lib/verwerking/gegenereerd/systeemprompt.md"] },
};

export default nextConfig;
