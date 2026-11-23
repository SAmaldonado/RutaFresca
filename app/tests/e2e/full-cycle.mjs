import { spawn } from "child_process";
import assert from "assert";

const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Server did not start in time");
}

async function run() {
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer();
    console.log("✓ Production server ready on", BASE);

    // 1. Verify all 7 SSR routes return 200 HTML with brand markers
    const pages = [
      { path: "/", expectText: "Del campo a la cocina" },
      { path: "/login", expectText: "Iniciar sesión" },
      { path: "/vinculacion", expectText: "Ley 1581" },
      { path: "/comprador", expectText: "Portal del Comprador" },
      { path: "/productor", expectText: "Espacio del Productor" },
      { path: "/acopio", expectText: "Punto de Acopio" },
      { path: "/transportador", expectText: "Transportador Aliado" },
      { path: "/operaciones", expectText: "Torre de Control" },
    ];
    for (const p of pages) {
      const r = await fetch(`${BASE}${p.path}`);
      assert.strictEqual(r.status, 200, `Page ${p.path} returned ${r.status}`);
      const html = await r.text();
      assert(html.includes(p.expectText), `Page ${p.path} missing text "${p.expectText}"`);
      assert(!html.includes("__next_error__"), `Page ${p.path} rendered Next error boundary`);
      console.log(`✓ SSR ${p.path} (200 OK)`);
    }

    // 2. Auth login + demo-switch
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "claudia@andina.com.co", password: "rutafresca2026" }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginJson = await loginRes.json();
    assert.strictEqual(loginJson.user.role, "BUYER");
    console.log("✓ Auth login verified (Claudia -> BUYER)");

    // 3. Buyer dashboard & create weekly partial order with Calidad Funcional
    const buyerDash = await (await fetch(`${BASE}/api/buyer/dashboard`)).json();
    assert(buyerDash.catalog.length >= 14, "Expected 14 catalog products");
    assert(buyerDash.metrics.ley2046.meetsStatutory30Pct, "Expected Ley 2046 >= 30%");

    const createOrderRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerOrgId: buyerDash.buyerOrg.id,
        deliveryWeek: "2026-W49",
        deliveryDate: "2026-12-01",
        commitmentType: "PARTIAL",
        items: [
          { productId: buyerDash.catalog[0].productId, kg: 80, qualityGrade: "STANDARD" },
          { productId: buyerDash.catalog[1].productId, kg: 60, qualityGrade: "FUNCTIONAL" },
        ],
      }),
    });
    assert.strictEqual(createOrderRes.status, 201);
    const createdOrder = await createOrderRes.json();
    assert.strictEqual(createdOrder.economics.commissionCop, 0, "Pilot 0% commission check");
    assert(createdOrder.economics.functionalSavingsCop > 0, "Functional savings must be > 0");
    console.log(`✓ Buyer weekly order created (${createdOrder.order.orderCode}) with Calidad Funcional savings`);

    // 4. Producer dashboard (Don Luis) + WhatsApp Voice confirmation (Ley 527 SHA-256)
    const prodDash = await (await fetch(`${BASE}/api/producer/dashboard`)).json();
    assert.strictEqual(prodDash.producer.user.fullName, "Luis Rodríguez");
    const pendingAsgn = prodDash.assignments.find((a) => a.status === "SENT");
    assert(pendingAsgn, "Expected pending W48 assignment for Don Luis (Lechuga 60 kg)");

    const respondRes = await fetch(`${BASE}/api/assignments/${pendingAsgn.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SI_CUMPLO",
        channel: "WHATSAPP_AUDIO",
        audioTranscript: "Sí cumplo con los 60 kilos de lechuga el martes a las 6.",
      }),
    });
    assert.strictEqual(respondRes.status, 200);
    const respondJson = await respondRes.json();
    assert.strictEqual(respondJson.assignment.status, "CONFIRMED");
    assert.strictEqual(respondJson.evidence.contentSha256Hash.length, 64);
    console.log("✓ Producer WhatsApp/Voice confirmation persisted with Ley 527 SHA-256 hash");

    // 5. Offline Acopio weighing + idempotent batch sync
    const syncId = `E2E-OFFLINE-${Date.now()}`;
    const weighPayload = {
      records: [
        {
          offlineSyncId: syncId,
          harvestAssignmentId: pendingAsgn.id,
          actualKg: 60,
          qualityResult: "APPROVED_STANDARD",
          producerSignatureAck: true,
          captureChannel: "ACOPIO_TABLET",
        },
      ],
    };
    const sync1 = await (
      await fetch(`${BASE}/api/acopio/weigh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weighPayload),
      })
    ).json();
    assert.strictEqual(sync1.ok, true);
    assert(sync1.results[0].lot.lotCode.startsWith("RF-2026W48-"));

    // Replay same offlineSyncId -> must deduplicate cleanly
    const sync2 = await (
      await fetch(`${BASE}/api/acopio/weigh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weighPayload),
      })
    ).json();
    assert.strictEqual(sync2.results[0].deduplicated, true);
    console.log(`✓ Acopio offline weighing & idempotent sync verified (${sync1.results[0].lot.lotCode})`);

    // 6. Ops Control Tower: Analytics + Multi-zone Allocation + VRP + Incident Resolution
    const ops = await (await fetch(`${BASE}/api/ops/overview`)).json();
    assert(ops.analytics.q1Descriptiva.length > 0);
    assert(ops.analytics.q2Diagnostica.length > 0);
    assert(ops.analytics.q3PredictivaOferta.length > 0);
    assert(ops.analytics.q4PredictivaRetencion.length > 0);
    assert(ops.analytics.q5Prescriptiva.length > 0);
    assert(ops.economicScenarios.length === 4);

    const allocRes = await (
      await fetch(`${BASE}/api/ops/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: ops.products[0].id,
          demandKg: 260,
          deliveryWeek: "2026-W48",
          persist: false,
        }),
      })
    ).json();
    assert.strictEqual(allocRes.plan.meetsMultiZoneClimateRule, true);
    console.log("✓ Ops Control Tower analytics (5 questions) & multi-zone climate allocation verified");

    const vrpRes = await (
      await fetch(`${BASE}/api/ops/routes/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transporterId: ops.transporters[0].id,
          collectionPointIds: [ops.collectionPoints[0].id, ops.collectionPoints[2].id],
          buyerOrgIds: [ops.buyers[0].id, ops.buyers[1].id, ops.buyers[5].id],
          totalKgOverride: 2100,
          simulatedCommissionPct: 0.03,
          includeSubscriptionProration: true,
          isPilotZeroCommission: false,
          persist: false,
        }),
      })
    ).json();
    assert.strictEqual(vrpRes.ok, true);
    assert(vrpRes.planned.agreedTariffCop > 0);
    console.log(
      `✓ VRP route planner verified (Tarifa ${vrpRes.planned.agreedTariffCop} COP, Margen/kg ${vrpRes.planned.marginPerKgCop} COP, ${vrpRes.planned.goNoGoStatus})`
    );

    const openInc = ops.incidents.find((i) => i.status === "OPEN");
    assert(openInc, "Expected open W48 climate incident");
    const resolveInc = await (
      await fetch(`${BASE}/api/ops/incidents/${openInc.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionType: "PREAGREED_SUBSTITUTE",
          slaResponseMinutes: 18,
        }),
      })
    ).json();
    assert.strictEqual(resolveInc.incident.status, "RESOLVED");
    assert.strictEqual(resolveInc.responsibilityPolicy.scoreDelta, 0);
    console.log("✓ Climate incident resolved with 0 producer penalty");

    // 7. Transporter route acceptance & stop completion
    const trDash = await (await fetch(`${BASE}/api/transporter/dashboard`)).json();
    const offeredRoute = trDash.routes.find((r) => r.status === "OFFERED");
    assert(offeredRoute, "Expected offered W48 route for Carlos Méndez");
    const accRes = await (
      await fetch(`${BASE}/api/routes/${offeredRoute.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT" }),
      })
    ).json();
    assert.strictEqual(accRes.route.status, "ACCEPTED");
    console.log(`✓ Transporter route acceptance verified (${offeredRoute.routeCode})`);

    // 8. Verify all 4 binary PDF endpoints return valid %PDF- documents
    const pdfUrls = [
      "/api/pdf/boleta",
      "/api/pdf/certificado-ley2046",
      "/api/pdf/hoja-ruta",
      "/api/pdf/afiche",
    ];
    for (const u of pdfUrls) {
      const r = await fetch(`${BASE}${u}`);
      assert.strictEqual(r.status, 200, `PDF ${u} returned ${r.status}`);
      assert(
        (r.headers.get("content-type") || "").includes("application/pdf"),
        `PDF ${u} wrong content-type`
      );
      const buf = Buffer.from(await r.arrayBuffer());
      assert.strictEqual(buf.subarray(0, 5).toString("ascii"), "%PDF-");
      console.log(`✓ PDF ${u} verified (${buf.length} bytes)`);
    }

    console.log("\n🎉 ALL END-TO-END CHECKS PASSED!");
  } finally {
    server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error("❌ E2E failed:", err);
  process.exit(1);
});
