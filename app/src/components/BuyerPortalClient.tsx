"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  Repeat,
  FileCheck2,
  ShieldAlert,
  Leaf,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  Download,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  formatCOP,
  formatDateCO,
  formatKg,
  ORDER_STATUS_LABELS,
  PRODUCT_EMOJI,
} from "@/lib/format";

interface CatalogItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  iconKey: string;
  supportsFunctionalQuality: boolean;
  functionalDiscountPct: number;
  agreedBuyerPriceCop: number;
  functionalBuyerPriceCop: number;
  sipsaRefPriceCop: number;
  bandStatus: "LOW" | "MEDIUM" | "HIGH";
}

interface OrderRecord {
  id: string;
  orderCode: string;
  deliveryWeek: string;
  deliveryDate: string;
  commitmentType: string;
  status: string;
  notes: string | null;
  items: Array<{
    id: string;
    productId: string;
    qualityGrade: string;
    requestedKg: number;
    adjustedKg: number;
    deliveredKg: number;
    unitPriceCop: number;
    product: { name: string; iconKey: string };
  }>;
  lots: Array<{
    id: string;
    lotCode: string;
    farmName: string;
    municipality: string;
    harvestDate: string;
    actualKg: number;
    qualityResult: string;
    product: { name: string };
    producer: { user: { fullName: string } };
    association: { name: string } | null;
  }>;
  deliveryReceipt: {
    otifOnTime: boolean;
    otifInFull: boolean;
    wasteMermaKg: number;
    wasteMermaPct: number;
    receivedByName: string;
    notes: string | null;
  } | null;
  incidents: Array<{
    id: string;
    incidentCode: string;
    affectedKg: number;
    resolutionType: string;
    status: string;
    description: string;
    product: { name: string };
    substituteProduct: { name: string } | null;
  }>;
}

interface BuyerDashboardData {
  buyerOrg: {
    id: string;
    code: string;
    name: string;
    segment: string;
    address: string;
    dailyMealsRange: string;
    deliveryWindowStart: string;
    deliveryWindowEnd: string;
    pricingMode: string;
    commissionRate: number;
    subscriptionFeeCop: number;
    user: { fullName: string };
  };
  allBuyers: Array<{ id: string; code: string; name: string; segment: string }>;
  activeCycle: { id: string; name: string; ipcFoodPct: number } | null;
  catalog: CatalogItem[];
  substituteRules: Array<{
    id: string;
    primaryProductId: string;
    substituteProductId: string;
    autoApproveIfShortage: boolean;
    notes: string | null;
    primaryProduct: { name: string; iconKey: string };
    substituteProduct: { name: string; iconKey: string };
  }>;
  orders: OrderRecord[];
  metrics: {
    otifPct: number;
    totalKgOrdered: number;
    functionalKg: number;
    estimatedCo2AvoidedKg: number;
    ley2046: {
      acfcVerifiedSpendCop: number;
      acfcSharePct: number;
      meetsStatutory30Pct: boolean;
      distinctSmallholdersCount: number;
      distinctAssociationsCount: number;
      verifiedLotsCount: number;
    };
  };
}

export function BuyerPortalClient() {
  const [data, setData] = useState<BuyerDashboardData | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");
  const [tab, setTab] = useState<"NEW_ORDER" | "ORDERS" | "SUBSTITUTES" | "TRACEABILITY">(
    "NEW_ORDER"
  );
  const [cart, setCart] = useState<
    Record<string, { kg: number; qualityGrade: "STANDARD" | "FUNCTIONAL" }>
  >({});
  const [commitmentType, setCommitmentType] = useState<"PARTIAL" | "FULL">("PARTIAL");
  const [deliveryDate, setDeliveryDate] = useState("2026-12-01");
  const [orderNotes, setOrderNotes] = useState(
    "Entrega en puerta de cocina entre 6:00 y 7:30 a. m."
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Reception modal state
  const [receivingOrder, setReceivingOrder] = useState<OrderRecord | null>(null);
  const [recOnTime, setRecOnTime] = useState(true);
  const [recInFull, setRecInFull] = useState(true);
  const [recMermaKg, setRecMermaKg] = useState(2);
  const [recShortProdId, setRecShortProdId] = useState("");
  const [recShortKg, setRecShortKg] = useState(15);
  const [recNotes, setRecNotes] = useState("Producto recibido fresco y clasificado por lote.");

  // Substitute rule form
  const [subPrimary, setSubPrimary] = useState("");
  const [subAlt, setSubAlt] = useState("");
  const [subNotes, setSubNotes] = useState("Aceptado por chef para menú semanal.");

  const loadDashboard = useCallback(async (orgId?: string) => {
    const qs = orgId ? `?buyerOrgId=${encodeURIComponent(orgId)}` : "";
    const res = await fetch(`/api/buyer/dashboard${qs}`);
    if (res.ok) {
      const json = (await res.json()) as BuyerDashboardData;
      setData(json);
      setSelectedBuyerId(json.buyerOrg.id);
      if (json.catalog.length >= 2) {
        setSubPrimary((prev) => prev || json.catalog[0].productId);
        setSubAlt((prev) => prev || json.catalog[1].productId);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const cartSummary = useMemo(() => {
    if (!data) return { totalKg: 0, subtotal: 0, savings: 0, commission: 0, subProrated: 0, total: 0, count: 0 };
    let totalKg = 0;
    let subtotal = 0;
    let savings = 0;
    let count = 0;

    for (const [productId, entry] of Object.entries(cart)) {
      if (entry.kg <= 0) continue;
      const prod = data.catalog.find((c) => c.productId === productId);
      if (!prod) continue;
      count += 1;
      totalKg += entry.kg;
      const unit =
        entry.qualityGrade === "FUNCTIONAL"
          ? prod.functionalBuyerPriceCop
          : prod.agreedBuyerPriceCop;
      subtotal += Math.round(entry.kg * unit);
      if (entry.qualityGrade === "FUNCTIONAL") {
        savings += Math.round(entry.kg * (prod.agreedBuyerPriceCop - prod.functionalBuyerPriceCop));
      }
    }

    const commission =
      data.buyerOrg.pricingMode === "PILOT_0_PCT"
        ? 0
        : Math.round(subtotal * data.buyerOrg.commissionRate);
    const subProrated =
      data.buyerOrg.pricingMode === "HYBRID_SUBSCRIPTION"
        ? Math.round(data.buyerOrg.subscriptionFeeCop / 4)
        : 0;

    return {
      totalKg,
      subtotal,
      savings,
      commission,
      subProrated,
      total: subtotal + commission + subProrated,
      count,
    };
  }, [cart, data]);

  function setCartQty(productId: string, kg: number) {
    setCart((prev) => ({
      ...prev,
      [productId]: {
        kg: Math.max(0, kg),
        qualityGrade: prev[productId]?.qualityGrade ?? "STANDARD",
      },
    }));
  }

  function toggleQuality(productId: string) {
    setCart((prev) => {
      const cur = prev[productId] ?? { kg: 0, qualityGrade: "STANDARD" as const };
      return {
        ...prev,
        [productId]: {
          ...cur,
          qualityGrade: cur.qualityGrade === "STANDARD" ? "FUNCTIONAL" : "STANDARD",
        },
      };
    });
  }

  function repeatLastOrder() {
    if (!data || data.orders.length === 0) return;
    const latest = data.orders[0];
    const next: Record<string, { kg: number; qualityGrade: "STANDARD" | "FUNCTIONAL" }> = {};
    for (const item of latest.items) {
      next[item.productId] = {
        kg: item.adjustedKg,
        qualityGrade: item.qualityGrade === "FUNCTIONAL" ? "FUNCTIONAL" : "STANDARD",
      };
    }
    setCart(next);
    setFeedback({
      type: "ok",
      text: `Se cargaron las cantidades del pedido ${latest.orderCode}. Puede ajustarlas antes de confirmar.`,
    });
  }

  async function submitOrder() {
    if (!data) return;
    const items = Object.entries(cart)
      .filter(([, v]) => v.kg > 0)
      .map(([productId, v]) => ({
        productId,
        kg: v.kg,
        qualityGrade: v.qualityGrade,
      }));
    if (items.length === 0) {
      setFeedback({ type: "err", text: "Agregue al menos un producto en kilos para crear el pedido." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerOrgId: data.buyerOrg.id,
          deliveryWeek: "2026-W49",
          deliveryDate,
          commitmentType,
          notes: orderNotes,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error || "No fue posible crear el pedido." });
        return;
      }
      setCart({});
      setFeedback({
        type: "ok",
        text: `Pedido ${json.order.orderCode} registrado (${
          commitmentType === "PARTIAL" ? "confirmación parcial con ajuste abierto" : "en firme"
        }).`,
      });
      await loadDashboard(data.buyerOrg.id);
      setTab("ORDERS");
    } finally {
      setSubmitting(false);
    }
  }

  async function lockPartialOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/adjust`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockOrder: true }),
    });
    if (res.ok && data) {
      setFeedback({ type: "ok", text: "Pedido confirmado en firme para programación de cosecha." });
      await loadDashboard(data.buyerOrg.id);
    }
  }

  async function submitReception(e: React.FormEvent) {
    e.preventDefault();
    if (!receivingOrder || !data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${receivingOrder.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedByName: data.buyerOrg.user.fullName,
          otifOnTime: recOnTime,
          otifInFull: recInFull,
          wasteMermaKg: Number(recMermaKg),
          notes: recNotes,
          shortageProductId: !recInFull ? recShortProdId || receivingOrder.items[0]?.productId : undefined,
          shortageKg: !recInFull ? Number(recShortKg) : 0,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setReceivingOrder(null);
        setFeedback({
          type: "ok",
          text: json.incident
            ? `Recepción registrada y protocolo de reposición activado (${json.incident.incidentCode}).`
            : "Recepción OTIF confirmada con éxito.",
        });
        await loadDashboard(data.buyerOrg.id);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function addSubstituteRule(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const res = await fetch("/api/substitutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerOrgId: data.buyerOrg.id,
        primaryProductId: subPrimary,
        substituteProductId: subAlt,
        autoApproveIfShortage: true,
        notes: subNotes,
      }),
    });
    if (res.ok) {
      setFeedback({ type: "ok", text: "Sustituto pre-acordado guardado para reposición automática." });
      await loadDashboard(data.buyerOrg.id);
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rf-border bg-white p-10 text-center text-sm text-slate-500">
        Cargando catálogo de precios pactados y pedidos del comedor...
      </div>
    );
  }

  const allLots = data.orders.flatMap((o) =>
    o.lots.map((l) => ({ ...l, orderCode: o.orderCode, deliveryWeek: o.deliveryWeek }))
  );

  return (
    <div className="space-y-6">
      {/* Buyer Org Selector & Pricing Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rf-border bg-rf-graphite p-5 text-white shadow-card">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rf-yellow px-2.5 py-0.5 text-[11px] font-bold text-rf-graphite">
              {data.buyerOrg.pricingMode === "PILOT_0_PCT"
                ? "Piloto 4 semanas · 0 % comisión"
                : data.buyerOrg.pricingMode === "HYBRID_SUBSCRIPTION"
                ? `Híbrido ${(data.buyerOrg.commissionRate * 100).toFixed(1)} % + Plan Abastecimiento`
                : `Comisión pactada ${(data.buyerOrg.commissionRate * 100).toFixed(1)} %`}
            </span>
            <span className="text-xs text-slate-300">
              Ventana fija: {data.buyerOrg.deliveryWindowStart} – {data.buyerOrg.deliveryWindowEnd}
            </span>
          </div>
          <h2 className="mt-2 font-display text-xl font-bold">{data.buyerOrg.name}</h2>
          <p className="text-xs text-slate-300">
            Responsable: {data.buyerOrg.user.fullName} · {data.buyerOrg.address} ·{" "}
            {data.buyerOrg.dailyMealsRange} comidas/día
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-300">Ver comedor:</label>
          <select
            value={selectedBuyerId}
            onChange={(e) => loadDashboard(e.target.value)}
            className="rounded-xl border border-white/20 bg-rf-graphite-light px-3 py-2 text-xs font-semibold text-white outline-none"
          >
            {data.allBuyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Cumplimiento OTIF</span>
            <CheckCircle2 className="h-4 w-4 text-rf-green" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rf-graphite tabular-nums">
            {data.metrics.otifPct} %
          </div>
          <div className="mt-1 text-[11px] text-rf-green-dark">
            Entregas completas en horario pactado (Meta ≥ 92 %)
          </div>
        </div>

        <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Soporte Ley 2046 (ACFC)</span>
            <FileCheck2 className="h-4 w-4 text-rf-green" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rf-graphite tabular-nums">
            {data.metrics.ley2046.acfcSharePct} % origen campesino
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            {data.metrics.ley2046.distinctSmallholdersCount} pequeños productores ·{" "}
            {data.metrics.ley2046.verifiedLotsCount} lotes verificados
          </div>
        </div>

        <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Calidad Funcional rescatada</span>
            <Leaf className="h-4 w-4 text-rf-green" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rf-graphite tabular-nums">
            {formatKg(data.metrics.functionalKg)}
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            Producto sano de forma irregular (-15 % a -25 % en sopas/jugos)
          </div>
        </div>

        <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Impacto sostenibilidad</span>
            <Leaf className="h-4 w-4 text-rf-yellow-dark" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rf-graphite tabular-nums">
            {formatKg(data.metrics.estimatedCo2AvoidedKg)} CO₂e
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            Evitados por menor merma en finca y ruta compartida
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "NEW_ORDER" as const, label: "1. Pedido semanal y precios pactados", icon: ShoppingBag },
          { key: "ORDERS" as const, label: `2. Mis pedidos y recepción (${data.orders.length})`, icon: Clock },
          { key: "SUBSTITUTES" as const, label: `3. Sustitutos pre-acordados (${data.substituteRules.length})`, icon: SlidersHorizontal },
          { key: "TRACEABILITY" as const, label: `4. Trazabilidad y Ley 2046 (${allLots.length} lotes)`, icon: FileCheck2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                active
                  ? "bg-rf-green text-white shadow"
                  : "border border-rf-border bg-white text-rf-graphite hover:bg-rf-green-soft"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold ${
            feedback.type === "ok"
              ? "bg-rf-green-soft text-rf-green-dark"
              : "bg-rf-danger-soft text-rf-danger"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: NEW ORDER + CYCLE PRICES */}
      {tab === "NEW_ORDER" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rf-border bg-white p-4 shadow-card">
              <div>
                <div className="text-xs font-bold text-rf-green-dark">
                  {data.activeCycle?.name || "Ciclo quincenal activo"}
                </div>
                <p className="text-xs text-slate-500">
                  Precios fijados por ciclo frente a referencia SIPSA (IPC alimentos:{" "}
                  {data.activeCycle?.ipcFoodPct ?? 7.31} %). Active «Calidad Funcional» para
                  descuentos en sopas, purés y jugos.
                </p>
              </div>
              <button
                type="button"
                onClick={repeatLastOrder}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rf-graphite px-3.5 py-2 text-xs font-semibold text-white hover:bg-rf-graphite-light"
              >
                <Repeat className="h-3.5 w-3.5 text-rf-yellow" />
                Repetir último pedido
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {data.catalog.map((item) => {
                const entry = cart[item.productId] ?? { kg: 0, qualityGrade: "STANDARD" as const };
                const isFunc = entry.qualityGrade === "FUNCTIONAL";
                const activePrice = isFunc
                  ? item.functionalBuyerPriceCop
                  : item.agreedBuyerPriceCop;
                const savingsVsSipsa = item.sipsaRefPriceCop - activePrice;

                return (
                  <div
                    key={item.productId}
                    className={`rounded-2xl border bg-white p-4 shadow-card transition ${
                      entry.kg > 0 ? "border-rf-green ring-1 ring-rf-green/30" : "border-rf-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rf-bg text-xl">
                          {PRODUCT_EMOJI[item.iconKey] || "🥬"}
                        </span>
                        <div>
                          <div className="font-display text-sm font-bold text-rf-graphite">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            SIPSA hoy: {formatCOP(item.sipsaRefPriceCop)}/kg
                            {savingsVsSipsa > 0 && (
                              <span className="ml-1 font-semibold text-rf-green-dark">
                                (ahorra {formatCOP(savingsVsSipsa)}/kg)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.bandStatus === "HIGH" && (
                        <span
                          className="rounded-full bg-rf-yellow-soft px-2 py-0.5 text-[10px] font-bold text-amber-800"
                          title="Precio de plaza volátil; su precio de ciclo le protege"
                        >
                          Plaza volátil
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-base font-bold text-rf-graphite tabular-nums">
                          {formatCOP(activePrice)}{" "}
                          <span className="text-xs font-normal text-slate-500">/ kg</span>
                        </div>
                        {item.supportsFunctionalQuality && (
                          <button
                            type="button"
                            onClick={() => toggleQuality(item.productId)}
                            className={`mt-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                              isFunc
                                ? "bg-rf-green text-white"
                                : "bg-rf-bg text-slate-600 hover:bg-rf-green-soft"
                            }`}
                          >
                            {isFunc
                              ? `✓ Calidad Funcional (-${Math.round(
                                  item.functionalDiscountPct * 100
                                )} %)`
                              : `Usar Calidad Funcional (${formatCOP(item.functionalBuyerPriceCop)})`}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCartQty(item.productId, entry.kg - 10)}
                          className="h-8 w-8 rounded-lg border border-rf-border bg-rf-bg text-sm font-bold text-rf-graphite hover:bg-slate-200"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={entry.kg}
                          onChange={(e) => setCartQty(item.productId, Number(e.target.value))}
                          className="w-16 rounded-lg border border-rf-border px-2 py-1 text-center text-sm font-bold tabular-nums outline-none focus:border-rf-green"
                        />
                        <button
                          type="button"
                          onClick={() => setCartQty(item.productId, entry.kg + 10)}
                          className="h-8 w-8 rounded-lg border border-rf-border bg-rf-bg text-sm font-bold text-rf-graphite hover:bg-rf-green-soft"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sticky Order Summary */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 rounded-2xl border border-rf-border bg-white p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Resumen del pedido semanal
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Usted puede confirmar hoy la base del menú (pedido parcial) y ajustar cantidades antes
                del cierre.
              </p>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-rf-graphite">Tipo de confirmación</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCommitmentType("PARTIAL")}
                      className={`rounded-xl border px-3 py-2 text-left font-semibold ${
                        commitmentType === "PARTIAL"
                          ? "border-rf-green bg-rf-green-soft text-rf-green-dark"
                          : "border-rf-border text-slate-600"
                      }`}
                    >
                      Parcial flexible
                      <span className="block text-[10px] font-normal">Permite ajuste ±15 %</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommitmentType("FULL")}
                      className={`rounded-xl border px-3 py-2 text-left font-semibold ${
                        commitmentType === "FULL"
                          ? "border-rf-green bg-rf-green-soft text-rf-green-dark"
                          : "border-rf-border text-slate-600"
                      }`}
                    >
                      Total en firme
                      <span className="block text-[10px] font-normal">Listo para cosecha</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-rf-graphite">Fecha de entrega</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-rf-graphite">
                    Notas de recepción / cocina
                  </label>
                  <textarea
                    rows={2}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-rf-border pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Productos / Peso total</span>
                  <span className="font-bold tabular-nums">
                    {cartSummary.count} ítems · {formatKg(cartSummary.totalKg)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal cosecha</span>
                  <span className="font-semibold tabular-nums">{formatCOP(cartSummary.subtotal)}</span>
                </div>
                {cartSummary.savings > 0 && (
                  <div className="flex justify-between text-rf-green-dark">
                    <span>Ahorro por Calidad Funcional</span>
                    <span className="font-bold tabular-nums">-{formatCOP(cartSummary.savings)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Comisión plataforma</span>
                  <span className="font-semibold tabular-nums">
                    {cartSummary.commission === 0
                      ? "$0 (Piloto sin comisión)"
                      : formatCOP(cartSummary.commission)}
                  </span>
                </div>
                {cartSummary.subProrated > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Plan Abastecimiento (prorrateo sem.)</span>
                    <span className="font-semibold tabular-nums">
                      {formatCOP(cartSummary.subProrated)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-rf-border pt-2 text-sm font-bold text-rf-graphite">
                  <span>Total estimado</span>
                  <span className="tabular-nums">{formatCOP(cartSummary.total)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting || cartSummary.totalKg <= 0}
                onClick={submitOrder}
                className="mt-5 w-full rounded-xl bg-rf-green py-3 text-sm font-bold text-white shadow hover:bg-rf-green-dark disabled:opacity-50"
              >
                {submitting ? "Confirmando pedido..." : "Confirmar pedido semanal"}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Incluye garantía de reposición ante faltantes (sustituto pre-acordado o respaldo
                Corabastos).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS & RECEPTION */}
      {tab === "ORDERS" && (
        <div className="space-y-4">
          {data.orders.map((order) => {
            const totalKg = order.items.reduce((s, i) => s + i.adjustedKg, 0);
            const totalCop = order.items.reduce(
              (s, i) => s + Math.round(i.adjustedKg * i.unitPriceCop),
              0
            );
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-rf-border bg-white p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-rf-graphite">
                        {order.orderCode}
                      </span>
                      <span className="rounded-full bg-rf-green-soft px-2.5 py-0.5 text-[11px] font-bold text-rf-green-dark">
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                      <span className="rounded-full bg-rf-bg px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        {order.commitmentType === "PARTIAL" ? "Parcial flexible" : "En firme"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Semana {order.deliveryWeek} · Entrega: {formatDateCO(order.deliveryDate)} ·{" "}
                      {formatKg(totalKg)} · {formatCOP(totalCop)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.status === "PARTIAL_CONFIRMED" && (
                      <button
                        type="button"
                        onClick={() => lockPartialOrder(order.id)}
                        className="rounded-xl bg-rf-yellow px-3 py-2 text-xs font-bold text-rf-graphite hover:bg-rf-yellow-dark"
                      >
                        Confirmar en firme
                      </button>
                    )}
                    {!order.deliveryReceipt && (
                      <button
                        type="button"
                        onClick={() => {
                          setReceivingOrder(order);
                          setRecShortProdId(order.items[0]?.productId || "");
                        }}
                        className="rounded-xl bg-rf-green px-3 py-2 text-xs font-bold text-white hover:bg-rf-green-dark"
                      >
                        Registrar recepción / faltante
                      </button>
                    )}
                    {order.lots.length > 0 && (
                      <a
                        href={`/api/pdf/certificado-ley2046?orderId=${order.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rf-green bg-rf-green-soft px-3 py-2 text-xs font-bold text-rf-green-dark hover:bg-rf-green hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Certificado Ley 2046 (PDF)
                      </a>
                    )}
                  </div>
                </div>

                {/* Items table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-rf-border text-[11px] text-slate-500">
                        <th className="py-2">Producto</th>
                        <th className="py-2">Calidad</th>
                        <th className="py-2">Pedido</th>
                        <th className="py-2">Ajustado</th>
                        <th className="py-2">Precio pactado</th>
                        <th className="py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rf-border/60">
                      {order.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 font-semibold text-rf-graphite">
                            {PRODUCT_EMOJI[it.product.iconKey] || "🥬"} {it.product.name}
                          </td>
                          <td className="py-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                it.qualityGrade === "FUNCTIONAL"
                                  ? "bg-rf-green-soft text-rf-green-dark"
                                  : "bg-rf-bg text-slate-600"
                              }`}
                            >
                              {it.qualityGrade === "FUNCTIONAL" ? "Funcional (-20%)" : "Estándar"}
                            </span>
                          </td>
                          <td className="py-2 tabular-nums">{formatKg(it.requestedKg)}</td>
                          <td className="py-2 font-semibold tabular-nums">
                            {formatKg(it.adjustedKg)}
                          </td>
                          <td className="py-2 tabular-nums">{formatCOP(it.unitPriceCop)}/kg</td>
                          <td className="py-2 text-right font-bold tabular-nums">
                            {formatCOP(it.adjustedKg * it.unitPriceCop)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Delivery receipt & incidents */}
                {order.deliveryReceipt && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rf-bg px-3.5 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-rf-graphite">
                        Recepción ({order.deliveryReceipt.receivedByName}):
                      </span>
                      <span
                        className={`font-semibold ${
                          order.deliveryReceipt.otifOnTime ? "text-rf-green-dark" : "text-rf-danger"
                        }`}
                      >
                        {order.deliveryReceipt.otifOnTime ? "✓ A tiempo" : "✗ Con demora"}
                      </span>
                      <span
                        className={`font-semibold ${
                          order.deliveryReceipt.otifInFull ? "text-rf-green-dark" : "text-amber-700"
                        }`}
                      >
                        {order.deliveryReceipt.otifInFull ? "✓ Completo" : "⚠ Con reposición"}
                      </span>
                      <span className="text-slate-600">
                        Merma: {order.deliveryReceipt.wasteMermaKg} kg (
                        {order.deliveryReceipt.wasteMermaPct} %)
                      </span>
                    </div>
                  </div>
                )}

                {order.incidents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {order.incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-rf-yellow-soft px-3.5 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-700" />
                          <span>
                            <strong>{inc.incidentCode}</strong> ({inc.product.name} ·{" "}
                            {inc.affectedKg} kg): {inc.description}
                          </span>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-rf-graphite">
                          {inc.status === "RESOLVED"
                            ? `Resuelto (${inc.resolutionType})`
                            : "En gestión"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: PRE-AGREED SUBSTITUTES */}
      {tab === "SUBSTITUTES" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-7">
            <h3 className="font-display text-base font-bold text-rf-graphite">
              Matriz de sustitutos acordada con cocina (Garantía 11/11)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Ante una helada, granizada o rechazo de calidad en acopio, Ruta Fresca activa estos
              reemplazos aprobados por el chef sin sobrecosto ni retrasar el menú.
            </p>
            <div className="mt-4 space-y-2.5">
              {data.substituteRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rf-border bg-rf-bg/50 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-rf-graphite">
                    <span>
                      {PRODUCT_EMOJI[rule.primaryProduct.iconKey]} {rule.primaryProduct.name}
                    </span>
                    <span className="text-rf-green">→</span>
                    <span className="text-rf-green-dark">
                      {PRODUCT_EMOJI[rule.substituteProduct.iconKey]} {rule.substituteProduct.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">{rule.notes}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card lg:col-span-5">
            <h3 className="font-display text-base font-bold text-rf-graphite">
              Agregar nuevo acuerdo de sustituto
            </h3>
            <form onSubmit={addSubstituteRule} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold">Si llega a faltar:</label>
                <select
                  value={subPrimary}
                  onChange={(e) => setSubPrimary(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                >
                  {data.catalog.map((c) => (
                    <option key={c.productId} value={c.productId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold">Reemplazar automáticamente por:</label>
                <select
                  value={subAlt}
                  onChange={(e) => setSubAlt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                >
                  {data.catalog.map((c) => (
                    <option key={c.productId} value={c.productId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold">Nota de cocina / chef</label>
                <input
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rf-green py-2.5 text-sm font-bold text-white hover:bg-rf-green-dark"
              >
                <Plus className="h-4 w-4" /> Guardar sustituto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: TRACEABILITY & LEY 2046 */}
      {tab === "TRACEABILITY" && (
        <div className="rounded-2xl border border-rf-border bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-rf-graphite">
                Trazabilidad verificable por lote (Soporte Ley 2046 de 2020)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Cada entrega muestra exactamente de qué finca, vereda y asociación campesina salió
                cada lote, listo para auditorías y licitaciones públicas (≥ 30 % ACFC).
              </p>
            </div>
            {data.orders.find((o) => o.lots.length > 0) && (
              <a
                href={`/api/pdf/certificado-ley2046?orderId=${
                  data.orders.find((o) => o.lots.length > 0)!.id
                }`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-rf-green px-4 py-2.5 text-xs font-bold text-white hover:bg-rf-green-dark"
              >
                <Download className="h-4 w-4" />
                Descargar Certificado Ley 2046 (PDF)
              </a>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-rf-border text-[11px] text-slate-500">
                  <th className="py-2">Código de Lote</th>
                  <th className="py-2">Pedido</th>
                  <th className="py-2">Producto</th>
                  <th className="py-2">Productor y Finca</th>
                  <th className="py-2">Asociación / Municipio</th>
                  <th className="py-2">Cosecha</th>
                  <th className="py-2 text-right">Peso verificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rf-border/60">
                {allLots.slice(0, 25).map((lot) => (
                  <tr key={lot.id}>
                    <td className="py-2.5 font-mono text-[11px] font-bold text-rf-green-dark">
                      {lot.lotCode}
                    </td>
                    <td className="py-2.5 text-slate-600">{lot.orderCode}</td>
                    <td className="py-2.5 font-semibold text-rf-graphite">{lot.product.name}</td>
                    <td className="py-2.5">
                      {lot.producer.user.fullName}{" "}
                      <span className="text-slate-500">({lot.farmName})</span>
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {lot.municipality} · {lot.association?.name || "Independiente ACFC"}
                    </td>
                    <td className="py-2.5 text-slate-500">{formatDateCO(lot.harvestDate)}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums">
                      {formatKg(lot.actualKg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECEPTION MODAL */}
      {receivingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-rf-graphite">
                Recepción de pedido {receivingOrder.orderCode}
              </h3>
              <button
                onClick={() => setReceivingOrder(null)}
                className="text-xs font-semibold text-slate-500 hover:text-rf-graphite"
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={submitReception} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-rf-border p-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={recOnTime}
                    onChange={(e) => setRecOnTime(e.target.checked)}
                    className="accent-rf-green"
                  />
                  Llegó en horario pactado
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-rf-border p-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={recInFull}
                    onChange={(e) => setRecInFull(e.target.checked)}
                    className="accent-rf-green"
                  />
                  Pedido completo sin faltantes
                </label>
              </div>

              <div>
                <label className="block font-semibold">Merma o producto golpeado en recepción (kg)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={recMermaKg}
                  onChange={(e) => setRecMermaKg(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm"
                />
              </div>

              {!recInFull && (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-rf-yellow-soft p-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <ShieldAlert className="h-4 w-4" />
                    Protocolo de reposición inmediata (Garantía 11/11)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold">Producto faltante</label>
                      <select
                        value={recShortProdId}
                        onChange={(e) => setRecShortProdId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        {receivingOrder.items.map((it) => (
                          <option key={it.productId} value={it.productId}>
                            {it.product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold">Kilos faltantes</label>
                      <input
                        type="number"
                        min={1}
                        value={recShortKg}
                        onChange={(e) => setRecShortKg(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold">Observaciones de cocina</label>
                <textarea
                  rows={2}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-rf-green py-3 text-sm font-bold text-white hover:bg-rf-green-dark"
              >
                {submitting ? "Guardando..." : "Confirmar recepción"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
