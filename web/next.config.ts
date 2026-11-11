import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Eén .env voor de hele repo: die in de root (naast eval/). Op Vercel staan de variabelen in het project.
// forceReload: Next heeft web/ al geladen (zonder .env) en zou die lading anders uit de cache teruggeven.
loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {};

export default nextConfig;
