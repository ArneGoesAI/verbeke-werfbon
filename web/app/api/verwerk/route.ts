// POST /api/verwerk: een opgeladen opname of foto verwerken tot een conceptbon. Logica in lib/route/verwerk-route.ts.

import { NextResponse } from "next/server";

import { echteAfhankelijkheden } from "@/lib/route/afhankelijkheden";
import { verwerkVerzoek } from "@/lib/route/verwerk-route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  try {
    const { status, body } = await verwerkVerzoek(data, echteAfhankelijkheden);
    return NextResponse.json(body, { status });
  } catch (e) {
    console.error("[api/verwerk]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { fout: "interne fout", melding: "Er ging iets mis bij het opslaan. Probeer opnieuw." },
      { status: 500 },
    );
  }
}
