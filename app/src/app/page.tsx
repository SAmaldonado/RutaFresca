import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Sprout,
  Truck,
  Scale,
  LayoutDashboard,
  ShieldCheck,
  CheckCircle2,
  FileText,
  MessageCircle,
  MapPin,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { formatKg } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, buyersCount, producersCount, lotsCount, receipts, totalLotsKg] =
    await Promise.all([
      getCurrentSession(),
      prisma.buyerOrg.count(),
      prisma.producer.count(),
      prisma.lot.count(),
      prisma.deliveryReceipt.findMany(),
      prisma.lot.aggregate({ _sum: { actualKg: true } }),
    ]);

  const otifOk = receipts.filter((r) => r.otifOnTime && r.otifInFull).length;
  const otifPct =
    receipts.length > 0 ? Math.round((otifOk / receipts.length) * 1000) / 10 : 94.0;

  const weekSteps = [
    { num: 1, title: "Pedido", desc: "El comedor confirma total o parcialmente su necesidad semanal.", color: "bg-rf-green text-white" },
    { num: 2, title: "Agregación", desc: "Se agrupan compras de una misma zona y se reparten en ≥ 2 climas.", color: "bg-rf-yellow text-rf-graphite" },
    { num: 3, title: "Confirmación", desc: "Precio y cantidad pactados por WhatsApp, audio o boleta física.", color: "bg-rf-green text-white" },
    { num: 4, title: "Cosecha", desc: "El campesino cosecha únicamente lo vendido y lo lleva al acopio.", color: "bg-rf-yellow text-rf-graphite" },
    { num: 5, title: "Ruta", desc: "Un transportador aliado consolida entregas con tarifa pactada.", color: "bg-rf-green text-white" },
    { num: 6, title: "Entrega y pago", desc: "Recepción con trazabilidad por lote y pago puntual al productor.", color: "bg-rf-yellow text-rf-graphite" },
  ];

  const portals = [
    {
      href: "/comprador",
      title: "Portal Comprador (Claudia)",
      badge: "Comedores e Instituciones",
      desc: "Precios pactados por ciclo, Calidad Funcional (-20 %), pedidos parciales, reposición 11/11 y Certificado PDF Ley 2046.",
      icon: Building2,
      accent: "border-t-rf-graphite",
    },
    {
      href: "/productor",
      title: "Productor & WhatsApp Voz",
      badge: "Asociaciones Cundinamarca y Boyacá",
      desc: "Interfaz sin tecnicismos, simulador WhatsApp + notas de voz (Ley 527), Boleta de Pedido imprimible y pagos claros.",
      icon: Sprout,
      accent: "border-t-rf-green",
    },
    {
      href: "/acopio",
      title: "Punto de Acopio (Tableta Offline)",
      badge: "Modo Sin Conexión",
      desc: "Pesaje real en vereda, control de calidad, códigos de lote QR, captura asistida sin celular y sincronización automática.",
      icon: Scale,
      accent: "border-t-rf-yellow",
    },
    {
      href: "/transportador",
      title: "Hoja de Ruta Transportador",
      badge: "Rutas Compartidas Rentables",
      desc: "Peso confirmado, tarifa pactada antes de salir, mapa de paradas, registro de tiempos de espera y reglas de cancelación.",
      icon: Truck,
      accent: "border-t-rf-graphite",
    },
    {
      href: "/operaciones",
      title: "Torre de Control & Analítica",
      badge: "Motor VRP · Economía · 5 Preguntas",
      desc: "Agregador semanal, reparto anti-riesgo climático, margen/kg en vivo, mesa Corabastos, SIPSA/IDEAM y auditoría de sesgos.",
      icon: LayoutDashboard,
      accent: "border-t-rf-green",
    },
    {
      href: "/vinculacion",
      title: "Vinculación & Ley 1581",
      badge: "Onboarding + Línea Base Digital",
      desc: "Registro de compradores, productores (con perfil de conectividad) y transportadores, con consentimiento revocable.",
      icon: ShieldCheck,
      accent: "border-t-rf-yellow",
    },
  ];

  return (
    <div className="min-h-screen bg-rf-bg">
      {/* Header */}
      <header className="border-b border-white/10 bg-rf-graphite text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo variant="dark" size="md" showTagline />
          <div className="flex items-center gap-3">
            <Link
              href="/vinculacion"
              className="hidden rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 sm:inline-flex"
            >
              Vincularme al piloto
            </Link>
            <Link
              href={session ? "/operaciones" : "/login"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rf-green px-4 py-2 text-xs font-semibold text-white hover:bg-rf-green-dark"
            >
              {session ? `Ir a mi panel (${session.fullName.split(" ")[0]})` : "Ingresar por rol"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-rf-graphite pb-16 pt-12 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-rf-yellow">
              <MapPin className="h-3.5 w-3.5" />
              Corredor Cundinamarca y Boyacá → Zona Piloto Chapinero–Teusaquillo
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Del campo a la cocina, con{" "}
              <span className="text-rf-green">pedidos confirmados.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
              <strong className="text-white">«Se cosecha lo que usted ya pidió.»</strong>{" "}
              Coordinamos la compra semanal de comedores institucionales con asociaciones campesinas
              y transportadores aliados, sin inventario ni flota propia. Sepa qué le llega, cuándo
              y de qué finca.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/comprador"
                className="inline-flex items-center gap-2 rounded-xl bg-rf-green px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-rf-green-dark"
              >
                Explorar Portal Comprador (Claudia)
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/productor"
                className="inline-flex items-center gap-2 rounded-xl bg-rf-yellow px-5 py-3 text-sm font-bold text-rf-graphite hover:bg-rf-yellow-dark"
              >
                <MessageCircle className="h-4 w-4" />
                Probar WhatsApp Productor (Don Luis)
              </Link>
              <Link
                href="/operaciones"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Torre de Control y Analítica
              </Link>
            </div>
          </div>

          {/* Live pilot metrics snapshot card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-rf-graphite-light/80 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rf-yellow">
                  Estado en vivo del piloto (Semanas 45–48)
                </span>
                <span className="rounded-full bg-rf-green/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  0 % comisión piloto
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-rf-graphite/70 p-4">
                  <div className="text-2xl font-bold text-white tabular-nums">
                    {formatKg(totalLotsKg._sum.actualKg ?? 0)}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">Cosecha trazable movilizada</div>
                </div>
                <div className="rounded-xl bg-rf-graphite/70 p-4">
                  <div className="text-2xl font-bold text-rf-green tabular-nums">{otifPct} %</div>
                  <div className="mt-1 text-xs text-slate-300">Cumplimiento OTIF (Meta ≥ 92 %)</div>
                </div>
                <div className="rounded-xl bg-rf-graphite/70 p-4">
                  <div className="text-2xl font-bold text-rf-yellow tabular-nums">
                    {buyersCount} comedores
                  </div>
                  <div className="mt-1 text-xs text-slate-300">Zona Chapinero–Teusaquillo</div>
                </div>
                <div className="rounded-xl bg-rf-graphite/70 p-4">
                  <div className="text-2xl font-bold text-white tabular-nums">
                    {producersCount} fincas · {lotsCount} lotes
                  </div>
                  <div className="mt-1 text-xs text-slate-300">Boyacá y Cundinamarca</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-rf-green" /> Ley 2046 (Origen ACFC)
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-rf-green" /> Ley 527 (Evidencia WhatsApp)
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-rf-green" /> Ley 1581 (Habeas Data)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Operation Flow (Slide 4) */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-rf-border bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rf-green">
                Operación Semanal
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold text-rf-graphite">
                Primero el pedido. Después la cosecha.
              </h2>
            </div>
            <div className="rounded-xl bg-rf-green-soft px-4 py-2 text-xs font-medium text-rf-green-dark">
              <strong>Diferencia clave:</strong> La siembra se orienta por demanda; la cosecha se
              programa contra pedidos en firme.
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {weekSteps.map((s) => (
              <div
                key={s.num}
                className="relative rounded-xl border border-rf-border bg-rf-bg/60 p-4"
              >
                <div
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold ${s.color}`}
                >
                  {s.num}
                </div>
                <h3 className="mt-3 font-display text-sm font-bold text-rf-graphite">
                  {s.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Direct Access to the 6 Live Modules */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rf-green">
              Plataforma Operativa Completa
            </span>
            <h2 className="mt-1 font-display text-2xl font-bold text-rf-graphite">
              Ingrese directamente a cada espacio de trabajo
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/pdf/boleta"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rf-border bg-white px-3 py-2 text-xs font-semibold text-rf-graphite hover:bg-rf-green-soft"
            >
              <FileText className="h-3.5 w-3.5 text-rf-green" />
              Ver Boleta PDF (Don Luis)
            </a>
            <a
              href="/api/pdf/certificado-ley2046"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rf-border bg-white px-3 py-2 text-xs font-semibold text-rf-graphite hover:bg-rf-green-soft"
            >
              <FileText className="h-3.5 w-3.5 text-rf-green" />
              Ver Certificado Ley 2046 PDF
            </a>
            <a
              href="/api/pdf/afiche"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rf-border bg-white px-3 py-2 text-xs font-semibold text-rf-graphite hover:bg-rf-green-soft"
            >
              <FileText className="h-3.5 w-3.5 text-rf-yellow-dark" />
              Ver Afiche de Acopio PDF
            </a>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {portals.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                href={p.href}
                className={`group flex flex-col justify-between rounded-2xl border border-rf-border border-t-4 ${p.accent} bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-rf-bg px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {p.badge}
                    </span>
                    <div className="rounded-xl bg-rf-bg p-2 text-rf-graphite group-hover:bg-rf-green group-hover:text-white transition">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-rf-graphite">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
                </div>
                <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-rf-green">
                  Abrir módulo
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
