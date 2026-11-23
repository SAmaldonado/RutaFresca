import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const paySchema = z.object({
  paymentMethod: z
    .enum(["TRANSFERENCIA", "NEQUI", "PSE", "EFECTIVO_ACOPIO"])
    .default("NEQUI"),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: parsed.data.paymentMethod,
    },
  });

  return NextResponse.json({ ok: true, settlement: updated });
}
