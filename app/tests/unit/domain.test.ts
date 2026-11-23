import { describe, expect, it } from "vitest";
import {
  calculateOrderEconomics,
  computeCyclePriceBand,
  computeFunctionalPrice,
  simulateEconomicScenarios,
} from "@/domain/pricing";
import { allocateDemandMultiZone } from "@/domain/allocation";
import {
  calculateCancellationCompensation,
  calculateWaitingCompensation,
  planSharedRoute,
} from "@/domain/routing";
import {
  computeLey2046Compliance,
  generateLotCode,
  generateMessageHash,
  verifyMessageHash,
} from "@/domain/traceability";
import {
  computeProducerResponsibility,
  evaluateShortageResolution,
} from "@/domain/incidents";
import {
  buildPrescriptiveRecommendations,
  computeBuyerRetentionSignal,
  computeDemandVariability,
  computeDiagnosticBreakdown,
  computePilotKpis,
  computeSupplyRiskScore,
} from "@/domain/analytics";

describe("Ruta Fresca — Motores de Dominio (Reglas R1-R11)", () => {
  it("calcula bandas de precio SIPSA y alerta riesgo de venta a tercero", () => {
    const ok = computeCyclePriceBand(2200, 2100, 0.12);
    expect(ok.sideSellingRisk).toBe("LOW");

    const breach = computeCyclePriceBand(2950, 2300, 0.12);
    expect(breach.sideSellingRisk).toBe("HIGH");
    expect(breach.sipsaDeviationPct).toBeGreaterThan(20);
  });

  it("calcula precio de Calidad Funcional y economía en modo Piloto 0% vs Híbrido", () => {
    expect(computeFunctionalPrice(2000, 0.2)).toBe(1600);

    const pilot = calculateOrderEconomics({
      items: [
        { kg: 100, standardBuyerPriceCop: 2500, functionalDiscountPct: 0.2, qualityGrade: "STANDARD" },
        { kg: 100, standardBuyerPriceCop: 2000, functionalDiscountPct: 0.2, qualityGrade: "FUNCTIONAL" },
      ],
      pricingMode: "PILOT_0_PCT",
      commissionRate: 0.03,
      subscriptionFeeCop: 350000,
    });
    expect(pilot.commissionCop).toBe(0);
    expect(pilot.functionalSavingsCop).toBe(40000);
    expect(pilot.buyerTotalCop).toBe(410000);

    const hybrid = calculateOrderEconomics({
      items: [
        { kg: 200, standardBuyerPriceCop: 3000, functionalDiscountPct: 0.2, qualityGrade: "STANDARD" },
      ],
      pricingMode: "HYBRID_SUBSCRIPTION",
      commissionRate: 0.025,
      subscriptionFeeCop: 360000,
    });
    expect(hybrid.commissionCop).toBe(15000);
    expect(hybrid.proratedSubscriptionCop).toBe(90000);
    expect(hybrid.platformRevenueCop).toBe(105000);

    const scenarios = simulateEconomicScenarios({
      totalWeeklyMerchandiseCop: 12000000,
      totalKg: 3500,
      weeklyRouteCostCop: 620000,
      backupOvercostCop: 40000,
      activeBuyersCount: 6,
    });
    expect(scenarios.find((s) => s.id === "pilot-0")?.viable).toBe(false);
    expect(scenarios.find((s) => s.id === "hybrid-25-sub")?.viable).toBe(true);
  });

  it("reparte demanda en >=2 zonas climáticas distintas sin sesgar contra productores sin smartphone", () => {
    const result = allocateDemandMultiZone({
      totalDemandKg: 200,
      candidates: [
        {
          producerId: "p-boy-1",
          producerName: "Luis (Boyacá)",
          associationId: "a1",
          associationName: "Asoc Ventaquemada",
          zoneId: "z-boy",
          zoneName: "Ventaquemada",
          climateProfile: "ALTIPLANO_FRIO",
          collectionPointId: "cp1",
          availableKg: 200,
          fulfillmentScore: 98,
          hasFinagroInsurance: true,
          primaryChannel: "WHATSAPP_AUDIO",
          weatherSeverity: "HIGH", // Helada IDEAM reduce tope
        },
        {
          producerId: "p-cun-1",
          producerName: "Carmen (Cundinamarca)",
          associationId: "a2",
          associationName: "Asoc Sabana Verde",
          zoneId: "z-cun",
          zoneName: "Subachoque",
          climateProfile: "SABANA_TEMPLADO",
          collectionPointId: "cp2",
          availableKg: 200,
          fulfillmentScore: 97,
          hasFinagroInsurance: true,
          primaryChannel: "ACOPIO_PAPER", // Productora sin celular -> cero sesgo
          weatherSeverity: "LOW",
        },
      ],
    });

    expect(result.meetsMultiZoneClimateRule).toBe(true);
    expect(result.distinctClimatesUsed).toBe(2);
    expect(result.totalAssignedKg).toBe(200);
    const cunSlice = result.allocations.find((a) => a.producerId === "p-cun-1")!;
    const boySlice = result.allocations.find((a) => a.producerId === "p-boy-1")!;
    // Sabana sin helada recibe mayor parte que Ventaquemada con helada, pese a usar papel
    expect(cunSlice.assignedKg).toBeGreaterThan(boySlice.assignedKg);
    expect(result.channelDistribution["ACOPIO_PAPER"]).toBe(cunSlice.assignedKg);
  });

  it("planifica ruta compartida, verifica sobrecupo, espera, cancelación y margen/kg (Regla R2)", () => {
    const transporter = {
      capacityKg: 2000,
      maxDetourKm: 40,
      preferredTariffModel: "BASE_PLUS_KM" as const,
      baseRateCop: 120000,
      perKmRateCop: 1900,
      perKgRateCop: 240,
      fixedRouteRateCop: 300000,
      waitingFeePerHourCop: 36000,
      cancellationCompPct: 0.35,
      homeLat: 5.36,
      homeLng: -73.52,
    };

    const planned = planSharedRoute({
      transporter,
      pickupStops: [
        {
          id: "cp1",
          label: "Acopio Ventaquemada",
          lat: 5.3652,
          lng: -73.5219,
          kg: 900,
          stopType: "PICKUP_ACOPIO",
          address: "Ventaquemada",
          scheduledTime: "05:30",
        },
        {
          id: "cp2",
          label: "Acopio Subachoque",
          lat: 4.9285,
          lng: -74.1731,
          kg: 800,
          stopType: "PICKUP_ACOPIO",
          address: "Subachoque",
          scheduledTime: "06:45",
        },
      ],
      deliveryStops: [
        {
          id: "b1",
          label: "Comedor Andina",
          lat: 4.6562,
          lng: -74.0578,
          kg: 900,
          stopType: "DELIVERY_BUYER",
          address: "Chapinero",
          scheduledTime: "07:45",
        },
        {
          id: "b2",
          label: "Campus Central",
          lat: 4.6368,
          lng: -74.0836,
          kg: 800,
          stopType: "DELIVERY_BUYER",
          address: "Teusaquillo",
          scheduledTime: "08:15",
        },
      ],
      commissionRevenueCop: 680000,
      proratedSubRevCop: 150000,
      waitingMinutesTotal: 60, // 30 min cobrables = $18.000
    });

    expect(planned.totalKg).toBe(1700);
    expect(planned.waitingCompCop).toBe(18000);
    expect(planned.goNoGoStatus).toBe("GO_POSITIVE");
    expect(planned.marginPerKgCop).toBeGreaterThan(0);

    expect(calculateWaitingCompensation(25, 36000)).toBe(0);
    expect(calculateWaitingCompensation(90, 36000)).toBe(36000);
    expect(calculateCancellationCompensation(400000, 0.35)).toBe(140000);
  });

  it("genera códigos de lote, verifica hashes Ley 527 y calcula cumplimiento Ley 2046", () => {
    const code = generateLotCode({
      deliveryWeek: "2026-W48",
      zoneCode: "BOY-VEN",
      productSku: "LEC-BAT",
      sequence: 7,
    });
    expect(code).toBe("RF-2026W48-BOY-LEC-007");

    const payload = {
      entityType: "HARVEST_ASSIGNMENT",
      entityId: "asg-1",
      senderPhone: "+573115001001",
      messageBody: "Sí cumplo 60 kg lechuga",
      timestampIso: "2026-11-22T10:00:00.000Z",
    };
    const hash = generateMessageHash(payload);
    expect(verifyMessageHash(payload, hash)).toBe(true);
    expect(verifyMessageHash({ ...payload, messageBody: "Alterado" }, hash)).toBe(false);

    const ley = computeLey2046Compliance({
      lots: [
        {
          lotCode: code,
          producerId: "p1",
          associationId: "a1",
          actualKg: 400,
          unitBuyerPriceCop: 2500,
          qualityResult: "APPROVED_STANDARD",
        },
      ],
      totalInstitutionalFoodBudgetCop: 2500000,
    });
    expect(ley.acfcSharePct).toBe(40);
    expect(ley.meetsStatutory30Pct).toBe(true);
    expect(ley.eligibleFor10PctTenderBonus).toBe(true);
  });

  it("exime patrimonialmente al productor en evento climático y prioriza sustituto/Corabastos con tope", () => {
    const climateResp = computeProducerResponsibility("CLIMATE_CERTIFIED");
    expect(climateResp.financialPenaltyApplies).toBe(false);
    expect(climateResp.scoreDelta).toBe(0);

    const subPlan = evaluateShortageResolution({
      affectedKg: 30,
      agreedBuyerPriceCop: 2450,
      corabastosMarketPriceCop: 3900,
      secondZoneAvailableKg: 0,
      availableSubstitutes: [
        { productId: "esp", productName: "Espinaca", autoApproveIfShortage: true },
      ],
      rootCause: "CLIMATE_CERTIFIED",
    });
    expect(subPlan.recommendedResolution).toBe("PREAGREED_SUBSTITUTE");
    expect(subPlan.corabastosOvercostCop).toBe(0);

    const backupPlan = evaluateShortageResolution({
      affectedKg: 100,
      agreedBuyerPriceCop: 2500,
      corabastosMarketPriceCop: 4500,
      overcostCapCop: 120000,
      secondZoneAvailableKg: 0,
      availableSubstitutes: [],
      rootCause: "QUALITY_REJECTED_ACOPIO",
    });
    expect(backupPlan.recommendedResolution).toBe("CORABASTOS_BACKUP");
    expect(backupPlan.corabastosOvercostCop).toBe(200000);
    expect(backupPlan.platformAbsorbedCop).toBe(120000);
  });

  it("calcula KPIs del piloto y responde las 5 preguntas analíticas", () => {
    const kpis = computePilotKpis({
      totalLinkedBuyers: 6,
      buyersWithOrderIn14Days: 5,
      activeBuyersThisMonth: 6,
      retainedBuyersMonthOverMonth: 5,
      totalOrdersLast4Weeks: 25,
      receipts: [
        { otifOnTime: true, otifInFull: true, wasteMermaKg: 5 },
        { otifOnTime: true, otifInFull: true, wasteMermaKg: 8 },
        { otifOnTime: true, otifInFull: false, wasteMermaKg: 12 },
      ],
      totalKgDelivered: 1200,
      rescuedFunctionalKg: 250,
      routes: [{ totalKg: 1200, contributionMarginCop: 180000 }],
    });
    expect(kpis.activationRatePct).toBeCloseTo(83.3, 1);
    expect(kpis.mermaPct).toBeLessThan(5);
    expect(kpis.avgMarginPerKgCop).toBe(150);

    const variability = computeDemandVariability([
      { productName: "Lechuga", week: "W45", kg: 100 },
      { productName: "Lechuga", week: "W46", kg: 120 },
    ]);
    expect(variability[0].meanWeeklyKg).toBe(110);

    const diag = computeDiagnosticBreakdown([
      { rootCause: "CLIMATE_CERTIFIED", affectedKg: 40 },
      { rootCause: "QUALITY_REJECTED_ACOPIO", affectedKg: 20 },
    ]);
    expect(diag[0].rootCause).toBe("CLIMATE_CERTIFIED");

    const risk = computeSupplyRiskScore({
      zoneName: "Ventaquemada",
      productName: "Lechuga",
      weatherSeverity: "HIGH",
      sipsaBreachPct: 18,
      historicalIncidents: 1,
    });
    expect(risk.riskLevel).toBe("ALTO");

    const ret = computeBuyerRetentionSignal({
      buyerName: "Comedor Andina",
      earlyOrdersCount: 3,
      otifExperiencedPct: 95,
      incidentsCount: 1,
      unresolvedIncidentsCount: 0,
    });
    expect(ret.signalLabel).toBe("ALTA_RETENCION");

    const presc = buildPrescriptiveRecommendations({
      highRiskSupply: [risk],
      avgVehicleUtilizationPct: 62,
      avgMarginPerKgCop: -50,
      offlineChannelSharePct: 10,
    });
    expect(presc.length).toBeGreaterThanOrEqual(3);
  });
});
