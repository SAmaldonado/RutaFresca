import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateMessageHash } from "@/domain/traceability";

const respondSchema = z.object({
  action: z.enum(["SI_CUMPLO", "NO_ALCANZO"]),
  channel: z
    .enum(["WHATSAPP_AUDIO", "WHATSAPP_TEXT", "WEB", "PHONE_CALL", "ACOPIO_PAPER"])
    .default("WHATSAPP_AUDIO"),
  reason: z.string().optional(),
  isClimateEvent: z.boolean().optional().default(false),
  audioDataUrl: z.string().nullable().optional(),
  audioTranscript: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Respuesta inválida" }, { status: 400 });
  }

  const assignment = await prisma.harvestAssignment.findUnique({
    where: { id },
    include: {
      producer: { include: { user: true } },
      product: true,
      orderItem: { include: { weeklyOrder: true } },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Orden de cosecha no encontrada" }, { status: 404 });
  }

  const d = parsed.data;
  const newStatus =
    d.action === "SI_CUMPLO"
      ? "CONFIRMED"
      : d.isClimateEvent
      ? "CANCELLED_CLIMATE"
      : "REJECTED_CAPACITY";

  const messageBody =
    d.action === "SI_CUMPLO"
      ? `✓ Sí cumplo · ${assignment.product.name} (${assignment.assignedKg} kg) a $${assignment.producerPricePerKgCop.toLocaleString("es-CO")}/kg.`
      : `✗ No alcanzo · ${assignment.product.name} (${assignment.assignedKg} kg). Motivo: ${
          d.reason || (d.isClimateEvent ? "Afectación climática" : "Capacidad insuficiente")
        }`;

  const timestampIso = new Date().toISOString();
  const hash = generateMessageHash({
    entityType: "HARVEST_ASSIGNMENT",
    entityId: assignment.id,
    senderPhone: assignment.producer.user.phone,
    messageBody,
    timestampIso,
  });

  const updated = await prisma.harvestAssignment.update({
    where: { id },
    data: {
      status: newStatus,
      confirmedAt: d.action === "SI_CUMPLO" ? new Date() : null,
      rejectionReason: d.action === "NO_ALCANZO" ? d.reason || "No alcanza volumen" : null,
      captureChannel: d.channel,
    },
  });

  const evidence = await prisma.messageEvidence.create({
    data: {
      entityType: "HARVEST_ASSIGNMENT",
      entityId: assignment.id,
      direction: "INBOUND",
      channel: d.channel,
      senderPhone: assignment.producer.user.phone,
      recipientPhone: "+573000000000",
      messageBody,
      audioDataUrl: d.audioDataUrl ?? null,
      audioTranscript:
        d.audioTranscript ||
        (d.channel === "WHATSAPP_AUDIO"
          ? d.action === "SI_CUMPLO"
            ? `Listo, sí cumplo con los ${assignment.assignedKg} kilos de ${assignment.product.name}.`
            : `No alcanzo a entregar los ${assignment.assignedKg} kilos por ${d.reason || "clima"}.`
          : null),
      actionClicked: d.action,
      contentSha256Hash: hash,
    },
  });

  let incident = null;
  if (d.action === "NO_ALCANZO") {
    incident = await prisma.incident.create({
      data: {
        incidentCode: `INC-${assignment.deliveryWeek}-${Math.floor(100 + Math.random() * 900)}`,
        weeklyOrderId: assignment.orderItem?.weeklyOrderId ?? null,
        buyerOrgId: assignment.orderItem?.weeklyOrder.buyerOrgId ?? null,
        orderItemId: assignment.orderItemId,
        producerId: assignment.producerId,
        zoneId: assignment.zoneId,
        productId: assignment.productId,
        deliveryWeek: assignment.deliveryWeek,
        rootCause: d.isClimateEvent ? "CLIMATE_CERTIFIED" : "DEMAND_CHANGE",
        affectedKg: assignment.assignedKg,
        description: `Productor ${assignment.producer.user.fullName} reportó "No alcanzo" por ${d.channel}: ${
          d.reason || "Sin detalle adicional"
        }.`,
        resolutionType: "PENDING",
        status: "OPEN",
      },
    });
  }

  return NextResponse.json({ ok: true, assignment: updated, evidence, incident });
}
