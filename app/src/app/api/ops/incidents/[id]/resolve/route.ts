import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeProducerResponsibility } from "@/domain/incidents";
import type { IncidentRootCause } from "@/domain/types";

const resolveSchema = z.object({
  resolutionType: z.enum([
    "PREAGREED_SUBSTITUTE",
    "CORABASTOS_BACKUP",
    "SECOND_ZONE_REALLOCATION",
    "CREDIT_NOTE",
  ]),
  substituteProductId: z.string().optional(),
  corabastosVendor: z.string().optional(),
  corabastosMarketPriceCop: z.number().positive().optional(),
  overcostCapCop: z.number().positive().default(120000),
  slaResponseMinutes: z.number().int().min(1).default(24),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Resolución inválida" }, { status: 400 });
  }

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: { product: true, producer: true },
  });
  if (!incident) {
    return NextResponse.json({ error: "Incidencia no encontrada" }, { status: 404 });
  }

  const d = parsed.data;
  const respPolicy = computeProducerResponsibility(incident.rootCause as IncidentRootCause);

  let backupPurchase = null;
  if (d.resolutionType === "CORABASTOS_BACKUP") {
    const cp = await prisma.cyclePrice.findFirst({
      where: { productId: incident.productId, priceCycle: { isActive: true } },
    });
    const agreedPrice = cp?.agreedBuyerPriceCop ?? 2800;
    const marketPrice = d.corabastosMarketPriceCop ?? Math.round(agreedPrice * 1.35);
    const totalOvercost = Math.max(0, Math.round((marketPrice - agreedPrice) * incident.affectedKg));
    const absorbed = Math.min(d.overcostCapCop, totalOvercost);

    backupPurchase = await prisma.backupPurchase.upsert({
      where: { incidentId: incident.id },
      create: {
        incidentId: incident.id,
        corabastosVendor: d.corabastosVendor || "Bodega 14 · Mayorista Aliado La Sabana",
        productId: incident.productId,
        kg: incident.affectedKg,
        marketPriceCop: marketPrice,
        agreedPriceCop: agreedPrice,
        totalOvercostCop: totalOvercost,
        overcostCapCop: d.overcostCapCop,
        platformAbsorbedCop: absorbed,
      },
      update: {
        marketPriceCop: marketPrice,
        totalOvercostCop: totalOvercost,
        platformAbsorbedCop: absorbed,
      },
    });
  }

  // Update producer score ONLY if not a certified climate event (Phase 1/2 rule!)
  if (incident.producerId && respPolicy.scoreDelta !== 0 && incident.producer) {
    const nextScore = Math.max(
      40,
      Math.min(100, incident.producer.fulfillmentScore + respPolicy.scoreDelta)
    );
    await prisma.producer.update({
      where: { id: incident.producerId },
      data: { fulfillmentScore: nextScore },
    });
  }

  const updated = await prisma.incident.update({
    where: { id },
    data: {
      resolutionType: d.resolutionType,
      substituteProductId: d.substituteProductId || null,
      slaResponseMinutes: d.slaResponseMinutes,
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
    include: { product: true, substituteProduct: true, backupPurchase: true },
  });

  return NextResponse.json({
    ok: true,
    incident: updated,
    backupPurchase,
    responsibilityPolicy: respPolicy,
  });
}
