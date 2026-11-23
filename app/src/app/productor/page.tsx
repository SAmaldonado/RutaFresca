import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ProducerPortalClient } from "@/components/ProducerPortalClient";

export const dynamic = "force-dynamic";

export default async function ProductorPage() {
  const session = await getCurrentSession();
  return (
    <AppShell
      activeUser={session}
      title="Espacio del Productor y Asociación"
      subtitle="Diseñado sin tecnicismos: confirme sus pedidos por botón, WhatsApp o nota de voz, descargue su boleta impresa y consulte sus pagos."
    >
      <ProducerPortalClient />
    </AppShell>
  );
}
