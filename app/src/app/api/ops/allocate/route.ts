import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { allocateDemandMultiZone } from "@/domain/allocation";
import { sendHarvestOrderViaWhatsApp } from "@/adapters/whatsapp";
import { formatDateCO, formatDateTimeCO } from "@/lib/format";
import type { CaptureChannel } from "@/domain/types";

const allocateSchema = z.object({
  productId: z.string(),
  demandKg: z.number().positive(),
  deliveryWeek: z.string().default("2026-W48"),
  persist: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = allocateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parámetros de asignación inválidos" }, { status: 400 });
    }

    const { productId, demandKg, deliveryWeek, persist } = parsed.data;
    const [product, cyclePrice, producers, weatherAlerts, sowingDecls] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.cyclePrice.findFirst({
        where: { productId, priceCycle: { isActive: true } },
      }),
      prisma.producer.findMany({
        include: {
          user: true,
          zone: true,
          association: { include: { collectionPoints: true } },
        },
      }),
      prisma.weatherAlert.findMany({ where: { isActive: true } }),
      prisma.sowingDeclaration.findMany({ where: { productId } }),
    ]);

    if (!product || !cyclePrice) {
      return NextResponse.json({ error: "Producto o precio de ciclo no encontrado" }, { status: 404 });
    }

    const fallbackCp = await prisma.collectionPoint.findFirst();
    const alertByZone = new Map(weatherAlerts.map((w) => [w.zoneId, w.severity]));
    const sowingByProd = new Map<string, number>();
    for (const s of sowingDecls) {
      sowingByProd.set(s.producerId, (sowingByProd.get(s.producerId) ?? 0) + s.estimatedKg);
    }

    const candidates = producers.map((p) => {
      const cp = p.association?.collectionPoints[0] ?? fallbackCp;
      const declaredKg = sowingByProd.get(p.id) ?? Math.round(p.hectares * 65);
      return {
        producerId: p.id,
        producerName: p.user.fullName,
        associationId: p.associationId,
        associationName: p.association?.name ?? "Productor independiente",
        zoneId: p.zoneId,
        zoneName: p.zone.municipality,
        climateProfile: p.zone.climateProfile,
        collectionPointId: cp?.id ?? "",
        availableKg: Math.max(40, declaredKg),
        fulfillmentScore: p.fulfillmentScore,
        hasFinagroInsurance: p.association?.hasFinagroInsurance ?? false,
        primaryChannel: p.primaryChannel as CaptureChannel,
        weatherSeverity: (alertByZone.get(p.zoneId) ?? "LOW") as "LOW" | "MEDIUM" | "HIGH",
      };
    });

    const plan = allocateDemandMultiZone({
      totalDemandKg: demandKg,
      candidates,
    });

    const createdAssignments = [];
    if (persist) {
      const pickupDate = new Date("2026-11-24T06:00:00-05:00");
      for (const slice of plan.allocations) {
        const prod = producers.find((p) => p.id === slice.producerId)!;
        const payDays =
          prod.paymentTerm === "CONTADO_MISMO_DIA"
            ? 0
            : prod.paymentTerm === "DAYS_1_3"
            ? 2
            : 8;
        const payDue = new Date(pickupDate.getTime() + payDays * 24 * 60 * 60 * 1000);
        const code = `COS-${deliveryWeek}-${product.sku.slice(0, 3)}-${Math.floor(
          100 + Math.random() * 900
        )}`;

        const asgn = await prisma.harvestAssignment.create({
          data: {
            assignmentCode: code,
            productId: product.id,
            producerId: prod.id,
            associationId: prod.associationId,
            zoneId: prod.zoneId,
            collectionPointId: slice.collectionPointId,
            deliveryWeek,
            assignedKg: slice.assignedKg,
            producerPricePerKgCop: cyclePrice.agreedProducerPriceCop,
            pickupDatetime: pickupDate,
            paymentDueDate: payDue,
            status: "SENT",
            captureChannel: prod.primaryChannel,
          },
          include: { collectionPoint: true },
        });

        const waRes = await sendHarvestOrderViaWhatsApp({
          assignmentId: asgn.id,
          assignmentCode: asgn.assignmentCode,
          producerName: prod.user.fullName,
          producerPhone: prod.user.phone,
          productName: product.name,
          assignedKg: slice.assignedKg,
          producerPricePerKgCop: cyclePrice.agreedProducerPriceCop,
          pickupDateLabel: formatDateTimeCO(pickupDate),
          collectionPointName: asgn.collectionPoint.name,
          paymentDueDateLabel: formatDateCO(payDue),
        });

        await prisma.messageEvidence.create({
          data: {
            entityType: "HARVEST_ASSIGNMENT",
            entityId: asgn.id,
            direction: "OUTBOUND",
            channel: prod.primaryChannel,
            senderPhone: "+573000000000",
            recipientPhone: prod.user.phone,
            messageBody: waRes.messageBody,
            audioTranscript: waRes.voiceScript,
            contentSha256Hash: waRes.contentSha256Hash,
          },
        });

        createdAssignments.push(asgn);
      }
    }

    return NextResponse.json({
      ok: true,
      productName: product.name,
      producerPricePerKgCop: cyclePrice.agreedProducerPriceCop,
      plan,
      createdAssignmentsCount: createdAssignments.length,
    });
  } catch (err) {
    console.error("Allocate error:", err);
    return NextResponse.json({ error: "Error en motor de asignación multi-zona" }, { status: 500 });
  }
}
