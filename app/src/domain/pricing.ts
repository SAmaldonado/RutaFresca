import type { PricingMode, QualityGrade } from "./types";

export interface PriceBandEvaluation {
  bandMinCop: number;
  bandMaxCop: number;
  sipsaDeviationPct: number;
  sideSellingRisk: "LOW" | "MEDIUM" | "HIGH";
  alertMessage: string;
}

export function computeCyclePriceBand(
  sipsaPriceCop: number,
  agreedProducerPriceCop: number,
  bandTolerancePct = 0.12
): PriceBandEvaluation {
  const bandMinCop = Math.round(agreedProducerPriceCop * (1 - bandTolerancePct));
  const bandMaxCop = Math.round(agreedProducerPriceCop * (1 + bandTolerancePct));
  const sipsaDeviationPct =
    agreedProducerPriceCop > 0
      ? Math.round(((sipsaPriceCop - agreedProducerPriceCop) / agreedProducerPriceCop) * 1000) / 10
      : 0;

  if (sipsaPriceCop > bandMaxCop) {
    return {
      bandMinCop,
      bandMaxCop,
      sipsaDeviationPct,
      sideSellingRisk: "HIGH",
      alertMessage: `Precio SIPSA supera la banda pactada (+${sipsaDeviationPct}%). Riesgo alto de venta a tercero; activar revisión de banda o pago de contado.`,
    };
  }
  if (sipsaPriceCop > agreedProducerPriceCop * (1 + bandTolerancePct * 0.65)) {
    return {
      bandMinCop,
      bandMaxCop,
      sipsaDeviationPct,
      sideSellingRisk: "MEDIUM",
      alertMessage: `Precio de plaza acercándose al techo de banda (+${sipsaDeviationPct}%). Monitorear confirmación con la asociación.`,
    };
  }
  return {
    bandMinCop,
    bandMaxCop,
    sipsaDeviationPct,
    sideSellingRisk: "LOW",
    alertMessage: `Precio pactado competitivo frente a SIPSA (${sipsaDeviationPct >= 0 ? "+" : ""}${sipsaDeviationPct}%).`,
  };
}

export function computeFunctionalPrice(
  standardBuyerPriceCop: number,
  discountPct = 0.2
): number {
  const clamped = Math.max(0, Math.min(0.5, discountPct));
  return Math.round(standardBuyerPriceCop * (1 - clamped));
}

export interface OrderPricingLine {
  kg: number;
  standardBuyerPriceCop: number;
  functionalDiscountPct: number;
  qualityGrade: QualityGrade;
}

export interface OrderEconomicsResult {
  totalKg: number;
  functionalKg: number;
  grossMerchandiseCop: number;
  functionalSavingsCop: number;
  commissionCop: number;
  proratedSubscriptionCop: number;
  platformRevenueCop: number;
  buyerTotalCop: number;
}

export function calculateOrderEconomics(params: {
  items: OrderPricingLine[];
  pricingMode: PricingMode;
  commissionRate: number;
  subscriptionFeeCop: number;
  weeksPerMonth?: number;
}): OrderEconomicsResult {
  const weeks = params.weeksPerMonth ?? 4;
  let totalKg = 0;
  let functionalKg = 0;
  let grossMerchandiseCop = 0;
  let functionalSavingsCop = 0;

  for (const item of params.items) {
    const kg = Math.max(0, item.kg);
    totalKg += kg;
    if (item.qualityGrade === "FUNCTIONAL") {
      functionalKg += kg;
      const funcUnit = computeFunctionalPrice(
        item.standardBuyerPriceCop,
        item.functionalDiscountPct
      );
      grossMerchandiseCop += Math.round(kg * funcUnit);
      functionalSavingsCop += Math.round(kg * (item.standardBuyerPriceCop - funcUnit));
    } else {
      grossMerchandiseCop += Math.round(kg * item.standardBuyerPriceCop);
    }
  }

  let commissionCop = 0;
  let proratedSubscriptionCop = 0;

  if (params.pricingMode === "COMMISSION_PCT") {
    commissionCop = Math.round(grossMerchandiseCop * Math.max(0, params.commissionRate));
  } else if (params.pricingMode === "HYBRID_SUBSCRIPTION") {
    commissionCop = Math.round(grossMerchandiseCop * Math.max(0, params.commissionRate));
    proratedSubscriptionCop = Math.round(Math.max(0, params.subscriptionFeeCop) / weeks);
  }

  const platformRevenueCop = commissionCop + proratedSubscriptionCop;

  return {
    totalKg,
    functionalKg,
    grossMerchandiseCop,
    functionalSavingsCop,
    commissionCop,
    proratedSubscriptionCop,
    platformRevenueCop,
    buyerTotalCop: grossMerchandiseCop + platformRevenueCop,
  };
}

export interface EconomicScenario {
  id: string;
  label: string;
  description: string;
  commissionPct: number;
  monthlySubscriptionCop: number;
  logisticsFeePerKgCop: number;
  weeklyRevenueCop: number;
  weeklyCostCop: number;
  contributionMarginCop: number;
  marginPerKgCop: number;
  viable: boolean;
  breakEvenKg: number;
}

export function simulateEconomicScenarios(params: {
  totalWeeklyMerchandiseCop: number;
  totalKg: number;
  weeklyRouteCostCop: number;
  backupOvercostCop: number;
  activeBuyersCount: number;
}): EconomicScenario[] {
  const { totalWeeklyMerchandiseCop, totalKg, weeklyRouteCostCop, backupOvercostCop, activeBuyersCount } = params;
  const safeKg = Math.max(1, totalKg);
  const avgPricePerKg = totalWeeklyMerchandiseCop / safeKg;
  const weeklyCostCop = weeklyRouteCostCop + backupOvercostCop;

  const definitions = [
    {
      id: "pilot-0",
      label: "Piloto Semanas 1–4 (0 %)",
      description: "Sin comisión para validar cumplimiento OTIF, costos reales y recompra.",
      commissionPct: 0,
      monthlySubscriptionCop: 0,
      logisticsFeePerKgCop: 0,
    },
    {
      id: "comm-3",
      label: "Comisión Validada 3 %",
      description: "Dentro de la banda 1–4 % elegida por 7/11 compradores en Fase 2.",
      commissionPct: 0.03,
      monthlySubscriptionCop: 0,
      logisticsFeePerKgCop: 0,
    },
    {
      id: "hybrid-25-sub",
      label: "Híbrido 2,5 % + Plan Abastecimiento ($350k/mes)",
      description: "Comisión baja (2,5 %) + suscripción mensual por precio fijo y certificado Ley 2046.",
      commissionPct: 0.025,
      monthlySubscriptionCop: 350000,
      logisticsFeePerKgCop: 0,
    },
    {
      id: "transparent-logistics",
      label: "Comisión 3 % + Flete Compartido ($220/kg)",
      description: "Comisión en rango validado (3 %) + flete consolidado visible para el comedor.",
      commissionPct: 0.03,
      monthlySubscriptionCop: 0,
      logisticsFeePerKgCop: 220,
    },
  ];

  return definitions.map((d) => {
    const commRev = Math.round(totalWeeklyMerchandiseCop * d.commissionPct);
    const subRev = Math.round((d.monthlySubscriptionCop / 4) * activeBuyersCount);
    const logRev = Math.round(safeKg * d.logisticsFeePerKgCop);
    const weeklyRevenueCop = commRev + subRev + logRev;
    const contributionMarginCop = weeklyRevenueCop - weeklyCostCop;
    const marginPerKgCop = Math.round((contributionMarginCop / safeKg) * 10) / 10;
    const revPerKg = avgPricePerKg * d.commissionPct + d.logisticsFeePerKgCop;
    const remainingFixed = Math.max(0, weeklyCostCop - subRev);
    const breakEvenKg = revPerKg > 0 ? Math.ceil(remainingFixed / revPerKg) : 0;

    return {
      ...d,
      weeklyRevenueCop,
      weeklyCostCop,
      contributionMarginCop,
      marginPerKgCop,
      viable: contributionMarginCop > 0,
      breakEvenKg,
    };
  });
}
