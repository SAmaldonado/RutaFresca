import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  buyerOrgId: z.string(),
  primaryProductId: z.string(),
  substituteProductId: z.string(),
  autoApproveIfShortage: z.boolean().default(true),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.primaryProductId === parsed.data.substituteProductId) {
    return NextResponse.json(
      { error: "Seleccione dos productos distintos para el acuerdo de sustituto." },
      { status: 400 }
    );
  }

  const rule = await prisma.buyerSubstituteRule.upsert({
    where: {
      buyerOrgId_primaryProductId_substituteProductId: {
        buyerOrgId: parsed.data.buyerOrgId,
        primaryProductId: parsed.data.primaryProductId,
        substituteProductId: parsed.data.substituteProductId,
      },
    },
    create: {
      buyerOrgId: parsed.data.buyerOrgId,
      primaryProductId: parsed.data.primaryProductId,
      substituteProductId: parsed.data.substituteProductId,
      autoApproveIfShortage: parsed.data.autoApproveIfShortage,
      notes: parsed.data.notes || "Acordado por chef para continuidad de menú.",
    },
    update: {
      autoApproveIfShortage: parsed.data.autoApproveIfShortage,
      notes: parsed.data.notes || undefined,
    },
    include: { primaryProduct: true, substituteProduct: true },
  });

  return NextResponse.json({ ok: true, rule }, { status: 201 });
}
