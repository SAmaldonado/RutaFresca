"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Sprout,
  Scale,
  Truck,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  Users,
  Menu,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface DemoPersona {
  email: string;
  label: string;
  roleLabel: string;
  path: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: "claudia@andina.com.co",
    label: "Claudia Morales",
    roleLabel: "Compradora (Comedor)",
    path: "/comprador",
  },
  {
    email: "luis.rodriguez@ventaquemada.org",
    label: "Don Luis Rodríguez",
    roleLabel: "Productor (Ventaquemada)",
    path: "/productor",
  },
  {
    email: "acopio.ventaquemada@rutafresca.co",
    label: "Marta Pulido",
    roleLabel: "Punto de Acopio (Offline)",
    path: "/acopio",
  },
  {
    email: "carlos.mendez@rutasaliadas.co",
    label: "Carlos Méndez",
    roleLabel: "Transportador Aliado",
    path: "/transportador",
  },
  {
    email: "ops@rutafresca.co",
    label: "Torre de Control",
    roleLabel: "Operaciones y Analítica",
    path: "/operaciones",
  },
];

const NAV_LINKS = [
  { href: "/comprador", label: "Comprador", icon: Building2 },
  { href: "/productor", label: "Productor & WhatsApp", icon: Sprout },
  { href: "/acopio", label: "Punto de Acopio", icon: Scale },
  { href: "/transportador", label: "Transportador", icon: Truck },
  { href: "/operaciones", label: "Torre de Control", icon: LayoutDashboard },
  { href: "/vinculacion", label: "Vinculación & Ley 1581", icon: ShieldCheck },
];

interface AppShellProps {
  children: React.ReactNode;
  activeUser?: {
    fullName: string;
    email: string;
    role: string;
  } | null;
  title?: string;
  subtitle?: string;
}

export function AppShell({ children, activeUser, title, subtitle }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const showDemoSwitcher = process.env.NEXT_PUBLIC_ENABLE_DEMO_SWITCHER !== "false";

  async function handleDemoSwitch(persona: DemoPersona) {
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: persona.email }),
      });
      if (res.ok) {
        router.push(persona.path);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-rf-bg">
      {/* Top Navigation */}
      <header className="no-print sticky top-0 z-30 border-b border-rf-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="focus:outline-none">
              <BrandLogo size="sm" />
            </Link>
            <span className="hidden rounded-full bg-rf-green-soft px-2.5 py-0.5 text-[11px] font-semibold text-rf-green-dark md:inline-block">
              Piloto Semana 48 · 0 % comisión
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon;
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-rf-graphite text-white"
                      : "text-slate-600 hover:bg-rf-bg hover:text-rf-graphite"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right status & user */}
          <div className="flex items-center gap-2">
            <span
              className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${
                isOnline
                  ? "bg-rf-green-soft text-rf-green-dark"
                  : "bg-rf-yellow-soft text-amber-800"
              }`}
              title={isOnline ? "Conectado" : "Modo sin conexión activo"}
            >
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? "En línea" : "Sin conexión"}
            </span>

            {activeUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <div className="text-xs font-semibold leading-tight text-rf-graphite">
                    {activeUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500">{activeUser.role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-rf-border p-1.5 text-slate-500 hover:bg-rf-bg hover:text-rf-graphite"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-rf-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-rf-green-dark"
              >
                Ingresar
              </Link>
            )}

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg border border-rf-border p-1.5 text-rf-graphite lg:hidden"
              aria-label="Abrir menú"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Demo role quick-switcher bar */}
        {showDemoSwitcher && (
          <div className="border-t border-rf-border bg-rf-graphite px-4 py-1.5 text-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 sm:px-2">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold text-rf-yellow">
                <Users className="h-3.5 w-3.5" />
                Cambiar perfil demo:
              </span>
              {DEMO_PERSONAS.map((p) => {
                const isCurrent = activeUser?.email === p.email;
                return (
                  <button
                    key={p.email}
                    disabled={switching}
                    onClick={() => handleDemoSwitch(p)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                      isCurrent
                        ? "bg-rf-green text-white"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                  >
                    {p.label.split(" ")[0]} · <span className="opacity-80">{p.roleLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-rf-border bg-white px-4 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map((item) => {
                const Icon = item.icon;
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                      active
                        ? "bg-rf-graphite text-white"
                        : "bg-rf-bg text-rf-graphite"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {(title || subtitle) && (
          <div className="mb-6">
            {title && (
              <h1 className="font-display text-2xl font-bold tracking-tight text-rf-graphite sm:text-3xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
