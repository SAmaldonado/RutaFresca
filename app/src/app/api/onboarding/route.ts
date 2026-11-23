import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import type { UserRole } from "@/domain/types";

const onboardingSchema = z.object({
  role: z.enum(["BUYER", "PRODUCER", "TRANSPORTER"]),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(6),
  consentAccepted: z.boolean(),
  readAloudByGestor: z.boolean().optional().default(false),
  captureChannel: z.string().optional().default("WEB"),
  // Buyer fields
  orgName: z.string().optional(),
  segment: z.string().optional(),
  address: z.string().optional(),
  dailyMealsRange: z.string().optional(),
  deliveryWindowStart: z.string().optional(),
  deliveryWindowEnd: z.string().optional(),
  // Producer fields
  zoneId: z.string().optional(),
  associationId: z.string().nullable().optional(),
  farmName: z.string().optional(),
  vereda: z.string().optional(),
  hectares: z.number().optional(),
  paymentTerm: z.string().optional(),
  hasPhone: z.boolean().optional(),
  isSmartphone: z.boolean().optional(),
  hasMobileData: z.boolean().optional(),
  hasFarmSignal: z.boolean().optional(),
  usesWhatsapp: z.boolean().optional(),
  phoneHandlerInHome: z.string().optional(),
  primaryChannel: z.string().optional(),
  // Transporter fields
  vehicleType: z.string().optional(),
  capacityKg: z.number().optional(),
  plateNumber: z.string().optional(),
  operatingDepartments: z.string().optional(),
  acceptsSharedRoutes: z.string().optional(),
  preferredTariffModel: z.string().optional(),
  maxDetourKm: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos incompletos o inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    if (!d.consentAccepted) {
      return NextResponse.json(
        {
          error:
            "Conforme a la Ley 1581 de 2012, se requiere autorización previa y comprendida para registrar sus datos.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: d.email.toLowerCase() }, { phone: d.phone }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con ese correo o teléfono." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(d.password);
    const user = await prisma.user.create({
      data: {
        fullName: d.fullName.trim(),
        email: d.email.toLowerCase().trim(),
        phone: d.phone.trim(),
        role: d.role,
        passwordHash,
        preferredChannel: d.primaryChannel || d.captureChannel || "WEB",
      },
    });

    await prisma.consentRecord.create({
      data: {
        userId: user.id,
        purposeVersion: "LEY1581-v1.0-2026",
        purposeSummary:
          "Autorización clara y revocable (Ley 1581 de 2012): sus datos solo se usan para coordinar pedidos, cosecha, rutas, trazabilidad por lote y pagos en Ruta Fresca.",
        accepted: true,
        readAloudByGestor: d.readAloudByGestor,
        captureChannel: d.captureChannel,
        evidenceNote: d.readAloudByGestor
          ? "Leído en voz alta y comprendido en acompañamiento presencial."
          : "Aceptado en formato simplificado digital.",
        signatureRef: `LEY1581-${Date.now()}`,
      },
    });

    if (d.role === "BUYER") {
      const bogZone = await prisma.zone.findFirst({ where: { type: "URBAN_DELIVERY" } });
      if (!bogZone) throw new Error("Zona piloto Bogotá no encontrada");
      const code = `COMP-${Math.floor(100 + Math.random() * 900)}`;
      await prisma.buyerOrg.create({
        data: {
          code,
          userId: user.id,
          name: d.orgName || `Comedor ${d.fullName}`,
          segment: d.segment || "COMEDOR_EMPRESARIAL",
          zoneId: bogZone.id,
          address: d.address || "Chapinero, Bogotá",
          lat: 4.646 + (Math.random() - 0.5) * 0.02,
          lng: -74.065 + (Math.random() - 0.5) * 0.02,
          dailyMealsRange: d.dailyMealsRange || "100-249",
          deliveryWindowStart: d.deliveryWindowStart || "06:00",
          deliveryWindowEnd: d.deliveryWindowEnd || "08:00",
          pricingMode: "PILOT_0_PCT",
          commissionRate: 0,
          subscriptionFeeCop: 0,
          referralCode: `RF-${code}`,
          status: "LETTER_OF_INTENT",
        },
      });
    } else if (d.role === "PRODUCER") {
      const ruralZone = d.zoneId
        ? await prisma.zone.findUnique({ where: { id: d.zoneId } })
        : await prisma.zone.findFirst({ where: { type: "RURAL_PRODUCTION" } });
      if (!ruralZone) throw new Error("Zona rural no encontrada");
      const uniqueCode = `PROD-${ruralZone.code.slice(0, 3)}-${Math.floor(100 + Math.random() * 900)}`;
      await prisma.producer.create({
        data: {
          uniqueCode,
          userId: user.id,
          associationId: d.associationId || null,
          zoneId: ruralZone.id,
          farmName: d.farmName || `Finca de ${d.fullName}`,
          vereda: d.vereda || ruralZone.municipality,
          hectares: d.hectares ?? 3.5,
          paymentTerm: d.paymentTerm || "MAX_8_DAYS",
          fulfillmentScore: 95,
          hasPhone: d.hasPhone ?? true,
          isSmartphone: d.isSmartphone ?? true,
          hasMobileData: d.hasMobileData ?? false,
          hasFarmSignal: d.hasFarmSignal ?? true,
          usesWhatsapp: d.usesWhatsapp ?? true,
          phoneHandlerInHome: d.phoneHandlerInHome || "Titular",
          primaryChannel: d.primaryChannel || "WHATSAPP_AUDIO",
        },
      });
    } else if (d.role === "TRANSPORTER") {
      const code = `TRANS-${Math.floor(100 + Math.random() * 900)}`;
      await prisma.transporter.create({
        data: {
          code,
          userId: user.id,
          vehicleType: d.vehicleType || "FURGON_PEQUENO",
          capacityKg: d.capacityKg ?? 1600,
          plateNumber: (d.plateNumber || `RF-${Math.floor(100 + Math.random() * 900)}`).toUpperCase(),
          operatingDepartments: d.operatingDepartments || "Cundinamarca,Boyacá",
          acceptsSharedRoutes: d.acceptsSharedRoutes || "CONDITIONAL",
          maxDetourKm: d.maxDetourKm ?? 18,
          preferredTariffModel: d.preferredTariffModel || "BASE_PLUS_KM",
          homeLat: 4.92,
          homeLng: -74.12,
        },
      });
    }

    await setSessionCookie({
      userId: user.id,
      role: user.role as UserRole,
      fullName: user.fullName,
      email: user.email,
    });

    return NextResponse.json({ ok: true, userId: user.id, role: user.role }, { status: 201 });
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: "Error registrando vinculación" }, { status: 500 });
  }
}

export async function GET() {
  const [zones, associations, consents] = await Promise.all([
    prisma.zone.findMany({ orderBy: { department: "asc" } }),
    prisma.association.findMany({ include: { zone: true }, orderBy: { name: "asc" } }),
    prisma.consentRecord.findMany({
      include: { user: { select: { fullName: true, role: true, phone: true } } },
      orderBy: { grantedAt: "desc" },
      take: 30,
    }),
  ]);
  return NextResponse.json({ zones, associations, consents });
}
