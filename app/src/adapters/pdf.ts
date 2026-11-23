import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const GREEN = rgb(58 / 255, 157 / 255, 74 / 255); // #3A9D4A
const GRAPHITE = rgb(38 / 255, 50 / 255, 56 / 255); // #263238
const YELLOW = rgb(244 / 255, 180 / 255, 0 / 255); // #F4B400
const LIGHT_BG = rgb(242 / 255, 245 / 255, 240 / 255); // #F2F5F0
const SOFT_GREEN = rgb(232 / 255, 245 / 255, 234 / 255);
const MUTED = rgb(96 / 255, 112 / 255, 120 / 255);
const BORDER = rgb(210 / 255, 220 / 255, 212 / 255);

/**
 * Normaliza cadenas a WinAnsi (Latin-1) para pdf-lib StandardFonts sin fallar con emojis.
 */
function safePdfText(input: string): string {
  return input
    .replace(/[✓✔]/g, "[OK]")
    .replace(/[✗✘]/g, "[NO]")
    .replace(/[→➔]/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[«»]/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function cop(val: number): string {
  return `$${Math.round(val).toLocaleString("es-CO")}`;
}

async function embedQrPng(pdf: PDFDocument, text: string) {
  const dataUrl = await QRCode.toDataURL(text, {
    margin: 1,
    width: 120,
    color: { dark: "#263238", light: "#FFFFFF" },
  });
  const base64 = dataUrl.split(",")[1];
  const bytes = Buffer.from(base64, "base64");
  return pdf.embedPng(bytes);
}

/**
 * 1. BOLETA DE PEDIDO DEL PRODUCTOR (Fiel a la Figura 6 del Manual de Marca)
 */
export async function generateBoletaPedidoPdf(params: {
  weekLabel: string;
  producerName: string;
  associationLabel: string;
  collectionPointName: string;
  pickupDateLabel: string;
  paymentDueDateLabel: string;
  verificationHash: string;
  lines: Array<{
    productName: string;
    assignedKg: number;
    pricePerKgCop: number;
    actualKg?: number | null;
  }>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 440]); // Formato boleta apaisada como el Manual de Marca
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // Marco verde cosecha
  page.drawRectangle({
    x: 18,
    y: 18,
    width: 559,
    height: 404,
    borderColor: GREEN,
    borderWidth: 2.2,
    color: rgb(1, 1, 1),
  });

  // Encabezado marca RutaFresca
  page.drawCircle({ x: 46, y: 390, size: 12, color: GREEN });
  page.drawText("Ruta", { x: 66, y: 384, size: 18, font: bold, color: GRAPHITE });
  page.drawText("Fresca", { x: 108, y: 384, size: 18, font: bold, color: GREEN });

  // Línea punteada amarilla maíz debajo del logo
  for (let dx = 66; dx < 168; dx += 7) {
    page.drawCircle({ x: dx, y: 378, size: 1.3, color: YELLOW });
  }

  page.drawText("Boleta de pedido", {
    x: 410,
    y: 389,
    size: 16,
    font: bold,
    color: GRAPHITE,
  });
  page.drawText(safePdfText(params.weekLabel), {
    x: 410,
    y: 374,
    size: 9.5,
    font: regular,
    color: MUTED,
  });

  // Separador
  page.drawLine({
    start: { x: 32, y: 365 },
    end: { x: 563, y: 365 },
    thickness: 1,
    color: BORDER,
  });

  // Banda de productor y asociación
  page.drawRectangle({
    x: 32,
    y: 336,
    width: 531,
    height: 22,
    color: LIGHT_BG,
  });
  page.drawText(
    safePdfText(
      `Productor: ${params.producerName}   |   Asociación: ${params.associationLabel}`
    ),
    { x: 40, y: 343, size: 10, font: bold, color: GRAPHITE }
  );

  // Encabezados de tabla
  const tableTop = 316;
  page.drawText("Producto", { x: 42, y: tableTop, size: 9.5, font: bold, color: MUTED });
  page.drawText("Le pidieron", { x: 220, y: tableTop, size: 9.5, font: bold, color: MUTED });
  page.drawText("Precio por kilo", { x: 325, y: tableTop, size: 9.5, font: bold, color: MUTED });
  page.drawText("Kilos que trajo", { x: 448, y: tableTop, size: 9.5, font: bold, color: MUTED });

  page.drawLine({
    start: { x: 32, y: tableTop - 6 },
    end: { x: 563, y: tableTop - 6 },
    thickness: 0.8,
    color: BORDER,
  });

  let y = tableTop - 32;
  let totalEst = 0;
  for (const line of params.lines.slice(0, 5)) {
    totalEst += Math.round(line.assignedKg * line.pricePerKgCop);
    page.drawCircle({ x: 46, y: y + 4, size: 6, color: SOFT_GREEN, borderColor: GREEN, borderWidth: 1 });
    page.drawText(safePdfText(line.productName), {
      x: 60,
      y,
      size: 11.5,
      font: bold,
      color: GRAPHITE,
    });
    page.drawText(safePdfText(`${line.assignedKg} kilos`), {
      x: 220,
      y,
      size: 11,
      font: bold,
      color: GRAPHITE,
    });
    page.drawText(safePdfText(cop(line.pricePerKgCop)), {
      x: 325,
      y,
      size: 11,
      font: regular,
      color: GRAPHITE,
    });

    // Casilla "Kilos que trajo" (vacía para escritura en acopio o diligenciada si ya se pesó)
    page.drawRectangle({
      x: 446,
      y: y - 6,
      width: 96,
      height: 22,
      borderColor: GRAPHITE,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
    if (line.actualKg !== undefined && line.actualKg !== null) {
      page.drawText(safePdfText(`${line.actualKg} kg`), {
        x: 458,
        y,
        size: 10.5,
        font: bold,
        color: GREEN,
      });
    }

    y -= 32;
  }

  // Tres bloques informativos inferiores (idénticos al manual)
  const boxY = 98;
  page.drawRectangle({
    x: 32,
    y: boxY,
    width: 455,
    height: 54,
    color: LIGHT_BG,
    borderColor: BORDER,
    borderWidth: 0.8,
  });

  page.drawText("Traer el", { x: 42, y: boxY + 36, size: 9, font: bold, color: GREEN });
  page.drawText(safePdfText(params.pickupDateLabel), {
    x: 42,
    y: boxY + 21,
    size: 9.5,
    font: bold,
    color: GRAPHITE,
  });

  page.drawText("Punto de acopio", { x: 192, y: boxY + 36, size: 9, font: bold, color: GREEN });
  page.drawText(safePdfText(params.collectionPointName.slice(0, 32)), {
    x: 192,
    y: boxY + 21,
    size: 9,
    font: regular,
    color: GRAPHITE,
  });

  page.drawText("Le pagamos", { x: 365, y: boxY + 36, size: 9, font: bold, color: YELLOW });
  page.drawText(safePdfText(`A más tardar el ${params.paymentDueDateLabel}`), {
    x: 365,
    y: boxY + 21,
    size: 8.5,
    font: bold,
    color: GRAPHITE,
  });
  page.drawText(safePdfText(`Valor est.: ${cop(totalEst)}`), {
    x: 365,
    y: boxY + 8,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  // QR de soporte Ley 527
  const qrImg = await embedQrPng(pdf, `RUTAFRESCA|BOLETA|${params.verificationHash}`);
  page.drawImage(qrImg, { x: 498, y: boxY - 2, width: 58, height: 58 });

  // Líneas de firma / huella
  page.drawLine({ start: { x: 36, y: 54 }, end: { x: 255, y: 54 }, thickness: 0.9, color: GRAPHITE });
  page.drawText("Firma o huella del productor", {
    x: 82,
    y: 41,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  page.drawLine({ start: { x: 305, y: 54 }, end: { x: 540, y: 54 }, thickness: 0.9, color: GRAPHITE });
  page.drawText("Recibió en el punto de acopio", {
    x: 365,
    y: 41,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  page.drawText(
    safePdfText(
      `Soporte verificable Ley 527 de 1999 · Hash: ${params.verificationHash.slice(0, 24)}... · Ruta Fresca`
    ),
    { x: 36, y: 24, size: 7, font: regular, color: MUTED }
  );

  return pdf.save();
}

/**
 * 2. CERTIFICADO DE ORIGEN CAMPESINO POR LOTE (SOPORTE LEY 2046 DE 2020)
 */
export async function generateCertificadoLey2046Pdf(params: {
  certificateId: string;
  buyerName: string;
  buyerSegment: string;
  buyerAddress: string;
  orderCode: string;
  deliveryWeek: string;
  deliveryDateLabel: string;
  acfcSpendCop: number;
  acfcSharePct: number;
  distinctProducers: number;
  distinctAssociations: number;
  lots: Array<{
    lotCode: string;
    productName: string;
    producerName: string;
    farmName: string;
    associationName: string;
    municipality: string;
    harvestDateLabel: string;
    actualKg: number;
    qualityLabel: string;
  }>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 Vertical
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // Banner superior grafito
  page.drawRectangle({ x: 0, y: 745, width: 595, height: 97, color: GRAPHITE });
  page.drawText("Ruta", { x: 40, y: 802, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Fresca", { x: 92, y: 802, size: 22, font: bold, color: GREEN });
  page.drawText("CERTIFICADO DE TRAZABILIDAD Y ORIGEN CAMPESINO (ACFC)", {
    x: 40,
    y: 778,
    size: 11,
    font: bold,
    color: YELLOW,
  });
  page.drawText(
    safePdfText("Soporte por lote para cumplimiento de la Ley 2046 de 2020 (Art. 7 - Compras Públicas Locales)"),
    { x: 40, y: 760, size: 9, font: regular, color: rgb(0.86, 0.9, 0.88) }
  );

  const qr = await embedQrPng(
    pdf,
    `https://rutafresca.co/certificado/${params.certificateId}|${params.orderCode}`
  );
  page.drawImage(qr, { x: 492, y: 756, width: 72, height: 72 });

  // Datos del comprador y pedido
  page.drawRectangle({
    x: 40,
    y: 650,
    width: 515,
    height: 78,
    color: LIGHT_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });
  page.drawText(safePdfText(`Comprador institucional: ${params.buyerName}`), {
    x: 52,
    y: 708,
    size: 11,
    font: bold,
    color: GRAPHITE,
  });
  page.drawText(safePdfText(`Dirección: ${params.buyerAddress}`), {
    x: 52,
    y: 691,
    size: 9.5,
    font: regular,
    color: GRAPHITE,
  });
  page.drawText(
    safePdfText(
      `Pedido: ${params.orderCode}   |   Semana: ${params.deliveryWeek}   |   Entrega: ${params.deliveryDateLabel}`
    ),
    { x: 52, y: 673, size: 9.5, font: regular, color: MUTED }
  );
  page.drawText(safePdfText(`Certificado No.: ${params.certificateId}`), {
    x: 52,
    y: 658,
    size: 8.5,
    font: bold,
    color: GREEN,
  });

  // Tarjetas resumen Ley 2046
  const kpiY = 582;
  const boxes = [
    { label: "Compra verificada ACFC", value: cop(params.acfcSpendCop) },
    { label: "Cumplimiento Ley 2046", value: `${params.acfcSharePct}% (Mín. 30%)` },
    { label: "Pequeños productores", value: `${params.distinctProducers} fincas` },
    { label: "Asociaciones rurales", value: `${params.distinctAssociations} asociadas` },
  ];
  boxes.forEach((b, idx) => {
    const bx = 40 + idx * 131;
    page.drawRectangle({
      x: bx,
      y: kpiY,
      width: 122,
      height: 52,
      color: SOFT_GREEN,
      borderColor: GREEN,
      borderWidth: 0.8,
    });
    page.drawText(safePdfText(b.label), { x: bx + 8, y: kpiY + 34, size: 8, font: regular, color: MUTED });
    page.drawText(safePdfText(b.value), { x: bx + 8, y: kpiY + 14, size: 10.5, font: bold, color: GRAPHITE });
  });

  // Tabla de lotes trazables
  page.drawText("Detalle verificable por lote de cosecha", {
    x: 40,
    y: 554,
    size: 12,
    font: bold,
    color: GRAPHITE,
  });

  const headY = 532;
  page.drawRectangle({ x: 40, y: headY - 6, width: 515, height: 20, color: GRAPHITE });
  page.drawText("Código Lote", { x: 46, y: headY, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Producto", { x: 146, y: headY, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Productor / Finca", { x: 230, y: headY, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Municipio / Asoc.", { x: 356, y: headY, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Cosecha", { x: 462, y: headY, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Kg", { x: 520, y: headY, size: 8, font: bold, color: rgb(1, 1, 1) });

  let ry = headY - 22;
  for (const lot of params.lots.slice(0, 18)) {
    page.drawText(safePdfText(lot.lotCode), { x: 46, y: ry, size: 7.5, font: bold, color: GREEN });
    page.drawText(safePdfText(lot.productName.slice(0, 16)), { x: 146, y: ry, size: 8, font: regular, color: GRAPHITE });
    page.drawText(safePdfText(`${lot.producerName.slice(0, 16)} (${lot.farmName.slice(0, 12)})`), {
      x: 230,
      y: ry,
      size: 7.5,
      font: regular,
      color: GRAPHITE,
    });
    page.drawText(safePdfText(`${lot.municipality} - ${lot.associationName.slice(0, 14)}`), {
      x: 356,
      y: ry,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    page.drawText(safePdfText(lot.harvestDateLabel), { x: 462, y: ry, size: 7.5, font: regular, color: MUTED });
    page.drawText(safePdfText(`${lot.actualKg}`), { x: 520, y: ry, size: 8, font: bold, color: GRAPHITE });
    page.drawLine({ start: { x: 40, y: ry - 6 }, end: { x: 555, y: ry - 6 }, thickness: 0.4, color: BORDER });
    ry -= 22;
  }

  // Declaración normativa
  page.drawRectangle({
    x: 40,
    y: 52,
    width: 515,
    height: 62,
    color: LIGHT_BG,
    borderColor: GREEN,
    borderWidth: 1,
  });
  page.drawText("Declaración de Trazabilidad y Cumplimiento Normativo", {
    x: 50,
    y: 96,
    size: 9.5,
    font: bold,
    color: GRAPHITE,
  });
  page.drawText(
    safePdfText(
      "Ruta Fresca certifica que los lotes arriba listados fueron cosechados contra pedido confirmado por pequeños"
    ),
    { x: 50, y: 81, size: 8.5, font: regular, color: GRAPHITE }
  );
  page.drawText(
    safePdfText(
      "productores de agricultura campesina, familiar y comunitaria (ACFC) de Cundinamarca y Boyacá, pesados en"
    ),
    { x: 50, y: 69, size: 8.5, font: regular, color: GRAPHITE }
  );
  page.drawText(
    safePdfText(
      "punto de acopio con trazabilidad verificable (Ley 2046 de 2020, Ley 527 de 1999 y Ley 1581 de 2012)."
    ),
    { x: 50, y: 57, size: 8.5, font: regular, color: GRAPHITE }
  );

  return pdf.save();
}

/**
 * 3. HOJA DE RUTA Y ACUERDO DE TARIFA DEL TRANSPORTADOR
 */
export async function generateHojaRutaPdf(params: {
  routeCode: string;
  routeDateLabel: string;
  driverName: string;
  plateNumber: string;
  vehicleType: string;
  capacityKg: number;
  totalKg: number;
  utilizationPct: number;
  estimatedKm: number;
  detourKm: number;
  agreedTariffCop: number;
  tariffModel: string;
  waitingFeePerHourCop: number;
  cancellationCompPct: number;
  stops: Array<{
    stopOrder: number;
    stopType: string;
    label: string;
    address: string;
    scheduledTime: string;
    kgAmount: number;
  }>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 752, width: 595, height: 90, color: GRAPHITE });
  page.drawText("RutaFresca · Hoja de Ruta y Acuerdo de Tarifa", {
    x: 40,
    y: 804,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    safePdfText(
      `Ruta ${params.routeCode} · Fecha: ${params.routeDateLabel} · Conductor: ${params.driverName} (${params.plateNumber})`
    ),
    { x: 40, y: 778, size: 10, font: regular, color: YELLOW }
  );

  // Resumen económico pactado ANTES del viaje
  page.drawRectangle({
    x: 40,
    y: 658,
    width: 515,
    height: 76,
    color: SOFT_GREEN,
    borderColor: GREEN,
    borderWidth: 1.2,
  });
  page.drawText(safePdfText(`TARIFA PACTADA ANTES DE SALIR: ${cop(params.agreedTariffCop)}`), {
    x: 54,
    y: 712,
    size: 13,
    font: bold,
    color: GRAPHITE,
  });
  page.drawText(
    safePdfText(
      `Carga confirmada: ${params.totalKg} kg / ${params.capacityKg} kg (${params.utilizationPct}% ocupación)   |   Distancia: ${params.estimatedKm} km (desvío ${params.detourKm} km)`
    ),
    { x: 54, y: 692, size: 9.5, font: regular, color: GRAPHITE }
  );
  page.drawText(
    safePdfText(
      `Reglas de protección: Espera > 30 min se paga a ${cop(params.waitingFeePerHourCop)}/h · Cancelación en marcha: ${Math.round(
        params.cancellationCompPct * 100
      )}% (${cop(params.agreedTariffCop * params.cancellationCompPct)}).`
    ),
    { x: 54, y: 672, size: 8.8, font: bold, color: GREEN }
  );

  // Secuencia de paradas
  page.drawText("Secuencia de paradas (Recogidas en acopio -> Entregas en Bogotá)", {
    x: 40,
    y: 632,
    size: 11.5,
    font: bold,
    color: GRAPHITE,
  });

  let y = 602;
  for (const s of params.stops) {
    const isPickup = s.stopType === "PICKUP_ACOPIO";
    page.drawRectangle({
      x: 40,
      y: y - 16,
      width: 515,
      height: 40,
      color: isPickup ? LIGHT_BG : rgb(1, 1, 1),
      borderColor: isPickup ? GREEN : YELLOW,
      borderWidth: 1,
    });
    page.drawText(
      safePdfText(
        `#${s.stopOrder} [${isPickup ? "RECOGER" : "ENTREGAR"}] ${s.scheduledTime} - ${s.label}`
      ),
      { x: 52, y: y + 8, size: 10, font: bold, color: GRAPHITE }
    );
    page.drawText(safePdfText(`${s.address}   |   Carga: ${s.kgAmount} kg`), {
      x: 52,
      y: y - 7,
      size: 8.8,
      font: regular,
      color: MUTED,
    });
    y -= 52;
  }

  return pdf.save();
}

/**
 * 4. AFICHE PARA PUNTO DE ACOPIO (Fiel al diseño 3 pasos del Manual de Marca)
 */
export async function generateAficheAcopioPdf(params: {
  associationName: string;
  collectionPointName: string;
  whatsappNumber: string;
  meetingDayLabel: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]); // A5 Poster
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // Cabecera verde cosecha
  page.drawRectangle({ x: 0, y: 455, width: 420, height: 140, color: GREEN });
  page.drawText("RutaFresca", { x: 34, y: 558, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Coseche lo que", { x: 34, y: 512, size: 28, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ya está vendido.", { x: 34, y: 478, size: 28, font: bold, color: rgb(1, 1, 1) });

  // Fondo blanco cuerpo
  const steps = [
    {
      num: "1",
      title: "Le llega el pedido por WhatsApp",
      desc: "Qué, cuántos kilos y a qué precio. En audio si prefiere.",
    },
    {
      num: "2",
      title: "Coseche solo lo que le pidieron",
      desc: "Lo que recoge ya tiene comprador y precio pactado.",
    },
    {
      num: "3",
      title: "Tráigalo al punto de acopio",
      desc: "El carro lo lleva a Bogotá. Le pagamos según acuerdo (contado o máx. 8 días).",
    },
  ];

  let sy = 390;
  for (const st of steps) {
    page.drawCircle({ x: 54, y: sy + 8, size: 18, color: YELLOW });
    page.drawText(st.num, { x: 49, y: sy + 2, size: 16, font: bold, color: GRAPHITE });
    page.drawText(safePdfText(st.title), { x: 88, y: sy + 14, size: 13.5, font: bold, color: GRAPHITE });
    page.drawText(safePdfText(st.desc), { x: 88, y: sy - 4, size: 9.5, font: regular, color: MUTED });
    sy -= 82;
  }

  // Franja amarilla "Para usted es gratis"
  page.drawRectangle({ x: 34, y: 120, width: 352, height: 36, color: YELLOW });
  page.drawText("Para usted es gratis", { x: 132, y: 133, size: 15, font: bold, color: GRAPHITE });

  // Pie grafito con WhatsApp y punto físico
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 96, color: GRAPHITE });
  page.drawText("Escríbanos o mándenos un audio por WhatsApp", {
    x: 34,
    y: 66,
    size: 10,
    font: regular,
    color: rgb(0.9, 0.94, 0.92),
  });
  page.drawText(safePdfText(params.whatsappNumber), {
    x: 34,
    y: 40,
    size: 20,
    font: bold,
    color: YELLOW,
  });
  page.drawText(
    safePdfText(`${params.associationName} · ${params.collectionPointName} (${params.meetingDayLabel})`),
    { x: 34, y: 18, size: 8, font: regular, color: rgb(0.75, 0.8, 0.78) }
  );

  return pdf.save();
}
