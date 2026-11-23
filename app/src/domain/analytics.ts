export interface PilotKpiSnapshot {
  activationRatePct: number; // Meta >= 60%
  ordersPerBuyerPerMonth: number; // Meta >= 4
  monthlyRetentionPct: number; // Meta >= 80%
  otifRatePct: number; // Meta >= 92%
  mermaPct: number; // Meta <= 5%
  avgMarginPerKgCop: number; // Meta > 0 post-piloto
  totalKgDelivered: number;
  rescuedFunctionalKg: number;
  estimatedCo2AvoidedKg: number;
}

export interface DemandVariabilityRow {
  productName: string;
  weeklyTotalsKg: number[];
  meanWeeklyKg: number;
  cvPct: number; // Coeficiente de variación %
}

export interface DiagnosticCauseRow {
  rootCause: string;
  incidentsCount: number;
  affectedKg: number;
  sharePct: number;
}

export interface SupplyRiskRow {
  zoneName: string;
  productName: string;
  weatherSeverity: "LOW" | "MEDIUM" | "HIGH";
  sipsaBreachPct: number;
  historicalIncidents: number;
  riskScore: number; // 0-100
  riskLevel: "BAJO" | "MEDIO" | "ALTO";
}

export interface BuyerRetentionSignalRow {
  buyerName: string;
  earlyOrdersCount: number;
  otifExperiencedPct: number;
  incidentsCount: number;
  retentionProbabilityPct: number;
  signalLabel: "ALTA_RETENCION" | "MONITOREAR" | "RIESGO_FUGA";
}

export interface PrescriptiveAction {
  priority: "ALTA" | "MEDIA";
  title: string;
  impactEstimate: string;
  detail: string;
}

export function computePilotKpis(input: {
  totalLinkedBuyers: number;
  buyersWithOrderIn14Days: number;
  activeBuyersThisMonth: number;
  retainedBuyersMonthOverMonth: number;
  totalOrdersLast4Weeks: number;
  receipts: Array<{ otifOnTime: boolean; otifInFull: boolean; wasteMermaKg: number }>;
  totalKgDelivered: number;
  rescuedFunctionalKg: number;
  routes: Array<{ totalKg: number; contributionMarginCop: number }>;
}): PilotKpiSnapshot {
  const activationRatePct =
    input.totalLinkedBuyers > 0
      ? Math.round((input.buyersWithOrderIn14Days / input.totalLinkedBuyers) * 1000) / 10
      : 0;
  const ordersPerBuyerPerMonth =
    input.activeBuyersThisMonth > 0
      ? Math.round((input.totalOrdersLast4Weeks / input.activeBuyersThisMonth) * 10) / 10
      : 0;
  const monthlyRetentionPct =
    input.activeBuyersThisMonth > 0
      ? Math.round((input.retainedBuyersMonthOverMonth / input.activeBuyersThisMonth) * 1000) / 10
      : 0;

  const otifOk = input.receipts.filter((r) => r.otifOnTime && r.otifInFull).length;
  const otifRatePct =
    input.receipts.length > 0
      ? Math.round((otifOk / input.receipts.length) * 1000) / 10
      : 100;

  const totalWaste = input.receipts.reduce((s, r) => s + r.wasteMermaKg, 0);
  const mermaPct =
    input.totalKgDelivered > 0
      ? Math.round((totalWaste / input.totalKgDelivered) * 1000) / 10
      : 0;

  const totalRouteKg = input.routes.reduce((s, r) => s + r.totalKg, 0);
  const totalMargin = input.routes.reduce((s, r) => s + r.contributionMarginCop, 0);
  const avgMarginPerKgCop =
    totalRouteKg > 0 ? Math.round((totalMargin / totalRouteKg) * 10) / 10 : 0;

  // ~2.5 kg CO2e avoided per kg of rescued fresh produce (FAO/MinAmbiente reference)
  const estimatedCo2AvoidedKg = Math.round(
    (input.rescuedFunctionalKg + input.totalKgDelivered * 0.14) * 2.5
  );

  return {
    activationRatePct,
    ordersPerBuyerPerMonth,
    monthlyRetentionPct,
    otifRatePct,
    mermaPct,
    avgMarginPerKgCop,
    totalKgDelivered: Math.round(input.totalKgDelivered),
    rescuedFunctionalKg: Math.round(input.rescuedFunctionalKg),
    estimatedCo2AvoidedKg,
  };
}

export function computeDemandVariability(
  weeklyProductTotals: Array<{ productName: string; week: string; kg: number }>
): DemandVariabilityRow[] {
  const byProd = new Map<string, Map<string, number>>();
  for (const row of weeklyProductTotals) {
    if (!byProd.has(row.productName)) byProd.set(row.productName, new Map());
    const wm = byProd.get(row.productName)!;
    wm.set(row.week, (wm.get(row.week) ?? 0) + row.kg);
  }

  const results: DemandVariabilityRow[] = [];
  for (const [productName, weekMap] of byProd.entries()) {
    const vals = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => Math.round(v));
    const mean = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    const variance =
      vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, vals.length);
    const std = Math.sqrt(variance);
    const cvPct = mean > 0 ? Math.round((std / mean) * 1000) / 10 : 0;
    results.push({
      productName,
      weeklyTotalsKg: vals,
      meanWeeklyKg: Math.round(mean),
      cvPct,
    });
  }

  return results.sort((a, b) => b.meanWeeklyKg - a.meanWeeklyKg);
}

export function computeDiagnosticBreakdown(
  incidents: Array<{ rootCause: string; affectedKg: number }>
): DiagnosticCauseRow[] {
  const map = new Map<string, { count: number; kg: number }>();
  const totalKg = incidents.reduce((s, i) => s + i.affectedKg, 0);

  for (const inc of incidents) {
    const cur = map.get(inc.rootCause) ?? { count: 0, kg: 0 };
    cur.count += 1;
    cur.kg += inc.affectedKg;
    map.set(inc.rootCause, cur);
  }

  return Array.from(map.entries())
    .map(([rootCause, stats]) => ({
      rootCause,
      incidentsCount: stats.count,
      affectedKg: Math.round(stats.kg),
      sharePct: totalKg > 0 ? Math.round((stats.kg / totalKg) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.affectedKg - a.affectedKg);
}

export function computeSupplyRiskScore(params: {
  zoneName: string;
  productName: string;
  weatherSeverity: "LOW" | "MEDIUM" | "HIGH";
  sipsaBreachPct: number;
  historicalIncidents: number;
}): SupplyRiskRow {
  const weatherPts =
    params.weatherSeverity === "HIGH" ? 45 : params.weatherSeverity === "MEDIUM" ? 22 : 5;
  const pricePts = Math.min(35, Math.max(0, params.sipsaBreachPct * 1.4));
  const histPts = Math.min(20, params.historicalIncidents * 10);
  const riskScore = Math.min(100, Math.round(weatherPts + pricePts + histPts));
  const riskLevel = riskScore >= 60 ? "ALTO" : riskScore >= 30 ? "MEDIO" : "BAJO";
  return { ...params, riskScore, riskLevel };
}

export function computeBuyerRetentionSignal(params: {
  buyerName: string;
  earlyOrdersCount: number;
  otifExperiencedPct: number;
  incidentsCount: number;
  unresolvedIncidentsCount: number;
}): BuyerRetentionSignalRow {
  let score = 45;
  score += Math.min(30, params.earlyOrdersCount * 12);
  score += (params.otifExperiencedPct - 75) * 0.8;
  score -= params.incidentsCount * 4;
  score -= params.unresolvedIncidentsCount * 20;
  const retentionProbabilityPct = Math.max(10, Math.min(98, Math.round(score)));
  const signalLabel =
    retentionProbabilityPct >= 75
      ? "ALTA_RETENCION"
      : retentionProbabilityPct >= 55
      ? "MONITOREAR"
      : "RIESGO_FUGA";

  return {
    buyerName: params.buyerName,
    earlyOrdersCount: params.earlyOrdersCount,
    otifExperiencedPct: params.otifExperiencedPct,
    incidentsCount: params.incidentsCount,
    retentionProbabilityPct,
    signalLabel,
  };
}

export function buildPrescriptiveRecommendations(params: {
  highRiskSupply: SupplyRiskRow[];
  avgVehicleUtilizationPct: number;
  avgMarginPerKgCop: number;
  offlineChannelSharePct: number;
}): PrescriptiveAction[] {
  const actions: PrescriptiveAction[] = [];

  for (const hr of params.highRiskSupply.slice(0, 2)) {
    actions.push({
      priority: "ALTA",
      title: `Redistribuir ${hr.productName} fuera de ${hr.zoneName}`,
      impactEstimate: `Reduce riesgo de incumplimiento (${hr.riskScore}/100)`,
      detail: `Transferir al menos 65 % del volumen semanal a la zona climática alterna y pre-activar sustituto con el chef antes del corte.`,
    });
  }

  if (params.avgVehicleUtilizationPct < 75) {
    actions.push({
      priority: "ALTA",
      title: "Consolidar 2 comedores adicionales en ruta compartida Chapinero–Teusaquillo",
      impactEstimate: `Sube ocupación de ${params.avgVehicleUtilizationPct}% a >82% y baja costo/kg ~24%`,
      detail:
        "Mantener un solo día de entrega concentrado (martes 5:30–8:00 a. m.) evita viajes medio vacíos y mejora la rentabilidad del transportador.",
    });
  }

  if (params.avgMarginPerKgCop <= 0) {
    actions.push({
      priority: "ALTA",
      title: "Activar transición post-piloto a esquema Híbrido (2,5 % + Plan Abastecimiento)",
      impactEstimate: "Lleva el margen de contribución por kg a terreno positivo (>0)",
      detail:
        "Mantener comisión dentro de la banda aceptada por 7/11 compradores (1–4 %) y monetizar trazabilidad Ley 2046 + entregas prioritarias vía suscripción.",
    });
  }

  if (params.offlineChannelSharePct < 15) {
    actions.push({
      priority: "MEDIA",
      title: "Auditar participación de productores por llamada y boleta física",
      impactEstimate: "Previene sesgo de exclusión digital (Riesgo prioritario #2)",
      detail:
        "Asegurar que el gestor de acopio capture la disponibilidad de productores sin WhatsApp antes del reparto semanal.",
    });
  }

  return actions;
}
