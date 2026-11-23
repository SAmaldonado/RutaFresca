import { generateMessageHash } from "@/domain/traceability";

export interface OutboundHarvestMessage {
  assignmentId: string;
  assignmentCode: string;
  producerName: string;
  producerPhone: string;
  productName: string;
  assignedKg: number;
  producerPricePerKgCop: number;
  pickupDateLabel: string;
  collectionPointName: string;
  paymentDueDateLabel: string;
}

export interface WhatsAppSendResult {
  mode: "simulator" | "meta_cloud_api";
  externalMessageId: string;
  messageBody: string;
  voiceScript: string;
  waMeUrl: string;
  contentSha256Hash: string;
  timestampIso: string;
}

export function buildProducerHarvestWhatsAppMessage(input: OutboundHarvestMessage): {
  messageBody: string;
  voiceScript: string;
  waMeUrl: string;
} {
  const priceStr = input.producerPricePerKgCop.toLocaleString("es-CO");
  const totalStr = Math.round(
    input.assignedKg * input.producerPricePerKgCop
  ).toLocaleString("es-CO");

  const messageBody = [
    `Ruta Fresca · Le quedó vendido`,
    `Producto: ${input.productName} (${input.assignedKg} kilos)`,
    `Precio pactado: $${priceStr} el kilo (Total aprox: $${totalStr})`,
    `Traer: ${input.pickupDateLabel}`,
    `Punto de acopio: ${input.collectionPointName}`,
    `Le pagamos a más tardar el ${input.paymentDueDateLabel}.`,
    `Responda "Sí cumplo" o mándenos una nota de voz.`,
  ].join("\n");

  const voiceScript = `Buen día ${input.producerName}, le habla Ruta Fresca. Le quedó vendido ${input.assignedKg} kilos de ${input.productName} a ${input.producerPricePerKgCop} pesos el kilo. Por favor traerlo el ${input.pickupDateLabel} al punto de acopio ${input.collectionPointName}. Le pagamos a más tardar el ${input.paymentDueDateLabel}. Si cumple, oprima el botón verde Sí cumplo o mándenos un audio.`;

  const cleanPhone = input.producerPhone.replace(/[^0-9]/g, "");
  const waMeUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageBody)}`;

  return { messageBody, voiceScript, waMeUrl };
}

export function buildTransporterRouteWhatsAppUrl(params: {
  driverPhone: string;
  driverName: string;
  routeCode: string;
  totalKg: number;
  agreedTariffCop: number;
  stopsSummary: string;
  cancellationCompPct: number;
}): { messageBody: string; waMeUrl: string } {
  const messageBody = [
    `Ruta Fresca · Programación de ruta ${params.routeCode}`,
    `Hola ${params.driverName}, ruta compartida lista:`,
    `Carga confirmada: ${params.totalKg} kg`,
    `Tarifa pactada antes de salir: $${params.agreedTariffCop.toLocaleString("es-CO")}`,
    `Regla cancelación: compensación ${Math.round(params.cancellationCompPct * 100)}% si se cancela en marcha.`,
    `Paradas: ${params.stopsSummary}`,
    `Confirme para iniciar.`,
  ].join("\n");

  const cleanPhone = params.driverPhone.replace(/[^0-9]/g, "");
  return {
    messageBody,
    waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageBody)}`,
  };
}

/**
 * Adaptador desacoplado de WhatsApp:
 * - Modo "simulator" (default): genera mensaje exacto del Manual de Marca, guion de nota de voz,
 *   enlace real wa.me y hash criptográfico SHA-256 (Ley 527 de 1999).
 * - Modo "meta_cloud_api": listo para enviar vía Graph API de WhatsApp Business Cloud cuando
 *   WHATSAPP_CLOUD_TOKEN y WHATSAPP_PHONE_NUMBER_ID estén configurados.
 */
export async function sendHarvestOrderViaWhatsApp(
  input: OutboundHarvestMessage
): Promise<WhatsAppSendResult> {
  const mode =
    process.env.WHATSAPP_ADAPTER_MODE === "meta_cloud_api" &&
    process.env.WHATSAPP_CLOUD_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
      ? "meta_cloud_api"
      : "simulator";

  const { messageBody, voiceScript, waMeUrl } = buildProducerHarvestWhatsAppMessage(input);
  const timestampIso = new Date().toISOString();
  const contentSha256Hash = generateMessageHash({
    entityType: "HARVEST_ASSIGNMENT",
    entityId: input.assignmentId,
    senderPhone: "+573000000000",
    messageBody,
    timestampIso,
  });

  if (mode === "meta_cloud_api") {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_CLOUD_TOKEN!;
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.producerPhone.replace(/[^0-9]/g, ""),
        type: "text",
        text: { body: messageBody },
      }),
    });
    const data = (await resp.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    return {
      mode: "meta_cloud_api",
      externalMessageId: data.messages?.[0]?.id ?? `wa-live-${Date.now()}`,
      messageBody,
      voiceScript,
      waMeUrl,
      contentSha256Hash,
      timestampIso,
    };
  }

  return {
    mode: "simulator",
    externalMessageId: `wa-sim-${Date.now()}`,
    messageBody,
    voiceScript,
    waMeUrl,
    contentSha256Hash,
    timestampIso,
  };
}
