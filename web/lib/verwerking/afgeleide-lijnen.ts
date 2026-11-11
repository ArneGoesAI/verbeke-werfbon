// Port van eval/afgeleide_lijnen.py (beslissing 1 van docs/eval-plan.md). Houd beide gelijk: de vitest-tests
// draaien dezelfde gevallen als eval/tests/test_afgeleide_lijnen.py.
//
// Het model geeft alleen uren, km, onderdelen en een opmerking terug. De lijnen die vastliggen door het type
// interventie en het toestel, vult deze code aan:
// - herstelling: ARB-TECH met aantal = uren, plus VERPL 1
// - onderhoud:   één forfait volgens het toestel (ARB-ONDERH-WP, -VENT of -ZB), geen ARB-TECH

import type { Lijn } from "./types";

export const FORFAIT: Record<string, string> = {
  warmtepomp: "ARB-ONDERH-WP",
  ventilatie: "ARB-ONDERH-VENT",
  zonneboiler: "ARB-ONDERH-ZB",
};

export const AFGELEIDE_CODES: ReadonlySet<string> = new Set(["ARB-TECH", "VERPL", ...Object.values(FORFAIT)]);

/** In JavaScript is 2.0 al gelijk aan 2; dit zet alleen tekst om naar een getal, zoals getal() in Python. */
export function getal(x: number | string): number {
  const n = Number(x);
  if (!Number.isFinite(n)) throw new Error(`Geen getal: ${String(x)}`);
  return n;
}

export function afgeleideLijnen(type: string, toestelType: string | null, uren: number): Lijn[] {
  if (type === "herstelling") {
    const lijnen: Lijn[] = [];
    if (uren > 0) lijnen.push({ code: "ARB-TECH", aantal: getal(uren) });
    lijnen.push({ code: "VERPL", aantal: 1 });
    return lijnen;
  }
  if (type === "onderhoud") {
    if (toestelType === null || !(toestelType in FORFAIT)) {
      throw new Error(`Onderhoud zonder bekend toestel (${JSON.stringify(toestelType)}): geen forfait af te leiden.`);
    }
    return [{ code: FORFAIT[toestelType], aantal: 1 }];
  }
  throw new Error(`Geen afgeleide lijnen voor type ${JSON.stringify(type)}.`);
}

/** Telt dezelfde code samen en sorteert op code. Alleen code en aantal blijven over. */
export function normaliseer(lijnen: Iterable<{ code: string; aantal: number | string }>): Lijn[] {
  const som = new Map<string, number>();
  for (const l of lijnen) som.set(l.code, (som.get(l.code) ?? 0) + getal(l.aantal));
  // Zelfde volgorde als sorted() in Python: op codepunt, dus hoofdletters vóór "onbekend".
  return [...som.keys()].sort().map((code) => ({ code, aantal: som.get(code)! }));
}

/** De factuurlijnen: onderdelen van het model plus de afgeleide lijnen, genormaliseerd. */
export function volledigeLijnen(
  type: string,
  toestelType: string | null,
  uren: number,
  onderdelen: Iterable<{ code: string; aantal: number | string }>,
): Lijn[] {
  const lijst = [...onderdelen];
  const fout = [...new Set(lijst.map((o) => o.code).filter((c) => AFGELEIDE_CODES.has(c)))].sort();
  if (fout.length > 0) {
    throw new Error(`Afgeleide code(s) tussen de onderdelen: ${fout.join(", ")}. Die vult de code zelf aan.`);
  }
  return normaliseer([...lijst, ...afgeleideLijnen(type, toestelType, uren)]);
}

/** De lijnen zonder de afgeleide: wat het model zelf moet teruggeven. */
export function onderdelenUit<T extends { code: string }>(lijnen: Iterable<T>): T[] {
  return [...lijnen].filter((l) => !AFGELEIDE_CODES.has(l.code));
}
