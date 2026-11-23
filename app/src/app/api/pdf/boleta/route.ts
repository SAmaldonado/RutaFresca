import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBoletaPedidoPdf } from "@/adapters/pdf";
import { generateMessageHash } from "@/domain/traceability";
import { formatDateCO, formatDateTimeCO } from "@/lib/format";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const producerId = url.searchParams.get("producerId");
  const week = url.searchParams.get("week") || "2026-W48";

  const producer = producerId
    ? await prisma.producer.findUnique({
        where: { id: producerId },
        include: { user: true, association: true, zone: true },
      })
    : await prisma.producer.findFirst({
        where: { uniqueCode: "PROD-BOY-001" },
        include: { user: true, association: true, zone: true },
      });

  if (!producer) {
    return NextResponse.json({ error: "Productor no encontrado" }, { status: 404 });
  }

  const assignments = await prisma.harvestAssignment.findMany({
    where: { producerId: producer.id, deliveryWeek: week },
    include: { product: true, collectionPoint: true, lot: true },
    orderBy: { createdAt: "asc" },
  });

  const first = assignments[0];
  const hash = generateMessageHash({
    entityType: "BOLETA_PEDIDO",
    entityId: `${producer.uniqueCode}-${week}`,
    senderPhone: producer.user.phone,
    messageBody: assignments.map((a) => `${a.product.name}:${a.assignedKg}`).join(","),
    timestampIso: new Date().toISOString().slice(0, 10),
  });

  const pdfBytes = await generateBoletaPedidoPdf({
    weekLabel: `Semana ${week.split("W")[1] || "48"} · noviembre de 2026`,
    producerName: producer.user.fullName,
    associationLabel: producer.association
      ? `${producer.association.municipality}, ${producer.zone.department}`
      : `${producer.vereda}, ${producer.zone.department}`,
    collectionPointName: first?.collectionPoint.name || "Salón comunal de la vereda",
    pickupDateLabel: first ? formatDateTimeCO(first.pickupDatetime) : "Martes 24, 6:00 a. m.",
    paymentDueDateLabel: first ? formatDateCO(first.paymentDueDate) : "2 de diciembre",
    verificationHash: hash,
    lines: assignments.map((a) => ({
      productName: a.product.name,
      assignedKg: a.assignedKg,
      pricePerKgCop: a.producerPricePerKgCop,
      actualKg: a.lot?.actualKg ?? null,
    })),
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Boleta_Pedido_${producer.uniqueCode}_${week}.pdf"`,
    },
  });
}
