import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { buildProducerHarvestWhatsAppMessage } from "@/adapters/whatsapp";
import { formatDateCO, formatDateTimeCO } from "@/lib/format";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedProducerId = url.searchParams.get("producerId");
  const session = await getCurrentSession();

  let producer = null;
  if (requestedProducerId) {
    producer = await prisma.producer.findUnique({
      where: { id: requestedProducerId },
      include: { user: true, association: { include: { collectionPoints: true } }, zone: true },
    });
  } else if (session?.role === "PRODUCER" || session?.role === "ASSOCIATION_LEADER") {
    producer = await prisma.producer.findUnique({
      where: { userId: session.userId },
      include: { user: true, association: { include: { collectionPoints: true } }, zone: true },
    });
  }

  if (!producer) {
    // Default to Don Luis Rodríguez (Ventaquemada, Boyacá — Manual de Marca)
    producer = await prisma.producer.findFirst({
      where: { uniqueCode: "PROD-BOY-001" },
      include: { user: true, association: { include: { collectionPoints: true } }, zone: true },
    });
  }

  if (!producer) {
    return NextResponse.json({ error: "Productor no encontrado" }, { status: 404 });
  }

  const [allProducers, assignments, sowingDeclarations, settlements, products] = await Promise.all([
    prisma.producer.findMany({
      include: { user: { select: { fullName: true } }, zone: { select: { municipality: true } } },
      orderBy: { uniqueCode: "asc" },
    }),
    prisma.harvestAssignment.findMany({
      where: { producerId: producer.id },
      include: {
        product: true,
        collectionPoint: true,
        zone: true,
        lot: true,
      },
      orderBy: { pickupDatetime: "desc" },
    }),
    prisma.sowingDeclaration.findMany({
      where: { producerId: producer.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.findMany({
      where: { counterpartyType: "PRODUCER", counterpartyId: producer.id },
      orderBy: { dueDate: "desc" },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const assignmentIds = assignments.map((a) => a.id);
  const evidences = await prisma.messageEvidence.findMany({
    where: { entityType: "HARVEST_ASSIGNMENT", entityId: { in: assignmentIds } },
    orderBy: { createdAt: "asc" },
  });

  const enrichedAssignments = assignments.map((a) => {
    const wa = buildProducerHarvestWhatsAppMessage({
      assignmentId: a.id,
      assignmentCode: a.assignmentCode,
      producerName: producer!.user.fullName,
      producerPhone: producer!.user.phone,
      productName: a.product.name,
      assignedKg: a.assignedKg,
      producerPricePerKgCop: a.producerPricePerKgCop,
      pickupDateLabel: formatDateTimeCO(a.pickupDatetime),
      collectionPointName: a.collectionPoint.name,
      paymentDueDateLabel: formatDateCO(a.paymentDueDate),
    });
    return {
      ...a,
      whatsappPreview: wa,
      evidences: evidences.filter((e) => e.entityId === a.id),
    };
  });

  const totalEarnedCop = settlements
    .filter((s) => s.status === "PAID")
    .reduce((sum, s) => sum + s.netAmountCop, 0);
  const pendingPayCop = settlements
    .filter((s) => s.status !== "PAID")
    .reduce((sum, s) => sum + s.netAmountCop, 0);

  return NextResponse.json({
    producer,
    allProducers: allProducers.map((p) => ({
      id: p.id,
      uniqueCode: p.uniqueCode,
      fullName: p.user.fullName,
      municipality: p.zone.municipality,
      primaryChannel: p.primaryChannel,
      paymentTerm: p.paymentTerm,
    })),
    assignments: enrichedAssignments,
    sowingDeclarations,
    settlements,
    products,
    summary: {
      totalEarnedCop,
      pendingPayCop,
      completedDeliveries: assignments.filter((a) => a.status === "WEIGHED").length,
      fulfillmentScore: producer.fulfillmentScore,
    },
  });
}
