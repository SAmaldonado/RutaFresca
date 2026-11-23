import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const collectionPointId = url.searchParams.get("collectionPointId");

  const [collectionPoints, assignments, lots, producers, products] = await Promise.all([
    prisma.collectionPoint.findMany({
      include: { association: { include: { zone: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.harvestAssignment.findMany({
      where: {
        deliveryWeek: "2026-W48",
        ...(collectionPointId ? { collectionPointId } : {}),
      },
      include: {
        product: true,
        producer: { include: { user: true } },
        association: true,
        collectionPoint: true,
        zone: true,
        lot: true,
      },
      orderBy: { status: "asc" },
    }),
    prisma.lot.findMany({
      where: collectionPointId ? { collectionPointId } : undefined,
      include: {
        product: true,
        producer: { include: { user: true } },
        association: true,
        collectionPoint: true,
        zone: true,
      },
      orderBy: { weighedAt: "desc" },
      take: 30,
    }),
    prisma.producer.findMany({
      include: { user: true, zone: true, association: true },
      orderBy: { uniqueCode: "asc" },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    collectionPoints,
    assignments,
    lots,
    producers,
    products,
  });
}
