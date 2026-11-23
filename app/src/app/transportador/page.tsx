import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { TransporterClient } from "@/components/TransporterClient";

export const dynamic = "force-dynamic";

export default async function TransportadorPage() {
  const session = await getCurrentSession();
  return (
    <AppShell
      activeUser={session}
      title="Portal y Hoja de Ruta del Transportador Aliado"
      subtitle="Rutas compartidas rentables: conozca peso confirmado, paradas exactas, tarifa total pactada y reglas de espera/cancelación antes de encender el motor."
    >
      <TransporterClient />
    </AppShell>
  );
}
