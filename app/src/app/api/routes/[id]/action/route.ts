import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  calculateCancellationCompensation,
  calculateWaitingCompensation,
} from "@/domain/routing";

const actionSchema = z.object({
  action: z.enum([
    "ACCEPT",
    "START",
    "STOP_ARRIVE",
    "STOP_COMPLETE",
    "COMPLETE",
    "CANCEL",
  ]),
  stopId: z.string().optional(),
  waitMinutes: z.number().min(0).optional(),
  reason: z.string().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción de ruta inválida" }, { status: 400 });
  }

  const route = await prisma.route.findUnique({
    where: { id },
    include: {
      transporter: { include: { user: true } },
      stops: { orderBy: { stopOrder: "asc" } },
    },
  });
  if (!route) {
    return NextResponse.json({ error: "Ruta no encontrada" }, { status: 404 });
  }

  const d = parsed.data;
  if (d.action === "ACCEPT") {
    const updated = await prisma.route.update({
      where: { id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    });
    return NextResponse.json({ ok: true, route: updated });
  }

  if (d.action === "START") {
    const updated = await prisma.route.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    });
    return NextResponse.json({ ok: true, route: updated });
  }

  if (d.action === "STOP_ARRIVE" && d.stopId) {
    await prisma.routeStop.update({
      where: { id: d.stopId },
      data: { status: "ARRIVED", arrivedAt: new Date() },
    });
    const updated = await prisma.route.findUnique({
      where: { id },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    });
    return NextResponse.json({ ok: true, route: updated });
  }

  if (d.action === "STOP_COMPLETE" && d.stopId) {
    const waitMin = d.waitMinutes ?? 10;
    await prisma.routeStop.update({
      where: { id: d.stopId },
      data: { status: "COMPLETED", departedAt: new Date(), waitMinutes: waitMin },
    });
    const allStops = await prisma.routeStop.findMany({ where: { routeId: id } });
    const totalWait = allStops.reduce((s, st) => s + st.waitMinutes, 0);
    const waitingCompCop = calculateWaitingCompensation(
      totalWait,
      route.transporter.waitingFeePerHourCop
    );
    const newMargin =
      route.grossCommissionRevCop +
      route.proratedSubRevCop -
      (route.agreedTariffCop + waitingCompCop + route.backupOvercostCop);

    const updated = await prisma.route.update({
      where: { id },
      data: {
        waitingMinutesTotal: totalWait,
        waitingCompCop,
        contributionMarginCop: newMargin,
        marginPerKgCop:
          route.totalKg > 0 ? Math.round((newMargin / route.totalKg) * 10) / 10 : 0,
      },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    });
    return NextResponse.json({ ok: true, route: updated });
  }

  if (d.action === "COMPLETE") {
    await prisma.routeStop.updateMany({
      where: { routeId: id, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", departedAt: new Date() },
    });
    const updated = await prisma.route.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    });

    const totalPay = updated.agreedTariffCop + updated.waitingCompCop;
    await prisma.settlement.create({
      data: {
        settlementCode: `LIQ-TR-${Math.floor(1000 + Math.random() * 9000)}`,
        counterpartyType: "TRANSPORTER",
        counterpartyId: route.transporterId,
        counterpartyName: route.transporter.user.fullName,
        referenceType: "ROUTE",
        referenceId: route.id,
        deliveryWeek: route.deliveryWeek,
        grossAmountCop: totalPay,
        commissionCop: 0,
        subscriptionCop: 0,
        netAmountCop: totalPay,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
        paymentMethod: "TRANSFERENCIA",
        status: "SCHEDULED",
      },
    });
    return NextResponse.json({ ok: true, route: updated });
  }

  if (d.action === "CANCEL") {
    const compCop = calculateCancellationCompensation(
      route.agreedTariffCop,
      route.transporter.cancellationCompPct
    );
    const updated = await prisma.route.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationCompCop: compCop,
        notes: `${route.notes || ""} | Cancelada (${d.reason || "sin motivo"}): compensación pactada $${compCop.toLocaleString("es-CO")}.`,
      },
      include: { stops: { orderBy: { stopOrder: "asc" } } },
    });

    await prisma.settlement.create({
      data: {
        settlementCode: `LIQ-TR-CANC-${Math.floor(100 + Math.random() * 900)}`,
        counterpartyType: "TRANSPORTER",
        counterpartyId: route.transporterId,
        counterpartyName: route.transporter.user.fullName,
        referenceType: "ROUTE",
        referenceId: route.id,
        deliveryWeek: route.deliveryWeek,
        grossAmountCop: compCop,
        commissionCop: 0,
        subscriptionCop: 0,
        netAmountCop: compCop,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
        paymentMethod: "NEQUI",
        status: "PENDING",
      },
    });
    return NextResponse.json({ ok: true, route: updated, cancellationCompCop: compCop });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
