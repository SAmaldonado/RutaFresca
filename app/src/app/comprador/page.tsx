import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { BuyerPortalClient } from "@/components/BuyerPortalClient";

export const dynamic = "force-dynamic";

export default async function CompradorPage() {
  const session = await getCurrentSession();
  return (
    <AppShell
      activeUser={session}
      title="Portal del Comprador Institucional"
      subtitle="Precios pactados por ciclo, pedidos semanales con ajuste controlado, garantía de reposición 11/11 y soporte de origen campesino (Ley 2046)."
    >
      <BuyerPortalClient />
    </AppShell>
  );
}
