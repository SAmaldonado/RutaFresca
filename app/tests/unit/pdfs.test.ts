import { describe, expect, it } from "vitest";
import {
  generateAficheAcopioPdf,
  generateBoletaPedidoPdf,
  generateCertificadoLey2046Pdf,
  generateHojaRutaPdf,
} from "@/adapters/pdf";

describe("Ruta Fresca — Generación Real de Documentos PDF del Manual de Marca", () => {
  it("genera Boleta de Pedido PDF válida (Don Luis Rodríguez · Ventaquemada)", async () => {
    const bytes = await generateBoletaPedidoPdf({
      weekLabel: "Semana 48 · noviembre de 2026",
      producerName: "Luis Rodríguez",
      associationLabel: "Ventaquemada, Boyacá",
      collectionPointName: "Salón comunal de la vereda",
      pickupDateLabel: "Martes 24 a las 6 a. m.",
      paymentDueDateLabel: "2 de diciembre",
      verificationHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      lines: [
        { productName: "Lechuga batavia", assignedKg: 60, pricePerKgCop: 2100 },
        { productName: "Zanahoria", assignedKg: 90, pricePerKgCop: 1600 },
        { productName: "Tomate chonto", assignedKg: 120, pricePerKgCop: 2800 },
      ],
    });
    expect(bytes.length).toBeGreaterThan(2000);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("genera Certificado de Origen Campesino Ley 2046 PDF válido con QR", async () => {
    const bytes = await generateCertificadoLey2046Pdf({
      certificateId: "CERT-2046-PED-2026-W47-01",
      buyerName: "Operador Nutriser — Contratos Públicos",
      buyerSegment: "OPERADOR_PUBLICO_LEY_2046",
      buyerAddress: "Av. El Dorado # 26-40, Bogotá",
      orderCode: "PED-2026-W47-06",
      deliveryWeek: "2026-W47",
      deliveryDateLabel: "17 nov 2026",
      acfcSpendCop: 2450000,
      acfcSharePct: 100,
      distinctProducers: 4,
      distinctAssociations: 2,
      lots: [
        {
          lotCode: "RF-2026W47-BOY-LEC-001",
          productName: "Lechuga batavia",
          producerName: "Luis Rodríguez",
          farmName: "Finca El Mirador",
          associationName: "Asoc. Ventaquemada",
          municipality: "Ventaquemada",
          harvestDateLabel: "16 nov 2026",
          actualKg: 60,
          qualityLabel: "Estándar Aprobado",
        },
      ],
    });
    expect(bytes.length).toBeGreaterThan(2500);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("genera Hoja de Ruta y Acuerdo de Tarifa PDF válida", async () => {
    const bytes = await generateHojaRutaPdf({
      routeCode: "RUT-2026-W48-01",
      routeDateLabel: "24 nov 2026",
      driverName: "Carlos Méndez",
      plateNumber: "WLA-482",
      vehicleType: "CAMION_LIVIANO",
      capacityKg: 2800,
      totalKg: 1420,
      utilizationPct: 50.7,
      estimatedKm: 168,
      detourKm: 12.5,
      agreedTariffCop: 457600,
      tariffModel: "BASE_PLUS_KM",
      waitingFeePerHourCop: 35000,
      cancellationCompPct: 0.35,
      stops: [
        {
          stopOrder: 1,
          stopType: "PICKUP_ACOPIO",
          label: "Salón comunal Ventaquemada",
          address: "Vereda Puente de Boyacá",
          scheduledTime: "05:30",
          kgAmount: 410,
        },
      ],
    });
    expect(bytes.length).toBeGreaterThan(1500);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("genera Afiche de Punto de Acopio PDF válido", async () => {
    const bytes = await generateAficheAcopioPdf({
      associationName: "Asociación de Ventaquemada",
      collectionPointName: "Salón comunal de la vereda",
      whatsappNumber: "300 000 0000",
      meetingDayLabel: "Martes y Viernes",
    });
    expect(bytes.length).toBeGreaterThan(1500);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});
