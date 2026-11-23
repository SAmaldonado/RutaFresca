import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { generateLotCode } from "@/domain/traceability";

const singleWeighSchema = z.object({
  harvestAssignmentId: z.string(),
  actualKg: z.number().min(0),
  qualityResult: z.enum(["APPROVED_STANDARD", "RECLASSIFIED_FUNCTIONAL", "REJECTED"]),
  rejectionReason: z.string().optional(),
  producerSignatureAck: z.boolean().default(true),
  captureChannel: z.string().default("ACOPIO_TABLET"),
  offlineSyncId: z.string().optional(),
});

const batchSchema = z.object({
  records: z.array(singleWeighSchema).min(1),
});

async function processWeighing(
  d: z.infer<typeof singleWeighSchema>,
  weigherUserId: string | null
) {
  // Idempotency for offline queue sync
  if (d.offlineSyncId) {
    const existingLot = await prisma.lot.findUnique({
      where: { offlineSyncId: d.offlineSyncId },
      include: { product: true, producer: { include: { user: true } } },
    });
    if (existingLot) {
      return { lot: existingLot, deduplicated: true, incident: null };
    }
  }

  const assignment = await prisma.harvestAssignment.findUnique({
    where: { id: d.harvestAssignmentId },
    include: {
      product: true,
      producer: { include: { user: true } },
      zone: true,
      collectionPoint: true,
      orderItem: { include: { weeklyOrder: true } },
    },
  });
  if (!assignment) {
    throw new Error(`Asignación no encontrada: ${d.harvestAssignmentId}`);
  }

  const existingCount = await prisma.lot.count();
  const lotCode = generateLotCode({
    deliveryWeek: assignment.deliveryWeek,
    zoneCode: assignment.zone.code,
    productSku: assignment.product.sku,
    sequence: existingCount + 1,
  });

  const lot = await prisma.lot.upsert({
    where: { harvestAssignmentId: assignment.id },
    create: {
      lotCode,
      qrPayload: `https://rutafresca.co/trazabilidad/${lotCode}`,
      harvestAssignmentId: assignment.id,
      producerId: assignment.producerId,
      associationId: assignment.associationId,
      zoneId: assignment.zoneId,
      collectionPointId: assignment.collectionPointId,
      productId: assignment.productId,
      farmName: assignment.producer.farmName,
      municipality: assignment.zone.municipality,
      harvestDate: new Date(),
      weighedAt: new Date(),
      requestedKg: assignment.assignedKg,
      actualKg: d.actualKg,
      qualityResult: d.qualityResult,
      rejectionReason: d.rejectionReason || null,
      weigherUserId,
      producerSignatureAck: d.producerSignatureAck,
      weeklyOrderId: assignment.orderItem?.weeklyOrderId ?? null,
      offlineSyncId: d.offlineSyncId ?? null,
      captureChannel: d.captureChannel,
    },
    update: {
      actualKg: d.actualKg,
      qualityResult: d.qualityResult,
      rejectionReason: d.rejectionReason || null,
      weighedAt: new Date(),
      producerSignatureAck: d.producerSignatureAck,
    },
    include: { product: true, producer: { include: { user: true } } },
  });

  await prisma.harvestAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "WEIGHED",
      boletaPrintedAt: new Date(),
    },
  });

  // Create producer settlement if approved
  if (d.qualityResult !== "REJECTED" && d.actualKg > 0) {
    const unitPrice =
      d.qualityResult === "RECLASSIFIED_FUNCTIONAL"
        ? Math.round(assignment.producerPricePerKgCop * 0.85)
        : assignment.producerPricePerKgCop;
    const gross = Math.round(d.actualKg * unitPrice);
    const payMethod =
      assignment.producer.paymentTerm === "CONTADO_MISMO_DIA"
        ? "EFECTIVO_ACOPIO"
        : "NEQUI";

    await prisma.settlement.create({
      data: {
        settlementCode: `LIQ-PR-${Math.floor(1000 + Math.random() * 9000)}`,
        counterpartyType: "PRODUCER",
        counterpartyId: assignment.producerId,
        counterpartyName: assignment.producer.user.fullName,
        referenceType: "HARVEST_ASSIGNMENT",
        referenceId: assignment.id,
        deliveryWeek: assignment.deliveryWeek,
        grossAmountCop: gross,
        commissionCop: 0,
        subscriptionCop: 0,
        netAmountCop: gross,
        dueDate: assignment.paymentDueDate,
        paymentMethod: payMethod,
        status: assignment.producer.paymentTerm === "CONTADO_MISMO_DIA" ? "PENDING" : "SCHEDULED",
      },
    });
  }

  // Auto-open incident on quality rejection or shortfall > 5%
  let incident = null;
  const shortfall = assignment.assignedKg - d.actualKg;
  if (d.qualityResult === "REJECTED" || shortfall > assignment.assignedKg * 0.05) {
    const affectedKg = d.qualityResult === "REJECTED" ? assignment.assignedKg : shortfall;
    incident = await prisma.incident.create({
      data: {
        incidentCode: `INC-${assignment.deliveryWeek}-${Math.floor(100 + Math.random() * 900)}`,
        weeklyOrderId: assignment.orderItem?.weeklyOrderId ?? null,
        buyerOrgId: assignment.orderItem?.weeklyOrder.buyerOrgId ?? null,
        orderItemId: assignment.orderItemId,
        lotId: lot.id,
        producerId: assignment.producerId,
        zoneId: assignment.zoneId,
        productId: assignment.productId,
        deliveryWeek: assignment.deliveryWeek,
        rootCause: "QUALITY_REJECTED_ACOPIO",
        affectedKg: Math.round(affectedKg * 10) / 10,
        description:
          d.qualityResult === "REJECTED"
            ? `Lote ${lot.lotCode} rechazado en acopio (${d.rejectionReason || "no cumple estándar"}).`
            : `Faltante en pesaje de ${Math.round(shortfall)} kg sobre orden ${assignment.assignmentCode}.`,
        resolutionType: "PENDING",
        status: "OPEN",
      },
    });
  }

  return { lot, deduplicated: false, incident };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session = await getCurrentSession();
    const weigherId = session?.userId ?? null;

    if (Array.isArray(body?.records)) {
      const parsed = batchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Lote de sincronización inválido" }, { status: 400 });
      }
      const results = [];
      for (const rec of parsed.data.records) {
        results.push(await processWeighing(rec, weigherId));
      }
      return NextResponse.json({ ok: true, syncedCount: results.length, results });
    }

    const parsed = singleWeighSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de pesaje inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const res = await processWeighing(parsed.data, weigherId);
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (err) {
    console.error("Weighing error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error registrando pesaje" },
      { status: 500 }
    );
  }
}
