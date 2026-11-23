import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAficheAcopioPdf } from "@/adapters/pdf";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cpId = url.searchParams.get("collectionPointId");

  const cp = cpId
    ? await prisma.collectionPoint.findUnique({
        where: { id: cpId },
        include: { association: true },
      })
    : await prisma.collectionPoint.findFirst({
        include: { association: true },
      });

  const pdfBytes = await generateAficheAcopioPdf({
    associationName: cp?.association.name ?? "Asociación de Ventaquemada",
    collectionPointName: cp?.name ?? "Salón comunal de la vereda",
    whatsappNumber: "300 000 0000",
    meetingDayLabel: cp?.operatingDays ?? "Martes y Viernes",
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Afiche_Acopio_RutaFresca.pdf"`,
    },
  });
}
