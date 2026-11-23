import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomePathForRole, setSessionCookie } from "@/lib/auth";
import type { UserRole } from "@/domain/types";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_SWITCHER === "false") {
    return NextResponse.json({ error: "Selector demo deshabilitado" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json({ error: "Perfil demo no encontrado" }, { status: 404 });
  }

  await setSessionCookie({
    userId: user.id,
    role: user.role as UserRole,
    fullName: user.fullName,
    email: user.email,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    redirectTo: getHomePathForRole(user.role),
  });
}
