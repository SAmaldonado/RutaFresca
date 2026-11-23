import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { VinculacionClient } from "@/components/VinculacionClient";

export const dynamic = "force-dynamic";

export default async function VinculacionPage() {
  const session = await getCurrentSession();
  return (
    <AppShell
      activeUser={session}
      title="Vinculación al Piloto y Gobierno del Dato (Ley 1581)"
      subtitle="Registro de comedores, asociaciones/productores con línea base digital y transportadores aliados, con autorización comprensible y revocable."
    >
      <VinculacionClient />
    </AppShell>
  );
}
