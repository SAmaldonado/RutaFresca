import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { AcopioClient } from "@/components/AcopioClient";

export const dynamic = "force-dynamic";

export default async function AcopioPage() {
  const session = await getCurrentSession();
  return (
    <AppShell
      activeUser={session}
      title="Módulo de Punto de Acopio (Tableta Offline-First)"
      subtitle="Pesaje real en vereda, control de calidad, emisión de códigos de lote con QR, captura asistida para productores sin celular y sincronización sin señal."
    >
      <AcopioClient />
    </AppShell>
  );
}
