import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCertificadoLey2046Pdf } from "@/adapters/pdf";
import { computeLey2046Compliance } from "@/domain/traceability";
import { formatDateCO } from "@/lib/format";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");

  const order = orderId
    ? await prisma.weeklyOrder.findUnique({
        where: { id: orderId },
        include: {
          buyerOrg: true,
          items: true,
          lots: {
            include: {
              product: true,
              producer: { include: { user: true } },
              association: true,
              zone: true,
            },
          },
        },
      })
    : await prisma.weeklyOrder.findFirst({
        where: { lots: { some: {} } },
        include: {
          buyerOrg: true,
          items: true,
          lots: {
            include: {
              product: true,
              producer: { include: { user: true } },
              association: true,
              zone: true,
            },
          },
        },
        orderBy: { deliveryDate: "desc" },
      });

  if (!order) {
    return NextResponse.json({ error: "Pedido con lotes trazables no encontrado" }, { status: 404 });
  }

  const priceByProd = new Map(order.items.map((i) => [i.productId, i.unitPriceCop]));
  const compliance = computeLey2046Compliance({
    lots: order.lots.map((l) => ({
      lotCode: l.lotCode,
      producerId: l.producerId,
      associationId: l.associationId,
      actualKg: l.actualKg,
      unitBuyerPriceCop: priceByProd.get(l.productId) ?? 2500,
      qualityResult: l.qualityResult,
    })),
  });

  const certId = `CERT-2046-${order.orderCode}`;
  const pdfBytes = await generateCertificadoLey2046Pdf({
    certificateId: certId,
    buyerName: order.buyerOrg.name,
    buyerSegment: order.buyerOrg.segment,
    buyerAddress: order.buyerOrg.address,
    orderCode: order.orderCode,
    deliveryWeek: order.deliveryWeek,
    deliveryDateLabel: formatDateCO(order.deliveryDate),
    acfcSpendCop: compliance.acfcVerifiedSpendCop,
    acfcSharePct: compliance.acfcSharePct,
    distinctProducers: compliance.distinctSmallholdersCount,
    distinctAssociations: compliance.distinctAssociationsCount,
    lots: order.lots.map((l) => ({
      lotCode: l.lotCode,
      productName: l.product.name,
      producerName: l.producer.user.fullName,
      farmName: l.farmName,
      associationName: l.association?.name ?? "Independiente ACFC",
      municipality: l.municipality,
      harvestDateLabel: formatDateCO(l.harvestDate),
      actualKg: l.actualKg,
      qualityLabel:
        l.qualityResult === "RECLASSIFIED_FUNCTIONAL"
          ? "Calidad Funcional"
          : "Estándar Aprobado",
    })),
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${certId}.pdf"`,
    },
  });
}
