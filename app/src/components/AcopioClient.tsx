"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Scale,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  FileText,
  CheckCircle2,
  AlertTriangle,
  CloudUpload,
} from "lucide-react";
import {
  CHANNEL_LABELS,
  formatCOP,
  formatDateTimeCO,
  formatKg,
  PAYMENT_TERM_LABELS,
  PRODUCT_EMOJI,
} from "@/lib/format";
import {
  enqueueOfflineWeighing,
  listOfflineWeighings,
  removeOfflineWeighing,
  type OfflineWeighingRecord,
} from "@/lib/offline-queue";

interface AcopioData {
  collectionPoints: Array<{
    id: string;
    code: string;
    name: string;
    veredaAddress: string;
    connectivityType: string;
    operatingDays: string;
    association: { name: string; municipality: string; digitalLeaderName: string };
  }>;
  assignments: Array<{
    id: string;
    assignmentCode: string;
    assignedKg: number;
    producerPricePerKgCop: number;
    status: string;
    captureChannel: string;
    product: { name: string; iconKey: string; sku: string };
    producer: {
      id: string;
      farmName: string;
      paymentTerm: string;
      primaryChannel: string;
      user: { fullName: string };
    };
    collectionPoint: { id: string; name: string };
    lot: { id: string; lotCode: string; actualKg: number; qualityResult: string } | null;
  }>;
  lots: Array<{
    id: string;
    lotCode: string;
    qrPayload: string;
    farmName: string;
    municipality: string;
    requestedKg: number;
    actualKg: number;
    qualityResult: string;
    weighedAt: string;
    captureChannel: string;
    product: { name: string; iconKey: string };
    producer: { user: { fullName: string } };
    collectionPoint: { name: string };
  }>;
}

export function AcopioClient() {
  const [data, setData] = useState<AcopioData | null>(null);
  const [selectedCpId, setSelectedCpId] = useState("");
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineWeighingRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "warn"; text: string } | null>(null);

  // Active weighing form state
  const [activeAssignId, setActiveAssignId] = useState<string | null>(null);
  const [actualKg, setActualKg] = useState<number>(60);
  const [qualityResult, setQualityResult] = useState<
    "APPROVED_STANDARD" | "RECLASSIFIED_FUNCTIONAL" | "REJECTED"
  >("APPROVED_STANDARD");
  const [rejectionReason, setRejectionReason] = useState("");
  const [signatureAck, setSignatureAck] = useState(true);
  const [captureChannel, setCaptureChannel] = useState("ACOPIO_TABLET");

  const refreshQueue = useCallback(async () => {
    const q = await listOfflineWeighings();
    setOfflineQueue(q);
  }, []);

  const loadData = useCallback(async (cpId?: string) => {
    const qs = cpId ? `?collectionPointId=${encodeURIComponent(cpId)}` : "";
    const res = await fetch(`/api/acopio/dashboard${qs}`);
    if (res.ok) {
      const json = (await res.json()) as AcopioData;
      setData(json);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshQueue();
  }, [loadData, refreshQueue]);

  async function handleWeighSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAssignId || !data) return;
    const target = data.assignments.find((a) => a.id === activeAssignId);
    if (!target) return;

    const payload: OfflineWeighingRecord = {
      offlineSyncId: `OFF-${target.assignmentCode}-${Date.now()}`,
      harvestAssignmentId: activeAssignId,
      actualKg: Number(actualKg),
      qualityResult,
      rejectionReason: qualityResult === "REJECTED" ? rejectionReason || "Producto golpeado/sobremaduro" : undefined,
      producerSignatureAck: signatureAck,
      captureChannel,
      queuedAt: new Date().toISOString(),
      labelSummary: `${target.producer.user.fullName} · ${target.product.name} (${actualKg} kg)`,
    };

    const isOffline = simulatedOffline || (typeof navigator !== "undefined" && !navigator.onLine);
    if (isOffline) {
      await enqueueOfflineWeighing(payload);
      await refreshQueue();
      setActiveAssignId(null);
      setFeedback({
        type: "warn",
        text: `Sin conexión: pesaje guardado en cola local IndexedDB (${payload.labelSummary}). Se sincronizará al recuperar señal satelital/4G.`,
      });
      return;
    }

    const res = await fetch("/api/acopio/weigh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      setActiveAssignId(null);
      setFeedback({
        type: "ok",
        text: `✓ Lote ${json.lot.lotCode} generado (${actualKg} kg). ${
          json.incident
            ? `Alerta abierta en Torre de Control (${json.incident.incidentCode}).`
            : "Liquidación al productor programada automáticamente."
        }`,
      });
      await loadData(selectedCpId || undefined);
    }
  }

  async function syncOfflineQueue() {
    if (offlineQueue.length === 0) return;
    if (simulatedOffline) {
      setFeedback({
        type: "warn",
        text: "Desactive el modo offline simulado para sincronizar los registros con el servidor.",
      });
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/acopio/weigh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: offlineQueue }),
      });
      if (res.ok) {
        for (const item of offlineQueue) {
          await removeOfflineWeighing(item.offlineSyncId);
        }
        await refreshQueue();
        await loadData(selectedCpId || undefined);
        setFeedback({
          type: "ok",
          text: `✓ ${offlineQueue.length} registro(s) offline sincronizados con éxito y lotes QR generados.`,
        });
      }
    } finally {
      setSyncing(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rf-border bg-white p-10 text-center text-sm text-slate-500">
        Cargando puntos de acopio y órdenes de cosecha...
      </div>
    );
  }

  const activeAssign = data.assignments.find((a) => a.id === activeAssignId);

  return (
    <div className="space-y-6">
      {/* Top Bar: Collection Point Selector + Offline Mode Simulator */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rf-border bg-rf-graphite p-5 text-white shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-rf-yellow">
              Punto de acopio rural
            </div>
            <select
              value={selectedCpId}
              onChange={(e) => {
                setSelectedCpId(e.target.value);
                loadData(e.target.value || undefined);
              }}
              className="mt-1 rounded-xl border border-white/20 bg-rf-graphite-light px-3 py-2 text-sm font-bold text-white outline-none"
            >
              <option value="">Todos los puntos de acopio (Boyacá y Cundinamarca)</option>
              {data.collectionPoints.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} ({cp.connectivityType})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Offline Simulator Toggle */}
          <button
            type="button"
            onClick={() => setSimulatedOffline((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              simulatedOffline
                ? "bg-rf-yellow text-rf-graphite"
                : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {simulatedOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4 text-rf-green" />}
            {simulatedOffline ? "Modo SIN SEÑAL activo (Simulado)" : "Simular corte de señal"}
          </button>

          {offlineQueue.length > 0 && (
            <button
              type="button"
              disabled={syncing}
              onClick={syncOfflineQueue}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rf-green px-3.5 py-2 text-xs font-bold text-white hover:bg-rf-green-dark"
            >
              <CloudUpload className="h-4 w-4" />
              {syncing ? "Sincronizando..." : `Sincronizar cola (${offlineQueue.length})`}
            </button>
          )}

          <a
            href="/api/pdf/afiche"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-rf-graphite hover:bg-rf-yellow"
          >
            <FileText className="h-4 w-4 text-rf-green" />
            Afiche Acopio PDF
          </a>
        </div>
      </div>

      {/* Offline queue banner */}
      {offlineQueue.length > 0 && (
        <div className="rounded-2xl border-2 border-rf-yellow bg-rf-yellow-soft p-4 text-xs text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold">
              Cola offline local (IndexedDB): {offlineQueue.length} pesaje(s) pendiente(s) por
              subir al recuperar señal satelital o 4G
            </div>
            <button
              type="button"
              onClick={syncOfflineQueue}
              className="inline-flex items-center gap-1 rounded-lg bg-rf-graphite px-3 py-1.5 font-bold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Sincronizar ahora
            </button>
          </div>
          <ul className="mt-2 list-disc pl-5 space-y-0.5">
            {offlineQueue.map((q) => (
              <li key={q.offlineSyncId}>
                <strong>{q.labelSummary}</strong> · Calidad: {q.qualityResult} · Guardado:{" "}
                {formatDateTimeCO(q.queuedAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold ${
            feedback.type === "ok"
              ? "bg-rf-green-soft text-rf-green-dark"
              : "bg-rf-yellow-soft text-amber-900"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Expected Deliveries to Weigh (W48) */}
        <div className="space-y-3 lg:col-span-7">
          <h2 className="font-display text-lg font-bold text-rf-graphite">
            Recepción de cosecha · Semana 48 ({data.assignments.length} órdenes)
          </h2>
          <div className="space-y-3">
            {data.assignments.map((a) => {
              const isWeighed = a.status === "WEIGHED";
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl border bg-white p-4 shadow-card ${
                    isWeighed ? "border-rf-green/50 bg-rf-green-soft/20" : "border-rf-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rf-bg text-2xl">
                        {PRODUCT_EMOJI[a.product.iconKey] || "🥬"}
                      </span>
                      <div>
                        <div className="font-display text-base font-bold text-rf-graphite">
                          {a.producer.user.fullName} — {a.product.name}
                        </div>
                        <div className="text-xs text-slate-600">
                          Pidieron: <strong>{formatKg(a.assignedKg)}</strong> ·{" "}
                          {formatCOP(a.producerPricePerKgCop)}/kg · {a.collectionPoint.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span>Pago: {PAYMENT_TERM_LABELS[a.producer.paymentTerm]}</span>
                          <span>·</span>
                          <span>Canal: {CHANNEL_LABELS[a.producer.primaryChannel]}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/pdf/boleta?producerId=${a.producer.id}&week=2026-W48`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-rf-border px-2.5 py-2 text-xs font-semibold text-rf-graphite hover:bg-rf-bg"
                        title="Imprimir Boleta de Pedido"
                      >
                        Boleta PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAssignId(a.id);
                          setActualKg(a.lot?.actualKg ?? a.assignedKg);
                          setQualityResult("APPROVED_STANDARD");
                          setCaptureChannel(
                            a.producer.primaryChannel === "ACOPIO_PAPER"
                              ? "ACOPIO_PAPER"
                              : "ACOPIO_TABLET"
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
                          isWeighed
                            ? "bg-rf-graphite text-white"
                            : "bg-rf-green text-white hover:bg-rf-green-dark"
                        }`}
                      >
                        <Scale className="h-4 w-4" />
                        {isWeighed ? `Pesado (${a.lot?.actualKg} kg)` : "Pesar y emitir Lote"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Tablet Weighing Desk OR Recent Lots */}
        <div className="space-y-5 lg:col-span-5">
          {activeAssign ? (
            <div className="sticky top-28 rounded-2xl border-2 border-rf-green bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-rf-graphite">
                  Báscula y Control de Calidad
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveAssignId(null)}
                  className="text-xs font-semibold text-slate-500"
                >
                  Cerrar
                </button>
              </div>
              <div className="mt-2 rounded-xl bg-rf-bg p-3 text-xs">
                <div className="font-bold text-rf-graphite">
                  {activeAssign.producer.user.fullName} ({activeAssign.producer.farmName})
                </div>
                <div className="text-slate-600">
                  {activeAssign.product.name} · Pedido confirmado:{" "}
                  <strong>{activeAssign.assignedKg} kg</strong>
                </div>
              </div>

              <form onSubmit={handleWeighSubmit} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-rf-graphite">
                    Kilos que trajo (báscula certificada)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    required
                    value={actualKg}
                    onChange={(e) => setActualKg(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border-2 border-rf-green px-4 py-3 text-2xl font-bold tabular-nums outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-rf-graphite">
                    Resultado de inspección de calidad
                  </label>
                  <div className="mt-1.5 grid gap-2">
                    {[
                      {
                        val: "APPROVED_STANDARD" as const,
                        label: "✓ Estándar Aprobado (100 % precio pactado)",
                        cls: "border-rf-green bg-rf-green-soft text-rf-green-dark",
                      },
                      {
                        val: "RECLASSIFIED_FUNCTIONAL" as const,
                        label: "🌿 Calidad Funcional (sano, forma irregular · rescata merma)",
                        cls: "border-rf-yellow bg-rf-yellow-soft text-amber-900",
                      },
                      {
                        val: "REJECTED" as const,
                        label: "✗ Rechazado (abre incidencia y reposición automática)",
                        cls: "border-rf-danger bg-rf-danger-soft text-rf-danger",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setQualityResult(opt.val)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-left font-bold transition ${
                          qualityResult === opt.val
                            ? opt.cls
                            : "border-rf-border bg-white text-slate-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {qualityResult === "REJECTED" && (
                  <div>
                    <label className="block font-bold text-rf-danger">
                      Causa obligatoria de rechazo (para analítica diagnóstica)
                    </label>
                    <input
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ej. Producto sobremaduro o daño por granizada"
                      className="mt-1 w-full rounded-xl border border-red-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold">Canal de registro</label>
                    <select
                      value={captureChannel}
                      onChange={(e) => setCaptureChannel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-rf-border px-2.5 py-2 text-xs"
                    >
                      <option value="ACOPIO_TABLET">Tableta punto de acopio</option>
                      <option value="ACOPIO_PAPER">Boleta física (sin celular)</option>
                      <option value="PHONE_CALL">Confirmado por llamada</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-rf-border bg-rf-bg px-3 py-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={signatureAck}
                      onChange={(e) => setSignatureAck(e.target.checked)}
                      className="accent-rf-green"
                    />
                    Firma o huella en Boleta
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rf-green py-3.5 text-sm font-bold text-white shadow hover:bg-rf-green-dark"
                >
                  <QrCode className="h-4 w-4" />
                  {simulatedOffline
                    ? "Guardar en cola offline (sin señal)"
                    : "Confirmar pesaje y generar Código de Lote"}
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-rf-green" />
                <h3 className="font-display text-base font-bold text-rf-graphite">
                  Últimos lotes generados con trazabilidad
                </h3>
              </div>
              <div className="mt-4 max-h-[500px] space-y-2.5 overflow-y-auto pr-1">
                {data.lots.slice(0, 15).map((lot) => (
                  <div
                    key={lot.id}
                    className="rounded-xl border border-rf-border bg-rf-bg/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-rf-green-dark">{lot.lotCode}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          lot.qualityResult === "REJECTED"
                            ? "bg-rf-danger-soft text-rf-danger"
                            : "bg-rf-green-soft text-rf-green-dark"
                        }`}
                      >
                        {lot.qualityResult === "REJECTED" ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {lot.qualityResult === "APPROVED_STANDARD"
                          ? "Estándar"
                          : lot.qualityResult === "RECLASSIFIED_FUNCTIONAL"
                          ? "Funcional"
                          : "Rechazado"}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-rf-graphite">
                      {PRODUCT_EMOJI[lot.product.iconKey]} {lot.product.name} ·{" "}
                      {formatKg(lot.actualKg)} (pedido {lot.requestedKg} kg)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {lot.producer.user.fullName} ({lot.farmName}, {lot.municipality}) ·{" "}
                      {CHANNEL_LABELS[lot.captureChannel] || lot.captureChannel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
