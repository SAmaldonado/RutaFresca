import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { computeLey2046Compliance } from "@/domain/traceability";
import { computeCyclePriceBand } from "@/domain/pricing";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedOrgId = url.searchParams.get("buyerOrgId");
  const session = await getCurrentSession();

  let buyerOrg = null;
  if (requestedOrgId) {
    buyerOrg = await prisma.buyerOrg.findUnique({
      where: { id: requestedOrgId },
      include: { user: true, zone: true },
    });
  } else if (session?.role === "BUYER") {
    buyerOrg = await prisma.buyerOrg.findUnique({
      where: { userId: session.userId },
      include: { user: true, zone: true },
    });
  }

  if (!buyerOrg) {
    // Fallback to Claudia (Comedor Empresarial Grupo Andina) for demo usability
    buyerOrg = await prisma.buyerOrg.findFirst({
      where: { code: "COMP-001" },
      include: { user: true, zone: true },
    });
  }

  if (!buyerOrg) {
    return NextResponse.json({ error: "No hay compradores configurados" }, { status: 404 });
  }

  const [allBuyers, activeCycle, substituteRules, orders, recentFeeds] = await Promise.all([
    prisma.buyerOrg.findMany({
      select: { id: true, code: true, name: true, segment: true, pricingMode: true },
      orderBy: { code: "asc" },
    }),
    prisma.priceCycle.findFirst({
      where: { isActive: true },
      include: {
        cyclePrices: {
          include: { product: true },
          orderBy: { product: { name: "asc" } },
        },
      },
    }),
    prisma.buyerSubstituteRule.findMany({
      where: { buyerOrgId: buyerOrg.id },
      include: { primaryProduct: true, substituteProduct: true },
      orderBy: { priorityOrder: "asc" },
    }),
    prisma.weeklyOrder.findMany({
      where: { buyerOrgId: buyerOrg.id },
      include: {
        items: { include: { product: true } },
        lots: {
          include: {
            product: true,
            producer: { include: { user: true } },
            association: true,
            zone: true,
          },
        },
        deliveryReceipt: true,
        incidents: { include: { product: true, substituteProduct: true, backupPurchase: true } },
      },
      orderBy: { deliveryDate: "desc" },
    }),
    prisma.externalMarketFeed.findMany({
      orderBy: { recordedDate: "desc" },
      take: 14,
    }),
  ]);

  const latestSipsaMap = new Map<string, number>();
  for (const f of recentFeeds) {
    if (!latestSipsaMap.has(f.productId)) {
      latestSipsaMap.set(f.productId, f.sipsaPriceCop);
    }
  }

  const catalog = (activeCycle?.cyclePrices ?? []).map((cp) => {
    const liveSipsa = latestSipsaMap.get(cp.productId) ?? cp.sipsaRefPriceCop;
    const band = computeCyclePriceBand(liveSipsa, cp.agreedProducerPriceCop);
    return {
      productId: cp.productId,
      sku: cp.product.sku,
      name: cp.product.name,
      category: cp.product.category,
      iconKey: cp.product.iconKey,
      supportsFunctionalQuality: cp.product.supportsFunctionalQuality,
      functionalDiscountPct: cp.product.functionalDiscountPct,
      agreedBuyerPriceCop: cp.agreedBuyerPriceCop,
      functionalBuyerPriceCop: cp.functionalBuyerPriceCop,
      sipsaRefPriceCop: liveSipsa,
      bandStatus: band.sideSellingRisk,
    };
  });

  // Compute buyer KPIs & Ley 2046 compliance across delivered lots
  const allLots = orders.flatMap((o) => o.lots);
  const priceByProductId = new Map(catalog.map((c) => [c.productId, c.agreedBuyerPriceCop]));
  const ley2046 = computeLey2046Compliance({
    lots: allLots.map((l) => ({
      lotCode: l.lotCode,
      producerId: l.producerId,
      associationId: l.associationId,
      actualKg: l.actualKg,
      unitBuyerPriceCop: priceByProductId.get(l.productId) ?? 2500,
      qualityResult: l.qualityResult,
    })),
  });

  const receipts = orders.map((o) => o.deliveryReceipt).filter(Boolean);
  const otifOk = receipts.filter((r) => r!.otifOnTime && r!.otifInFull).length;
  const otifPct = receipts.length > 0 ? Math.round((otifOk / receipts.length) * 1000) / 10 : 100;
  const functionalKg = orders
    .flatMap((o) => o.items)
    .filter((i) => i.qualityGrade === "FUNCTIONAL")
    .reduce((s, i) => s + i.adjustedKg, 0);
  const totalKgOrdered = orders
    .flatMap((o) => o.items)
    .reduce((s, i) => s + i.adjustedKg, 0);

  return NextResponse.json({
    buyerOrg,
    allBuyers,
    activeCycle: activeCycle
      ? {
          id: activeCycle.id,
          code: activeCycle.code,
          name: activeCycle.name,
          startDate: activeCycle.startDate,
          endDate: activeCycle.endDate,
          ipcFoodPct: activeCycle.ipcFoodPct,
        }
      : null,
    catalog,
    substituteRules,
    orders,
    metrics: {
      otifPct,
      totalKgOrdered: Math.round(totalKgOrdered),
      functionalKg: Math.round(functionalKg),
      estimatedCo2AvoidedKg: Math.round((functionalKg + totalKgOrdered * 0.14) * 2.5),
      ley2046,
    },
  });
}
