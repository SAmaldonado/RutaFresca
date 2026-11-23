import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { buildTransporterRouteWhatsAppUrl } from "@/adapters/whatsapp";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedId = url.searchParams.get("transporterId");
  const session = await getCurrentSession();

  let transporter = null;
  if (requestedId) {
    transporter = await prisma.transporter.findUnique({
      where: { id: requestedId },
      include: { user: true },
    });
  } else if (session?.role === "TRANSPORTER") {
    transporter = await prisma.transporter.findUnique({
      where: { userId: session.userId },
      include: { user: true },
    });
  }

  if (!transporter) {
    transporter = await prisma.transporter.findFirst({
      where: { code: "TRANS-001" },
      include: { user: true },
    });
  }

  if (!transporter) {
    return NextResponse.json({ error: "Transportador no encontrado" }, { status: 404 });
  }

  const [allTransporters, routes, settlements] = await Promise.all([
    prisma.transporter.findMany({
      include: { user: { select: { fullName: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.route.findMany({
      where: { transporterId: transporter.id },
      include: {
        stops: { orderBy: { stopOrder: "asc" } },
        lots: { include: { product: true } },
      },
      orderBy: { routeDate: "desc" },
    }),
    prisma.settlement.findMany({
      where: { counterpartyType: "TRANSPORTER", counterpartyId: transporter.id },
      orderBy: { dueDate: "desc" },
    }),
  ]);

  const enrichedRoutes = routes.map((r) => {
    const stopsSummary = r.stops
      .map((s) => `${s.stopOrder}. ${s.scheduledTime} ${s.label} (${s.kgAmount} kg)`)
      .join(" -> ");
    const wa = buildTransporterRouteWhatsAppUrl({
      driverPhone: transporter!.user.phone,
      driverName: transporter!.user.fullName,
      routeCode: r.routeCode,
      totalKg: r.totalKg,
      agreedTariffCop: r.agreedTariffCop,
      stopsSummary,
      cancellationCompPct: transporter!.cancellationCompPct,
    });
    return { ...r, whatsappShare: wa };
  });

  return NextResponse.json({
    transporter,
    allTransporters: allTransporters.map((t) => ({
      id: t.id,
      code: t.code,
      fullName: t.user.fullName,
      vehicleType: t.vehicleType,
      capacityKg: t.capacityKg,
      plateNumber: t.plateNumber,
    })),
    routes: enrichedRoutes,
    settlements,
  });
}
