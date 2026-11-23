import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { evaluateShortageResolution } from "@/domain/incidents";

const receiveSchema = z.object({
  receivedByName: z.string().min(2),
  otifOnTime: z.boolean(),
  otifInFull: z.boolean(),
  wasteMermaKg: z.number().min(0).default(0),
  notes: z.string().optional(),
  shortageProductId: z.string().optional(),
  shortageKg: z.number().min(0).optional(),
  shortageDescription: z.string().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = receiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de recepción inválidos" }, { status: 400 });
  }

  const order = await prisma.weeklyOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      buyerOrg: {
        include: {
          substituteRules: { include: { substituteProduct: true } },
        },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const totalKg = order.items.reduce((s, i) => s + i.adjustedKg, 0);
  const mermaPct =
    totalKg > 0 ? Math.round((parsed.data.wasteMermaKg / totalKg) * 1000) / 10 : 0;

  const receipt = await prisma.deliveryReceipt.upsert({
    where: { weeklyOrderId: order.id },
    create: {
      weeklyOrderId: order.id,
      otifOnTime: parsed.data.otifOnTime,
      otifInFull: parsed.data.otifInFull,
      wasteMermaKg: parsed.data.wasteMermaKg,
      wasteMermaPct: mermaPct,
      receivedByName: parsed.data.receivedByName,
      notes: parsed.data.notes || null,
      captureChannel: "WEB",
    },
    update: {
      otifOnTime: parsed.data.otifOnTime,
      otifInFull: parsed.data.otifInFull,
      wasteMermaKg: parsed.data.wasteMermaKg,
      wasteMermaPct: mermaPct,
      receivedByName: parsed.data.receivedByName,
      notes: parsed.data.notes || null,
    },
  });

  for (const item of order.items) {
    const missing =
      parsed.data.shortageProductId === item.productId ? parsed.data.shortageKg ?? 0 : 0;
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { deliveredKg: Math.max(0, item.adjustedKg - missing) },
    });
  }

  let createdIncident = null;
  let mitigationPlan = null;

  if (!parsed.data.otifInFull && parsed.data.shortageProductId && (parsed.data.shortageKg ?? 0) > 0) {
    const affectedItem = order.items.find((i) => i.productId === parsed.data.shortageProductId);
    const matchingSubs = order.buyerOrg.substituteRules
      .filter((r) => r.primaryProductId === parsed.data.shortageProductId)
      .map((r) => ({
        productId: r.substituteProductId,
        productName: r.substituteProduct.name,
        autoApproveIfShortage: r.autoApproveIfShortage,
      }));

    mitigationPlan = evaluateShortageResolution({
      affectedKg: parsed.data.shortageKg ?? 0,
      agreedBuyerPriceCop: affectedItem?.unitPriceCop ?? 2800,
      corabastosMarketPriceCop: Math.round((affectedItem?.unitPriceCop ?? 2800) * 1.35),
      secondZoneAvailableKg: 0,
      availableSubstitutes: matchingSubs,
      rootCause: "QUALITY_REJECTED_ACOPIO",
    });

    createdIncident = await prisma.incident.create({
      data: {
        incidentCode: `INC-${order.deliveryWeek}-${Math.floor(100 + Math.random() * 900)}`,
        weeklyOrderId: order.id,
        buyerOrgId: order.buyerOrgId,
        orderItemId: affectedItem?.id ?? null,
        productId: parsed.data.shortageProductId,
        deliveryWeek: order.deliveryWeek,
        rootCause: "QUALITY_REJECTED_ACOPIO",
        affectedKg: parsed.data.shortageKg ?? 0,
        description:
          parsed.data.shortageDescription ||
          `Novedad reportada en recepción por ${parsed.data.receivedByName}. Reposición solicitada bajo garantía 11/11.`,
        resolutionType: "PENDING",
        status: "OPEN",
      },
    });
  }

  await prisma.weeklyOrder.update({
    where: { id: order.id },
    data: {
      status: createdIncident ? "COMPLETED_WITH_INCIDENT" : "DELIVERED",
    },
  });

  return NextResponse.json({ ok: true, receipt, incident: createdIncident, mitigationPlan });
}
