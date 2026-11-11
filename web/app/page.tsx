import { redirect } from "next/navigation";

import { bestemmingVoorRol } from "@/lib/rol";
import { huidigeMedewerker } from "@/lib/sessie";

import { afmelden } from "./acties";

export default async function Start() {
  const ik = await huidigeMedewerker();
  if (!ik) redirect("/login");
  const bestemming = bestemmingVoorRol(ik.rol);
  if (bestemming) redirect(bestemming);
  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "56px 20px" }}>
      <h1>Geen toegang</h1>
      <p>De werfbon-app is er voor techniekers en de administratie.</p>
      <form action={afmelden}>
        <button type="submit">Afmelden</button>
      </form>
    </main>
  );
}
