// Tijdelijk: deel 5 bouwt hier T1 (interventies van vandaag). Nu alleen om het aanmelden te testen.
import { afmelden } from "../acties";
import { vereisScherm } from "@/lib/sessie";

export default async function Vandaag() {
  const ik = await vereisScherm("/vandaag");
  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "28px 20px" }}>
      <h1>Goeiemorgen, {ik.voornaam}</h1>
      <p>Aangemeld als technieker (medewerker {ik.id}). De interventies van vandaag komen in deel 5.</p>
      <form action={afmelden}>
        <button type="submit">Afmelden</button>
      </form>
    </main>
  );
}
