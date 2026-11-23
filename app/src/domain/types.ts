export type UserRole =
  | "BUYER"
  | "PRODUCER"
  | "ASSOCIATION_LEADER"
  | "TRANSPORTER"
  | "ACOPIO_OPERATOR"
  | "ADMIN_OPS";

export type CaptureChannel =
  | "WEB"
  | "WHATSAPP_TEXT"
  | "WHATSAPP_AUDIO"
  | "PHONE_CALL"
  | "ACOPIO_TABLET"
  | "ACOPIO_PAPER";

export type PaymentTerm = "CONTADO_MISMO_DIA" | "DAYS_1_3" | "MAX_8_DAYS";

export type PricingMode = "PILOT_0_PCT" | "COMMISSION_PCT" | "HYBRID_SUBSCRIPTION";

export type TariffModel = "BASE_PLUS_KM" | "PER_KM" | "PER_KG" | "FIXED_ROUTE";

export type QualityGrade = "STANDARD" | "FUNCTIONAL";

export type QualityResult =
  | "APPROVED_STANDARD"
  | "RECLASSIFIED_FUNCTIONAL"
  | "REJECTED";

export type IncidentRootCause =
  | "CLIMATE_CERTIFIED"
  | "QUALITY_REJECTED_ACOPIO"
  | "DIVERTED_SIDE_SELLING"
  | "ROUTE_FAILURE"
  | "DEMAND_CHANGE";

export type IncidentResolution =
  | "PREAGREED_SUBSTITUTE"
  | "CORABASTOS_BACKUP"
  | "SECOND_ZONE_REALLOCATION"
  | "CREDIT_NOTE"
  | "PENDING";

export interface GeoPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  kg: number;
  stopType: "PICKUP_ACOPIO" | "DELIVERY_BUYER" | "BACKUP_CORABASTOS";
  address: string;
  scheduledTime: string;
}
