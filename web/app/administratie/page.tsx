// Tijdelijk: deel 10 bouwt hier A1 (conceptfacturen). Nu alleen om het aanmelden te testen.
import { afmelden } from "../acties";
import { vereisScherm } from "@/lib/sessie";

export default async function Administratie() {
  const ik = await vereisScherm("/administratie");
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px" }}>
      <h1>Conceptfacturen</h1>
      <p>Aangemeld als {ik.rol} (medewerker {ik.id}). De conceptfacturen komen in deel 10.</p>
      <form action={afmelden}>
        <button type="submit">Afmelden</button>
      </form>
    </main>
  );
}
