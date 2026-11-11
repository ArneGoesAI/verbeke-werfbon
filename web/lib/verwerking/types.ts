// Gedeelde types van de verwerking. De vorm volgt eval/schema.py en de velden van eval/data/cases.jsonl.

export type Lijn = { code: string; aantal: number };

export type Toestel = { type: string; merk: string; model: string };

/** Context van de interventie, in dezelfde vorm als `case.context` in cases.jsonl. */
export type Context = {
  type: string;
  omschrijving: string;
  toestel: Toestel | null;
};

export type Onderdeel = {
  code: string;
  aantal: number;
  omschrijving: string | null;
  bronzin: string;
};

/** Wat het model teruggeeft (het Werfbon-model uit eval/schema.py). */
export type Extractie = {
  uren: number;
  km: number | null;
  onderdelen: Onderdeel[];
  opmerking: string;
};

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
