import crypto from "crypto";

export function generateLotCode(params: {
  deliveryWeek: string;
  zoneCode: string;
  productSku: string;
  sequence: number;
}): string {
  const wk = params.deliveryWeek.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const zn = params.zoneCode.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase();
  const sku = params.productSku.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase();
  const seq = String(params.sequence).padStart(3, "0");
  return `RF-${wk}-${zn}-${sku}-${seq}`;
}

export function generateMessageHash(payload: {
  entityType: string;
  entityId: string;
  senderPhone: string;
  messageBody: string;
  timestampIso: string;
}): string {
  const canonical = [
    payload.entityType,
    payload.entityId,
    payload.senderPhone,
    payload.messageBody.trim(),
    payload.timestampIso,
  ].join("|");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function verifyMessageHash(
  payload: {
    entityType: string;
    entityId: string;
    senderPhone: string;
    messageBody: string;
    timestampIso: string;
  },
  expectedHash: string
): boolean {
  const computed = generateMessageHash(payload);
  if (computed.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
}

export interface Ley2046Summary {
  totalSpendCop: number;
  acfcVerifiedSpendCop: number;
  acfcSharePct: number;
  meetsStatutory30Pct: boolean;
  eligibleFor10PctTenderBonus: boolean;
  distinctSmallholdersCount: number;
  distinctAssociationsCount: number;
  verifiedLotsCount: number;
}

/**
 * Ley 2046 de 2020 (art. 7): entidades con compras públicas de alimentos deben adquirir
 * al menos 30 % a pequeños productores locales / ACFC y otorgan >=10 % de puntaje adicional
 * a operadores que superen ese compromiso.
 */
export function computeLey2046Compliance(params: {
  lots: Array<{
    lotCode: string;
    producerId: string;
    associationId: string | null;
    actualKg: number;
    unitBuyerPriceCop: number;
    qualityResult: string;
  }>;
  totalInstitutionalFoodBudgetCop?: number;
}): Ley2046Summary {
  const validLots = params.lots.filter((l) => l.qualityResult !== "REJECTED");
  const acfcVerifiedSpendCop = validLots.reduce(
    (sum, l) => sum + Math.round(l.actualKg * l.unitBuyerPriceCop),
    0
  );
  const totalSpendCop = Math.max(
    acfcVerifiedSpendCop,
    params.totalInstitutionalFoodBudgetCop ?? acfcVerifiedSpendCop
  );
  const acfcSharePct =
    totalSpendCop > 0
      ? Math.round((acfcVerifiedSpendCop / totalSpendCop) * 1000) / 10
      : 0;

  return {
    totalSpendCop,
    acfcVerifiedSpendCop,
    acfcSharePct,
    meetsStatutory30Pct: acfcSharePct >= 30,
    eligibleFor10PctTenderBonus: acfcSharePct > 35,
    distinctSmallholdersCount: new Set(validLots.map((l) => l.producerId)).size,
    distinctAssociationsCount: new Set(
      validLots.map((l) => l.associationId).filter(Boolean)
    ).size,
    verifiedLotsCount: validLots.length,
  };
}
