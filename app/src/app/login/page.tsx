"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Users, AlertCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const DEMO_ACCOUNTS = [
  { email: "claudia@andina.com.co", role: "Compradora · Comedor Andina", badge: "BUYER" },
  { email: "luis.rodriguez@ventaquemada.org", role: "Productor · Don Luis (Ventaquemada)", badge: "PRODUCER" },
  { email: "acopio.ventaquemada@rutafresca.co", role: "Gestora Punto de Acopio (Offline)", badge: "ACOPIO" },
  { email: "carlos.mendez@rutasaliadas.co", role: "Transportador · Carlos Méndez", badge: "TRANSPORTER" },
  { email: "ops@rutafresca.co", role: "Torre de Control & Analítica", badge: "ADMIN_OPS" },
];

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("claudia@andina.com.co");
  const [password, setPassword] = useState("rutafresca2026");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No fue posible ingresar.");
        return;
      }
      router.push(data.redirectTo || "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickSwitch(email: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(data.redirectTo || "/");
        router.refresh();
      } else {
        setError(data.error || "Error cambiando perfil demo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-rf-bg px-4 py-10">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-rf-border bg-white shadow-card md:grid md:grid-cols-12">
        {/* Left Brand Panel */}
        <div className="flex flex-col justify-between bg-rf-graphite p-8 text-white md:col-span-5">
          <div>
            <Link href="/">
              <BrandLogo variant="dark" size="md" showTagline />
            </Link>
            <h1 className="mt-8 font-display text-2xl font-bold leading-snug">
              Acceso por rol a la red de abastecimiento
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              Cada actor cuenta con una experiencia diseñada para su rutina diaria: compras
              planificadas, confirmación sencilla por WhatsApp/audio, pesaje offline en vereda o
              ruteo compartido.
            </p>
          </div>
          <div className="mt-8 rounded-xl bg-white/10 p-4 text-xs text-slate-200">
            <div className="font-semibold text-rf-yellow">Contraseña demo para todos los perfiles:</div>
            <code className="mt-1 inline-block rounded bg-black/30 px-2 py-0.5 font-mono text-white">
              rutafresca2026
            </code>
          </div>
        </div>

        {/* Right Form & Demo Selector */}
        <div className="p-8 md:col-span-7">
          <h2 className="font-display text-xl font-bold text-rf-graphite">Iniciar sesión</h2>
          <p className="mt-1 text-xs text-slate-500">
            Use su correo o teléfono celular registrado en Ruta Fresca.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-rf-graphite">
                Correo o teléfono
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-rf-border bg-rf-bg/50 px-3.5 py-2.5 text-sm outline-none focus:border-rf-green focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rf-graphite">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-rf-border bg-rf-bg/50 px-3.5 py-2.5 text-sm outline-none focus:border-rf-green focus:bg-white"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rf-danger-soft px-3 py-2 text-xs font-medium text-rf-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rf-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-rf-green-dark disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {loading ? "Verificando..." : "Ingresar"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Fast Demo Role Switcher */}
          <div className="mt-7 border-t border-rf-border pt-5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rf-graphite">
              <Users className="h-4 w-4 text-rf-green" />
              Entrada rápida de demostración (1 clic):
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSwitch(acc.email)}
                  className="flex flex-col items-start rounded-xl border border-rf-border bg-rf-bg/50 px-3 py-2 text-left transition hover:border-rf-green hover:bg-rf-green-soft"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rf-green-dark">
                    {acc.badge}
                  </span>
                  <span className="text-xs font-semibold text-rf-graphite">{acc.role}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-center text-xs text-slate-500">
              ¿Nuevo comedor, asociación o transportador?{" "}
              <Link href="/vinculacion" className="font-semibold text-rf-green hover:underline">
                Vincularse aquí (Ley 1581)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
