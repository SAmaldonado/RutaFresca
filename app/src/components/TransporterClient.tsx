"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Truck,
  CheckCircle2,
  Play,
  Flag,
  Clock,
  ShieldAlert,
  ExternalLink,
  FileText,
  Wallet,
} from "lucide-react";
import { CorridorMap, type MapNode } from "./CorridorMap";
import {
  formatCOP,
  formatDateCO,
  formatKg,
  ROUTE_STATUS_LABELS,
} from "@/lib/format";

interface RouteStopItem {
  id: string;
  stopOrder: number;
  stopType: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  scheduledTime: string;
  waitMinutes: number;
  kgAmount: number;
  status: string;
}

interface RouteItem {
  id: string;
  routeCode: string;
  routeDate: string;
  deliveryWeek: string;
  status: string;
  totalKg: number;
  vehicleUtilizationPct: number;
  estimatedKm: number;
  detourKm: number;
  agreedTariffCop: number;
  waitingMinutesTotal: number;
  waitingCompCop: number;
  cancellationCompCop: number;
  tariffModelUsed: string;
  notes: string | null;
  stops: RouteStopItem[];
  whatsappShare: { messageBody: string; waMeUrl: string };
}

interface TransporterData {
  transporter: {
    id: string;
    code: string;
    vehicleType: string;
    capacityKg: number;
    plateNumber: string;
    operatingDepartments: string;
    acceptsSharedRoutes: string;
    maxDetourKm: number;
    preferredTariffModel: string;
    waitingFeePerHourCop: number;
    cancellationCompPct: number;
    user: { fullName: string; phone: string };
  };
  allTransporters: Array<{
    id: string;
    code: string;
    fullName: string;
    vehicleType: string;
    capacityKg: number;
    plateNumber: string;
  }>;
  routes: RouteItem[];
  settlements: Array<{
    id: string;
    settlementCode: string;
    deliveryWeek: string;
    netAmountCop: number;
    dueDate: string;
    paymentMethod: string;
    status: string;
  }>;
}

export function TransporterClient() {
  const [data, setData] = useState<TransporterData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [waitInputs, setWaitInputs] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async (trId?: string) => {
    const qs = trId ? `?transporterId=${encodeURIComponent(trId)}` : "";
    const res = await fetch(`/api/transporter/dashboard${qs}`);
    if (res.ok) {
      const json = (await res.json()) as TransporterData;
      setData(json);
      setSelectedId(json.transporter.id);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runAction(
    routeId: string,
    action: "ACCEPT" | "START" | "STOP_ARRIVE" | "STOP_COMPLETE" | "COMPLETE" | "CANCEL",
    stopId?: string,
    waitMinutes?: number
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          stopId,
          waitMinutes,
          reason: action === "CANCEL" ? "Cancelación reportada en marcha" : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (action === "ACCEPT") setFeedback("✓ Ruta aceptada con tarifa y reglas pactadas.");
        if (action === "START") setFeedback("🚚 Recorrido iniciado. Registre su llegada en cada parada.");
        if (action === "STOP_COMPLETE")
          setFeedback(
            `✓ Parada completada. Compensación acumulada por espera: ${formatCOP(
              json.route?.waitingCompCop || 0
            )}.`
          );
        if (action === "COMPLETE")
          setFeedback("✓ Ruta finalizada. Su liquidación quedó programada automáticamente.");
        if (action === "CANCEL")
          setFeedback(
            `Ruta cancelada con compensación protegida de ${formatCOP(
              json.cancellationCompCop || 0
            )}.`
          );
        await loadData(selectedId);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rf-border bg-white p-10 text-center text-sm text-slate-500">
        Cargando rutas programadas y tarifas...
      </div>
    );
  }

  const activeRoute = data.routes[0];
  const mapNodes: MapNode[] = activeRoute
    ? activeRoute.stops.map((s) => ({
        id: s.id,
        label: s.label,
        sublabel: `${s.scheduledTime} · ${s.kgAmount} kg`,
        lat: s.lat,
        lng: s.lng,
        kind: s.stopType === "PICKUP_ACOPIO" ? "ACOPIO" : "BUYER",
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Driver Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rf-border bg-rf-graphite p-5 text-white shadow-card">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-rf-yellow px-2.5 py-0.5 font-bold text-rf-graphite">
              Placa {data.transporter.plateNumber}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5">
              Capacidad: {formatKg(data.transporter.capacityKg)}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5">
              Desvío máx: {data.transporter.maxDetourKm} km
            </span>
          </div>
          <h2 className="mt-2 font-display text-xl font-bold">
            {data.transporter.user.fullName} · {data.transporter.vehicleType.replace(/_/g, " ")}
          </h2>
          <p className="text-xs text-slate-300">
            Reglas pactadas: Espera &gt; 30 min se paga a{" "}
            <strong>{formatCOP(data.transporter.waitingFeePerHourCop)}/h</strong> · Compensación por
            cancelación en marcha:{" "}
            <strong>{Math.round(data.transporter.cancellationCompPct * 100)} %</strong> de la tarifa.
          </p>
        </div>

        <select
          value={selectedId}
          onChange={(e) => loadData(e.target.value)}
          className="rounded-xl border border-white/20 bg-rf-graphite-light px-3 py-2 text-xs font-semibold text-white"
        >
          {data.allTransporters.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName} · {t.plateNumber} ({t.capacityKg} kg)
            </option>
          ))}
        </select>
      </div>

      {feedback && (
        <div className="rounded-xl border border-rf-green bg-rf-green-soft px-4 py-3 text-xs font-bold text-rf-green-dark">
          {feedback}
        </div>
      )}

      {activeRoute ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Tariff Guarantee & Stop Execution */}
          <div className="space-y-5 lg:col-span-7">
            {/* Tariff Banner */}
            <div className="rounded-2xl border-2 border-rf-green bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-rf-yellow-soft px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                    {ROUTE_STATUS_LABELS[activeRoute.status] || activeRoute.status}
                  </span>
                  <h3 className="mt-1.5 font-display text-xl font-bold text-rf-graphite">
                    {activeRoute.routeCode} · {formatDateCO(activeRoute.routeDate)}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Tarifa total pactada antes de salir
                  </div>
                  <div className="font-display text-3xl font-bold text-rf-green-dark tabular-nums">
                    {formatCOP(activeRoute.agreedTariffCop + activeRoute.waitingCompCop)}
                  </div>
                  {activeRoute.waitingCompCop > 0 && (
                    <div className="text-xs font-semibold text-amber-700">
                      Incluye +{formatCOP(activeRoute.waitingCompCop)} por espera ({activeRoute.waitingMinutesTotal} min)
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-rf-bg p-3 text-center text-xs">
                <div>
                  <div className="text-slate-500">Carga confirmada</div>
                  <div className="mt-0.5 text-base font-bold text-rf-graphite tabular-nums">
                    {formatKg(activeRoute.totalKg)}
                  </div>
                  <div className="text-[11px] text-rf-green-dark">
                    {activeRoute.vehicleUtilizationPct} % ocupación
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Recorrido total</div>
                  <div className="mt-0.5 text-base font-bold text-rf-graphite tabular-nums">
                    {activeRoute.estimatedKm} km
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Desvío: {activeRoute.detourKm} km
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Protección cancelación</div>
                  <div className="mt-0.5 text-base font-bold text-rf-graphite tabular-nums">
                    {formatCOP(
                      activeRoute.agreedTariffCop * data.transporter.cancellationCompPct
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {Math.round(data.transporter.cancellationCompPct * 100)} % asegurado
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="mt-4 flex flex-wrap gap-2">
                {activeRoute.status === "OFFERED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(activeRoute.id, "ACCEPT")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rf-green px-4 py-2.5 text-xs font-bold text-white hover:bg-rf-green-dark"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aceptar ruta y tarifa
                  </button>
                )}
                {activeRoute.status === "ACCEPTED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(activeRoute.id, "START")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rf-green px-4 py-2.5 text-xs font-bold text-white hover:bg-rf-green-dark"
                  >
                    <Play className="h-4 w-4" /> Iniciar viaje ahora
                  </button>
                )}
                {activeRoute.status === "IN_PROGRESS" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(activeRoute.id, "COMPLETE")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rf-graphite px-4 py-2.5 text-xs font-bold text-white"
                  >
                    <Flag className="h-4 w-4 text-rf-yellow" /> Finalizar ruta y liquidar
                  </button>
                )}
                <a
                  href={`/api/pdf/hoja-ruta?routeId=${activeRoute.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rf-border bg-rf-bg px-3.5 py-2.5 text-xs font-bold text-rf-graphite hover:bg-rf-green-soft"
                >
                  <FileText className="h-4 w-4 text-rf-green" /> Hoja de Ruta PDF
                </a>
                <a
                  href={activeRoute.whatsappShare.waMeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rf-green bg-rf-green-soft px-3.5 py-2.5 text-xs font-bold text-rf-green-dark"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Enviar a WhatsApp
                </a>
                {["OFFERED", "ACCEPTED", "IN_PROGRESS"].includes(activeRoute.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(activeRoute.id, "CANCEL")}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-rf-danger hover:bg-rf-danger-soft"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Cancelar (cobrar compensación)
                  </button>
                )}
              </div>
            </div>

            {/* Ordered Stops Checklist */}
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Secuencia de paradas (Recogidas → Entregas)
              </h3>
              <div className="mt-4 space-y-3">
                {activeRoute.stops.map((st) => {
                  const isPickup = st.stopType === "PICKUP_ACOPIO";
                  const waitVal = waitInputs[st.id] ?? 15;
                  return (
                    <div
                      key={st.id}
                      className={`rounded-xl border p-4 text-xs ${
                        st.status === "COMPLETED"
                          ? "border-rf-green/40 bg-rf-green-soft/30"
                          : "border-rf-border bg-rf-bg/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rf-graphite text-[11px] font-bold text-rf-yellow">
                              {st.stopOrder}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isPickup
                                  ? "bg-rf-green text-white"
                                  : "bg-rf-yellow text-rf-graphite"
                              }`}
                            >
                              {isPickup ? "RECOGER EN ACOPIO" : "ENTREGAR EN COMEDOR"}
                            </span>
                            <span className="font-bold text-rf-graphite">{st.scheduledTime}</span>
                          </div>
                          <div className="mt-1.5 text-sm font-bold text-rf-graphite">
                            {st.label}
                          </div>
                          <div className="text-slate-600">
                            {st.address} · Carga: <strong>{formatKg(st.kgAmount)}</strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {st.status === "PENDING" && activeRoute.status === "IN_PROGRESS" && (
                            <button
                              type="button"
                              onClick={() => runAction(activeRoute.id, "STOP_ARRIVE", st.id)}
                              className="rounded-lg bg-rf-graphite px-3 py-1.5 font-bold text-white"
                            >
                              Marcar llegada
                            </button>
                          )}
                          {(st.status === "ARRIVED" ||
                            (st.status === "PENDING" && activeRoute.status === "IN_PROGRESS")) && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              <input
                                type="number"
                                min={0}
                                value={waitVal}
                                onChange={(e) =>
                                  setWaitInputs((p) => ({
                                    ...p,
                                    [st.id]: Number(e.target.value),
                                  }))
                                }
                                className="w-14 rounded-lg border border-rf-border bg-white px-2 py-1 text-center font-bold"
                                title="Minutos de espera en esta parada"
                              />
                              <span className="text-[11px] text-slate-500">min</span>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(activeRoute.id, "STOP_COMPLETE", st.id, waitVal)
                                }
                                className="rounded-lg bg-rf-green px-3 py-1.5 font-bold text-white"
                              >
                                Completar
                              </button>
                            </div>
                          )}
                          {st.status === "COMPLETED" && (
                            <span className="font-bold text-rf-green-dark">
                              ✓ Listo ({st.waitMinutes} min espera)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Interactive Corridor Map & Settlements */}
          <div className="space-y-5 lg:col-span-5">
            <CorridorMap
              title={`Mapa de ruta ${activeRoute.routeCode}`}
              nodes={mapNodes}
              routeStopCoords={activeRoute.stops.map((s) => ({
                lat: s.lat,
                lng: s.lng,
                label: s.label,
                stopOrder: s.stopOrder,
              }))}
            />

            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-rf-green" />
                <h3 className="font-display text-base font-bold text-rf-graphite">
                  Liquidaciones de viajes
                </h3>
              </div>
              <div className="mt-3 space-y-2">
                {data.settlements.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between rounded-xl bg-rf-bg px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-rf-graphite">
                        {st.settlementCode} · {st.deliveryWeek}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {st.paymentMethod} · Vence {formatDateCO(st.dueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums">{formatCOP(st.netAmountCop)}</div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          st.status === "PAID"
                            ? "bg-rf-green-soft text-rf-green-dark"
                            : "bg-rf-yellow-soft text-amber-800"
                        }`}
                      >
                        {st.status === "PAID" ? "Pagado" : "Programado"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-rf-border bg-white p-8 text-center text-sm text-slate-500">
          <Truck className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2">Este transportador aún no tiene rutas asignadas esta semana.</p>
        </div>
      )}
    </div>
  );
}
