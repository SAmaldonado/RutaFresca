import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const adjustSchema = z.object({
  lockOrder: z.boolean().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        adjustedKg: z.number().positive(),
      })
    )
    .optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ajuste inválido" }, { status: 400 });
  }

  const order = await prisma.weeklyOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  if (parsed.data.items) {
    for (const item of parsed.data.items) {
      await prisma.orderItem.update({
        where: { id: item.itemId },
        data: { adjustedKg: item.adjustedKg },
      });
    }
  }

  const updated = await prisma.weeklyOrder.update({
    where: { id },
    data: parsed.data.lockOrder
      ? { commitmentType: "FULL", status: "LOCKED" }
      : {},
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ ok: true, order: updated });
}
