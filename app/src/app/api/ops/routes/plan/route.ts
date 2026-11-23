import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { planSharedRoute } from "@/domain/routing";
import type { GeoPoint, TariffModel } from "@/domain/types";

const routePlanSchema = z.object({
  transporterId: z.string(),
  collectionPointIds: z.array(z.string()).min(1),
  buyerOrgIds: z.array(z.string()).min(1),
  totalKgOverride: z.number().positive().optional(),
  simulatedCommissionPct: z.number().min(0).max(0.15).default(0.03),
  includeSubscriptionProration: z.boolean().default(true),
  isPilotZeroCommission: z.boolean().default(false),
  persist: z.boolean().default(false),
  deliveryWeek: z.string().default("2026-W48"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = routePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parámetros de ruta inválidos" }, { status: 400 });
    }

    const d = parsed.data;
    const [transporter, cps, buyers] = await Promise.all([
      prisma.transporter.findUnique({
        where: { id: d.transporterId },
        include: { user: true },
      }),
      prisma.collectionPoint.findMany({
        where: { id: { in: d.collectionPointIds } },
        include: { association: true },
      }),
      prisma.buyerOrg.findMany({
        where: { id: { in: d.buyerOrgIds } },
      }),
    ]);

    if (!transporter || cps.length === 0 || buyers.length === 0) {
      return NextResponse.json(
        { error: "Seleccione un transportador, al menos 1 acopio y 1 comedor." },
        { status: 404 }
      );
    }

    const targetKg = d.totalKgOverride ?? Math.min(transporter.capacityKg * 0.8, buyers.length * 420);
    const kgPerPickup = Math.round((targetKg / cps.length) * 10) / 10;
    const kgPerBuyer = Math.round((targetKg / buyers.length) * 10) / 10;

    const pickupStops: GeoPoint[] = cps.map((cp, idx) => ({
      id: cp.id,
      label: cp.name,
      lat: cp.lat,
      lng: cp.lng,
      kg: kgPerPickup,
      stopType: "PICKUP_ACOPIO",
      address: cp.veredaAddress,
      scheduledTime: idx === 0 ? "05:30" : "06:30",
    }));

    const deliveryStops: GeoPoint[] = buyers.map((b, idx) => ({
      id: b.id,
      label: b.name,
      lat: b.lat,
      lng: b.lng,
      kg: kgPerBuyer,
      stopType: "DELIVERY_BUYER",
      address: b.address,
      scheduledTime: `07:${String(15 + idx * 15).padStart(2, "0")}`,
    }));

    // Estimate average merchandise value ~$2.750/kg (blend of catalog)
    const estMerchandiseCop = Math.round(targetKg * 2750);
    const commissionRevenueCop = d.isPilotZeroCommission
      ? 0
      : Math.round(estMerchandiseCop * d.simulatedCommissionPct);
    const proratedSubRevCop =
      !d.isPilotZeroCommission && d.includeSubscriptionProration
        ? Math.round((350000 / 4) * buyers.length)
        : 0;

    const planned = planSharedRoute({
      transporter: {
        capacityKg: transporter.capacityKg,
        maxDetourKm: transporter.maxDetourKm,
        preferredTariffModel: transporter.preferredTariffModel as TariffModel,
        baseRateCop: transporter.baseRateCop,
        perKmRateCop: transporter.perKmRateCop,
        perKgRateCop: transporter.perKgRateCop,
        fixedRouteRateCop: transporter.fixedRouteRateCop,
        waitingFeePerHourCop: transporter.waitingFeePerHourCop,
        cancellationCompPct: transporter.cancellationCompPct,
        homeLat: transporter.homeLat,
        homeLng: transporter.homeLng,
      },
      pickupStops,
      deliveryStops,
      commissionRevenueCop,
      proratedSubRevCop,
      isPilotZeroCommission: d.isPilotZeroCommission,
    });

    let createdRoute = null;
    if (d.persist) {
      const routeCode = `RUT-${d.deliveryWeek}-${String(Math.floor(10 + Math.random() * 89))}`;
      createdRoute = await prisma.route.create({
        data: {
          routeCode,
          routeDate: new Date("2026-11-24T05:30:00-05:00"),
          deliveryWeek: d.deliveryWeek,
          transporterId: transporter.id,
          status: "OFFERED",
          totalKg: planned.totalKg,
          vehicleUtilizationPct: planned.vehicleUtilizationPct,
          estimatedKm: planned.estimatedKm,
          detourKm: planned.detourKm,
          agreedTariffCop: planned.agreedTariffCop,
          grossCommissionRevCop: commissionRevenueCop,
          proratedSubRevCop,
          contributionMarginCop: planned.contributionMarginCop,
          marginPerKgCop: planned.marginPerKgCop,
          tariffModelUsed: transporter.preferredTariffModel,
          notes: `Ruta consolidada por Torre de Control (${planned.goNoGoStatus}).`,
          stops: {
            create: planned.orderedStops.map((s) => ({
              stopOrder: s.stopOrder,
              stopType: s.stopType,
              refId: s.id,
              label: s.label,
              address: s.address,
              lat: s.lat,
              lng: s.lng,
              scheduledTime: s.scheduledTime,
              kgAmount: s.kg,
              status: "PENDING",
            })),
          },
        },
        include: { stops: { orderBy: { stopOrder: "asc" } } },
      });
    }

    return NextResponse.json({
      ok: true,
      transporterName: transporter.user.fullName,
      planned,
      createdRoute,
    });
  } catch (err) {
    console.error("Plan route error:", err);
    return NextResponse.json({ error: "Error planificando ruta compartida" }, { status: 500 });
  }
}
