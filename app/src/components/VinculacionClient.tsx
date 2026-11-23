"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sprout,
  Truck,
  ShieldCheck,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Ban,
} from "lucide-react";
import { CHANNEL_LABELS, formatDateTimeCO } from "@/lib/format";

interface ZoneItem {
  id: string;
  name: string;
  type: string;
  department: string;
  municipality: string;
}

interface AssocItem {
  id: string;
  name: string;
  zoneId: string;
  municipality: string;
}

interface ConsentItem {
  id: string;
  purposeVersion: string;
  accepted: boolean;
  readAloudByGestor: boolean;
  captureChannel: string;
  evidenceNote: string | null;
  grantedAt: string;
  revokedAt: string | null;
  user: { fullName: string; role: string; phone: string };
}

export function VinculacionClient() {
  const router = useRouter();
  const [role, setRole] = useState<"BUYER" | "PRODUCER" | "TRANSPORTER">("PRODUCER");
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [associations, setAssociations] = useState<AssocItem[]>([]);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Common fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+5731");
  const [password, setPassword] = useState("rutafresca2026");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [readAloudByGestor, setReadAloudByGestor] = useState(true);

  // Buyer fields
  const [orgName, setOrgName] = useState("");
  const [segment, setSegment] = useState("COMEDOR_EMPRESARIAL");
  const [address, setAddress] = useState("Chapinero, Bogotá");
  const [dailyMealsRange, setDailyMealsRange] = useState("100-249");

  // Producer + Digital Baseline fields
  const [zoneId, setZoneId] = useState("");
  const [associationId, setAssociationId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [vereda, setVereda] = useState("");
  const [hectares, setHectares] = useState(3.5);
  const [paymentTerm, setPaymentTerm] = useState("MAX_8_DAYS");
  const [hasPhone, setHasPhone] = useState(true);
  const [isSmartphone, setIsSmartphone] = useState(true);
  const [hasMobileData, setHasMobileData] = useState(false);
  const [hasFarmSignal, setHasFarmSignal] = useState(true);
  const [usesWhatsapp, setUsesWhatsapp] = useState(true);
  const [phoneHandlerInHome, setPhoneHandlerInHome] = useState("Titular");
  const [primaryChannel, setPrimaryChannel] = useState("WHATSAPP_AUDIO");

  // Transporter fields
  const [vehicleType, setVehicleType] = useState("FURGON_PEQUENO");
  const [capacityKg, setCapacityKg] = useState(1600);
  const [plateNumber, setPlateNumber] = useState("");
  const [acceptsSharedRoutes, setAcceptsSharedRoutes] = useState("CONDITIONAL");
  const [preferredTariffModel, setPreferredTariffModel] = useState("BASE_PLUS_KM");
  const [maxDetourKm, setMaxDetourKm] = useState(18);

  async function loadData() {
    const res = await fetch("/api/onboarding");
    if (res.ok) {
      const data = await res.json();
      setZones(data.zones || []);
      setAssociations(data.associations || []);
      setConsents(data.consents || []);
      const firstRural = (data.zones || []).find((z: ZoneItem) => z.type === "RURAL_PRODUCTION");
      if (firstRural && !zoneId) setZoneId(firstRural.id);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speakConsentAloud() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(
      "Autorización sencilla de datos de Ruta Fresca, Ley 1581 de 2012. Solo guardamos su nombre, su finca o negocio y su teléfono para coordinar pedidos confirmados, rutas de entrega y pagos puntuales. Nunca vendemos ni compartimos sus datos para otro fin. Usted puede consultar, corregir o cancelar este permiso en cualquier momento por WhatsApp o en el punto físico de acopio."
    );
    utter.lang = "es-CO";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          fullName,
          email,
          phone,
          password,
          consentAccepted,
          readAloudByGestor,
          captureChannel: role === "PRODUCER" ? primaryChannel : "WEB",
          orgName,
          segment,
          address,
          dailyMealsRange,
          zoneId,
          associationId: associationId || null,
          farmName,
          vereda,
          hectares: Number(hectares),
          paymentTerm,
          hasPhone,
          isSmartphone,
          hasMobileData,
          hasFarmSignal,
          usesWhatsapp,
          phoneHandlerInHome,
          primaryChannel,
          vehicleType,
          capacityKg: Number(capacityKg),
          plateNumber,
          acceptsSharedRoutes,
          preferredTariffModel,
          maxDetourKm: Number(maxDetourKm),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "No se pudo completar el registro." });
        return;
      }
      setMessage({
        type: "ok",
        text: "Vinculación registrada con consentimiento Ley 1581. Redirigiendo a su portal...",
      });
      await loadData();
      const dest =
        role === "BUYER"
          ? "/comprador"
          : role === "PRODUCER"
          ? "/productor"
          : "/transportador";
      setTimeout(() => {
        router.push(dest);
        router.refresh();
      }, 900);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConsentToggle(consentId: string, action: "REVOKE" | "RENEW") {
    const res = await fetch("/api/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentId, action, channel: "WEB" }),
    });
    if (res.ok) {
      await loadData();
    }
  }

  const ruralZones = zones.filter((z) => z.type === "RURAL_PRODUCTION");

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: Registration Wizard */}
      <div className="rounded-2xl border border-rf-border bg-white p-6 shadow-card lg:col-span-7">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "BUYER" as const, label: "Comprador", icon: Building2 },
            { key: "PRODUCER" as const, label: "Productor", icon: Sprout },
            { key: "TRANSPORTER" as const, label: "Transportador", icon: Truck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = role === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRole(tab.key)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                  active
                    ? "border-rf-green bg-rf-green text-white"
                    : "border-rf-border bg-rf-bg text-rf-graphite hover:bg-rf-green-soft"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Basic info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-rf-graphite">
                Nombre completo
              </label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={
                  role === "PRODUCER"
                    ? "Ej. María del Carmen Parra"
                    : role === "BUYER"
                    ? "Ej. Ana Lucía Gómez"
                    : "Ej. Raúl Ernesto Díaz"
                }
                className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm outline-none focus:border-rf-green"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-rf-graphite">
                Teléfono / WhatsApp
              </label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+573101234567"
                className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm outline-none focus:border-rf-green"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-rf-graphite">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@ejemplo.co"
                className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm outline-none focus:border-rf-green"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-rf-graphite">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-rf-border px-3 py-2 text-sm outline-none focus:border-rf-green"
              />
            </div>
          </div>

          {/* Buyer specific */}
          {role === "BUYER" && (
            <div className="space-y-3 rounded-xl border border-rf-border bg-rf-bg/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-rf-green-dark">
                Perfil del comedor institucional (Piloto 4 semanas · 0 % comisión)
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold">Nombre del establecimiento</label>
                  <input
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Comedor Empresarial Norte"
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Tipo de segmento</label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="COMEDOR_EMPRESARIAL">Comedor empresarial</option>
                    <option value="UNIVERSIDAD">Universidad</option>
                    <option value="COLEGIO_PRIVADO">Colegio privado</option>
                    <option value="RESTAURANTE_MEDIANO">Restaurante mediano</option>
                    <option value="OPERADOR_PUBLICO_LEY_2046">
                      Operador público (Ley 2046 · 30 % ACFC)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Dirección en zona piloto</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Comidas servidas al día</label>
                  <select
                    value={dailyMealsRange}
                    onChange={(e) => setDailyMealsRange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="50-99">Entre 50 y 99</option>
                    <option value="100-249">Entre 100 y 249</option>
                    <option value="250-499">Entre 250 y 499</option>
                    <option value="500+">500 o más</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Producer + Digital Baseline */}
          {role === "PRODUCER" && (
            <div className="space-y-4 rounded-xl border border-rf-border bg-rf-bg/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-rf-green-dark">
                Datos de la finca y condición de pago
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold">Zona rural</label>
                  <select
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    {ruralZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.department} · {z.municipality}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Asociación campesina</label>
                  <select
                    value={associationId}
                    onChange={(e) => setAssociationId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Productor independiente</option>
                    {associations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Nombre de la finca</label>
                  <input
                    required
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    placeholder="Finca Santa Lucía"
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Vereda</label>
                  <input
                    required
                    value={vereda}
                    onChange={(e) => setVereda(e.target.value)}
                    placeholder="Vereda El Tobal"
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Hectáreas (2–10 ha)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={hectares}
                    onChange={(e) => setHectares(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Plazo de pago acordado</label>
                  <select
                    value={paymentTerm}
                    onChange={(e) => setPaymentTerm(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="CONTADO_MISMO_DIA">Contado (mismo día en acopio)</option>
                    <option value="DAYS_1_3">1 a 3 días hábiles</option>
                    <option value="MAX_8_DAYS">Máximo 8 días</option>
                  </select>
                </div>
              </div>

              {/* Encuesta de Línea Base Digital (Fase 1 / Riesgo #2 Exclusión Digital) */}
              <div className="border-t border-rf-border pt-3">
                <div className="text-xs font-bold text-rf-graphite">
                  Línea base digital de la finca (para atenderle por el canal que prefiera sin excluirle)
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {[
                    { label: "Tiene celular", val: hasPhone, set: setHasPhone },
                    { label: "Es smartphone", val: isSmartphone, set: setIsSmartphone },
                    { label: "Tiene plan de datos", val: hasMobileData, set: setHasMobileData },
                    { label: "Hay señal en la finca", val: hasFarmSignal, set: setHasFarmSignal },
                    { label: "Usa WhatsApp", val: usesWhatsapp, set: setUsesWhatsapp },
                  ].map((cb) => (
                    <label
                      key={cb.label}
                      className="flex items-center gap-2 rounded-lg border border-rf-border bg-white px-2.5 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={cb.val}
                        onChange={(e) => cb.set(e.target.checked)}
                        className="accent-rf-green"
                      />
                      <span>{cb.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold">
                      ¿Quién maneja el teléfono en el hogar?
                    </label>
                    <input
                      value={phoneHandlerInHome}
                      onChange={(e) => setPhoneHandlerInHome(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold">
                      Canal preferido para confirmar pedidos
                    </label>
                    <select
                      value={primaryChannel}
                      onChange={(e) => setPrimaryChannel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="WHATSAPP_AUDIO">WhatsApp con notas de voz</option>
                      <option value="WHATSAPP_TEXT">WhatsApp escrito</option>
                      <option value="PHONE_CALL">Llamada telefónica</option>
                      <option value="ACOPIO_PAPER">Boleta impresa en punto físico</option>
                      <option value="WEB">Aplicación web</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transporter specific */}
          {role === "TRANSPORTER" && (
            <div className="space-y-3 rounded-xl border border-rf-border bg-rf-bg/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-rf-green-dark">
                Vehículo, rutas compartidas y modalidad de pago
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold">Tipo de vehículo</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="CAMIONETA">Camioneta / pickup (hasta 1.000 kg)</option>
                    <option value="FURGON_PEQUENO">Furgón pequeño (1.500–2.000 kg)</option>
                    <option value="CAMION_LIVIANO">Camión liviano (2.500–3.500 kg)</option>
                    <option value="CAMION_MEDIANO_GRANDE">Camión mediano/grande (4.000+ kg)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Capacidad confirmada (kg)</label>
                  <input
                    type="number"
                    value={capacityKg}
                    onChange={(e) => setCapacityKg(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Placa</label>
                  <input
                    required
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="WLA-990"
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Modalidad de tarifa preferida</label>
                  <select
                    value={preferredTariffModel}
                    onChange={(e) => setPreferredTariffModel(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="BASE_PLUS_KM">Valor base + distancia (km)</option>
                    <option value="PER_KM">Pago según distancia recorrida</option>
                    <option value="PER_KG">Pago según peso/volumen (kg)</option>
                    <option value="FIXED_ROUTE">Valor fijo pactado por ruta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">¿Acepta rutas compartidas?</label>
                  <select
                    value={acceptsSharedRoutes}
                    onChange={(e) => setAcceptsSharedRoutes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="YES">Sí, sin reservas</option>
                    <option value="CONDITIONAL">Sí, según desvíos y tiempos pactados</option>
                    <option value="NO">Solo rutas directas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Desvío máximo permitido (km)</label>
                  <input
                    type="number"
                    value={maxDetourKm}
                    onChange={(e) => setMaxDetourKm(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-rf-border bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ley 1581 de 2012 Consent Block */}
          <div className="rounded-xl border-2 border-rf-green/40 bg-rf-green-soft/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rf-graphite">
                <ShieldCheck className="h-4 w-4 text-rf-green" />
                Autorización corta en lenguaje sencillo (Ley 1581 de 2012)
              </div>
              <button
                type="button"
                onClick={speakConsentAloud}
                className="inline-flex items-center gap-1 rounded-lg bg-rf-graphite px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rf-graphite-light"
              >
                <Volume2 className="h-3.5 w-3.5 text-rf-yellow" />
                Escuchar en voz alta
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">
              Solo pedimos los datos estrictamente necesarios para confirmar pedidos, pesar su
              cosecha, organizar la ruta y realizar sus pagos. No solicitamos ubicación permanente ni
              vendemos su información. Puede consultar, corregir o revocar este permiso en cualquier
              momento por WhatsApp o en el punto de acopio.
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <label className="flex items-start gap-2 font-semibold text-rf-graphite">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 accent-rf-green"
                />
                <span>
                  Sí, comprendo y autorizo el uso de mis datos personales exclusivamente para operar
                  en Ruta Fresca.
                </span>
              </label>
              <label className="flex items-start gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={readAloudByGestor}
                  onChange={(e) => setReadAloudByGestor(e.target.checked)}
                  className="mt-0.5 accent-rf-green"
                />
                <span>
                  Autorización explicada en voz alta (recomendado en punto físico para prevenir
                  consentimiento sin comprensión).
                </span>
              </label>
            </div>
          </div>

          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-xs font-semibold ${
                message.type === "ok"
                  ? "bg-rf-green-soft text-rf-green-dark"
                  : "bg-rf-danger-soft text-rf-danger"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rf-green px-5 py-3 text-sm font-bold text-white hover:bg-rf-green-dark disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? "Registrando..." : "Completar vinculación con respaldo Ley 1581"}
          </button>
        </form>
      </div>

      {/* Right: Ley 1581 Audit & Revocation Console */}
      <div className="rounded-2xl border border-rf-border bg-white p-6 shadow-card lg:col-span-5">
        <h2 className="font-display text-lg font-bold text-rf-graphite">
          Bitácora auditable de consentimientos (Ley 1581)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Cada titular puede ejercer su derecho de consulta o revocación por WhatsApp, web o en el
          punto físico de acopio.
        </p>

        <div className="mt-4 max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
          {consents.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-3 text-xs ${
                c.accepted && !c.revokedAt
                  ? "border-rf-border bg-rf-bg/40"
                  : "border-red-200 bg-rf-danger-soft/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-rf-graphite">{c.user.fullName}</div>
                  <div className="text-[11px] text-slate-500">
                    {c.user.role} · {CHANNEL_LABELS[c.captureChannel] || c.captureChannel}
                    {c.readAloudByGestor && " · Leído en voz alta"}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    c.accepted && !c.revokedAt
                      ? "bg-rf-green-soft text-rf-green-dark"
                      : "bg-rf-danger-soft text-rf-danger"
                  }`}
                >
                  {c.accepted && !c.revokedAt ? "Vigente" : "Revocado"}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-slate-600">
                {c.evidenceNote || c.purposeVersion} · {formatDateTimeCO(c.grantedAt)}
              </div>
              <div className="mt-2 flex justify-end">
                {c.accepted && !c.revokedAt ? (
                  <button
                    type="button"
                    onClick={() => handleConsentToggle(c.id, "REVOKE")}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rf-danger hover:bg-rf-danger-soft"
                  >
                    <Ban className="h-3 w-3" /> Revocar permiso
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConsentToggle(c.id, "RENEW")}
                    className="inline-flex items-center gap-1 rounded-lg border border-rf-green/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-rf-green-dark hover:bg-rf-green-soft"
                  >
                    <RotateCcw className="h-3 w-3" /> Renovar permiso
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
