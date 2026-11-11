// A1 Conceptfacturen (docs/ontwerp/A1-Conceptfacturen.dc.html): de facturen die bevestigd zijn door de technieker
// en wachten op goedkeuring. Filter en geselecteerde factuur staan in de URL (?filter=, ?factuur=).

import Link from "next/link";

import { Logo } from "@/components/Logo";
import { NakijkVak } from "@/components/NakijkVak";
import { aantal, bedrag } from "@/lib/opmaak";
import { type Conceptfactuur, laadConceptfacturen, laadFactuurDetail } from "@/lib/schermen/laad-administratie";
import {
  type Filter,
  bedragen,
  filterFacturen,
  kiesFactuur,
  leesFilter,
  lijnBedrag,
  waarschuwingZin,
} from "@/lib/schermen/waarschuwing";
import { typeNaam } from "@/lib/schermen/vandaag";
import { vereisScherm } from "@/lib/sessie";

import { afmelden } from "../acties";
import { Goedkeuren } from "./Goedkeuren";
import { OpnameSpeler } from "./OpnameSpeler";
import s from "./administratie.module.css";

export const metadata = { title: "Conceptfacturen · Werfbon" };

type Zoek = Promise<Record<string, string | string[] | undefined>>;

function href(filter: Filter, factuur?: number): string {
  const p = new URLSearchParams();
  if (filter === "nakijken") p.set("filter", "nakijken");
  if (factuur) p.set("factuur", String(factuur));
  const q = p.toString();
  return q ? `/administratie?${q}` : "/administratie";
}

export default async function Administratie({ searchParams }: { searchParams: Zoek }) {
  const ik = await vereisScherm("/administratie");
  const zoek = await searchParams;
  const filter = leesFilter(zoek.filter);
  const alle = await laadConceptfacturen();
  const nakijken = filterFacturen(alle, "nakijken");
  const lijst = filter === "nakijken" ? nakijken : alle;
  const gekozen = kiesFactuur(lijst, zoek.factuur);

  return (
    <div className={s.scherm}>
      <nav aria-label="Hoofdmenu" className={s.menu}>
        <div className={s.merk}>
          <Logo grootte={36} />
          <span className={s.merkNaam}>verbeke</span>
        </div>
        <div className={s.menuLijst}>
          <Link href="/administratie" className={s.menuItem} aria-current="page">
            Conceptfacturen <span className={s.teller}>{alle.length}</span>
          </Link>
        </div>
        <form action={afmelden} className={s.afmelden}>
          <span className={s.ik}>
            {ik.voornaam} {ik.achternaam}
          </span>
          <button type="submit" className={s.afmeldKnop}>
            Afmelden
          </button>
        </form>
      </nav>

      <main className={s.inhoud}>
        <div className={s.kop}>
          <div className={s.kopTekst}>
            <h1 className={s.titel}>Conceptfacturen</h1>
            <span className={s.onder}>Bevestigd door de technieker, wacht op jouw goedkeuring</span>
          </div>
          <div className={s.filters}>
            <Link href={href("alle")} className={`${s.filter} ${filter === "alle" ? s.filterAan : ""}`} aria-current={filter === "alle" ? "true" : undefined}>
              Alle ({alle.length})
            </Link>
            <Link
              href={href("nakijken")}
              className={`${s.filter} ${filter === "nakijken" ? s.filterAan : ""}`}
              aria-current={filter === "nakijken" ? "true" : undefined}
            >
              Na te kijken ({nakijken.length})
            </Link>
          </div>
        </div>

        <div className={s.werkvlak}>
          <div className={s.tabelVak}>
            {lijst.length === 0 ? (
              <p className={s.leeg}>
                {filter === "nakijken"
                  ? "Niets na te kijken: alle conceptfacturen zijn klaar."
                  : "Geen conceptfacturen. Zodra een technieker een bon bevestigt, staat de factuur hier."}
              </p>
            ) : (
              <table className={s.tabel}>
                <thead>
                  <tr>
                    <th className={s.eerste}>Factuur</th>
                    <th>Klant</th>
                    <th>Type</th>
                    <th className={s.rechts}>Excl. btw</th>
                    <th className={s.laatste}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lijst.map((f) => {
                    const actief = f.id === gekozen?.id;
                    return (
                      <tr key={f.id} className={actief ? s.rijActief : undefined}>
                        <td className={`${s.eerste} ${s.nummer}`}>
                          <Link href={href(filter, f.id)} className={s.rijLink} aria-current={actief ? "true" : undefined}>
                            {f.nummer}
                          </Link>
                        </td>
                        <td>{f.klantNaam}</td>
                        <td>{f.type ? typeNaam(f.type) : "—"}</td>
                        <td className={`${s.rechts} ${s.vet}`}>{bedrag(f.totaalExclBtw)}</td>
                        <td className={s.laatste}>
                          <span className={`${s.status} ${f.status.soort === "inOrde" ? s.statusKlaar : s.statusNakijken}`}>
                            {f.status.tekst}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {gekozen && <Detail factuur={gekozen} filter={filter} />}
        </div>
      </main>
    </div>
  );
}

async function Detail({ factuur: f, filter }: { factuur: Conceptfactuur; filter: Filter }) {
  const { lijnen, opname } = await laadFactuurDetail(f);
  const b = bedragen(f.totaalExclBtw, f.btwTarief, lijnen);
  const wie = f.bon?.technieker?.voornaam ?? "de technieker";

  return (
    <aside aria-label={`Detail ${f.nummer}`} className={s.detail}>
      <div className={s.detailKop}>
        <span className={s.nummers}>
          {f.nummer}
          {f.bon ? ` · werfbon ${f.bon.nummer}` : ""}
        </span>
        <h2 className={s.klant}>{f.klantNaam}</h2>
        <span className={s.soort}>
          {[f.titel || null, `${f.particulier ? "particulier" : "bedrijf"}, btw ${aantal(f.btwTarief)}%`].filter(Boolean).join(" · ")}
        </span>
      </div>

      <div className={s.bedragen}>
        {lijnen.map((l, i) => (
          <div key={i} className={s.bedragRij}>
            <span>
              {l.omschrijving} · {aantal(l.aantal)} × {bedrag(l.eenheidsprijs)}
            </span>
            <span className={s.vet}>{bedrag(lijnBedrag(l))}</span>
          </div>
        ))}
        <div className={s.lijn} />
        <div className={`${s.bedragRij} ${s.zacht}`}>
          <span>Btw {aantal(f.btwTarief)}%</span>
          <span>{bedrag(b.btw)}</span>
        </div>
        <div className={`${s.bedragRij} ${s.totaal}`}>
          <span>Totaal</span>
          <span>{bedrag(b.totaal)}</span>
        </div>
        {b.somLijnen !== b.exclBtw && (
          <span className={s.fout} role="alert">
            Let op: de lijnen tellen op tot {bedrag(b.somLijnen)}, de factuur zegt {bedrag(b.exclBtw)} excl. btw.
          </span>
        )}
      </div>

      {f.waarschuwingen.length > 0 && (
        <NakijkVak
          titel="Na te kijken"
          tekst={
            <span className={s.waarschuwingen}>
              {f.waarschuwingen.map((w, i) => (
                <span key={i}>{waarschuwingZin(w)}</span>
              ))}
            </span>
          }
        />
      )}

      {f.bon?.opmerkingen && (
        <div className={s.opmerking}>
          <span className={s.opmerkingTitel}>Opmerking van {wie}</span>
          <span>{f.bon.opmerkingen}</span>
        </div>
      )}

      {opname?.soort === "audio" && <OpnameSpeler url={opname.url} wie={wie} transcript={opname.transcript} />}
      {opname?.soort === "foto" && (
        <div className={s.opname}>
          <span className={s.opnameWie}>Foto van de papieren bon, door {wie}</span>
          {opname.url ? (
            <a href={opname.url} target="_blank" rel="noreferrer" className={s.fotoLink}>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, niet via next/image */}
              <img src={opname.url} alt={`Papieren werfbon ${f.bon?.nummer ?? ""}`} className={s.foto} />
            </a>
          ) : (
            <span className={s.opnameDuur}>Het bestand is niet te openen.</span>
          )}
        </div>
      )}
      {!opname && f.bon && <span className={s.opnameDuur}>Geen opname of foto bij deze bon.</span>}

      <Goedkeuren factuurId={f.id} nummer={f.nummer} klant={f.klantNaam} totaal={bedrag(b.totaal)} filter={filter} />
    </aside>
  );
}
