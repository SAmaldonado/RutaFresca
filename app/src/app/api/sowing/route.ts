import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const sowingSchema = z.object({
  producerId: z.string(),
  productId: z.string(),
  sowingDate: z.string(),
  estimatedHarvestStart: z.string(),
  estimatedHarvestEnd: z.string(),
  estimatedKg: z.number().positive(),
  staggeredBatchNumber: z.number().int().min(1).max(4).default(1),
  captureChannel: z.string().default("WEB"),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = sowingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de siembra inválidos" }, { status: 400 });
  }

  const d = parsed.data;
  const declaration = await prisma.sowingDeclaration.create({
    data: {
      producerId: d.producerId,
      productId: d.productId,
      sowingDate: new Date(d.sowingDate),
      estimatedHarvestStart: new Date(d.estimatedHarvestStart),
      estimatedHarvestEnd: new Date(d.estimatedHarvestEnd),
      estimatedKg: d.estimatedKg,
      staggeredBatchNumber: d.staggeredBatchNumber,
      captureChannel: d.captureChannel,
      notes:
        d.notes ||
        "Planeación de siembra por ciclo (orientativa; la venta firme se confirma contra pedido semanal).",
    },
    include: { product: true },
  });

  return NextResponse.json({ ok: true, declaration }, { status: 201 });
}
