import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OpsControlTowerClient } from "@/components/OpsControlTowerClient";

export const dynamic = "force-dynamic";

export default async function OperacionesPage() {
  const session = await getCurrentSession();
  return (
    <AppShell
      activeUser={session}
      title="Torre de Control Operativa, Economía Unitaria y Analítica"
      subtitle="Núcleo tecnológico de Ruta Fresca (Regla R4): agregación semanal, reparto en ≥ 2 zonas climáticas, ruteo compartido con margen/kg en vivo, respaldo Corabastos y las 5 preguntas analíticas."
    >
      <OpsControlTowerClient />
    </AppShell>
  );
}
