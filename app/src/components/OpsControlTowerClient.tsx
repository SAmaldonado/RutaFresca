"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  LayoutDashboard,
  Split,
  Route as RouteIcon,
  ShieldAlert,
  CloudRain,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CorridorMap, type MapNode } from "./CorridorMap";
import {
  CHANNEL_LABELS,
  formatCOP,
  formatDateCO,
  formatKg,
  RESOLUTION_LABELS,
  ROOT_CAUSE_LABELS,
  ROUTE_STATUS_LABELS,
} from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function OpsControlTowerClient() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"ANALYTICS" | "ALLOCATE" | "VRP" | "INCIDENTS" | "FEEDS_PAY">(
    "ANALYTICS"
  );
  const [feedback, setFeedback] = useState<{ type: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Allocation simulator state
  const [allocProductId, setAllocProductId] = useState("");
  const [allocKg, setAllocKg] = useState(260);
  const [allocPreview, setAllocPreview] = useState<any>(null);

  // VRP simulator state
  const [vrpTransporterId, setVrpTransporterId] = useState("");
  const [vrpCpIds, setVrpCpIds] = useState<string[]>([]);
  const [vrpBuyerIds, setVrpBuyerIds] = useState<string[]>([]);
  const [vrpKg, setVrpKg] = useState(1950);
  const [vrpCommPct, setVrpCommPct] = useState(3.0);
  const [vrpSubOn, setVrpSubOn] = useState(true);
  const [vrpPilotZero, setVrpPilotZero] = useState(false);
  const [vrpPreview, setVrpPreview] = useState<any>(null);

  // External feeds simulator state
  const [feedProdId, setFeedProdId] = useState("");
  const [feedPrice, setFeedPrice] = useState(3400);
  const [alertZoneId, setAlertZoneId] = useState("");
  const [alertType, setAlertType] = useState<"HELADA" | "GRANIZADA" | "LLUVIA_EXTREMA" | "NORMAL">("GRANIZADA");
  const [alertSev, setAlertSev] = useState<"LOW" | "MEDIUM" | "HIGH">("HIGH");

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/ops/overview");
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (json.products?.length > 0) {
        setAllocProductId((p) => p || json.products[0].id);
        setFeedProdId((p) => p || json.products[0].id);
      }
      if (json.transporters?.length > 0) {
        setVrpTransporterId((p) => p || json.transporters[0].id);
      }
      if (json.collectionPoints?.length >= 2) {
        setVrpCpIds((prev) =>
          prev.length ? prev : [json.collectionPoints[0].id, json.collectionPoints[2].id]
        );
      }
      if (json.buyers?.length >= 3) {
        setVrpBuyerIds((prev) =>
          prev.length ? prev : [json.buyers[0].id, json.buyers[1].id, json.buyers[5]?.id || json.buyers[2].id]
        );
      }
      if (json.weatherAlerts?.length > 0) {
        setAlertZoneId((p) => p || json.weatherAlerts[0].zoneId);
      }
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function runAllocation(persist: boolean) {
    if (!allocProductId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ops/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: allocProductId,
          demandKg: Number(allocKg),
          deliveryWeek: "2026-W48",
          persist,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setAllocPreview(json);
        if (persist) {
          setFeedback({
            type: "ok",
            text: `✓ ${json.createdAssignmentsCount} órdenes de cosecha creadas en ${json.plan.distinctClimatesUsed} zonas climáticas y despachadas con evidencia Ley 527.`,
          });
          await loadOverview();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function runVrp(persist: boolean) {
    if (!vrpTransporterId || vrpCpIds.length === 0 || vrpBuyerIds.length === 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ops/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transporterId: vrpTransporterId,
          collectionPointIds: vrpCpIds,
          buyerOrgIds: vrpBuyerIds,
          totalKgOverride: Number(vrpKg),
          simulatedCommissionPct: vrpCommPct / 100,
          includeSubscriptionProration: vrpSubOn,
          isPilotZeroCommission: vrpPilotZero,
          persist,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setVrpPreview(json);
        if (persist && json.createdRoute) {
          setFeedback({
            type: "ok",
            text: `✓ Ruta ${json.createdRoute.routeCode} ofertada a ${json.transporterName} con tarifa pactada ${formatCOP(
              json.planned.agreedTariffCop
            )} y margen ${json.planned.marginPerKgCop} COP/kg.`,
          });
          await loadOverview();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function resolveIncident(
    incidentId: string,
    resolutionType: "PREAGREED_SUBSTITUTE" | "SECOND_ZONE_REALLOCATION" | "CORABASTOS_BACKUP"
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const spinach = data?.products?.find((p: any) => p.sku === "ESP-BOG");
      const res = await fetch(`/api/ops/incidents/${incidentId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionType,
          substituteProductId:
            resolutionType === "PREAGREED_SUBSTITUTE" ? spinach?.id : undefined,
          slaResponseMinutes: 22,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback({
          type: "ok",
          text: `✓ Incidencia resuelta (${RESOLUTION_LABELS[resolutionType]}). ${json.responsibilityPolicy.policyNote}`,
        });
        await loadOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  async function markSettlementPaid(settlementId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/settlements/${settlementId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "NEQUI" }),
      });
      if (res.ok) {
        setFeedback({ type: "ok", text: "✓ Pago liquidado y comprobante actualizado." });
        await loadOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateSipsaPrice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/ops/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "SIPSA_PRICE",
          productId: feedProdId,
          sipsaPriceCop: Number(feedPrice),
        }),
      });
      if (res.ok) {
        setFeedback({
          type: "ok",
          text: "Precio SIPSA actualizado. Bandas de precio y matriz predictiva recalculadas.",
        });
        await loadOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateIdeamAlert(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/ops/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "IDEAM_ALERT",
          zoneId: alertZoneId,
          alertType,
          severity: alertSev,
          description: `Alerta ${alertType} (${alertSev}) registrada manualmente desde panel IDEAM.`,
        }),
      });
      if (res.ok) {
        setFeedback({
          type: "warn",
          text: "Alerta climática IDEAM actualizada. El motor multi-zona ajustará automáticamente los topes por zona.",
        });
        await loadOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rf-border bg-white p-10 text-center text-sm text-slate-500">
        Cargando Torre de Control, KPIs del piloto y motores analíticos...
      </div>
    );
  }

  const kpis = data.pilotKpis;
  const openIncidentsCount = data.incidents.filter((i: any) => i.status !== "RESOLVED").length;

  return (
    <div className="space-y-6">
      {/* Top 6 Official Pilot KPIs (Meta vs Actual) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          {
            label: "Activación ≤ 14 d",
            val: `${kpis.activationRatePct} %`,
            target: "Meta ≥ 60 %",
            ok: kpis.activationRatePct >= 60,
          },
          {
            label: "Pedidos / mes",
            val: `${kpis.ordersPerBuyerPerMonth}`,
            target: "Meta ≥ 4",
            ok: kpis.ordersPerBuyerPerMonth >= 4,
          },
          {
            label: "Retención mensual",
            val: `${kpis.monthlyRetentionPct} %`,
            target: "Meta ≥ 80 %",
            ok: kpis.monthlyRetentionPct >= 80,
          },
          {
            label: "Cumplimiento OTIF",
            val: `${kpis.otifRatePct} %`,
            target: "Meta ≥ 92 %",
            ok: kpis.otifRatePct >= 92,
          },
          {
            label: "Merma sobre kg",
            val: `${kpis.mermaPct} %`,
            target: "Meta ≤ 5 %",
            ok: kpis.mermaPct <= 5,
          },
          {
            label: "Margen / kg (piloto)",
            val: `${formatCOP(kpis.avgMarginPerKgCop)}`,
            target: "Meta > $0 post-piloto",
            ok: kpis.avgMarginPerKgCop > 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-rf-border bg-white p-4 shadow-card"
          >
            <div className="text-[11px] font-semibold text-slate-500">{card.label}</div>
            <div className="mt-1.5 font-display text-xl font-bold text-rf-graphite tabular-nums">
              {card.val}
            </div>
            <div
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                card.ok
                  ? "bg-rf-green-soft text-rf-green-dark"
                  : "bg-rf-yellow-soft text-amber-800"
              }`}
            >
              {card.target}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ANALYTICS" as const, label: "1. KPIs, 5 Preguntas y Equidad", icon: LayoutDashboard },
          { key: "ALLOCATE" as const, label: "2. Agregación y Reparto ≥ 2 Zonas", icon: Split },
          { key: "VRP" as const, label: "3. Rutas (VRP) y Margen/kg", icon: RouteIcon },
          {
            key: "INCIDENTS" as const,
            label: `4. Incidencias y Corabastos (${openIncidentsCount} abierta)`,
            icon: ShieldAlert,
          },
          { key: "FEEDS_PAY" as const, label: "5. SIPSA / IDEAM y Tesorería", icon: CloudRain },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                tab === t.key
                  ? "bg-rf-graphite text-white shadow"
                  : "border border-rf-border bg-white text-rf-graphite hover:bg-rf-green-soft"
              }`}
            >
              <Icon className="h-4 w-4 text-rf-yellow" />
              {t.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-bold ${
            feedback.type === "ok"
              ? "bg-rf-green-soft text-rf-green-dark"
              : "bg-rf-yellow-soft text-amber-900"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: 5 ANALYTICAL QUESTIONS + DIGITAL BIAS AUDIT */}
      {tab === "ANALYTICS" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Q1 Descriptiva */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-7">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rf-green">
                Pregunta Analítica 1 · Descriptiva
              </span>
              <h3 className="font-display text-base font-bold text-rf-graphite">
                ¿Cuántos kilos de cada producto se piden por semana y cuánto varían?
              </h3>
              <div className="mt-4 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.analytics.q1Descriptiva.slice(0, 7)}>
                    <XAxis dataKey="productName" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="meanWeeklyKg" name="Promedio kg/semana" radius={[6, 6, 0, 0]}>
                      {data.analytics.q1Descriptiva.slice(0, 7).map((_: any, i: number) => (
                        <Cell key={i} fill={i % 2 === 0 ? "#3A9D4A" : "#263238"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                {data.analytics.q1Descriptiva.slice(0, 4).map((r: any) => (
                  <span key={r.productName} className="rounded-lg bg-rf-bg px-2.5 py-1">
                    <strong>{r.productName}:</strong> {r.meanWeeklyKg} kg/sem (CV {r.cvPct} %)
                  </span>
                ))}
              </div>
            </div>

            {/* Q2 Diagnóstica */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rf-yellow-dark">
                Pregunta Analítica 2 · Diagnóstica
              </span>
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Cuando un pedido falla, ¿qué lo causa?
              </h3>
              <div className="mt-4 space-y-3">
                {data.analytics.q2Diagnostica.map((row: any) => (
                  <div key={row.rootCause}>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{ROOT_CAUSE_LABELS[row.rootCause] || row.rootCause}</span>
                      <span className="tabular-nums">
                        {row.affectedKg} kg ({row.sharePct} %)
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-rf-bg">
                      <div
                        className="h-full rounded-full bg-rf-green"
                        style={{ width: `${Math.min(100, row.sharePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Auditoría de Sesgo Digital */}
              <div className="mt-6 border-t border-rf-border pt-4">
                <div className="flex items-center justify-between text-xs font-bold text-rf-graphite">
                  <span>Auditoría Antisesgo Digital (Riesgo #2)</span>
                  <span className="rounded-full bg-rf-green-soft px-2 py-0.5 text-[10px] text-rf-green-dark">
                    {data.analytics.offlineSharePct} % canales no-app
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Distribución de kilos asignados por canal de captura (asegura inclusión de
                  productores sin smartphone):
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.analytics.channelEquityAudit.map((c: any) => (
                    <span
                      key={c.channel}
                      className="rounded-lg border border-rf-border bg-rf-bg px-2 py-1 text-[11px] font-semibold"
                    >
                      {CHANNEL_LABELS[c.channel] || c.channel}: <strong>{c.sharePct} %</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Q3 Predictiva Oferta + Q4 Predictiva Retención + Q5 Prescriptiva */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Q3 Predictiva 1 */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rf-danger">
                Pregunta Analítica 3 · Predictiva (Oferta)
              </span>
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Riesgo de incumplimiento: Zona × Producto
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rf-border text-[11px] text-slate-500">
                      <th className="py-1.5">Zona</th>
                      <th className="py-1.5">Producto</th>
                      <th className="py-1.5">IDEAM</th>
                      <th className="py-1.5 text-right">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rf-border/50">
                    {data.analytics.q3PredictivaOferta.slice(0, 7).map((r: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 font-semibold">{r.zoneName}</td>
                        <td className="py-2">{r.productName}</td>
                        <td className="py-2 text-[11px]">{r.weatherSeverity}</td>
                        <td className="py-2 text-right">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              r.riskLevel === "ALTO"
                                ? "bg-rf-danger-soft text-rf-danger"
                                : r.riskLevel === "MEDIO"
                                ? "bg-rf-yellow-soft text-amber-800"
                                : "bg-rf-green-soft text-rf-green-dark"
                            }`}
                          >
                            {r.riskScore}/100 ({r.riskLevel})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Q4 Predictiva 2 */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rf-green">
                Pregunta Analítica 4 · Predictiva (Demanda)
              </span>
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Retención temprana de comedores
              </h3>
              <div className="mt-3 space-y-2.5">
                {data.analytics.q4PredictivaRetencion.map((b: any) => (
                  <div key={b.buyerName} className="rounded-xl bg-rf-bg p-2.5 text-xs">
                    <div className="font-bold text-rf-graphite truncate">{b.buyerName}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        {b.earlyOrdersCount} pedidos · OTIF {b.otifExperiencedPct} %
                      </span>
                      <span className="font-bold text-rf-green-dark">
                        {b.retentionProbabilityPct} %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Q5 Prescriptiva */}
            <div className="rounded-2xl border border-rf-border bg-rf-graphite p-5 text-white shadow-card lg:col-span-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rf-yellow">
                <Sparkles className="h-3.5 w-3.5" />
                Pregunta Analítica 5 · Prescriptiva
              </div>
              <h3 className="mt-1 font-display text-base font-bold">
                Recomendaciones de reparto y costo por kilo
              </h3>
              <div className="mt-3 space-y-3">
                {data.analytics.q5Prescriptiva.map((act: any, idx: number) => (
                  <div key={idx} className="rounded-xl bg-white/10 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{act.title}</span>
                      <span className="rounded bg-rf-yellow px-1.5 py-0.5 text-[10px] font-bold text-rf-graphite">
                        {act.priority}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-emerald-300">{act.impactEstimate}</div>
                    <p className="mt-1 text-[11px] text-slate-300">{act.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Corridor Overview Map */}
          <CorridorMap
            nodes={data.mapNodes}
            title="Mapa Operativo del Piloto · Acopios (Boyacá/Cundinamarca), Comedores (Bogotá) y Alertas IDEAM"
          />
        </div>
      )}

      {/* TAB 2: DEMAND AGGREGATION & MULTI-ZONE CLIMATE ALLOCATOR */}
      {tab === "ALLOCATE" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-7">
            <h3 className="font-display text-base font-bold text-rf-graphite">
              Demanda agregada Semana 48 y cumplimiento de regla ≥ 2 zonas climáticas
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rf-border text-[11px] text-slate-500">
                    <th className="py-2">Producto</th>
                    <th className="py-2">Demanda</th>
                    <th className="py-2">Asignado</th>
                    <th className="py-2">Zonas climáticas</th>
                    <th className="py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rf-border/60">
                  {data.w48Aggregation.map((row: any) => (
                    <tr key={row.productId}>
                      <td className="py-2.5 font-bold text-rf-graphite">{row.productName}</td>
                      <td className="py-2.5 tabular-nums">{formatKg(row.demandKg)}</td>
                      <td className="py-2.5 font-semibold tabular-nums">
                        {formatKg(row.assignedKg)}
                      </td>
                      <td className="py-2.5">
                        {row.meetsMultiZone ? (
                          <span className="rounded-full bg-rf-green-soft px-2 py-0.5 text-[10px] font-bold text-rf-green-dark">
                            ✓ {row.zonesAssigned.join(" + ")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-rf-yellow-soft px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            ⚠ {row.zonesAssigned.join(", ") || "Sin asignar"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAllocProductId(row.productId);
                            setAllocKg(Math.max(80, row.unassignedKg || row.demandKg));
                          }}
                          className="rounded-lg bg-rf-bg px-2.5 py-1 text-[11px] font-bold text-rf-graphite hover:bg-rf-green hover:text-white"
                        >
                          Repartir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-5">
            <h3 className="font-display text-base font-bold text-rf-graphite">
              Motor de Asignación Multi-Zona (Antisesgo + Anti-Clima)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Divide automáticamente la orden en ≥ 2 climas distintos, baja el tope donde IDEAM
              reporta helada/granizada y nunca penaliza productores sin smartphone.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold">Producto</label>
                <select
                  value={allocProductId}
                  onChange={(e) => setAllocProductId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                >
                  {data.products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold">Volumen a asignar (kg)</label>
                <input
                  type="number"
                  min={20}
                  value={allocKg}
                  onChange={(e) => setAllocKg(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAllocation(false)}
                  className="rounded-xl border border-rf-green bg-rf-green-soft py-2.5 font-bold text-rf-green-dark hover:bg-rf-green hover:text-white"
                >
                  Simular reparto
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAllocation(true)}
                  className="rounded-xl bg-rf-green py-2.5 font-bold text-white hover:bg-rf-green-dark"
                >
                  Confirmar y despachar
                </button>
              </div>
            </div>

            {allocPreview && (
              <div className="mt-4 space-y-2 border-t border-rf-border pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rf-graphite">
                    Resultado ({allocPreview.productName})
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      allocPreview.plan.meetsMultiZoneClimateRule
                        ? "bg-rf-green-soft text-rf-green-dark"
                        : "bg-rf-danger-soft text-rf-danger"
                    }`}
                  >
                    {allocPreview.plan.distinctClimatesUsed} climas ·{" "}
                    {allocPreview.plan.distinctZonesUsed} zonas
                  </span>
                </div>
                {allocPreview.plan.allocations.map((s: any) => (
                  <div key={s.producerId} className="rounded-xl bg-rf-bg p-2.5">
                    <div className="flex justify-between font-bold text-rf-graphite">
                      <span>
                        {s.producerName} ({s.zoneName})
                      </span>
                      <span>
                        {s.assignedKg} kg ({s.sharePct} %)
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {s.rationale} · Canal: {CHANNEL_LABELS[s.primaryChannel]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VRP SHARED ROUTE PLANNER & UNIT ECONOMICS (RULE R2) */}
      {tab === "VRP" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* VRP Configurator */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-5">
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Planificador VRP y Semáforo de Margen por Kilo (Regla R2)
              </h3>
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold">Transportador aliado</label>
                  <select
                    value={vrpTransporterId}
                    onChange={(e) => setVrpTransporterId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-xs"
                  >
                    {data.transporters.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.user.fullName} · {t.vehicleType} ({t.capacityKg} kg ·{" "}
                        {t.preferredTariffModel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold">Puntos de acopio a consolidar</label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {data.collectionPoints.map((cp: any) => {
                      const checked = vrpCpIds.includes(cp.id);
                      return (
                        <label
                          key={cp.id}
                          className="flex items-center gap-1.5 rounded-lg border border-rf-border bg-rf-bg/50 px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setVrpCpIds((prev) =>
                                checked ? prev.filter((x) => x !== cp.id) : [...prev, cp.id]
                              )
                            }
                            className="accent-rf-green"
                          />
                          <span className="truncate">{cp.association.municipality}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold">Comedores destino (Zona piloto Bogotá)</label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {data.buyers.map((b: any) => {
                      const checked = vrpBuyerIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="flex items-center gap-1.5 rounded-lg border border-rf-border bg-rf-bg/50 px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setVrpBuyerIds((prev) =>
                                checked ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                              )
                            }
                            className="accent-rf-green"
                          />
                          <span className="truncate">{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold">Carga consolidada (kg)</label>
                    <input
                      type="number"
                      min={200}
                      step={50}
                      value={vrpKg}
                      onChange={(e) => setVrpKg(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold">Comisión simulada (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      step={0.5}
                      value={vrpCommPct}
                      onChange={(e) => setVrpCommPct(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={vrpSubOn}
                      onChange={(e) => setVrpSubOn(e.target.checked)}
                      className="accent-rf-green"
                    />
                    Incluir Plan Abastecimiento ($350k/mes)
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={vrpPilotZero}
                      onChange={(e) => setVrpPilotZero(e.target.checked)}
                      className="accent-rf-green"
                    />
                    Modo Piloto 0 %
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runVrp(false)}
                    className="rounded-xl border border-rf-graphite bg-rf-bg py-2.5 font-bold text-rf-graphite hover:bg-slate-200"
                  >
                    Calcular Margen/kg
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runVrp(true)}
                    className="rounded-xl bg-rf-green py-2.5 font-bold text-white hover:bg-rf-green-dark"
                  >
                    Ofertar Ruta Real
                  </button>
                </div>
              </div>
            </div>

            {/* VRP Result + Scenarios */}
            <div className="space-y-5 lg:col-span-7">
              {vrpPreview && (
                <div
                  className={`rounded-2xl border-2 p-5 shadow-card ${
                    vrpPreview.planned.goNoGoStatus === "GO_POSITIVE"
                      ? "border-rf-green bg-rf-green-soft/40"
                      : "border-rf-danger bg-rf-danger-soft/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Semáforo Regla R2 · {vrpPreview.transporterName}
                      </span>
                      <div className="font-display text-xl font-bold text-rf-graphite">
                        {vrpPreview.planned.goNoGoStatus === "GO_POSITIVE"
                          ? "✓ VIABLE — Margen por kilo positivo"
                          : `⚠ ${vrpPreview.planned.goNoGoStatus}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-slate-600">Margen / kg</div>
                      <div className="font-display text-2xl font-bold tabular-nums">
                        {formatCOP(vrpPreview.planned.marginPerKgCop)}/kg
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5">
                      <div className="text-slate-500">Ocupación</div>
                      <div className="font-bold">{vrpPreview.planned.vehicleUtilizationPct} %</div>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <div className="text-slate-500">Distancia / Desvío</div>
                      <div className="font-bold">
                        {vrpPreview.planned.estimatedKm} / {vrpPreview.planned.detourKm} km
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <div className="text-slate-500">Tarifa Ruta</div>
                      <div className="font-bold">
                        {formatCOP(vrpPreview.planned.agreedTariffCop)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <div className="text-slate-500">Ingreso Plataforma</div>
                      <div className="font-bold text-rf-green-dark">
                        {formatCOP(vrpPreview.planned.grossRevenueCop)}
                      </div>
                    </div>
                  </div>
                  {vrpPreview.planned.alerts.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs font-semibold text-amber-900">
                      {vrpPreview.planned.alerts.map((al: string, idx: number) => (
                        <li key={idx}>• {al}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Economic Scenario Comparator (Phase 2 commission 1-4% vs 0% pilot) */}
              <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-rf-green" />
                  <h3 className="font-display text-base font-bold text-rf-graphite">
                    Simulador Económico Post-Piloto (Respuesta a hallazgo 1–4 % de Fase 2)
                  </h3>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-rf-border text-[11px] text-slate-500">
                        <th className="py-2">Escenario tarifario</th>
                        <th className="py-2">Ingreso sem.</th>
                        <th className="py-2">Costo ruta</th>
                        <th className="py-2">Margen / kg</th>
                        <th className="py-2 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rf-border/60">
                      {data.economicScenarios.map((sc: any) => (
                        <tr key={sc.id}>
                          <td className="py-2.5">
                            <div className="font-bold text-rf-graphite">{sc.label}</div>
                            <div className="text-[11px] text-slate-500">{sc.description}</div>
                          </td>
                          <td className="py-2.5 font-semibold tabular-nums">
                            {formatCOP(sc.weeklyRevenueCop)}
                          </td>
                          <td className="py-2.5 tabular-nums">{formatCOP(sc.weeklyCostCop)}</td>
                          <td
                            className={`py-2.5 font-bold tabular-nums ${
                              sc.viable ? "text-rf-green-dark" : "text-rf-danger"
                            }`}
                          >
                            {formatCOP(sc.marginPerKgCop)}/kg
                          </td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                sc.viable
                                  ? "bg-rf-green-soft text-rf-green-dark"
                                  : "bg-rf-yellow-soft text-amber-800"
                              }`}
                            >
                              {sc.viable ? "Viable (>0)" : "Subsidiado"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Routes Summary */}
              <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
                <h3 className="font-display text-sm font-bold text-rf-graphite">
                  Rutas registradas (Piloto W45–W48)
                </h3>
                <div className="mt-3 space-y-2">
                  {data.routes.slice(0, 5).map((r: any) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rf-bg px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <span className="font-bold text-rf-graphite">{r.routeCode}</span> ·{" "}
                        {r.transporter.user.fullName} · {formatKg(r.totalKg)} (
                        {r.vehicleUtilizationPct} %)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          Tarifa: {formatCOP(r.agreedTariffCop)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold">
                          {ROUTE_STATUS_LABELS[r.status] || r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INCIDENTS, SUBSTITUTES & CORABASTOS BACKUP DESK */}
      {tab === "INCIDENTS" && (
        <div className="space-y-4">
          {data.incidents.map((inc: any) => {
            const isOpen = inc.status !== "RESOLVED";
            return (
              <div
                key={inc.id}
                className={`rounded-2xl border bg-white p-5 shadow-card ${
                  isOpen ? "border-2 border-rf-yellow" : "border-rf-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-rf-graphite">
                        {inc.incidentCode}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isOpen
                            ? "bg-rf-yellow-soft text-amber-900"
                            : "bg-rf-green-soft text-rf-green-dark"
                        }`}
                      >
                        {isOpen ? "Abierta · Requiere reposición" : "✓ Resuelta"}
                      </span>
                      <span className="rounded-full bg-rf-bg px-2.5 py-0.5 text-[11px] font-semibold">
                        {ROOT_CAUSE_LABELS[inc.rootCause] || inc.rootCause}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-700">{inc.description}</p>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Producto: <strong>{inc.product.name}</strong> ({inc.affectedKg} kg) ·
                      Comprador: {inc.buyerOrg?.name || "Varios"} · Zona:{" "}
                      {inc.zone?.municipality || "—"}
                    </div>
                  </div>

                  {!isOpen && (
                    <div className="text-right text-xs">
                      <div className="font-bold text-rf-green-dark">
                        {RESOLUTION_LABELS[inc.resolutionType]}
                      </div>
                      {inc.slaResponseMinutes && (
                        <div className="text-[11px] text-slate-500">
                          SLA respuesta: {inc.slaResponseMinutes} min
                        </div>
                      )}
                      {inc.backupPurchase && (
                        <div className="mt-1 text-[11px] text-amber-800">
                          Corabastos ({inc.backupPurchase.corabastosVendor}): sobrecosto absorbido{" "}
                          {formatCOP(inc.backupPurchase.platformAbsorbedCop)} (tope{" "}
                          {formatCOP(inc.backupPurchase.overcostCapCop)})
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rf-border pt-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolveIncident(inc.id, "PREAGREED_SUBSTITUTE")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rf-green px-3.5 py-2 text-xs font-bold text-white hover:bg-rf-green-dark"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Activar sustituto pre-acordado (Espinaca · $0 sobrecosto)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolveIncident(inc.id, "SECOND_ZONE_REALLOCATION")}
                      className="rounded-xl bg-rf-graphite px-3.5 py-2 text-xs font-bold text-white"
                    >
                      Reasignar a 2ª zona climática (Sabana)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolveIncident(inc.id, "CORABASTOS_BACKUP")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-rf-yellow-soft px-3.5 py-2 text-xs font-bold text-amber-950"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Comprar respaldo en Corabastos (tope $120.000)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 5: SIPSA / IDEAM EXTERNAL FEEDS & TREASURY SETTLEMENTS */}
      {tab === "FEEDS_PAY" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* SIPSA Price Bands Monitor */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-7">
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Monitor de Precios Mayoristas SIPSA (DANE) vs Banda Pactada
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Detecta alzas bruscas en plaza que podrían tentar al productor a vender por fuera.
              </p>
              <div className="mt-3 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rf-border text-[11px] text-slate-500">
                      <th className="py-1.5">Producto</th>
                      <th className="py-1.5">Pactado prod.</th>
                      <th className="py-1.5">SIPSA hoy</th>
                      <th className="py-1.5">Brecha</th>
                      <th className="py-1.5 text-right">Riesgo desvío</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rf-border/50">
                    {data.priceBands.map((pb: any) => (
                      <tr key={pb.productId}>
                        <td className="py-2 font-semibold">{pb.productName}</td>
                        <td className="py-2 tabular-nums">
                          {formatCOP(pb.agreedProducerPriceCop)}
                        </td>
                        <td className="py-2 font-bold tabular-nums">
                          {formatCOP(pb.sipsaPriceCop)}
                        </td>
                        <td className="py-2 tabular-nums">
                          {pb.sipsaDeviationPct >= 0 ? "+" : ""}
                          {pb.sipsaDeviationPct} %
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              pb.sideSellingRisk === "HIGH"
                                ? "bg-rf-danger-soft text-rf-danger"
                                : pb.sideSellingRisk === "MEDIUM"
                                ? "bg-rf-yellow-soft text-amber-800"
                                : "bg-rf-green-soft text-rf-green-dark"
                            }`}
                          >
                            {pb.sideSellingRisk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live External Feed Updaters (SIPSA + IDEAM) */}
            <div className="space-y-4 lg:col-span-5">
              <form
                onSubmit={updateSipsaPrice}
                className="rounded-2xl border border-rf-border bg-white p-4 shadow-card text-xs"
              >
                <div className="font-display text-sm font-bold text-rf-graphite">
                  Actualizar referencia SIPSA (simular volatilidad)
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    value={feedProdId}
                    onChange={(e) => setFeedProdId(e.target.value)}
                    className="rounded-xl border border-rf-border px-2.5 py-2"
                  >
                    {data.products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={feedPrice}
                    onChange={(e) => setFeedPrice(Number(e.target.value))}
                    className="rounded-xl border border-rf-border px-2.5 py-2 font-bold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2.5 w-full rounded-xl bg-rf-graphite py-2 font-bold text-white"
                >
                  Registrar precio SIPSA
                </button>
              </form>

              <form
                onSubmit={updateIdeamAlert}
                className="rounded-2xl border border-rf-border bg-white p-4 shadow-card text-xs"
              >
                <div className="font-display text-sm font-bold text-rf-graphite">
                  Alertas climáticas IDEAM activas
                </div>
                <div className="mt-2 space-y-1.5">
                  {data.weatherAlerts.map((w: any) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-lg bg-rf-bg px-2.5 py-1.5"
                    >
                      <span>
                        <strong>{w.municipality}:</strong> {w.alertType}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          w.severity === "HIGH"
                            ? "bg-rf-danger-soft text-rf-danger"
                            : w.severity === "MEDIUM"
                            ? "bg-rf-yellow-soft text-amber-800"
                            : "bg-rf-green-soft text-rf-green-dark"
                        }`}
                      >
                        {w.severity}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <select
                    value={alertZoneId}
                    onChange={(e) => setAlertZoneId(e.target.value)}
                    className="rounded-lg border border-rf-border px-2 py-1.5"
                  >
                    {data.weatherAlerts.map((w: any) => (
                      <option key={w.zoneId} value={w.zoneId}>
                        {w.municipality}
                      </option>
                    ))}
                  </select>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value as any)}
                    className="rounded-lg border border-rf-border px-2 py-1.5"
                  >
                    <option value="HELADA">Helada</option>
                    <option value="GRANIZADA">Granizada</option>
                    <option value="LLUVIA_EXTREMA">Lluvia extrema</option>
                    <option value="NORMAL">Normal</option>
                  </select>
                  <select
                    value={alertSev}
                    onChange={(e) => setAlertSev(e.target.value as any)}
                    className="rounded-lg border border-rf-border px-2 py-1.5"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2.5 w-full rounded-xl bg-rf-yellow py-2 font-bold text-rf-graphite"
                >
                  Actualizar alerta IDEAM
                </button>
              </form>
            </div>
          </div>

          {/* Treasury & Settlements */}
          <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-rf-green" />
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Tesorería y Liquidaciones (Compradores · Productores contado/≤8d · Transportadores)
              </h3>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rf-border text-[11px] text-slate-500">
                    <th className="py-2">Código</th>
                    <th className="py-2">Actor</th>
                    <th className="py-2">Semana</th>
                    <th className="py-2">Vence</th>
                    <th className="py-2 text-right">Neto</th>
                    <th className="py-2 text-right">Estado / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rf-border/50">
                  {data.settlements.slice(0, 25).map((st: any) => (
                    <tr key={st.id}>
                      <td className="py-2 font-mono text-[11px] font-bold">{st.settlementCode}</td>
                      <td className="py-2">
                        <span className="font-semibold text-rf-graphite">
                          {st.counterpartyName}
                        </span>{" "}
                        <span className="text-[10px] text-slate-500">({st.counterpartyType})</span>
                      </td>
                      <td className="py-2">{st.deliveryWeek}</td>
                      <td className="py-2">{formatDateCO(st.dueDate)}</td>
                      <td className="py-2 text-right font-bold tabular-nums">
                        {formatCOP(st.netAmountCop)}
                      </td>
                      <td className="py-2 text-right">
                        {st.status === "PAID" ? (
                          <span className="rounded-full bg-rf-green-soft px-2 py-0.5 text-[10px] font-bold text-rf-green-dark">
                            Pagado ({st.paymentMethod})
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markSettlementPaid(st.id)}
                            className="rounded-lg bg-rf-green px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rf-green-dark"
                          >
                            Pagar ahora
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
