import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const revokeSchema = z.object({
  consentId: z.string(),
  action: z.enum(["REVOKE", "RENEW"]),
  channel: z.string().optional().default("WHATSAPP_AUDIO"),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { consentId, action, channel, note } = parsed.data;
  const existing = await prisma.consentRecord.findUnique({ where: { id: consentId } });
  if (!existing) {
    return NextResponse.json({ error: "Registro de consentimiento no encontrado" }, { status: 404 });
  }

  const updated = await prisma.consentRecord.update({
    where: { id: consentId },
    data:
      action === "REVOKE"
        ? {
            accepted: false,
            revokedAt: new Date(),
            evidenceNote: note || `Revocado por titular vía ${channel} (Ley 1581 de 2012).`,
          }
        : {
            accepted: true,
            revokedAt: null,
            evidenceNote: note || `Renovado por titular vía ${channel}.`,
          },
  });

  return NextResponse.json({ ok: true, consent: updated });
}
