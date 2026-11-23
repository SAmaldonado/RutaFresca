export function formatCOP(amount: number | null | undefined): string {
  const val = Math.round(Number(amount ?? 0));
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatKg(kg: number | null | undefined): string {
  const val = Number(kg ?? 0);
  return `${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
  }).format(val)} kg`;
}

export function formatPct(ratioOrPct: number, isRatio = false): string {
  const pct = isRatio ? ratioOrPct * 100 : ratioOrPct;
  return `${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
  }).format(pct)} %`;
}

export function formatDateCO(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTimeCO(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export const CHANNEL_LABELS: Record<string, string> = {
  WEB: "Portal Web",
  WHATSAPP_TEXT: "WhatsApp texto",
  WHATSAPP_AUDIO: "WhatsApp nota de voz",
  PHONE_CALL: "Llamada telefónica",
  ACOPIO_TABLET: "Tableta punto de acopio",
  ACOPIO_PAPER: "Boleta física / presencial",
};

export const PAYMENT_TERM_LABELS: Record<string, string> = {
  CONTADO_MISMO_DIA: "Contado (mismo día)",
  DAYS_1_3: "1 a 3 días hábiles",
  MAX_8_DAYS: "Máximo 8 días",
};

export const ROOT_CAUSE_LABELS: Record<string, string> = {
  CLIMATE_CERTIFIED: "Evento climático certificado",
  QUALITY_REJECTED_ACOPIO: "Calidad rechazada en acopio",
  DIVERTED_SIDE_SELLING: "Venta a otro comprador (precio plaza)",
  ROUTE_FAILURE: "Falla o retraso en ruta",
  DEMAND_CHANGE: "Cambio de demanda de última hora",
};

export const RESOLUTION_LABELS: Record<string, string> = {
  PREAGREED_SUBSTITUTE: "Sustituto pre-acordado",
  CORABASTOS_BACKUP: "Respaldo mayorista Corabastos",
  SECOND_ZONE_REALLOCATION: "Reasignación a segunda zona",
  CREDIT_NOTE: "Nota crédito / ajuste",
  PENDING: "Pendiente de gestión",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PARTIAL_CONFIRMED: "Confirmado parcial",
  LOCKED: "Confirmado en firme",
  ASSIGNED: "Asignado a cosecha",
  IN_TRANSIT: "En ruta hacia cocina",
  DELIVERED: "Entregado",
  COMPLETED_WITH_INCIDENT: "Entregado con novedad",
  CANCELLED: "Cancelado",
};

export const ROUTE_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planeada",
  OFFERED: "Ofertada al conductor",
  ACCEPTED: "Aceptada",
  IN_PROGRESS: "En recorrido",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const PRODUCT_EMOJI: Record<string, string> = {
  lettuce: "🥬",
  carrot: "🥕",
  tomato: "🍅",
  potato: "🥔",
  criolla: "🟡",
  onion: "🧅",
  scallion: "🌱",
  spinach: "🍃",
  cabbage: "🥗",
  greenbean: "🫛",
  peas: "🟢",
  blackberry: "🫐",
  strawberry: "🍓",
  lulo: "🍊",
};
