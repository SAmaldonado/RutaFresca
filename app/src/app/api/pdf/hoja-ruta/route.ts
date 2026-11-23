import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateHojaRutaPdf } from "@/adapters/pdf";
import { formatDateCO } from "@/lib/format";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const routeId = url.searchParams.get("routeId");

  const route = routeId
    ? await prisma.route.findUnique({
        where: { id: routeId },
        include: {
          transporter: { include: { user: true } },
          stops: { orderBy: { stopOrder: "asc" } },
        },
      })
    : await prisma.route.findFirst({
        include: {
          transporter: { include: { user: true } },
          stops: { orderBy: { stopOrder: "asc" } },
        },
        orderBy: { routeDate: "desc" },
      });

  if (!route) {
    return NextResponse.json({ error: "Ruta no encontrada" }, { status: 404 });
  }

  const pdfBytes = await generateHojaRutaPdf({
    routeCode: route.routeCode,
    routeDateLabel: formatDateCO(route.routeDate),
    driverName: route.transporter.user.fullName,
    plateNumber: route.transporter.plateNumber,
    vehicleType: route.transporter.vehicleType,
    capacityKg: route.transporter.capacityKg,
    totalKg: route.totalKg,
    utilizationPct: route.vehicleUtilizationPct,
    estimatedKm: route.estimatedKm,
    detourKm: route.detourKm,
    agreedTariffCop: route.agreedTariffCop,
    tariffModel: route.tariffModelUsed,
    waitingFeePerHourCop: route.transporter.waitingFeePerHourCop,
    cancellationCompPct: route.transporter.cancellationCompPct,
    stops: route.stops.map((s) => ({
      stopOrder: s.stopOrder,
      stopType: s.stopType,
      label: s.label,
      address: s.address,
      scheduledTime: s.scheduledTime,
      kgAmount: s.kgAmount,
    })),
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Hoja_Ruta_${route.routeCode}.pdf"`,
    },
  });
}
