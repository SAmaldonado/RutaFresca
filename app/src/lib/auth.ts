import crypto from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { UserRole } from "@/domain/types";

export const SESSION_COOKIE_NAME = "rf_session";

export interface SessionPayload {
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
  exp: number;
}

function getSecret(): string {
  return process.env.AUTH_SECRET || "ruta-fresca-dev-secret-2026-unal-colombia";
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signSession(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const encoded = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(encoded)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const parsed = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const token = signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUserWithProfile() {
  const session = await getCurrentSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      buyerOrg: { include: { zone: true } },
      producer: { include: { association: true, zone: true } },
      transporter: true,
      consents: { orderBy: { grantedAt: "desc" }, take: 3 },
    },
  });
}

export function getHomePathForRole(role: string): string {
  switch (role) {
    case "BUYER":
      return "/comprador";
    case "PRODUCER":
    case "ASSOCIATION_LEADER":
      return "/productor";
    case "ACOPIO_OPERATOR":
      return "/acopio";
    case "TRANSPORTER":
      return "/transportador";
    case "ADMIN_OPS":
      return "/operaciones";
    default:
      return "/";
  }
}
