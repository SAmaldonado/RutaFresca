"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  X,
  Volume2,
  Mic,
  Square,
  FileText,
  ExternalLink,
  Sprout,
  Wallet,
  ShieldCheck,
  Award,
  MessageCircle,
} from "lucide-react";
import {
  CHANNEL_LABELS,
  formatCOP,
  formatDateCO,
  formatDateTimeCO,
  formatKg,
  PAYMENT_TERM_LABELS,
  PRODUCT_EMOJI,
} from "@/lib/format";

interface AssignmentItem {
  id: string;
  assignmentCode: string;
  deliveryWeek: string;
  assignedKg: number;
  producerPricePerKgCop: number;
  pickupDatetime: string;
  paymentDueDate: string;
  status: string;
  captureChannel: string;
  product: { id: string; name: string; iconKey: string };
  collectionPoint: { id: string; name: string };
  lot: { lotCode: string; actualKg: number } | null;
  whatsappPreview: {
    messageBody: string;
    voiceScript: string;
    waMeUrl: string;
  };
  evidences: Array<{
    id: string;
    direction: string;
    channel: string;
    messageBody: string;
    audioTranscript: string | null;
    actionClicked: string | null;
    contentSha256Hash: string;
    createdAt: string;
  }>;
}

interface ProducerDashboardData {
  producer: {
    id: string;
    uniqueCode: string;
    farmName: string;
    vereda: string;
    hectares: number;
    paymentTerm: string;
    fulfillmentScore: number;
    primaryChannel: string;
    user: { fullName: string; phone: string };
    zone: { department: string; municipality: string };
    association: {
      name: string;
      hasFinagroInsurance: boolean;
      insuranceType: string;
      digitalLeaderName: string;
    } | null;
  };
  allProducers: Array<{
    id: string;
    uniqueCode: string;
    fullName: string;
    municipality: string;
    primaryChannel: string;
    paymentTerm: string;
  }>;
  assignments: AssignmentItem[];
  sowingDeclarations: Array<{
    id: string;
    sowingDate: string;
    estimatedHarvestStart: string;
    estimatedHarvestEnd: string;
    estimatedKg: number;
    staggeredBatchNumber: number;
    product: { name: string; iconKey: string };
  }>;
  settlements: Array<{
    id: string;
    settlementCode: string;
    deliveryWeek: string;
    netAmountCop: number;
    dueDate: string;
    paidAt: string | null;
    paymentMethod: string;
    status: string;
  }>;
  products: Array<{ id: string; name: string }>;
  summary: {
    totalEarnedCop: number;
    pendingPayCop: number;
    completedDeliveries: number;
    fulfillmentScore: number;
  };
}

export function ProducerPortalClient() {
  const [data, setData] = useState<ProducerDashboardData | null>(null);
  const [selectedProducerId, setSelectedProducerId] = useState("");
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Voice recording state for WhatsApp simulator
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [voiceNoteText, setVoiceNoteText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Decline modal
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("Lluvia fuerte / helada en el cultivo");
  const [declineClimate, setDeclineClimate] = useState(true);

  // Sowing form
  const [sowProductId, setSowProductId] = useState("");
  const [sowKg, setSowKg] = useState(350);
  const [sowBatch, setSowBatch] = useState(1);

  const loadDashboard = useCallback(async (prodId?: string) => {
    const qs = prodId ? `?producerId=${encodeURIComponent(prodId)}` : "";
    const res = await fetch(`/api/producer/dashboard${qs}`);
    if (res.ok) {
      const json = (await res.json()) as ProducerDashboardData;
      setData(json);
      setSelectedProducerId(json.producer.id);
      if (json.products.length > 0) {
        setSowProductId((prev) => prev || json.products[0].id);
      }
      const w48 = json.assignments.find((a) => a.deliveryWeek === "2026-W48");
      setActiveAssignmentId((prev) => prev || w48?.id || json.assignments[0]?.id || null);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function speakVoiceNote(script: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.lang = "es-CO";
    u.rate = 0.96;
    window.speechSynthesis.speak(u);
  }

  async function toggleVoiceRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudioUrl(String(reader.result || ""));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      // Graceful fallback when microphone is unavailable (desktop without mic)
      setVoiceNoteText("Listo, sí cumplo con todos los kilos el martes a las 6 de la mañana.");
      setFeedback("Micrófono no detectado: se preparó una nota de voz simulada lista para enviar.");
    }
  }

  async function respondAssignment(
    assignmentId: string,
    action: "SI_CUMPLO" | "NO_ALCANZO",
    channel: "WHATSAPP_AUDIO" | "WHATSAPP_TEXT" | "WEB" = "WHATSAPP_AUDIO",
    reason?: string,
    isClimateEvent = false
  ) {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          channel,
          reason,
          isClimateEvent,
          audioDataUrl: recordedAudioUrl,
          audioTranscript: voiceNoteText || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setDecliningId(null);
        setRecordedAudioUrl(null);
        setVoiceNoteText("");
        setFeedback(
          action === "SI_CUMPLO"
            ? `✓ Confirmado y guardado con soporte legal Ley 527 (Hash: ${json.evidence.contentSha256Hash.slice(
                0,
                16
              )}...). ¡Lo esperamos en el punto de acopio!`
            : `Aviso recibido. ${
                isClimateEvent
                  ? "Al ser evento climático, NO tiene ninguna penalidad; activamos respaldo en otra zona."
                  : "Avisamos al equipo para redistribuir la carga."
              }`
        );
        await loadDashboard(selectedProducerId);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSowing(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/sowing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producerId: data.producer.id,
          productId: sowProductId,
          sowingDate: "2026-11-22",
          estimatedHarvestStart: "2027-01-12",
          estimatedHarvestEnd: "2027-02-05",
          estimatedKg: Number(sowKg),
          staggeredBatchNumber: Number(sowBatch),
          captureChannel: data.producer.primaryChannel,
        }),
      });
      if (res.ok) {
        setFeedback("Planeación de siembra registrada (orientativa para el próximo ciclo).");
        await loadDashboard(data.producer.id);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rf-border bg-white p-10 text-center text-sm text-slate-500">
        Cargando sus pedidos de cosecha y boleta...
      </div>
    );
  }

  const w48Assignments = data.assignments.filter((a) => a.deliveryWeek === "2026-W48");
  const activeWaAssignment =
    data.assignments.find((a) => a.id === activeAssignmentId) ||
    w48Assignments[0] ||
    data.assignments[0];

  return (
    <div className="space-y-6">
      {/* Friendly Producer Header — Cero tecnicismos */}
      <div className="rounded-2xl border border-rf-border bg-rf-green p-5 text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-rf-yellow px-3 py-0.5 text-xs font-bold text-rf-graphite">
                Para usted es gratis
              </span>
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold">
                {PAYMENT_TERM_LABELS[data.producer.paymentTerm] || data.producer.paymentTerm}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold">
                Canal: {CHANNEL_LABELS[data.producer.primaryChannel] || data.producer.primaryChannel}
              </span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Hola, {data.producer.user.fullName}
            </h2>
            <p className="text-sm text-emerald-50">
              {data.producer.farmName} · Vereda {data.producer.vereda},{" "}
              {data.producer.zone.municipality} ({data.producer.zone.department}) ·{" "}
              {data.producer.association?.name || "Productor independiente"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProducerId}
              onChange={(e) => {
                setActiveAssignmentId(null);
                loadDashboard(e.target.value);
              }}
              className="rounded-xl border border-white/30 bg-rf-green-dark px-3 py-2 text-xs font-semibold text-white outline-none"
            >
              {data.allProducers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.municipality} · {CHANNEL_LABELS[p.primaryChannel]})
                </option>
              ))}
            </select>
            <a
              href={`/api/pdf/boleta?producerId=${data.producer.id}&week=2026-W48`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-rf-graphite shadow hover:bg-rf-yellow"
            >
              <FileText className="h-4 w-4 text-rf-green" />
              Imprimir Boleta de Pedido (PDF)
            </a>
            <a
              href="/api/pdf/afiche"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rf-graphite px-3.5 py-2 text-xs font-bold text-white hover:bg-rf-graphite-light"
            >
              <FileText className="h-4 w-4 text-rf-yellow" />
              Afiche Acopio (PDF)
            </a>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-rf-green bg-rf-green-soft px-4 py-3 text-sm font-semibold text-rf-green-dark">
          {feedback}
        </div>
      )}

      {/* Main Split: Simple Harvest Cards + Interactive Brand-Manual WhatsApp Phone */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Large Readable Harvest Order Cards */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-bold text-rf-graphite">
                Sus pedidos confirmados — Semana 48
              </h3>
              <p className="text-sm text-slate-600">
                Coseche únicamente lo que aparece aquí. Ya tiene comprador y precio fijo.
              </p>
            </div>
          </div>

          {w48Assignments.length === 0 ? (
            <div className="rounded-2xl border border-rf-border bg-white p-6 text-sm text-slate-600">
              No tiene pedidos nuevos asignados para esta semana todavía. Puede consultar el
              historial de entregas y pagos abajo.
            </div>
          ) : (
            <div className="space-y-4">
              {w48Assignments.map((a) => {
                const totalAmount = Math.round(a.assignedKg * a.producerPricePerKgCop);
                const isSelected = activeWaAssignment?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => setActiveAssignmentId(a.id)}
                    className={`cursor-pointer rounded-2xl border-2 bg-white p-5 shadow-card transition ${
                      isSelected ? "border-rf-green" : "border-rf-border hover:border-rf-green/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rf-green-soft text-4xl">
                          {PRODUCT_EMOJI[a.product.iconKey] || "🥬"}
                        </div>
                        <div>
                          <div className="font-display text-xl font-bold text-rf-graphite">
                            {a.product.name}
                          </div>
                          <div className="text-lg font-bold text-rf-green-dark tabular-nums">
                            {a.assignedKg} kilos · {formatCOP(a.producerPricePerKgCop)} el kilo
                          </div>
                          <div className="text-sm font-semibold text-slate-700 tabular-nums">
                            Total que recibe: {formatCOP(totalAmount)}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          a.status === "CONFIRMED" || a.status === "WEIGHED"
                            ? "bg-rf-green-soft text-rf-green-dark"
                            : a.status === "SENT"
                            ? "bg-rf-yellow-soft text-amber-900"
                            : "bg-rf-danger-soft text-rf-danger"
                        }`}
                      >
                        {a.status === "SENT"
                          ? "Falta su respuesta"
                          : a.status === "CONFIRMED"
                          ? "✓ Confirmado por usted"
                          : a.status === "WEIGHED"
                          ? `✓ Pesado (${a.lot?.actualKg ?? a.assignedKg} kg)`
                          : "No alcanza / Clima"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 rounded-xl bg-rf-bg p-3 text-sm sm:grid-cols-3">
                      <div>
                        <span className="block text-[11px] font-bold uppercase text-slate-500">
                          Traer el
                        </span>
                        <span className="font-semibold text-rf-graphite">
                          {formatDateTimeCO(a.pickupDatetime)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold uppercase text-slate-500">
                          Punto de acopio
                        </span>
                        <span className="font-semibold text-rf-graphite">
                          {a.collectionPoint.name}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold uppercase text-slate-500">
                          Le pagamos máximo el
                        </span>
                        <span className="font-bold text-rf-green-dark">
                          {formatDateCO(a.paymentDueDate)}
                        </span>
                      </div>
                    </div>

                    {/* Big Accessible Buttons */}
                    {a.status === "SENT" && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            respondAssignment(a.id, "SI_CUMPLO", "WEB");
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rf-green py-3.5 text-base font-bold text-white shadow hover:bg-rf-green-dark"
                        >
                          <Check className="h-5 w-5" />
                          Sí cumplo
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDecliningId(a.id);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white py-3.5 text-base font-bold text-rf-graphite hover:bg-rf-bg"
                        >
                          <X className="h-5 w-5" />
                          No alcanzo
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reputación & Seguro Finagro cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold text-rf-green-dark">
                <Award className="h-4 w-4" />
                Historial de cumplimiento (para crédito)
              </div>
              <div className="mt-2 text-3xl font-bold text-rf-graphite tabular-nums">
                {data.summary.fulfillmentScore} / 100
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {data.summary.completedDeliveries} entregas cumplidas y verificadas. Su historial
                queda guardado como respaldo para solicitar crédito agropecuario.
              </p>
            </div>

            <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold text-rf-green-dark">
                <ShieldCheck className="h-4 w-4" />
                Seguro Agropecuario Finagro / Climático
              </div>
              <div className="mt-2 text-lg font-bold text-rf-graphite">
                {data.producer.association?.hasFinagroInsurance
                  ? `Activo (${
                      data.producer.association.insuranceType === "PARAMETRIC"
                        ? "Paramétrico satelital"
                        : "ISA subsidiado 80–90 %"
                    })`
                  : "En trámite con la asociación"}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Usted nunca responde con su patrimonio si una helada o granizada certificada daña
                el cultivo.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Exact Brand-Manual WhatsApp + Voice Note Simulator (Ley 527) */}
        <div className="lg:col-span-5">
          <div className="sticky top-28 rounded-3xl border-4 border-rf-graphite bg-[#ECE5DD] shadow-xl overflow-hidden">
            {/* WhatsApp Header */}
            <div className="flex items-center justify-between bg-[#1F4E2E] px-4 py-3 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rf-green font-display text-sm font-bold">
                  RF
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight">Ruta Fresca</div>
                  <div className="text-[11px] text-emerald-200">
                    {data.producer.association?.name || "Atención WhatsApp · Notas de voz"}
                  </div>
                </div>
              </div>
              {activeWaAssignment && (
                <a
                  href={activeWaAssignment.whatsappPreview.waMeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/25"
                  title="Abrir mensaje real en WhatsApp"
                >
                  <ExternalLink className="h-3 w-3" /> wa.me
                </a>
              )}
            </div>

            {/* Chat Body */}
            <div className="max-h-[470px] space-y-3 overflow-y-auto p-4">
              <div className="mx-auto w-fit rounded-lg bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                Simulador fiel al Manual de Marca · Evidencia Ley 527 de 1999
              </div>

              {activeWaAssignment ? (
                <>
                  {/* Outbound Voice Note from Ruta Fresca */}
                  <div className="max-w-[92%] rounded-2xl rounded-tl-none bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          speakVoiceNote(activeWaAssignment.whatsappPreview.voiceScript)
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rf-green text-white hover:bg-rf-green-dark"
                        title="Escuchar nota de voz del pedido"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-0.5">
                          {[3, 6, 9, 5, 11, 8, 4, 10, 7, 12, 6, 9, 5, 8, 4, 6].map((h, i) => (
                            <span
                              key={i}
                              className="w-1 rounded-full bg-rf-green/70"
                              style={{ height: `${h * 2}px` }}
                            />
                          ))}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Nota de voz del pedido · Oprima para escuchar en español
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Outbound Visual Card (exact Brand Manual style) */}
                  <div className="max-w-[92%] overflow-hidden rounded-2xl rounded-tl-none bg-white shadow-sm">
                    <div className="bg-rf-green px-3 py-1.5 text-xs font-bold text-white">
                      ✓ Le quedó vendido
                    </div>
                    <div className="p-3 text-xs text-rf-graphite">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">
                          {PRODUCT_EMOJI[activeWaAssignment.product.iconKey] || "🥬"}
                        </span>
                        <div>
                          <div className="font-display text-base font-bold">
                            {activeWaAssignment.product.name}
                          </div>
                          <div className="text-sm font-bold text-rf-green-dark">
                            {activeWaAssignment.assignedKg} kilos
                          </div>
                        </div>
                      </div>
                      <ul className="mt-2.5 space-y-1 text-[12px] text-slate-700">
                        <li>
                          💰{" "}
                          <strong>
                            {formatCOP(activeWaAssignment.producerPricePerKgCop)} el kilo
                          </strong>
                        </li>
                        <li>📅 Traer: {formatDateTimeCO(activeWaAssignment.pickupDatetime)}</li>
                        <li>📍 {activeWaAssignment.collectionPoint.name}</li>
                        <li>
                          💵 Pago máximo el {formatDateCO(activeWaAssignment.paymentDueDate)}
                        </li>
                      </ul>

                      {/* Interactive WhatsApp Buttons */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            respondAssignment(
                              activeWaAssignment.id,
                              "SI_CUMPLO",
                              "WHATSAPP_AUDIO"
                            )
                          }
                          className="rounded-lg bg-rf-green py-2 text-xs font-bold text-white hover:bg-rf-green-dark"
                        >
                          ✓ Sí cumplo
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => setDecliningId(activeWaAssignment.id)}
                          className="rounded-lg border border-slate-300 bg-rf-bg py-2 text-xs font-bold text-rf-graphite"
                        >
                          ✗ No alcanzo
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Persisted Evidence Messages (Ley 527) */}
                  {activeWaAssignment.evidences
                    .filter((e) => e.direction === "INBOUND")
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="ml-auto max-w-[90%] rounded-2xl rounded-tr-none bg-[#DCF8C6] p-3 text-xs text-rf-graphite shadow-sm"
                      >
                        <div className="font-semibold">{ev.messageBody}</div>
                        {ev.audioTranscript && (
                          <div className="mt-1 italic text-slate-700">
                            🎙️ &ldquo;{ev.audioTranscript}&rdquo;
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-emerald-900/10 pt-1 text-[10px] text-emerald-900/70">
                          <span>Ley 527 SHA-256: {ev.contentSha256Hash.slice(0, 12)}…</span>
                          <span>{formatDateTimeCO(ev.createdAt)}</span>
                        </div>
                      </div>
                    ))}

                  {activeWaAssignment.status === "CONFIRMED" && (
                    <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-white px-3 py-2 text-xs text-rf-graphite shadow-sm">
                      Listo, {data.producer.user.fullName.split(" ")[0]}. Lo esperamos en el punto
                      de acopio. 👍
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-white p-4 text-xs text-slate-500">
                  Seleccione un pedido a la izquierda para previsualizar el flujo WhatsApp.
                </div>
              )}
            </div>

            {/* Voice Note Input Footer */}
            <div className="border-t border-black/10 bg-[#F0F0F0] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={voiceNoteText}
                  onChange={(e) => setVoiceNoteText(e.target.value)}
                  placeholder="Escriba respuesta o grabe una nota de voz..."
                  className="flex-1 rounded-full bg-white px-3.5 py-2 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${
                    recording ? "animate-pulse bg-rf-danger" : "bg-rf-green hover:bg-rf-green-dark"
                  }`}
                  title={recording ? "Detener grabación" : "Grabar nota de voz"}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                {activeWaAssignment && (voiceNoteText || recordedAudioUrl) && (
                  <button
                    type="button"
                    onClick={() =>
                      respondAssignment(activeWaAssignment.id, "SI_CUMPLO", "WHATSAPP_AUDIO")
                    }
                    className="rounded-full bg-rf-graphite px-3 py-2 text-xs font-bold text-white"
                  >
                    Enviar
                  </button>
                )}
              </div>
              {recordedAudioUrl && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-rf-green-dark">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Audio grabado listo para confirmar pedido con respaldo Ley 527.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Sowing Planning (Orientative) & Settlements */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sowing planning */}
        <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-6">
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-rf-green" />
            <h3 className="font-display text-base font-bold text-rf-graphite">
              Planeación de siembra por ciclo (orientativa)
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cuéntenos qué está sembrando para escalonar cosechas. Este registro orienta la demanda;
            la venta en firme se confirma cada semana con precio pactado.
          </p>

          <form onSubmit={submitSowing} className="mt-4 grid gap-2 sm:grid-cols-4">
            <select
              value={sowProductId}
              onChange={(e) => setSowProductId(e.target.value)}
              className="rounded-xl border border-rf-border px-2.5 py-2 text-xs sm:col-span-2"
            >
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={20}
              value={sowKg}
              onChange={(e) => setSowKg(Number(e.target.value))}
              placeholder="Kilos est."
              className="rounded-xl border border-rf-border px-2.5 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-rf-green px-3 py-2 text-xs font-bold text-white hover:bg-rf-green-dark"
            >
              Registrar siembra
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {data.sowingDeclarations.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-rf-bg px-3.5 py-2.5 text-xs"
              >
                <div>
                  <span className="font-bold text-rf-graphite">
                    {PRODUCT_EMOJI[s.product.iconKey]} {s.product.name}
                  </span>
                  <span className="ml-2 text-slate-500">Lote escalonado #{s.staggeredBatchNumber}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rf-green-dark">{formatKg(s.estimatedKg)}</div>
                  <div className="text-[10px] text-slate-500">
                    Cosecha est.: {formatDateCO(s.estimatedHarvestStart)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payments & Settlements */}
        <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-rf-green" />
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Sus pagos claros y puntuales
              </h3>
            </div>
            <div className="text-right text-xs">
              <div className="font-bold text-rf-green-dark">
                Recibido: {formatCOP(data.summary.totalEarnedCop)}
              </div>
              <div className="text-slate-500">
                Por recibir: {formatCOP(data.summary.pendingPayCop)}
              </div>
            </div>
          </div>

          <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
            {data.settlements.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between rounded-xl border border-rf-border bg-rf-bg/40 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <div className="font-bold text-rf-graphite">
                    {st.settlementCode} · Semana {st.deliveryWeek}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Medio: {st.paymentMethod} · Fecha límite: {formatDateCO(st.dueDate)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rf-graphite tabular-nums">
                    {formatCOP(st.netAmountCop)}
                  </div>
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

      {/* Decline / No Alcanzo Modal */}
      {decliningId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-rf-graphite">
              Avisar que no alcanza a cumplir
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Avisar con tiempo nos permite proteger al comprador sin afectarle a usted.
            </p>
            <div className="mt-4 space-y-3 text-xs">
              <label className="flex items-center gap-2 rounded-xl border border-rf-green/40 bg-rf-green-soft p-3 font-semibold text-rf-graphite">
                <input
                  type="checkbox"
                  checked={declineClimate}
                  onChange={(e) => setDeclineClimate(e.target.checked)}
                  className="accent-rf-green"
                />
                Fue por helada, granizada o lluvia fuerte (evento climático — cero penalidad)
              </label>
              <div>
                <label className="block font-semibold">Cuéntenos brevemente el motivo:</label>
                <input
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDecliningId(null)}
                  className="rounded-xl border border-rf-border px-4 py-2 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    respondAssignment(
                      decliningId,
                      "NO_ALCANZO",
                      "WHATSAPP_AUDIO",
                      declineReason,
                      declineClimate
                    )
                  }
                  className="rounded-xl bg-rf-graphite px-4 py-2 font-bold text-white"
                >
                  Enviar aviso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
