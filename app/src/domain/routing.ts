import type { GeoPoint, TariffModel } from "./types";

export interface TransporterTariffConfig {
  capacityKg: number;
  maxDetourKm: number;
  preferredTariffModel: TariffModel;
  baseRateCop: number;
  perKmRateCop: number;
  perKgRateCop: number;
  fixedRouteRateCop: number;
  waitingFeePerHourCop: number;
  cancellationCompPct: number;
  homeLat: number;
  homeLng: number;
}

export interface PlannedRouteResult {
  orderedStops: Array<GeoPoint & { stopOrder: number; legKm: number }>;
  totalKg: number;
  vehicleUtilizationPct: number;
  estimatedKm: number;
  detourKm: number;
  agreedTariffCop: number;
  waitingCompCop: number;
  cancellationCompCop: number;
  grossRevenueCop: number;
  totalRouteCostCop: number;
  contributionMarginCop: number;
  marginPerKgCop: number;
  goNoGoStatus:
    | "GO_POSITIVE"
    | "PILOT_SUBSIDIZED"
    | "NO_GO_NEGATIVE"
    | "OVER_CAPACITY"
    | "DETOUR_EXCEEDED";
  alerts: string[];
}

const ROAD_TORTUOSITY_ANDES = 1.35;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function roadDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * ROAD_TORTUOSITY_ANDES * 10) / 10;
}

function orderByNearestNeighbor(
  startLat: number,
  startLng: number,
  points: GeoPoint[]
): Array<GeoPoint & { legKm: number }> {
  const remaining = [...points];
  const ordered: Array<GeoPoint & { legKm: number }> = [];
  let curLat = startLat;
  let curLng = startLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = roadDistanceKm(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    ordered.push({ ...picked, legKm: bestDist });
    curLat = picked.lat;
    curLng = picked.lng;
  }

  return ordered;
}

export function calculateTransporterTariff(
  config: TransporterTariffConfig,
  estimatedKm: number,
  totalKg: number
): number {
  switch (config.preferredTariffModel) {
    case "BASE_PLUS_KM":
      return Math.round(config.baseRateCop + estimatedKm * config.perKmRateCop);
    case "PER_KM":
      return Math.round(estimatedKm * config.perKmRateCop);
    case "PER_KG":
      return Math.round(totalKg * config.perKgRateCop);
    case "FIXED_ROUTE":
      return Math.round(config.fixedRouteRateCop);
    default:
      return Math.round(config.baseRateCop + estimatedKm * config.perKmRateCop);
  }
}

export function calculateWaitingCompensation(
  waitingMinutesTotal: number,
  waitingFeePerHourCop: number,
  graceMinutes = 30
): number {
  const billable = Math.max(0, waitingMinutesTotal - graceMinutes);
  if (billable === 0) return 0;
  return Math.round((billable / 60) * waitingFeePerHourCop);
}

export function calculateCancellationCompensation(
  agreedTariffCop: number,
  cancellationCompPct: number
): number {
  return Math.round(agreedTariffCop * Math.max(0, Math.min(1, cancellationCompPct)));
}

export function planSharedRoute(params: {
  transporter: TransporterTariffConfig;
  pickupStops: GeoPoint[];
  deliveryStops: GeoPoint[];
  commissionRevenueCop: number;
  proratedSubRevCop?: number;
  backupOvercostCop?: number;
  waitingMinutesTotal?: number;
  isPilotZeroCommission?: boolean;
}): PlannedRouteResult {
  const {
    transporter,
    pickupStops,
    deliveryStops,
    commissionRevenueCop,
    proratedSubRevCop = 0,
    backupOvercostCop = 0,
    waitingMinutesTotal = 0,
    isPilotZeroCommission = false,
  } = params;

  const orderedPickups = orderByNearestNeighbor(
    transporter.homeLat,
    transporter.homeLng,
    pickupStops
  );

  const lastPickup = orderedPickups[orderedPickups.length - 1];
  const deliveryStartLat = lastPickup ? lastPickup.lat : transporter.homeLat;
  const deliveryStartLng = lastPickup ? lastPickup.lng : transporter.homeLng;

  const orderedDeliveries = orderByNearestNeighbor(
    deliveryStartLat,
    deliveryStartLng,
    deliveryStops
  );

  const combined = [...orderedPickups, ...orderedDeliveries].map((stop, idx) => ({
    ...stop,
    stopOrder: idx + 1,
  }));

  const estimatedKm =
    Math.round(combined.reduce((sum, s) => sum + s.legKm, 0) * 10) / 10;

  // Estimate detour as distance over direct first-pickup -> last-delivery baseline
  let detourKm = 0;
  if (orderedPickups.length > 0 && orderedDeliveries.length > 0) {
    const firstP = orderedPickups[0];
    const lastD = orderedDeliveries[orderedDeliveries.length - 1];
    const directKm =
      roadDistanceKm(transporter.homeLat, transporter.homeLng, firstP.lat, firstP.lng) +
      roadDistanceKm(firstP.lat, firstP.lng, lastD.lat, lastD.lng);
    detourKm = Math.max(0, Math.round((estimatedKm - directKm) * 10) / 10);
  }

  const pickupKg = pickupStops.reduce((s, p) => s + p.kg, 0);
  const deliveryKg = deliveryStops.reduce((s, d) => s + d.kg, 0);
  const totalKg = Math.round(Math.max(pickupKg, deliveryKg) * 10) / 10;
  const vehicleUtilizationPct =
    transporter.capacityKg > 0
      ? Math.round((totalKg / transporter.capacityKg) * 1000) / 10
      : 0;

  const agreedTariffCop = calculateTransporterTariff(transporter, estimatedKm, totalKg);
  const waitingCompCop = calculateWaitingCompensation(
    waitingMinutesTotal,
    transporter.waitingFeePerHourCop
  );
  const cancellationCompCop = calculateCancellationCompensation(
    agreedTariffCop,
    transporter.cancellationCompPct
  );

  const grossRevenueCop = commissionRevenueCop + proratedSubRevCop;
  const totalRouteCostCop = agreedTariffCop + waitingCompCop + backupOvercostCop;
  const contributionMarginCop = grossRevenueCop - totalRouteCostCop;
  const marginPerKgCop =
    totalKg > 0 ? Math.round((contributionMarginCop / totalKg) * 10) / 10 : 0;

  const alerts: string[] = [];
  let goNoGoStatus: PlannedRouteResult["goNoGoStatus"] = "GO_POSITIVE";

  if (totalKg > transporter.capacityKg) {
    goNoGoStatus = "OVER_CAPACITY";
    alerts.push(
      `Sobrecupo: ${totalKg} kg excede la capacidad del vehículo (${transporter.capacityKg} kg). Dividir en 2 rutas o asignar camión mayor.`
    );
  } else if (detourKm > transporter.maxDetourKm) {
    goNoGoStatus = "DETOUR_EXCEEDED";
    alerts.push(
      `Desvío de ${detourKm} km excede el límite pactado con el conductor (${transporter.maxDetourKm} km).`
    );
  } else if (contributionMarginCop <= 0) {
    if (isPilotZeroCommission) {
      goNoGoStatus = "PILOT_SUBSIDIZED";
      alerts.push(
        `Ruta en Piloto 0 % comisión (margen subsidiado ${marginPerKgCop} COP/kg). Consolidar más carga para validar rentabilidad post-piloto.`
      );
    } else {
      goNoGoStatus = "NO_GO_NEGATIVE";
      alerts.push(
        `Alerta Regla R2: margen por kilo negativo (${marginPerKgCop} COP/kg). Consolidar más comedores en la zona o ajustar tarifa antes de despachar.`
      );
    }
  }

  if (vehicleUtilizationPct < 60 && totalKg > 0) {
    alerts.push(
      `Ocupación del vehículo baja (${vehicleUtilizationPct} %). Riesgo de baja rentabilidad para el transportador.`
    );
  }

  return {
    orderedStops: combined,
    totalKg,
    vehicleUtilizationPct,
    estimatedKm,
    detourKm,
    agreedTariffCop,
    waitingCompCop,
    cancellationCompCop,
    grossRevenueCop,
    totalRouteCostCop,
    contributionMarginCop,
    marginPerKgCop,
    goNoGoStatus,
    alerts,
  };
}
