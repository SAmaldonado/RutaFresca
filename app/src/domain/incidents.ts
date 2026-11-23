import type { IncidentResolution, IncidentRootCause } from "./types";

export interface ShortageMitigationPlan {
  recommendedResolution: IncidentResolution;
  substituteProductName?: string;
  corabastosOvercostCop: number;
  platformAbsorbedCop: number;
  overcostCapCop: number;
  buyerImpactCop: number;
  producerFinancialPenaltyCop: number;
  producerScorePenalty: number;
  explanation: string;
}

export function computeProducerResponsibility(rootCause: IncidentRootCause): {
  financialPenaltyApplies: boolean;
  scoreDelta: number;
  policyNote: string;
} {
  if (rootCause === "CLIMATE_CERTIFIED") {
    return {
      financialPenaltyApplies: false,
      scoreDelta: 0,
      policyNote:
        "Evento climático certificado: el productor NO responde con su patrimonio ni pierde reputación (se activa seguro Finagro / reparto multi-zona).",
    };
  }
  if (rootCause === "DIVERTED_SIDE_SELLING") {
    return {
      financialPenaltyApplies: false,
      scoreDelta: -12,
      policyNote:
        "Desvío por venta a otro comprador: reduce historial de cumplimiento (-12 pts) y alerta revisión de banda de precio.",
    };
  }
  if (rootCause === "QUALITY_REJECTED_ACOPIO") {
    return {
      financialPenaltyApplies: false,
      scoreDelta: -4,
      policyNote:
        "Rechazo de calidad en punto de acopio: acompañamiento técnico poscosecha y ajuste leve de reputación (-4 pts).",
    };
  }
  return {
    financialPenaltyApplies: false,
    scoreDelta: 0,
    policyNote: "Causa externa al productor; sin afectación en historial.",
  };
}

export function evaluateShortageResolution(params: {
  affectedKg: number;
  agreedBuyerPriceCop: number;
  corabastosMarketPriceCop: number;
  overcostCapCop?: number;
  secondZoneAvailableKg: number;
  availableSubstitutes: Array<{
    productId: string;
    productName: string;
    autoApproveIfShortage: boolean;
  }>;
  rootCause: IncidentRootCause;
}): ShortageMitigationPlan {
  const cap = params.overcostCapCop ?? 120000;
  const resp = computeProducerResponsibility(params.rootCause);

  // Priority 1: Second climatic zone reallocation (preserves origin + agreed price)
  if (params.secondZoneAvailableKg >= params.affectedKg && params.affectedKg > 0) {
    return {
      recommendedResolution: "SECOND_ZONE_REALLOCATION",
      corabastosOvercostCop: 0,
      platformAbsorbedCop: 0,
      overcostCapCop: cap,
      buyerImpactCop: 0,
      producerFinancialPenaltyCop: 0,
      producerScorePenalty: Math.abs(resp.scoreDelta),
      explanation: `Cubrir ${params.affectedKg} kg con la segunda zona climática (mantiene trazabilidad campesina y precio pactado sin sobrecosto).`,
    };
  }

  // Priority 2: Pre-agreed chef substitute (0 overcost, fast SLA)
  const autoSub = params.availableSubstitutes.find((s) => s.autoApproveIfShortage);
  if (autoSub) {
    return {
      recommendedResolution: "PREAGREED_SUBSTITUTE",
      substituteProductName: autoSub.productName,
      corabastosOvercostCop: 0,
      platformAbsorbedCop: 0,
      overcostCapCop: cap,
      buyerImpactCop: 0,
      producerFinancialPenaltyCop: 0,
      producerScorePenalty: Math.abs(resp.scoreDelta),
      explanation: `Activar sustituto pre-acordado con el chef: ${autoSub.productName} (garantiza continuidad del menú sin sobrecosto).`,
    };
  }

  // Priority 3: Backup purchase in Corabastos with platform cost cap
  const unitDiff = Math.max(0, params.corabastosMarketPriceCop - params.agreedBuyerPriceCop);
  const totalOvercost = Math.round(unitDiff * params.affectedKg);
  const absorbed = Math.min(cap, totalOvercost);
  const buyerImpact = Math.max(0, totalOvercost - absorbed);

  return {
    recommendedResolution: "CORABASTOS_BACKUP",
    corabastosOvercostCop: totalOvercost,
    platformAbsorbedCop: absorbed,
    overcostCapCop: cap,
    buyerImpactCop: buyerImpact,
    producerFinancialPenaltyCop: 0,
    producerScorePenalty: Math.abs(resp.scoreDelta),
    explanation: `Reposición con mayorista aliado de Corabastos: sobrecosto total ${totalOvercost} COP; Ruta Fresca absorbe ${absorbed} COP (tope ${cap} COP).`,
  };
}
