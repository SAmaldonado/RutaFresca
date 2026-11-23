import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const feedSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SIPSA_PRICE"),
    productId: z.string(),
    sipsaPriceCop: z.number().positive(),
    ipcFoodVariationPct: z.number().optional().default(7.31),
  }),
  z.object({
    kind: z.literal("IDEAM_ALERT"),
    zoneId: z.string(),
    alertType: z.enum(["GRANIZADA", "HELADA", "LLUVIA_EXTREMA", "SEQUIA", "NORMAL"]),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    description: z.string().min(5),
  }),
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = feedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos externos inválidos" }, { status: 400 });
  }

  if (parsed.data.kind === "SIPSA_PRICE") {
    const rec = await prisma.externalMarketFeed.create({
      data: {
        productId: parsed.data.productId,
        recordedDate: new Date(),
        sipsaPriceCop: Math.round(parsed.data.sipsaPriceCop),
        corabastosMinCop: Math.round(parsed.data.sipsaPriceCop * 0.92),
        corabastosMaxCop: Math.round(parsed.data.sipsaPriceCop * 1.1),
        ipcFoodVariationPct: parsed.data.ipcFoodVariationPct,
        source: "DANE-SIPSA (Actualizado)",
      },
    });
    return NextResponse.json({ ok: true, feed: rec }, { status: 201 });
  }

  const zone = await prisma.zone.findUnique({ where: { id: parsed.data.zoneId } });
  if (!zone) {
    return NextResponse.json({ error: "Zona no encontrada" }, { status: 404 });
  }

  await prisma.weatherAlert.updateMany({
    where: { zoneId: zone.id, isActive: true },
    data: { isActive: false },
  });

  const alert = await prisma.weatherAlert.create({
    data: {
      zoneId: zone.id,
      municipality: zone.municipality,
      alertType: parsed.data.alertType,
      severity: parsed.data.severity,
      description: parsed.data.description,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      source: "IDEAM (Actualizado)",
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, alert }, { status: 201 });
}
