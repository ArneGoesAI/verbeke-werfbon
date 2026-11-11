"use client";

// T4: het voorstel aanpassen en bevestigen. De afgeleide lijnen (arbeid, verplaatsing, forfait) rekent het scherm
// opnieuw uit bij elke wijziging van de uren; de server rekent bij Bevestigen nog eens zelf (acties.ts).

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Knop } from "@/components/Knop";
import { Label } from "@/components/Label";
import { NakijkVak } from "@/components/NakijkVak";
import { aantal, km as kmTekst, uren as urenTekst } from "@/lib/opmaak";
import {
  type CatalogusArtikel,
  type Voorstel,
  afgeleideRijen,
  kiesArtikel,
  leesGetal,
  nietAanrekenen,
  openVakken,
  verwijder,
  wijzigAantal,
  zetKm,
  zetUren,
} from "@/lib/schermen/voorstel";
import { MAX_UREN } from "@/lib/verwerking/grenzen";

import { bevestig } from "./acties";
import s from "./voorstel.module.css";

type Props = {
  werfbonId: number;
  interventieId: number;
  kop: string;
  type: string;
  toesteltype: string | null;
  begin: Voorstel;
  namen: Record<string, string>;
  kiesbaar: CatalogusArtikel[];
};

export function VoorstelScherm({ werfbonId, interventieId, kop, type, toesteltype, begin, namen, kiesbaar }: Props) {
  const [v, setV] = useState(begin);
  const [bewerk, setBewerk] = useState<"uren" | "km" | null>(null);
  const [open, setOpen] = useState<string | null>(null); // sleutel van het onderdeel met − / + / verwijderen
  const [kiezen, setKiezen] = useState<string | null>(null); // sleutel van het gele vak in "Kies artikel"
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();

  const afgeleid = useMemo(() => afgeleideRijen(type, toesteltype, v.uren, new Map(Object.entries(namen))), [type, toesteltype, v.uren, namen]);
  const nogOpen = openVakken(v);
  const nietAangerekend = v.onbekend.filter((g) => g.oplossing !== null);

  function doeBevestig() {
    setFout(null);
    start(async () => {
      const r = await bevestig(werfbonId, {
        uren: v.uren,
        km: v.km,
        onderdelen: v.onderdelen.map(({ code, aantal }) => ({ code, aantal })),
        onbekend: v.onbekend.map(({ omschrijving, bronzin, aantal, oplossing }) => ({ omschrijving, bronzin, aantal, oplossing })),
        opmerking: v.opmerking,
      });
      if (r?.fout) setFout(r.fout); // bij succes stuurt de server door naar /vandaag
    });
  }

  return (
    <main className={s.pagina}>
      <div className={s.kop}>
        <span className={s.onderwerp}>{kop}</span>
        <h1 className={s.titel}>Klopt dit?</h1>
      </div>

      <div className={s.tegels}>
        <Tegel
          naam="Gewerkt"
          waarde={urenTekst(v.uren)}
          bewerken={bewerk === "uren"}
          beginTekst={aantal(v.uren)}
          eenheid="uur"
          max={MAX_UREN}
          decimaal
          onOpen={() => setBewerk("uren")}
          onKlaar={(n) => {
            if (n !== null && n <= MAX_UREN) setV(zetUren(v, Math.round(n * 100) / 100));
            setBewerk(null);
          }}
        />
        <Tegel
          naam="Gereden"
          waarde={kmTekst(v.km)}
          bewerken={bewerk === "km"}
          beginTekst={String(v.km)}
          eenheid="km"
          onOpen={() => setBewerk("km")}
          onKlaar={(n) => {
            if (n !== null) setV(zetKm(v, Math.round(n)));
            setBewerk(null);
          }}
        />
      </div>

      {(v.onderdelen.length > 0 || afgeleid.length > 0) && (
        <div className={s.lijnen}>
          {v.onderdelen.map((o) => (
            <div key={o.sleutel} className={s.rij}>
              <button
                type="button"
                className={s.rijKnop}
                aria-expanded={open === o.sleutel}
                onClick={() => setOpen(open === o.sleutel ? null : o.sleutel)}
              >
                <span className={s.rijNaam}>{o.naam}</span>
                <span className={s.rijNaam}>× {aantal(o.aantal)}</span>
              </button>
              {o.bronzinnen.map((zin, i) => (
                <span key={i} className={s.citaat}>
                  &ldquo;{zin}&rdquo;
                </span>
              ))}
              {open === o.sleutel && (
                <div className={s.bediening}>
                  <button type="button" className={s.rond} aria-label={`Eén ${o.naam} minder`} onClick={() => setV(wijzigAantal(v, o.sleutel, -1))} disabled={o.aantal <= 1}>
                    −
                  </button>
                  <button type="button" className={s.rond} aria-label={`Eén ${o.naam} meer`} onClick={() => setV(wijzigAantal(v, o.sleutel, 1))}>
                    +
                  </button>
                  <button
                    type="button"
                    className={s.verwijder}
                    onClick={() => {
                      setV(verwijder(v, o.sleutel));
                      setOpen(null);
                    }}
                  >
                    Verwijderen
                  </button>
                </div>
              )}
            </div>
          ))}
          {afgeleid.map((a) => (
            <div key={a.code} className={`${s.rij} ${s.rijAfgeleid}`}>
              <span className={s.afgeleidNaam}>{a.tekst}</span>
              <Label soort="automatisch" maat="mini">
                Automatisch
              </Label>
            </div>
          ))}
        </div>
      )}

      {v.onbekend.map((g) =>
        g.oplossing === null ? (
          <NakijkVak
            key={g.sleutel}
            tekst={
              <>
                &ldquo;{g.bronzin || g.omschrijving}&rdquo; staat niet in de catalogus. Ik heb niet gegokt.
              </>
            }
          >
            <Knop soort="petrolWit" maat="klein" onClick={() => setKiezen(g.sleutel)}>
              Kies artikel
            </Knop>
            <Knop soort="nakijkOmlijnd" maat="klein" onClick={() => setV(nietAanrekenen(v, g.sleutel))}>
              Niet aanrekenen
            </Knop>
          </NakijkVak>
        ) : null,
      )}

      {nietAangerekend.length > 0 && (
        <div className={s.nietAangerekend}>
          {nietAangerekend.map((g) => (
            <div key={g.sleutel} className={s.nietRij}>
              <span>
                Niet aangerekend: {g.omschrijving || g.bronzin} × {aantal(g.aantal)}
              </span>
              <button type="button" className={s.tekstKnop} onClick={() => setV(nietAanrekenen(v, g.sleutel, false))}>
                Ongedaan maken
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={s.vuller} />

      <div className={s.onderaan}>
        {nogOpen > 0 && <span className={s.hint}>Los eerst het gele vak op, dan kan je bevestigen.</span>}
        {fout && (
          <p role="alert" className={s.fout}>
            {fout}
          </p>
        )}
        <Knop className={s.bevestig} breed disabled={nogOpen > 0 || bezig || bewerk !== null} onClick={doeBevestig}>
          {bezig ? "Bevestigen…" : "Bevestigen"}
        </Knop>
        <Link href={`/interventie/${interventieId}/inspreken`} className={s.opnieuw}>
          Opnieuw inspreken
        </Link>
      </div>

      {kiezen !== null && (
        <ArtikelKiezer
          artikelen={kiesbaar}
          onKies={(a) => {
            setV(kiesArtikel(v, kiezen, a));
            setKiezen(null);
          }}
          onSluit={() => setKiezen(null)}
        />
      )}
    </main>
  );
}

function Tegel(props: {
  naam: string;
  waarde: string;
  bewerken: boolean;
  beginTekst: string;
  eenheid: string;
  decimaal?: boolean;
  max?: number;
  onOpen: () => void;
  onKlaar: (n: number | null) => void;
}) {
  const [tekst, setTekst] = useState(props.beginTekst);
  if (!props.bewerken) {
    return (
      <button
        type="button"
        className={s.tegel}
        onClick={() => {
          setTekst(props.beginTekst);
          props.onOpen();
        }}
        aria-label={`${props.naam}: ${props.waarde}. Tik om aan te passen.`}
      >
        <span className={s.tegelNaam}>{props.naam}</span>
        <span className={s.tegelWaarde}>{props.waarde}</span>
      </button>
    );
  }
  const gelezen = leesGetal(tekst);
  const n = gelezen !== null && (props.max === undefined || gelezen <= props.max) ? gelezen : null;
  const klaar = () => props.onKlaar(n);
  return (
    <div className={`${s.tegel} ${s.tegelBewerk}`}>
      <label className={s.tegelNaam} htmlFor={`tegel-${props.naam}`}>
        {props.naam}
      </label>
      <div className={s.tegelInvoer}>
        <input
          id={`tegel-${props.naam}`}
          autoFocus
          inputMode={props.decimaal ? "decimal" : "numeric"}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") klaar();
            if (e.key === "Escape") props.onKlaar(null);
          }}
          onBlur={klaar}
          aria-invalid={n === null}
        />
        <span>{props.eenheid}</span>
      </div>
      {n === null && <span className={s.tegelNaam}>{props.max !== undefined ? `0 tot ${props.max}` : "Een getal"}</span>}
    </div>
  );
}

function ArtikelKiezer({
  artikelen,
  onKies,
  onSluit,
}: {
  artikelen: CatalogusArtikel[];
  onKies: (a: CatalogusArtikel) => void;
  onSluit: () => void;
}) {
  const [zoek, setZoek] = useState("");
  const gevonden = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return z ? artikelen.filter((a) => a.omschrijving.toLowerCase().includes(z)) : artikelen;
  }, [zoek, artikelen]);
  return (
    <div className={s.kiezer} role="dialog" aria-modal="true" aria-label="Kies artikel">
      <div className={s.kiezerKop}>
        <h2 className={s.kiezerTitel}>Kies artikel</h2>
        <button type="button" className={s.tekstKnop} onClick={onSluit}>
          Sluiten
        </button>
      </div>
      <input
        className={s.zoek}
        type="search"
        placeholder="Zoek in de catalogus"
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        autoFocus
      />
      <div className={s.kiezerLijst}>
        {gevonden.map((a) => (
          <button key={a.code} type="button" className={s.kiezerRij} onClick={() => onKies(a)}>
            {a.omschrijving}
          </button>
        ))}
        {gevonden.length === 0 && <span className={s.hint}>Niets gevonden.</span>}
      </div>
    </div>
  );
}
