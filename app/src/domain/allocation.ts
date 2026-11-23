import type { CaptureChannel } from "./types";

export interface AllocationCandidate {
  producerId: string;
  producerName: string;
  associationId: string | null;
  associationName: string;
  zoneId: string;
  zoneName: string;
  climateProfile: string;
  collectionPointId: string;
  availableKg: number;
  fulfillmentScore: number; // 0-100
  hasFinagroInsurance: boolean;
  primaryChannel: CaptureChannel;
  weatherSeverity: "LOW" | "MEDIUM" | "HIGH";
}

export interface AllocationSlice {
  producerId: string;
  producerName: string;
  associationName: string;
  zoneId: string;
  zoneName: string;
  climateProfile: string;
  collectionPointId: string;
  assignedKg: number;
  sharePct: number;
  primaryChannel: CaptureChannel;
  rationale: string;
}

export interface MultiZoneAllocationResult {
  totalDemandKg: number;
  totalAssignedKg: number;
  unmetKg: number;
  distinctZonesUsed: number;
  distinctClimatesUsed: number;
  meetsMultiZoneClimateRule: boolean;
  warnings: string[];
  allocations: AllocationSlice[];
  channelDistribution: Record<string, number>;
}

/**
 * Reparte un pedido semanal entre asociaciones/productores cumpliendo dos reglas críticas:
 * 1) Mitigación climática (Fase 1/2): ningún pedido crítico depende de una sola vereda/clima;
 *    asigna al menos a 2 zonas con clima distinto cuando hay oferta disponible, reduciendo exposición
 *    en zonas con alerta IDEAM HIGH.
 * 2) Antisesgo digital (Riesgo prioritario #2): el canal de captura (papel, llamada, WhatsApp audio,
 *    web) NO penaliza jamás el puntaje del productor.
 */
export function allocateDemandMultiZone(params: {
  totalDemandKg: number;
  candidates: AllocationCandidate[];
  maxSingleZoneShare?: number;
}): MultiZoneAllocationResult {
  const { totalDemandKg, candidates } = params;
  const warnings: string[] = [];

  if (totalDemandKg <= 0 || candidates.length === 0) {
    return {
      totalDemandKg,
      totalAssignedKg: 0,
      unmetKg: Math.max(0, totalDemandKg),
      distinctZonesUsed: 0,
      distinctClimatesUsed: 0,
      meetsMultiZoneClimateRule: false,
      warnings: ["No hay productores disponibles para este producto."],
      allocations: [],
      channelDistribution: {},
    };
  }

  // Score purely on operational reliability, climate safety & insurance — NEVER on digital channel!
  const scoreCandidate = (c: AllocationCandidate): number => {
    const weatherPenalty =
      c.weatherSeverity === "HIGH" ? -28 : c.weatherSeverity === "MEDIUM" ? -10 : 0;
    const insuranceBonus = c.hasFinagroInsurance ? 6 : 0;
    const assocBonus = c.associationId ? 5 : 0;
    return c.fulfillmentScore + weatherPenalty + insuranceBonus + assocBonus;
  };

  const validCandidates = candidates
    .filter((c) => c.availableKg > 0)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  const distinctZoneIds = Array.from(new Set(validCandidates.map((c) => c.zoneId)));
  const maxZoneShare =
    distinctZoneIds.length >= 2 ? (params.maxSingleZoneShare ?? 0.6) : 1.0;

  if (distinctZoneIds.length < 2) {
    warnings.push(
      "Solo existe 1 zona disponible para este producto; se recomienda vincular una segunda asociación en otro piso térmico."
    );
  }

  // Compute zone caps respecting weather risk
  const zoneCapKg = new Map<string, number>();
  for (const zId of distinctZoneIds) {
    const zoneHasHighAlert = validCandidates.some(
      (c) => c.zoneId === zId && c.weatherSeverity === "HIGH"
    );
    const effectiveShare =
      distinctZoneIds.length >= 2 && zoneHasHighAlert
        ? Math.min(maxZoneShare, 0.35)
        : maxZoneShare;
    zoneCapKg.set(zId, Math.max(10, Math.round(totalDemandKg * effectiveShare)));
  }

  const assignedByZone = new Map<string, number>();
  const assignedByProducer = new Map<string, number>();
  let remainingKg = totalDemandKg;

  // Pass 1: First pick best candidate from at least 2 distinct climatic profiles
  const selectedClimates = new Set<string>();
  const prioritizedForDiversity: AllocationCandidate[] = [];
  for (const c of validCandidates) {
    if (!selectedClimates.has(c.climateProfile)) {
      selectedClimates.add(c.climateProfile);
      prioritizedForDiversity.push(c);
    }
  }
  const rest = validCandidates.filter((c) => !prioritizedForDiversity.includes(c));
  const ordered = [...prioritizedForDiversity, ...rest];

  // Respect zone caps on Pass 1
  for (const c of ordered) {
    if (remainingKg <= 0) break;
    const zUsed = assignedByZone.get(c.zoneId) ?? 0;
    const zCap = zoneCapKg.get(c.zoneId) ?? totalDemandKg;
    const roomInZone = Math.max(0, zCap - zUsed);
    const take = Math.min(remainingKg, c.availableKg, roomInZone);
    if (take > 0) {
      assignedByZone.set(c.zoneId, zUsed + take);
      assignedByProducer.set(c.producerId, (assignedByProducer.get(c.producerId) ?? 0) + take);
      remainingKg -= take;
    }
  }

  // Pass 2: If demand still unmet because of strict caps, fill from remaining capacity
  if (remainingKg > 0) {
    for (const c of ordered) {
      if (remainingKg <= 0) break;
      const already = assignedByProducer.get(c.producerId) ?? 0;
      const availLeft = Math.max(0, c.availableKg - already);
      const take = Math.min(remainingKg, availLeft);
      if (take > 0) {
        assignedByProducer.set(c.producerId, already + take);
        assignedByZone.set(c.zoneId, (assignedByZone.get(c.zoneId) ?? 0) + take);
        remainingKg -= take;
      }
    }
  }

  const allocations: AllocationSlice[] = [];
  const channelDistribution: Record<string, number> = {};
  const usedZones = new Set<string>();
  const usedClimates = new Set<string>();

  for (const c of validCandidates) {
    const kg = Math.round((assignedByProducer.get(c.producerId) ?? 0) * 10) / 10;
    if (kg <= 0) continue;
    usedZones.add(c.zoneId);
    usedClimates.add(c.climateProfile);
    channelDistribution[c.primaryChannel] =
      (channelDistribution[c.primaryChannel] ?? 0) + kg;

    const reasons: string[] = [];
    reasons.push(`Cumplimiento ${c.fulfillmentScore}%`);
    if (c.hasFinagroInsurance) reasons.push("Seguro Finagro activo");
    if (c.weatherSeverity === "HIGH") {
      reasons.push("Tope reducido por alerta IDEAM");
    } else {
      reasons.push(`Clima ${c.climateProfile.toLowerCase()}`);
    }
    if (c.primaryChannel === "ACOPIO_PAPER" || c.primaryChannel === "PHONE_CALL") {
      reasons.push("Inclusión garantizada (sin sesgo digital)");
    }

    allocations.push({
      producerId: c.producerId,
      producerName: c.producerName,
      associationName: c.associationName,
      zoneId: c.zoneId,
      zoneName: c.zoneName,
      climateProfile: c.climateProfile,
      collectionPointId: c.collectionPointId,
      assignedKg: kg,
      sharePct: Math.round((kg / totalDemandKg) * 1000) / 10,
      primaryChannel: c.primaryChannel,
      rationale: reasons.join(" · "),
    });
  }

  const totalAssignedKg = Math.round((totalDemandKg - remainingKg) * 10) / 10;
  const meetsMultiZoneClimateRule = usedZones.size >= 2 && usedClimates.size >= 2;
  if (!meetsMultiZoneClimateRule && totalAssignedKg > 0) {
    warnings.push(
      "Regla multi-zona climática no cumplida completamente (menos de 2 climas distintos asignados)."
    );
  }
  if (remainingKg > 0) {
    warnings.push(`Faltan ${remainingKg} kg por cubrir con oferta rural; considerar respaldo o ajuste.`);
  }

  return {
    totalDemandKg,
    totalAssignedKg,
    unmetKg: Math.max(0, Math.round(remainingKg * 10) / 10),
    distinctZonesUsed: usedZones.size,
    distinctClimatesUsed: usedClimates.size,
    meetsMultiZoneClimateRule,
    warnings,
    allocations,
    channelDistribution,
  };
}
