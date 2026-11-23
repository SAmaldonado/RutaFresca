import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomePathForRole, setSessionCookie, verifyPassword } from "@/lib/auth";
import type { UserRole } from "@/domain/types";

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(4),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ingrese correo o teléfono y contraseña." },
        { status: 400 }
      );
    }

    const { identifier, password } = parsed.data;
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.trim().toLowerCase() }, { phone: identifier.trim() }],
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado. Verifique sus datos." },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Contraseña incorrecta." },
        { status: 401 }
      );
    }

    await setSessionCookie({
      userId: user.id,
      role: user.role as UserRole,
      fullName: user.fullName,
      email: user.email,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      redirectTo: getHomePathForRole(user.role),
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Error interno al iniciar sesión" }, { status: 500 });
  }
}
