import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { calculateOrderEconomics } from "@/domain/pricing";
import type { PricingMode, QualityGrade } from "@/domain/types";

const createOrderSchema = z.object({
  buyerOrgId: z.string(),
  deliveryWeek: z.string().default("2026-W49"),
  deliveryDate: z.string(),
  commitmentType: z.enum(["FULL", "PARTIAL"]).default("PARTIAL"),
  captureChannel: z.string().default("WEB"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        kg: z.number().positive(),
        qualityGrade: z.enum(["STANDARD", "FUNCTIONAL"]).default("STANDARD"),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Revise los productos y cantidades del pedido", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const session = await getCurrentSession();
    const d = parsed.data;
    const [buyerOrg, activeCycle] = await Promise.all([
      prisma.buyerOrg.findUnique({ where: { id: d.buyerOrgId } }),
      prisma.priceCycle.findFirst({
        where: { isActive: true },
        include: { cyclePrices: { include: { product: true } } },
      }),
    ]);

    if (!buyerOrg || !activeCycle) {
      return NextResponse.json(
        { error: "Comprador o ciclo de precios activo no encontrado" },
        { status: 404 }
      );
    }

    const cpMap = new Map(activeCycle.cyclePrices.map((cp) => [cp.productId, cp]));
    const pricingLines = d.items.map((it) => {
      const cp = cpMap.get(it.productId);
      if (!cp) throw new Error(`Producto sin precio de ciclo: ${it.productId}`);
      return {
        kg: it.kg,
        standardBuyerPriceCop: cp.agreedBuyerPriceCop,
        functionalDiscountPct: cp.product.functionalDiscountPct,
        qualityGrade: it.qualityGrade as QualityGrade,
        unitPriceCop:
          it.qualityGrade === "FUNCTIONAL"
            ? cp.functionalBuyerPriceCop
            : cp.agreedBuyerPriceCop,
        productId: it.productId,
      };
    });

    const econ = calculateOrderEconomics({
      items: pricingLines,
      pricingMode: buyerOrg.pricingMode as PricingMode,
      commissionRate: buyerOrg.commissionRate,
      subscriptionFeeCop: buyerOrg.subscriptionFeeCop,
    });

    const delivDate = new Date(d.deliveryDate);
    const cutoffAt = new Date(delivDate.getTime() - 1000 * 60 * 60 * 24 * 4);
    const adjustmentDeadlineAt = new Date(delivDate.getTime() - 1000 * 60 * 60 * 24 * 1.5);
    const orderCode = `PED-${d.deliveryWeek}-${String(Math.floor(10 + Math.random() * 89))}`;

    const order = await prisma.weeklyOrder.create({
      data: {
        orderCode,
        buyerOrgId: buyerOrg.id,
        priceCycleId: activeCycle.id,
        deliveryWeek: d.deliveryWeek,
        deliveryDate: delivDate,
        commitmentType: d.commitmentType,
        cutoffAt,
        adjustmentDeadlineAt,
        status: d.commitmentType === "FULL" ? "LOCKED" : "PARTIAL_CONFIRMED",
        captureChannel: d.captureChannel,
        capturedByUserId: session?.userId ?? buyerOrg.userId,
        notes: d.notes || null,
        items: {
          create: pricingLines.map((pl) => ({
            productId: pl.productId,
            qualityGrade: pl.qualityGrade,
            requestedKg: pl.kg,
            adjustedKg: pl.kg,
            deliveredKg: 0,
            unitPriceCop: pl.unitPriceCop,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Activate buyer if still in LETTER_OF_INTENT
    if (buyerOrg.status !== "ACTIVE") {
      await prisma.buyerOrg.update({
        where: { id: buyerOrg.id },
        data: { status: "ACTIVE" },
      });
    }

    await prisma.settlement.create({
      data: {
        settlementCode: `LIQ-CO-${Math.floor(1000 + Math.random() * 9000)}`,
        counterpartyType: "BUYER",
        counterpartyId: buyerOrg.id,
        counterpartyName: buyerOrg.name,
        referenceType: "WEEKLY_ORDER",
        referenceId: order.id,
        deliveryWeek: d.deliveryWeek,
        grossAmountCop: econ.grossMerchandiseCop,
        commissionCop: econ.commissionCop,
        subscriptionCop: econ.proratedSubscriptionCop,
        netAmountCop: econ.buyerTotalCop,
        dueDate: new Date(delivDate.getTime() + 1000 * 60 * 60 * 24 * 5),
        paymentMethod: "PSE",
        status: "SCHEDULED",
      },
    });

    return NextResponse.json({ ok: true, order, economics: econ }, { status: 201 });
  } catch (err) {
    console.error("Create order error:", err);
    return NextResponse.json({ error: "Error creando pedido semanal" }, { status: 500 });
  }
}
