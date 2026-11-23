import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPrescriptiveRecommendations,
  computeBuyerRetentionSignal,
  computeDemandVariability,
  computeDiagnosticBreakdown,
  computePilotKpis,
  computeSupplyRiskScore,
} from "@/domain/analytics";
import { computeCyclePriceBand, simulateEconomicScenarios } from "@/domain/pricing";

export async function GET() {
  const [
    buyers,
    producers,
    associations,
    collectionPoints,
    transporters,
    products,
    activeCycle,
    orders,
    assignments,
    lots,
    routes,
    receipts,
    incidents,
    settlements,
    weatherAlerts,
    marketFeeds,
    consents,
  ] = await Promise.all([
    prisma.buyerOrg.findMany({ include: { user: true, zone: true } }),
    prisma.producer.findMany({ include: { user: true, association: true, zone: true } }),
    prisma.association.findMany({ include: { zone: true } }),
    prisma.collectionPoint.findMany({ include: { association: true } }),
    prisma.transporter.findMany({ include: { user: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.priceCycle.findFirst({
      where: { isActive: true },
      include: { cyclePrices: { include: { product: true } } },
    }),
    prisma.weeklyOrder.findMany({
      include: {
        buyerOrg: true,
        items: { include: { product: true } },
        deliveryReceipt: true,
      },
      orderBy: { deliveryDate: "desc" },
    }),
    prisma.harvestAssignment.findMany({
      include: {
        product: true,
        producer: { include: { user: true } },
        association: true,
        zone: true,
        collectionPoint: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lot.findMany({
      include: { product: true, producer: { include: { user: true } }, zone: true },
      orderBy: { weighedAt: "desc" },
    }),
    prisma.route.findMany({
      include: {
        transporter: { include: { user: true } },
        stops: { orderBy: { stopOrder: "asc" } },
      },
      orderBy: { routeDate: "desc" },
    }),
    prisma.deliveryReceipt.findMany(),
    prisma.incident.findMany({
      include: {
        product: true,
        substituteProduct: true,
        buyerOrg: true,
        zone: true,
        producer: { include: { user: true } },
        backupPurchase: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.findMany({ orderBy: { dueDate: "asc" } }),
    prisma.weatherAlert.findMany({
      where: { isActive: true },
      include: { zone: true },
      orderBy: { severity: "asc" },
    }),
    prisma.externalMarketFeed.findMany({
      include: { product: true },
      orderBy: { recordedDate: "desc" },
    }),
    prisma.consentRecord.findMany({ include: { user: { select: { fullName: true, role: true } } } }),
  ]);

  // 1. Pilot KPIs
  const totalKgDelivered = lots
    .filter((l) => l.qualityResult !== "REJECTED")
    .reduce((s, l) => s + l.actualKg, 0);
  const rescuedFunctionalKg = orders
    .flatMap((o) => o.items)
    .filter((i) => i.qualityGrade === "FUNCTIONAL")
    .reduce((s, i) => s + i.adjustedKg, 0);

  const buyersWithOrders = new Set(orders.map((o) => o.buyerOrgId));
  const buyersWithRepeatOrders = buyers.filter(
    (b) => orders.filter((o) => o.buyerOrgId === b.id).length >= 2
  ).length;

  const pilotKpis = computePilotKpis({
    totalLinkedBuyers: buyers.length,
    buyersWithOrderIn14Days: buyersWithOrders.size,
    activeBuyersThisMonth: buyers.filter((b) => b.status === "ACTIVE").length,
    retainedBuyersMonthOverMonth: buyersWithRepeatOrders,
    totalOrdersLast4Weeks: orders.length,
    receipts: receipts.map((r) => ({
      otifOnTime: r.otifOnTime,
      otifInFull: r.otifInFull,
      wasteMermaKg: r.wasteMermaKg,
    })),
    totalKgDelivered,
    rescuedFunctionalKg,
    routes: routes.map((r) => ({
      totalKg: r.totalKg,
      contributionMarginCop: r.contributionMarginCop,
    })),
  });

  // 2. Q1 Descriptiva: Weekly demand variability by product
  const weeklyRows: Array<{ productName: string; week: string; kg: number }> = [];
  for (const o of orders) {
    for (const it of o.items) {
      weeklyRows.push({
        productName: it.product.name,
        week: o.deliveryWeek,
        kg: it.adjustedKg,
      });
    }
  }
  const q1Descriptiva = computeDemandVariability(weeklyRows);

  // 3. Q2 Diagnóstica: Root causes of non-compliance
  const q2Diagnostica = computeDiagnosticBreakdown(
    incidents.map((i) => ({ rootCause: i.rootCause, affectedKg: i.affectedKg }))
  );

  // 4. External SIPSA price band monitoring
  const latestSipsaByProduct = new Map<string, number>();
  for (const mf of marketFeeds) {
    if (!latestSipsaByProduct.has(mf.productId)) {
      latestSipsaByProduct.set(mf.productId, mf.sipsaPriceCop);
    }
  }

  const priceBands = (activeCycle?.cyclePrices ?? []).map((cp) => {
    const liveSipsa = latestSipsaByProduct.get(cp.productId) ?? cp.sipsaRefPriceCop;
    const evalBand = computeCyclePriceBand(liveSipsa, cp.agreedProducerPriceCop);
    return {
      productId: cp.productId,
      sku: cp.product.sku,
      productName: cp.product.name,
      agreedProducerPriceCop: cp.agreedProducerPriceCop,
      agreedBuyerPriceCop: cp.agreedBuyerPriceCop,
      sipsaPriceCop: liveSipsa,
      ...evalBand,
    };
  });

  // 5. Q3 Predictiva 1: Supply risk matrix (Zone x Product)
  const alertByZone = new Map(weatherAlerts.map((w) => [w.zoneId, w]));
  const ruralZones = Array.from(new Map(associations.map((a) => [a.zone.id, a.zone])).values());
  const topProducts = priceBands.slice(0, 5);
  const q3PredictivaOferta = [];
  for (const z of ruralZones) {
    const alert = alertByZone.get(z.id);
    const sev = (alert?.severity ?? "LOW") as "LOW" | "MEDIUM" | "HIGH";
    for (const pr of topProducts) {
      const histCount = incidents.filter(
        (i) => i.zoneId === z.id && i.productId === pr.productId
      ).length;
      q3PredictivaOferta.push(
        computeSupplyRiskScore({
          zoneName: z.municipality,
          productName: pr.productName,
          weatherSeverity: sev,
          sipsaBreachPct: Math.max(0, pr.sipsaDeviationPct),
          historicalIncidents: histCount,
        })
      );
    }
  }
  q3PredictivaOferta.sort((a, b) => b.riskScore - a.riskScore);

  // 6. Q4 Predictiva 2: Buyer early retention signals
  const q4PredictivaRetencion = buyers.map((b) => {
    const bOrders = orders.filter((o) => o.buyerOrgId === b.id);
    const bReceipts = bOrders.map((o) => o.deliveryReceipt).filter(Boolean);
    const otifOk = bReceipts.filter((r) => r!.otifOnTime && r!.otifInFull).length;
    const otifPct =
      bReceipts.length > 0 ? Math.round((otifOk / bReceipts.length) * 100) : 95;
    const bIncs = incidents.filter((i) => i.buyerOrgId === b.id);
    const openIncs = bIncs.filter((i) => i.status !== "RESOLVED").length;
    return computeBuyerRetentionSignal({
      buyerName: b.name,
      earlyOrdersCount: bOrders.length,
      otifExperiencedPct: otifPct,
      incidentsCount: bIncs.length,
      unresolvedIncidentsCount: openIncs,
    });
  });

  // 7. Channel equity / digital inclusion bias audit
  const kgByChannelMap = new Map<string, number>();
  let totalAssignedAll = 0;
  for (const a of assignments) {
    kgByChannelMap.set(a.captureChannel, (kgByChannelMap.get(a.captureChannel) ?? 0) + a.assignedKg);
    totalAssignedAll += a.assignedKg;
  }
  const channelEquityAudit = Array.from(kgByChannelMap.entries()).map(([channel, kg]) => ({
    channel,
    kg: Math.round(kg),
    sharePct: totalAssignedAll > 0 ? Math.round((kg / totalAssignedAll) * 1000) / 10 : 0,
  }));
  const offlineSharePct = channelEquityAudit
    .filter((c) => ["ACOPIO_PAPER", "PHONE_CALL", "WHATSAPP_AUDIO"].includes(c.channel))
    .reduce((s, c) => s + c.sharePct, 0);

  // 8. Q5 Prescriptiva
  const avgUtil =
    routes.length > 0
      ? Math.round(
          (routes.reduce((s, r) => s + r.vehicleUtilizationPct, 0) / routes.length) * 10
        ) / 10
      : 0;
  const q5Prescriptiva = buildPrescriptiveRecommendations({
    highRiskSupply: q3PredictivaOferta.filter((r) => r.riskLevel === "ALTO"),
    avgVehicleUtilizationPct: avgUtil,
    avgMarginPerKgCop: pilotKpis.avgMarginPerKgCop,
    offlineChannelSharePct: offlineSharePct,
  });

  // 9. Aggregated demand for current week (2026-W48)
  const w48Orders = orders.filter((o) => o.deliveryWeek === "2026-W48");
  const aggMap = new Map<
    string,
    {
      productId: string;
      sku: string;
      productName: string;
      demandKg: number;
      assignedKg: number;
      zonesAssigned: Set<string>;
      buyersCount: number;
    }
  >();

  for (const o of w48Orders) {
    for (const it of o.items) {
      const cur = aggMap.get(it.productId) ?? {
        productId: it.productId,
        sku: it.product.sku,
        productName: it.product.name,
        demandKg: 0,
        assignedKg: 0,
        zonesAssigned: new Set<string>(),
        buyersCount: 0,
      };
      cur.demandKg += it.adjustedKg;
      cur.buyersCount += 1;
      aggMap.set(it.productId, cur);
    }
  }
  for (const a of assignments.filter((x) => x.deliveryWeek === "2026-W48")) {
    const cur = aggMap.get(a.productId);
    if (cur) {
      cur.assignedKg += a.assignedKg;
      cur.zonesAssigned.add(a.zone.municipality);
    }
  }

  const w48Aggregation = Array.from(aggMap.values()).map((x) => ({
    productId: x.productId,
    sku: x.sku,
    productName: x.productName,
    demandKg: Math.round(x.demandKg),
    assignedKg: Math.round(x.assignedKg),
    unassignedKg: Math.max(0, Math.round(x.demandKg - x.assignedKg)),
    zonesAssigned: Array.from(x.zonesAssigned),
    meetsMultiZone: x.zonesAssigned.size >= 2,
    buyersCount: x.buyersCount,
  }));

  // 10. Economic Scenario Simulator based on W48 real volumes
  const w48MerchandiseCop = w48Orders
    .flatMap((o) => o.items)
    .reduce((s, it) => s + Math.round(it.adjustedKg * it.unitPriceCop), 0);
  const w48Kg = w48Orders
    .flatMap((o) => o.items)
    .reduce((s, it) => s + it.adjustedKg, 0);
  const economicScenarios = simulateEconomicScenarios({
    totalWeeklyMerchandiseCop: Math.max(w48MerchandiseCop, 6800000),
    totalKg: Math.max(w48Kg, 1850),
    weeklyRouteCostCop: 457600,
    backupOvercostCop: 35000,
    activeBuyersCount: buyers.filter((b) => b.status === "ACTIVE").length,
  });

  // 11. Map nodes for CorridorMap
  const mapNodes = [
    ...collectionPoints.map((cp) => {
      const zoneAlert = alertByZone.get(cp.association.zoneId);
      return {
        id: cp.id,
        label: cp.name,
        sublabel: `${cp.association.municipality} · ${cp.connectivityType}`,
        lat: cp.lat,
        lng: cp.lng,
        kind: "ACOPIO" as const,
        severity: (zoneAlert?.severity ?? "LOW") as "LOW" | "MEDIUM" | "HIGH",
      };
    }),
    ...buyers.slice(0, 4).map((b) => ({
      id: b.id,
      label: b.name,
      sublabel: b.address,
      lat: b.lat,
      lng: b.lng,
      kind: "BUYER" as const,
    })),
    {
      id: "corabastos-backup",
      label: "Corabastos (Respaldo)",
      sublabel: "Bodega 14 · Tope sobrecosto",
      lat: 4.6308,
      lng: -74.1558,
      kind: "CORABASTOS" as const,
    },
  ];

  return NextResponse.json({
    pilotKpis,
    analytics: {
      q1Descriptiva,
      q2Diagnostica,
      q3PredictivaOferta: q3PredictivaOferta.slice(0, 10),
      q4PredictivaRetencion,
      q5Prescriptiva,
      channelEquityAudit,
      offlineSharePct: Math.round(offlineSharePct * 10) / 10,
    },
    economicScenarios,
    w48Aggregation,
    priceBands,
    weatherAlerts,
    routes,
    incidents,
    settlements,
    buyers,
    producers,
    transporters,
    collectionPoints,
    products,
    consentsCount: {
      total: consents.length,
      active: consents.filter((c) => c.accepted && !c.revokedAt).length,
      readAloud: consents.filter((c) => c.readAloudByGestor).length,
      revoked: consents.filter((c) => Boolean(c.revokedAt)).length,
    },
    mapNodes,
  });
}
