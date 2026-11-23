import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("🌱 Sembrando base de datos de Ruta Fresca (Piloto 4 semanas · Noviembre 2026)...");

  // Clean in reverse dependency order
  await prisma.backupPurchase.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.deliveryReceipt.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.route.deleteMany();
  await prisma.messageEvidence.deleteMany();
  await prisma.harvestAssignment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.weeklyOrder.deleteMany();
  await prisma.sowingDeclaration.deleteMany();
  await prisma.buyerSubstituteRule.deleteMany();
  await prisma.cyclePrice.deleteMany();
  await prisma.priceCycle.deleteMany();
  await prisma.externalMarketFeed.deleteMany();
  await prisma.weatherAlert.deleteMany();
  await prisma.product.deleteMany();
  await prisma.transporter.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.collectionPoint.deleteMany();
  await prisma.association.deleteMany();
  await prisma.buyerOrg.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.user.deleteMany();

  const demoPass = await bcrypt.hash("rutafresca2026", 10);

  // 1. Zonas (Zona piloto Bogotá + 4 zonas rurales en 2 corredores climáticos)
  const zBogota = await prisma.zone.create({
    data: {
      code: "BOG-CHA-TEU",
      name: "Chapinero – Teusaquillo – Ciudad Universitaria",
      type: "URBAN_DELIVERY",
      department: "Bogotá D.C.",
      municipality: "Bogotá",
      climateProfile: "URBANO_BOGOTA",
      lat: 4.6425,
      lng: -74.0655,
      isPilotActive: true,
    },
  });

  const zVentaquemada = await prisma.zone.create({
    data: {
      code: "BOY-VEN",
      name: "Boyacá Centro — Ventaquemada",
      type: "RURAL_PRODUCTION",
      department: "Boyacá",
      municipality: "Ventaquemada",
      climateProfile: "ALTIPLANO_FRIO",
      lat: 5.3652,
      lng: -73.5219,
      isPilotActive: true,
    },
  });

  const zToca = await prisma.zone.create({
    data: {
      code: "BOY-TOC",
      name: "Boyacá Centro — Toca",
      type: "RURAL_PRODUCTION",
      department: "Boyacá",
      municipality: "Toca",
      climateProfile: "ALTIPLANO_SECO",
      lat: 5.5653,
      lng: -73.1864,
      isPilotActive: true,
    },
  });

  const zSubachoque = await prisma.zone.create({
    data: {
      code: "CUN-SUB",
      name: "Cundinamarca Sabana Occidente — Subachoque / Madrid",
      type: "RURAL_PRODUCTION",
      department: "Cundinamarca",
      municipality: "Subachoque",
      climateProfile: "SABANA_TEMPLADO",
      lat: 4.9285,
      lng: -74.1731,
      isPilotActive: true,
    },
  });

  const zChipaque = await prisma.zone.create({
    data: {
      code: "CUN-CHI",
      name: "Cundinamarca Oriente — Chipaque",
      type: "RURAL_PRODUCTION",
      department: "Cundinamarca",
      municipality: "Chipaque",
      climateProfile: "ORIENTE_HUMEDO",
      lat: 4.4436,
      lng: -74.0453,
      isPilotActive: true,
    },
  });

  // 2. Asociaciones y Puntos de Acopio
  const assocVentaquemada = await prisma.association.create({
    data: {
      code: "ASOC-BOY-VEN",
      name: "Asociación Agropecuaria de Ventaquemada",
      zoneId: zVentaquemada.id,
      municipality: "Ventaquemada",
      memberCount: 42,
      hasFinagroInsurance: true,
      insuranceType: "ISA_SUBSIDIZED",
      digitalLeaderName: "Marta Pulido",
      hasSatelliteWifi: true,
      contactPhone: "+573104458820",
    },
  });

  const assocToca = await prisma.association.create({
    data: {
      code: "ASOC-BOY-TOC",
      name: "Cooperativa Hortícola Tierra Viva de Toca",
      zoneId: zToca.id,
      municipality: "Toca",
      memberCount: 35,
      hasFinagroInsurance: true,
      insuranceType: "PARAMETRIC",
      digitalLeaderName: "Efraín Cárdenas",
      hasSatelliteWifi: false,
      contactPhone: "+573112209911",
    },
  });

  const assocSubachoque = await prisma.association.create({
    data: {
      code: "ASOC-CUN-SUB",
      name: "Asociación Campesina Sabana Verde (Subachoque)",
      zoneId: zSubachoque.id,
      municipality: "Subachoque",
      memberCount: 54,
      hasFinagroInsurance: true,
      insuranceType: "ISA_SUBSIDIZED",
      digitalLeaderName: "Yolanda Buitrago",
      hasSatelliteWifi: true,
      contactPhone: "+573128894401",
    },
  });

  const assocChipaque = await prisma.association.create({
    data: {
      code: "ASOC-CUN-CHI",
      name: "Productores Unidos del Oriente — Chipaque",
      zoneId: zChipaque.id,
      municipality: "Chipaque",
      memberCount: 28,
      hasFinagroInsurance: false,
      insuranceType: "NONE",
      digitalLeaderName: "Hernán Gutiérrez",
      hasSatelliteWifi: false,
      contactPhone: "+573157723310",
    },
  });

  const cpVentaquemada = await prisma.collectionPoint.create({
    data: {
      code: "ACOPIO-VEN-01",
      associationId: assocVentaquemada.id,
      name: "Salón comunal de la vereda — Ventaquemada",
      veredaAddress: "Vereda Puente de Boyacá, Km 12 vía Tunja, Ventaquemada",
      lat: 5.3652,
      lng: -73.5219,
      connectivityType: "SATELLITE_WIFI",
      operatingDays: "Martes y Viernes (5:30 a. m. – 8:00 a. m.)",
    },
  });

  const cpToca = await prisma.collectionPoint.create({
    data: {
      code: "ACOPIO-TOC-01",
      associationId: assocToca.id,
      name: "Centro de Acopio Vereda Centro — Toca",
      veredaAddress: "Calle Real # 4-18, Toca, Boyacá",
      lat: 5.5653,
      lng: -73.1864,
      connectivityType: "OFFLINE_SYNC",
      operatingDays: "Martes y Viernes (5:00 a. m. – 7:30 a. m.)",
    },
  });

  const cpSubachoque = await prisma.collectionPoint.create({
    data: {
      code: "ACOPIO-SUB-01",
      associationId: assocSubachoque.id,
      name: "Punto de Acopio Sabana Verde — Subachoque",
      veredaAddress: "Vereda El Tobal, Subachoque, Cundinamarca",
      lat: 4.9285,
      lng: -74.1731,
      connectivityType: "SATELLITE_WIFI",
      operatingDays: "Lunes, Martes y Jueves (5:30 a. m. – 8:30 a. m.)",
    },
  });

  const cpChipaque = await prisma.collectionPoint.create({
    data: {
      code: "ACOPIO-CHI-01",
      associationId: assocChipaque.id,
      name: "Sede Comunal Chipaque — Punto Ruta Fresca",
      veredaAddress: "Vereda Munar, Km 2 vía al Llano, Chipaque",
      lat: 4.4436,
      lng: -74.0453,
      connectivityType: "MOBILE_4G",
      operatingDays: "Martes y Jueves (5:30 a. m. – 8:00 a. m.)",
    },
  });

  // 3. Usuarios principales (incluyendo roles demo)
  const adminUser = await prisma.user.create({
    data: {
      fullName: "Sergio Reita · Torre de Control",
      email: "ops@rutafresca.co",
      phone: "+573000000000",
      role: "ADMIN_OPS",
      passwordHash: demoPass,
      preferredChannel: "WEB",
    },
  });

  const acopioUser = await prisma.user.create({
    data: {
      fullName: "Marta Pulido · Gestora de Acopio",
      email: "acopio.ventaquemada@rutafresca.co",
      phone: "+573104458820",
      role: "ACOPIO_OPERATOR",
      passwordHash: demoPass,
      preferredChannel: "ACOPIO_TABLET",
    },
  });

  // Compradores institucionales (6 en zona piloto Chapinero-Teusaquillo-UNAL)
  const buyersData = [
    {
      fullName: "Claudia Morales",
      email: "claudia@andina.com.co",
      phone: "+573101002001",
      code: "COMP-001",
      name: "Comedor Empresarial Grupo Andina",
      segment: "COMEDOR_EMPRESARIAL",
      address: "Calle 72 # 10-34, Chapinero, Bogotá",
      lat: 4.6562,
      lng: -74.0578,
      dailyMealsRange: "250-499",
      deliveryWindowStart: "06:00",
      deliveryWindowEnd: "07:30",
      pricingMode: "PILOT_0_PCT",
      commissionRate: 0.0,
      subscriptionFeeCop: 0,
      referralCode: "RF-ANDINA26",
      channel: "WHATSAPP_TEXT",
    },
    {
      fullName: "Andrés Villamizar",
      email: "compras@campuscentral.edu.co",
      phone: "+573101002002",
      code: "COMP-002",
      name: "Comedor Universitario Campus Central",
      segment: "UNIVERSIDAD",
      address: "Cra 30 # 45-03, Ciudad Universitaria, Bogotá",
      lat: 4.6368,
      lng: -74.0836,
      dailyMealsRange: "500+",
      deliveryWindowStart: "05:30",
      deliveryWindowEnd: "07:00",
      pricingMode: "PILOT_0_PCT",
      commissionRate: 0.0,
      subscriptionFeeCop: 0,
      referralCode: "RF-CAMPUS26",
      channel: "WEB",
    },
    {
      fullName: "Patricia Lozano",
      email: "administracion@colegiosabana.edu.co",
      phone: "+573101002003",
      code: "COMP-003",
      name: "Comedor Colegio Privado Sabana Norte",
      segment: "COLEGIO_PRIVADO",
      address: "Calle 63 # 13-45, Chapinero, Bogotá",
      lat: 4.6494,
      lng: -74.0642,
      dailyMealsRange: "250-499",
      deliveryWindowStart: "06:00",
      deliveryWindowEnd: "07:30",
      pricingMode: "PILOT_0_PCT",
      commissionRate: 0.0,
      subscriptionFeeCop: 0,
      referralCode: "RF-SABANA26",
      channel: "PHONE_CALL",
    },
    {
      fullName: "Diego Castañeda",
      email: "chef@fogonsabana.co",
      phone: "+573101002004",
      code: "COMP-004",
      name: "Restaurante Fogón de la Sabana",
      segment: "RESTAURANTE_MEDIANO",
      address: "Cra 13 # 54-22, Chapinero, Bogotá",
      lat: 4.6428,
      lng: -74.0651,
      dailyMealsRange: "100-249",
      deliveryWindowStart: "06:30",
      deliveryWindowEnd: "08:00",
      pricingMode: "COMMISSION_PCT",
      commissionRate: 0.03,
      subscriptionFeeCop: 0,
      referralCode: "RF-FOGON26",
      channel: "WHATSAPP_TEXT",
    },
    {
      fullName: "Mónica Herrera",
      email: "compras@mesaverde.co",
      phone: "+573101002005",
      code: "COMP-005",
      name: "Restaurante Mesa Verde Teusaquillo",
      segment: "RESTAURANTE_MEDIANO",
      address: "Calle 42 # 19-15, Teusaquillo, Bogotá",
      lat: 4.6311,
      lng: -74.0725,
      dailyMealsRange: "50-99",
      deliveryWindowStart: "07:00",
      deliveryWindowEnd: "08:30",
      pricingMode: "PILOT_0_PCT",
      commissionRate: 0.0,
      subscriptionFeeCop: 0,
      referralCode: "RF-MESAV26",
      channel: "WEB",
    },
    {
      fullName: "Javier Peña",
      email: "operaciones@nutriser.com.co",
      phone: "+573101002006",
      code: "COMP-006",
      name: "Operador Nutriser — Contratos Públicos (Ley 2046)",
      segment: "OPERADOR_PUBLICO_LEY_2046",
      address: "Av. El Dorado # 26-40, Teusaquillo, Bogotá",
      lat: 4.6295,
      lng: -74.0812,
      dailyMealsRange: "500+",
      deliveryWindowStart: "05:30",
      deliveryWindowEnd: "07:00",
      pricingMode: "HYBRID_SUBSCRIPTION",
      commissionRate: 0.025,
      subscriptionFeeCop: 350000,
      referralCode: "RF-NUTRI26",
      channel: "WEB",
    },
  ];

  const createdBuyers = [];
  for (const b of buyersData) {
    const u = await prisma.user.create({
      data: {
        fullName: b.fullName,
        email: b.email,
        phone: b.phone,
        role: "BUYER",
        passwordHash: demoPass,
        preferredChannel: b.channel,
      },
    });
    await prisma.consentRecord.create({
      data: {
        userId: u.id,
        purposeSummary: "Tratamiento de datos de compras, facturación y trazabilidad de entregas bajo Ley 1581 de 2012.",
        accepted: true,
        readAloudByGestor: false,
        captureChannel: "WEB",
        signatureRef: `WEB-ACCEPT-${b.code}`,
      },
    });
    const org = await prisma.buyerOrg.create({
      data: {
        code: b.code,
        userId: u.id,
        name: b.name,
        segment: b.segment,
        zoneId: zBogota.id,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        dailyMealsRange: b.dailyMealsRange,
        deliveryWindowStart: b.deliveryWindowStart,
        deliveryWindowEnd: b.deliveryWindowEnd,
        pricingMode: b.pricingMode,
        commissionRate: b.commissionRate,
        subscriptionFeeCop: b.subscriptionFeeCop,
        pilotStartDate: new Date("2026-10-26T08:00:00-05:00"),
        referralCode: b.referralCode,
        status: "ACTIVE",
      },
    });
    createdBuyers.push({ user: u, org });
  }

  // Productores (12 en 4 asociaciones + independientes, con línea base digital diversa)
  const producersSeed = [
    {
      fullName: "Luis Rodríguez",
      email: "luis.rodriguez@ventaquemada.org",
      phone: "+573115001001",
      code: "PROD-BOY-001",
      assoc: assocVentaquemada,
      zone: zVentaquemada,
      cp: cpVentaquemada,
      farmName: "Finca El Mirador",
      vereda: "Puente de Boyacá",
      hectares: 4.5,
      paymentTerm: "MAX_8_DAYS",
      score: 98.5,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Titular (Luis)",
      channel: "WHATSAPP_AUDIO",
      readAloud: true,
    },
    {
      fullName: "Rosa Helena Rojas",
      email: "rosa.rojas@ventaquemada.org",
      phone: "+573115001002",
      code: "PROD-BOY-002",
      assoc: assocVentaquemada,
      zone: zVentaquemada,
      cp: cpVentaquemada,
      farmName: "Finca La Pradera",
      vereda: "El Carmen",
      hectares: 3.0,
      paymentTerm: "CONTADO_MISMO_DIA",
      score: 96.0,
      hasPhone: true,
      isSmartphone: false,
      hasMobileData: false,
      hasFarmSignal: true,
      usesWhatsapp: false,
      handler: "Hija mayor",
      channel: "PHONE_CALL",
      readAloud: true,
    },
    {
      fullName: "José Manuel Patiño",
      email: "jose.patino@ventaquemada.org",
      phone: "+573115001003",
      code: "PROD-BOY-003",
      assoc: assocVentaquemada,
      zone: zVentaquemada,
      cp: cpVentaquemada,
      farmName: "Parcela San Isidro",
      vereda: "Supatá Alta",
      hectares: 6.0,
      paymentTerm: "MAX_8_DAYS",
      score: 92.0,
      hasPhone: false,
      isSmartphone: false,
      hasMobileData: false,
      hasFarmSignal: false,
      usesWhatsapp: false,
      handler: "Punto de acopio",
      channel: "ACOPIO_PAPER",
      readAloud: true,
    },
    {
      fullName: "Blanca Nieves Suárez",
      email: "blanca.suarez@toca.org",
      phone: "+573115001004",
      code: "PROD-BOY-004",
      assoc: assocToca,
      zone: zToca,
      cp: cpToca,
      farmName: "Finca Los Pinos",
      vereda: "Tuaneca Abajo",
      hectares: 5.2,
      paymentTerm: "DAYS_1_3",
      score: 97.0,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Titular",
      channel: "WHATSAPP_TEXT",
      readAloud: false,
    },
    {
      fullName: "Alfonso Merchán",
      email: "alfonso.merchan@toca.org",
      phone: "+573115001005",
      code: "PROD-BOY-005",
      assoc: assocToca,
      zone: zToca,
      cp: cpToca,
      farmName: "Finca El Arrayán",
      vereda: "Centro Rural",
      hectares: 8.0,
      paymentTerm: "CONTADO_MISMO_DIA",
      score: 94.5,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: false,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Esposa",
      channel: "WHATSAPP_AUDIO",
      readAloud: true,
    },
    {
      fullName: "Nubia Esperanza Díaz",
      email: "nubia.diaz@sabanaverde.org",
      phone: "+573125002001",
      code: "PROD-CUN-001",
      assoc: assocSubachoque,
      zone: zSubachoque,
      cp: cpSubachoque,
      farmName: "Finca La Esperanza",
      vereda: "El Tobal",
      hectares: 4.0,
      paymentTerm: "DAYS_1_3",
      score: 99.0,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Titular",
      channel: "WHATSAPP_TEXT",
      readAloud: false,
    },
    {
      fullName: "Pedro Antonio Vargas",
      email: "pedro.vargas@sabanaverde.org",
      phone: "+573125002002",
      code: "PROD-CUN-002",
      assoc: assocSubachoque,
      zone: zSubachoque,
      cp: cpSubachoque,
      farmName: "Huerto San Jorge",
      vereda: "Galicia",
      hectares: 6.5,
      paymentTerm: "CONTADO_MISMO_DIA",
      score: 95.0,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Titular",
      channel: "WHATSAPP_AUDIO",
      readAloud: true,
    },
    {
      fullName: "Carmen Cecilia Pinzón",
      email: "carmen.pinzon@sabanaverde.org",
      phone: "+573125002003",
      code: "PROD-CUN-003",
      assoc: assocSubachoque,
      zone: zSubachoque,
      cp: cpSubachoque,
      farmName: "Finca El Rosalito",
      vereda: "Canica Baja",
      hectares: 2.8,
      paymentTerm: "MAX_8_DAYS",
      score: 96.5,
      hasPhone: true,
      isSmartphone: false,
      hasMobileData: false,
      hasFarmSignal: true,
      usesWhatsapp: false,
      handler: "Titular (llamada)",
      channel: "PHONE_CALL",
      readAloud: true,
    },
    {
      fullName: "Gabriel Enrique Torres",
      email: "gabriel.torres@sabanaverde.org",
      phone: "+573125002004",
      code: "PROD-CUN-004",
      assoc: assocSubachoque,
      zone: zSubachoque,
      cp: cpSubachoque,
      farmName: "Finca Agua Clara",
      vereda: "La Pradera",
      hectares: 5.5,
      paymentTerm: "MAX_8_DAYS",
      score: 91.0,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Hijo (líder joven)",
      channel: "WEB",
      readAloud: false,
    },
    {
      fullName: "Luz Marina Beltrán",
      email: "luz.beltran@chipaque.org",
      phone: "+573155003001",
      code: "PROD-CUN-005",
      assoc: assocChipaque,
      zone: zChipaque,
      cp: cpChipaque,
      farmName: "Finca Alto de la Cruz",
      vereda: "Munar",
      hectares: 3.5,
      paymentTerm: "CONTADO_MISMO_DIA",
      score: 95.5,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Titular",
      channel: "WHATSAPP_AUDIO",
      readAloud: true,
    },
    {
      fullName: "Héctor Julio Rincón",
      email: "hector.rincon@chipaque.org",
      phone: "+573155003002",
      code: "PROD-CUN-006",
      assoc: assocChipaque,
      zone: zChipaque,
      cp: cpChipaque,
      farmName: "Parcela Las Flores",
      vereda: "Quetame Bajo",
      hectares: 2.5,
      paymentTerm: "DAYS_1_3",
      score: 93.0,
      hasPhone: true,
      isSmartphone: false,
      hasMobileData: false,
      hasFarmSignal: false,
      usesWhatsapp: false,
      handler: "Punto de acopio",
      channel: "ACOPIO_PAPER",
      readAloud: true,
    },
    {
      fullName: "Jorge Eliécer Moreno",
      email: "jorge.moreno@independiente.co",
      phone: "+573155003003",
      code: "PROD-CUN-007",
      assoc: null,
      zone: zChipaque,
      cp: cpChipaque,
      farmName: "Finca El Nogal (Independiente)",
      vereda: "Calderitas",
      hectares: 4.2,
      paymentTerm: "CONTADO_MISMO_DIA",
      score: 88.0,
      hasPhone: true,
      isSmartphone: true,
      hasMobileData: true,
      hasFarmSignal: true,
      usesWhatsapp: true,
      handler: "Titular",
      channel: "WHATSAPP_TEXT",
      readAloud: true,
    },
  ];

  const createdProducers = [];
  for (const p of producersSeed) {
    const u = await prisma.user.create({
      data: {
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        role: "PRODUCER",
        passwordHash: demoPass,
        preferredChannel: p.channel,
      },
    });
    await prisma.consentRecord.create({
      data: {
        userId: u.id,
        purposeSummary:
          "Autorización sencilla Ley 1581 de 2012: usamos su nombre, teléfono y finca únicamente para enviarle pedidos, pesar su cosecha y pagarle a tiempo.",
        accepted: true,
        readAloudByGestor: p.readAloud,
        captureChannel: p.channel,
        evidenceNote: p.readAloud
          ? "Leído en voz alta en punto de acopio por el gestor de zona."
          : "Aceptado en formato simplificado.",
        signatureRef: p.channel === "ACOPIO_PAPER" ? `HUELLA-${p.code}` : `OK-${p.code}`,
      },
    });
    const prod = await prisma.producer.create({
      data: {
        uniqueCode: p.code,
        userId: u.id,
        associationId: p.assoc?.id ?? null,
        zoneId: p.zone.id,
        farmName: p.farmName,
        vereda: p.vereda,
        hectares: p.hectares,
        paymentTerm: p.paymentTerm,
        fulfillmentScore: p.score,
        hasPhone: p.hasPhone,
        isSmartphone: p.isSmartphone,
        hasMobileData: p.hasMobileData,
        hasFarmSignal: p.hasFarmSignal,
        usesWhatsapp: p.usesWhatsapp,
        phoneHandlerInHome: p.handler,
        primaryChannel: p.channel,
      },
    });
    createdProducers.push({ user: u, producer: prod, cp: p.cp, assoc: p.assoc, zone: p.zone });
  }

  // Transportadores aliados (5)
  const transportersSeed = [
    {
      fullName: "Carlos Méndez",
      email: "carlos.mendez@rutasaliadas.co",
      phone: "+573146001001",
      code: "TRANS-001",
      vehicleType: "CAMION_LIVIANO",
      capacityKg: 2800,
      plateNumber: "WLA-482",
      departments: "Boyacá,Cundinamarca",
      shared: "YES",
      maxDetourKm: 22,
      model: "BASE_PLUS_KM",
      baseRate: 130000,
      perKm: 1950,
      perKg: 240,
      fixed: 320000,
      lat: 5.35,
      lng: -73.53,
      channel: "WHATSAPP_AUDIO",
    },
    {
      fullName: "Orlando Castro",
      email: "orlando.castro@rutasaliadas.co",
      phone: "+573146001002",
      code: "TRANS-002",
      vehicleType: "FURGON_PEQUENO",
      capacityKg: 1600,
      plateNumber: "SVK-915",
      departments: "Cundinamarca",
      shared: "CONDITIONAL",
      maxDetourKm: 15,
      model: "BASE_PLUS_KM",
      baseRate: 105000,
      perKm: 1850,
      perKg: 250,
      fixed: 220000,
      lat: 4.91,
      lng: -74.18,
      channel: "WHATSAPP_TEXT",
    },
    {
      fullName: "Wilson Garzón",
      email: "wilson.garzon@rutasaliadas.co",
      phone: "+573146001003",
      code: "TRANS-003",
      vehicleType: "FURGON_PEQUENO",
      capacityKg: 1800,
      plateNumber: "THM-304",
      departments: "Cundinamarca,Boyacá",
      shared: "CONDITIONAL",
      maxDetourKm: 18,
      model: "PER_KM",
      baseRate: 110000,
      perKm: 2300,
      perKg: 260,
      fixed: 260000,
      lat: 4.46,
      lng: -74.05,
      channel: "PHONE_CALL",
    },
    {
      fullName: "Jhon Freddy Ayala",
      email: "jhon.ayala@rutasaliadas.co",
      phone: "+573146001004",
      code: "TRANS-004",
      vehicleType: "CAMIONETA",
      capacityKg: 950,
      plateNumber: "KTR-712",
      departments: "Cundinamarca",
      shared: "YES",
      maxDetourKm: 12,
      model: "FIXED_ROUTE",
      baseRate: 95000,
      perKm: 1700,
      perKg: 270,
      fixed: 185000,
      lat: 4.71,
      lng: -74.12,
      channel: "WEB",
    },
    {
      fullName: "Edgar Mauricio Silva",
      email: "edgar.silva@rutasaliadas.co",
      phone: "+573146001005",
      code: "TRANS-005",
      vehicleType: "CAMION_MEDIANO_GRANDE",
      capacityKg: 4500,
      plateNumber: "EQZ-128",
      departments: "Boyacá,Cundinamarca",
      shared: "CONDITIONAL",
      maxDetourKm: 25,
      model: "PER_KG",
      baseRate: 160000,
      perKm: 2400,
      perKg: 210,
      fixed: 410000,
      lat: 5.52,
      lng: -73.24,
      channel: "WHATSAPP_TEXT",
    },
  ];

  const createdTransporters = [];
  for (const t of transportersSeed) {
    const u = await prisma.user.create({
      data: {
        fullName: t.fullName,
        email: t.email,
        phone: t.phone,
        role: "TRANSPORTER",
        passwordHash: demoPass,
        preferredChannel: t.channel,
      },
    });
    await prisma.consentRecord.create({
      data: {
        userId: u.id,
        purposeSummary: "Autorización Ley 1581 de 2012 para programación de rutas, ubicación de paradas y pago de viajes.",
        accepted: true,
        readAloudByGestor: false,
        captureChannel: t.channel,
        signatureRef: `OK-${t.code}`,
      },
    });
    const tr = await prisma.transporter.create({
      data: {
        code: t.code,
        userId: u.id,
        vehicleType: t.vehicleType,
        capacityKg: t.capacityKg,
        plateNumber: t.plateNumber,
        operatingDepartments: t.departments,
        acceptsSharedRoutes: t.shared,
        maxDetourKm: t.maxDetourKm,
        preferredTariffModel: t.model,
        baseRateCop: t.baseRate,
        perKmRateCop: t.perKm,
        perKgRateCop: t.perKg,
        fixedRouteRateCop: t.fixed,
        waitingFeePerHourCop: 35000,
        cancellationCompPct: 0.35,
        homeLat: t.lat,
        homeLng: t.lng,
      },
    });
    createdTransporters.push({ user: u, transporter: tr });
  }

  // 4. Catálogo de 14 productos + Ciclo de precios Nov 2026 (con referencia SIPSA)
  const productsSeed = [
    { sku: "LEC-BAT", name: "Lechuga batavia", category: "HORTALIZA", iconKey: "lettuce", sipsa: 2350, producer: 2100, buyer: 2450, funcDisc: 0.2, days: 4 },
    { sku: "ZAN-CHA", name: "Zanahoria", category: "VERDURA", iconKey: "carrot", sipsa: 1850, producer: 1600, buyer: 1920, funcDisc: 0.22, days: 10 },
    { sku: "TOM-CHO", name: "Tomate chonto", category: "VERDURA", iconKey: "tomato", sipsa: 3150, producer: 2800, buyer: 3250, funcDisc: 0.2, days: 5 },
    { sku: "PAP-PAS", name: "Papa pastusa", category: "TUBERCULO", iconKey: "potato", sipsa: 2950, producer: 2300, buyer: 2680, funcDisc: 0.18, days: 15 },
    { sku: "PAP-CRI", name: "Papa criolla", category: "TUBERCULO", iconKey: "criolla", sipsa: 4200, producer: 3550, buyer: 4100, funcDisc: 0.18, days: 7 },
    { sku: "CEB-LAR", name: "Cebolla larga", category: "HORTALIZA", iconKey: "scallion", sipsa: 2600, producer: 2200, buyer: 2580, funcDisc: 0.15, days: 6 },
    { sku: "CEB-CAB", name: "Cebolla cabezona", category: "VERDURA", iconKey: "onion", sipsa: 2450, producer: 2050, buyer: 2420, funcDisc: 0.18, days: 14 },
    { sku: "ESP-BOG", name: "Espinaca", category: "HORTALIZA", iconKey: "spinach", sipsa: 3400, producer: 2900, buyer: 3380, funcDisc: 0.2, days: 4 },
    { sku: "REP-VER", name: "Repollo verde", category: "HORTALIZA", iconKey: "cabbage", sipsa: 1750, producer: 1450, buyer: 1720, funcDisc: 0.2, days: 8 },
    { sku: "HAB-VER", name: "Habichuela", category: "VERDURA", iconKey: "greenbean", sipsa: 4100, producer: 3500, buyer: 4050, funcDisc: 0.15, days: 5 },
    { sku: "ARV-VER", name: "Arveja verde", category: "VERDURA", iconKey: "peas", sipsa: 6200, producer: 5400, buyer: 6150, funcDisc: 0.12, days: 5 },
    { sku: "MOR-CAS", name: "Mora de Castilla", category: "FRUTA", iconKey: "blackberry", sipsa: 4600, producer: 3950, buyer: 4550, funcDisc: 0.25, days: 3 },
    { sku: "FRE-SAB", name: "Fresa de la Sabana", category: "FRUTA", iconKey: "strawberry", sipsa: 6800, producer: 5800, buyer: 6700, funcDisc: 0.25, days: 3 },
    { sku: "LUL-CUN", name: "Lulo", category: "FRUTA", iconKey: "lulo", sipsa: 4900, producer: 4200, buyer: 4850, funcDisc: 0.22, days: 6 },
  ];

  const cycle = await prisma.priceCycle.create({
    data: {
      code: "CICLO-2026-11B",
      name: "Ciclo Quincenal Noviembre 2026 (Semanas 47–48)",
      startDate: new Date("2026-11-15T00:00:00-05:00"),
      endDate: new Date("2026-11-30T23:59:59-05:00"),
      ipcFoodPct: 7.31,
      isActive: true,
    },
  });

  const productMap = new Map<string, { id: string; sku: string; name: string; producerPrice: number; buyerPrice: number; functionalPrice: number }>();

  for (const p of productsSeed) {
    const prod = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        iconKey: p.iconKey,
        supportsFunctionalQuality: true,
        functionalDiscountPct: p.funcDisc,
        perishabilityDays: p.days,
      },
    });
    const functionalPrice = Math.round(p.buyer * (1 - p.funcDisc));
    await prisma.cyclePrice.create({
      data: {
        priceCycleId: cycle.id,
        productId: prod.id,
        sipsaRefPriceCop: p.sipsa,
        agreedBuyerPriceCop: p.buyer,
        agreedProducerPriceCop: p.producer,
        functionalBuyerPriceCop: functionalPrice,
        bandMinCop: Math.round(p.producer * 0.88),
        bandMaxCop: Math.round(p.producer * 1.12),
      },
    });
    productMap.set(p.sku, {
      id: prod.id,
      sku: p.sku,
      name: p.name,
      producerPrice: p.producer,
      buyerPrice: p.buyer,
      functionalPrice,
    });

    // Series SIPSA (4 semanas) — incluye alza notable en Papa pastusa (+24% sobre banda para probar alertas)
    const multipliers =
      p.sku === "PAP-PAS" ? [0.92, 1.0, 1.12, 1.24] : [0.96, 1.0, 1.03, 1.02];
    for (let w = 0; w < 4; w++) {
      const sipsaVal = Math.round(p.sipsa * multipliers[w]);
      await prisma.externalMarketFeed.create({
        data: {
          productId: prod.id,
          recordedDate: addDays(new Date("2026-11-01T06:00:00-05:00"), w * 7),
          sipsaPriceCop: sipsaVal,
          corabastosMinCop: Math.round(sipsaVal * 0.91),
          corabastosMaxCop: Math.round(sipsaVal * 1.11),
          ipcFoodVariationPct: 7.31,
          source: "DANE-SIPSA",
        },
      });
    }
  }

  // 5. Reglas de sustitutos pre-acordados con chefs (11/11 compradores exigieron reposición)
  const subPairs: Array<[string, string, string]> = [
    ["LEC-BAT", "ESP-BOG", "Aprobado por chef para ensaladas y acompañamientos"],
    ["LEC-BAT", "REP-VER", "Segunda opción para ensaladas frescas"],
    ["PAP-PAS", "PAP-CRI", "Aceptado para sopas y purés"],
    ["TOM-CHO", "ZAN-CHA", "Sustituto para base de guisos y cremas"],
    ["MOR-CAS", "FRE-SAB", "Reemplazo directo para jugos del menú diario"],
  ];

  for (const b of createdBuyers) {
    for (let i = 0; i < subPairs.length; i++) {
      const [primSku, altSku, note] = subPairs[i];
      const prim = productMap.get(primSku)!;
      const alt = productMap.get(altSku)!;
      await prisma.buyerSubstituteRule.create({
        data: {
          buyerOrgId: b.org.id,
          primaryProductId: prim.id,
          substituteProductId: alt.id,
          priorityOrder: i + 1,
          autoApproveIfShortage: true,
          notes: note,
        },
      });
    }
  }

  // 6. Alertas climáticas IDEAM (activas)
  await prisma.weatherAlert.createMany({
    data: [
      {
        zoneId: zVentaquemada.id,
        municipality: "Ventaquemada",
        alertType: "HELADA",
        severity: "HIGH",
        description:
          "Alerta amarilla IDEAM por descenso térmico nocturno en altiplano cundiboyacense (2–4 °C). Riesgo en hortalizas de hoja; activar reparto con Sabana Occidente.",
        validFrom: new Date("2026-11-21T00:00:00-05:00"),
        validUntil: new Date("2026-11-27T23:59:59-05:00"),
        source: "IDEAM",
        isActive: true,
      },
      {
        zoneId: zChipaque.id,
        municipality: "Chipaque",
        alertType: "LLUVIA_EXTREMA",
        severity: "MEDIUM",
        description:
          "Precipitaciones moderadas a fuertes en corredor Oriente. Posible demora de 20 min en cargue rural.",
        validFrom: new Date("2026-11-22T00:00:00-05:00"),
        validUntil: new Date("2026-11-26T23:59:59-05:00"),
        source: "IDEAM",
        isActive: true,
      },
      {
        zoneId: zSubachoque.id,
        municipality: "Subachoque",
        alertType: "NORMAL",
        severity: "LOW",
        description: "Condiciones estables en Sabana Occidente, óptimo para cosecha programada.",
        validFrom: new Date("2026-11-20T00:00:00-05:00"),
        validUntil: new Date("2026-11-30T23:59:59-05:00"),
        source: "IDEAM",
        isActive: true,
      },
    ],
  });

  // 7. Declaraciones de siembra por ciclo (planeación orientativa, NO venta firme)
  const sowingSamples = [
    { prodIdx: 0, sku: "LEC-BAT", kg: 420, batch: 1, daysAgo: 35, chan: "WHATSAPP_AUDIO" },
    { prodIdx: 0, sku: "ZAN-CHA", kg: 600, batch: 2, daysAgo: 70, chan: "WHATSAPP_AUDIO" },
    { prodIdx: 0, sku: "TOM-CHO", kg: 540, batch: 1, daysAgo: 60, chan: "WHATSAPP_AUDIO" },
    { prodIdx: 1, sku: "PAP-PAS", kg: 950, batch: 1, daysAgo: 90, chan: "PHONE_CALL" },
    { prodIdx: 2, sku: "ZAN-CHA", kg: 520, batch: 1, daysAgo: 75, chan: "ACOPIO_PAPER" },
    { prodIdx: 3, sku: "CEB-LAR", kg: 480, batch: 1, daysAgo: 55, chan: "WHATSAPP_TEXT" },
    { prodIdx: 4, sku: "PAP-PAS", kg: 1100, batch: 2, daysAgo: 88, chan: "WHATSAPP_AUDIO" },
    { prodIdx: 5, sku: "LEC-BAT", kg: 460, batch: 2, daysAgo: 32, chan: "WHATSAPP_TEXT" },
    { prodIdx: 5, sku: "ESP-BOG", kg: 340, batch: 1, daysAgo: 30, chan: "WHATSAPP_TEXT" },
    { prodIdx: 6, sku: "ZAN-CHA", kg: 680, batch: 2, daysAgo: 72, chan: "WHATSAPP_AUDIO" },
    { prodIdx: 7, sku: "FRE-SAB", kg: 310, batch: 1, daysAgo: 50, chan: "PHONE_CALL" },
    { prodIdx: 8, sku: "REP-VER", kg: 500, batch: 1, daysAgo: 48, chan: "WEB" },
    { prodIdx: 9, sku: "TOM-CHO", kg: 580, batch: 2, daysAgo: 58, chan: "WHATSAPP_AUDIO" },
    { prodIdx: 10, sku: "MOR-CAS", kg: 260, batch: 1, daysAgo: 62, chan: "ACOPIO_PAPER" },
    { prodIdx: 11, sku: "HAB-VER", kg: 300, batch: 1, daysAgo: 45, chan: "WHATSAPP_TEXT" },
  ];

  for (const s of sowingSamples) {
    const p = createdProducers[s.prodIdx];
    const pr = productMap.get(s.sku)!;
    const sowDate = addDays(new Date("2026-11-22"), -s.daysAgo);
    await prisma.sowingDeclaration.create({
      data: {
        producerId: p.producer.id,
        productId: pr.id,
        sowingDate: sowDate,
        estimatedHarvestStart: new Date("2026-11-20T06:00:00-05:00"),
        estimatedHarvestEnd: new Date("2026-12-18T18:00:00-05:00"),
        estimatedKg: s.kg,
        staggeredBatchNumber: s.batch,
        captureChannel: s.chan,
        capturedByUserId: acopioUser.id,
        notes: "Planeación escalonada por ciclo (orientativa, sujeta a confirmación semanal).",
      },
    });
  }

  // 8. Historia realista de 3 semanas completadas (W45, W46, W47) para Analítica & KPIs
  const pastWeeks = [
    { code: "2026-W45", date: new Date("2026-11-03T06:30:00-05:00"), activeBuyers: 4 },
    { code: "2026-W46", date: new Date("2026-11-10T06:30:00-05:00"), activeBuyers: 5 },
    { code: "2026-W47", date: new Date("2026-11-17T06:30:00-05:00"), activeBuyers: 6 },
  ];

  let lotSeq = 1;
  let assignSeq = 1;
  let settleSeq = 1;

  for (let wIdx = 0; wIdx < pastWeeks.length; wIdx++) {
    const wk = pastWeeks[wIdx];
    const tr = createdTransporters[wIdx % 2].transporter;

    // Create consolidated route for the week
    const route = await prisma.route.create({
      data: {
        routeCode: `RUT-${wk.code}-01`,
        routeDate: wk.date,
        deliveryWeek: wk.code,
        transporterId: tr.id,
        status: "COMPLETED",
        totalKg: 1480 + wIdx * 240,
        vehicleUtilizationPct: Math.min(94, Math.round(((1480 + wIdx * 240) / tr.capacityKg) * 100)),
        estimatedKm: 162,
        detourKm: 11.4,
        agreedTariffCop: 345000 + wIdx * 18000,
        waitingMinutesTotal: wIdx === 1 ? 42 : 18,
        waitingCompCop: wIdx === 1 ? 15000 : 0,
        cancellationCompCop: 0,
        grossCommissionRevCop: 165000 + wIdx * 42000, // Valor de referencia post-piloto/mixto
        proratedSubRevCop: 87500,
        backupOvercostCop: wIdx === 1 ? 46000 : 0,
        contributionMarginCop: 165000 + wIdx * 42000 + 87500 - (345000 + wIdx * 18000) - (wIdx === 1 ? 61000 : 0),
        marginPerKgCop: Math.round(
          ((165000 + wIdx * 42000 + 87500 - (345000 + wIdx * 18000) - (wIdx === 1 ? 61000 : 0)) /
            (1480 + wIdx * 240)) *
            10
        ) / 10,
        tariffModelUsed: tr.preferredTariffModel,
        notes: "Ruta consolidada Boyacá (Ventaquemada) + Cundinamarca (Subachoque) -> Chapinero/Teusaquillo",
        acceptedAt: addDays(wk.date, -1),
        startedAt: wk.date,
        completedAt: new Date(wk.date.getTime() + 1000 * 60 * 195),
      },
    });

    await prisma.routeStop.createMany({
      data: [
        {
          routeId: route.id,
          stopOrder: 1,
          stopType: "PICKUP_ACOPIO",
          refId: cpVentaquemada.id,
          label: cpVentaquemada.name,
          address: cpVentaquemada.veredaAddress,
          lat: cpVentaquemada.lat,
          lng: cpVentaquemada.lng,
          scheduledTime: "04:45",
          waitMinutes: 12,
          kgAmount: 820 + wIdx * 110,
          status: "COMPLETED",
        },
        {
          routeId: route.id,
          stopOrder: 2,
          stopType: "PICKUP_ACOPIO",
          refId: cpSubachoque.id,
          label: cpSubachoque.name,
          address: cpSubachoque.veredaAddress,
          lat: cpSubachoque.lat,
          lng: cpSubachoque.lng,
          scheduledTime: "06:00",
          waitMinutes: wIdx === 1 ? 30 : 6,
          kgAmount: 660 + wIdx * 130,
          status: "COMPLETED",
        },
        {
          routeId: route.id,
          stopOrder: 3,
          stopType: "DELIVERY_BUYER",
          refId: createdBuyers[0].org.id,
          label: createdBuyers[0].org.name,
          address: createdBuyers[0].org.address,
          lat: createdBuyers[0].org.lat,
          lng: createdBuyers[0].org.lng,
          scheduledTime: "07:05",
          waitMinutes: 10,
          kgAmount: 380,
          status: "COMPLETED",
        },
        {
          routeId: route.id,
          stopOrder: 4,
          stopType: "DELIVERY_BUYER",
          refId: createdBuyers[1].org.id,
          label: createdBuyers[1].org.name,
          address: createdBuyers[1].org.address,
          lat: createdBuyers[1].org.lat,
          lng: createdBuyers[1].org.lng,
          scheduledTime: "07:35",
          waitMinutes: 14,
          kgAmount: 540,
          status: "COMPLETED",
        },
      ],
    });

    await prisma.settlement.create({
      data: {
        settlementCode: `LIQ-TR-${String(settleSeq++).padStart(4, "0")}`,
        counterpartyType: "TRANSPORTER",
        counterpartyId: tr.id,
        counterpartyName: createdTransporters[wIdx % 2].user.fullName,
        referenceType: "ROUTE",
        referenceId: route.id,
        deliveryWeek: wk.code,
        grossAmountCop: route.agreedTariffCop + route.waitingCompCop,
        commissionCop: 0,
        subscriptionCop: 0,
        netAmountCop: route.agreedTariffCop + route.waitingCompCop,
        dueDate: addDays(wk.date, 2),
        paidAt: addDays(wk.date, 1),
        paymentMethod: "TRANSFERENCIA",
        status: "PAID",
      },
    });

    // Orders for active buyers in each past week
    for (let bIdx = 0; bIdx < wk.activeBuyers; bIdx++) {
      const buyer = createdBuyers[bIdx];
      const hasIncident = wIdx === 1 && bIdx === 0;
      const hasClimateSub = wIdx === 2 && bIdx === 2;

      const order = await prisma.weeklyOrder.create({
        data: {
          orderCode: `PED-${wk.code}-${String(bIdx + 1).padStart(2, "0")}`,
          buyerOrgId: buyer.org.id,
          priceCycleId: cycle.id,
          deliveryWeek: wk.code,
          deliveryDate: wk.date,
          commitmentType: bIdx % 3 === 0 ? "PARTIAL" : "FULL",
          cutoffAt: addDays(wk.date, -5),
          adjustmentDeadlineAt: addDays(wk.date, -2),
          status: hasIncident || hasClimateSub ? "COMPLETED_WITH_INCIDENT" : "DELIVERED",
          captureChannel: buyer.user.preferredChannel,
          capturedByUserId: buyer.user.id,
          notes: "Pedido semanal consolidado dentro del piloto controlado.",
        },
      });

      const basket = [
        { sku: "LEC-BAT", kg: 60 + bIdx * 10, grade: "STANDARD" },
        { sku: "ZAN-CHA", kg: 90 + bIdx * 15, grade: bIdx % 2 === 0 ? "FUNCTIONAL" : "STANDARD" },
        { sku: "TOM-CHO", kg: 110 + bIdx * 10, grade: "STANDARD" },
        { sku: "PAP-PAS", kg: 130 + bIdx * 20, grade: "STANDARD" },
      ];

      let orderGross = 0;
      for (const item of basket) {
        const pr = productMap.get(item.sku)!;
        const unitPrice = item.grade === "FUNCTIONAL" ? pr.functionalPrice : pr.buyerPrice;
        const adjKg = item.kg + (bIdx % 2 === 0 ? 5 : -5);
        const deliveredKg = hasIncident && item.sku === "TOM-CHO" ? adjKg - 20 : adjKg;
        orderGross += Math.round(deliveredKg * unitPrice);

        const oi = await prisma.orderItem.create({
          data: {
            weeklyOrderId: order.id,
            productId: pr.id,
            qualityGrade: item.grade,
            requestedKg: item.kg,
            adjustedKg: adjKg,
            deliveredKg,
            unitPriceCop: unitPrice,
          },
        });

        // Split across 2 climatic zones (Boyacá + Cundinamarca)
        const pBoyaca = createdProducers[(bIdx + wIdx) % 5];
        const pCundi = createdProducers[5 + ((bIdx + wIdx) % 6)];
        const halfA = Math.round(adjKg * 0.55);
        const halfB = adjKg - halfA;

        for (const [splitProd, splitKg] of [
          [pBoyaca, halfA],
          [pCundi, halfB],
        ] as const) {
          const payDays =
            splitProd.producer.paymentTerm === "CONTADO_MISMO_DIA"
              ? 0
              : splitProd.producer.paymentTerm === "DAYS_1_3"
              ? 2
              : 8;

          const assignment = await prisma.harvestAssignment.create({
            data: {
              assignmentCode: `COS-${wk.code}-${String(assignSeq++).padStart(3, "0")}`,
              orderItemId: oi.id,
              productId: pr.id,
              producerId: splitProd.producer.id,
              associationId: splitProd.assoc?.id ?? null,
              zoneId: splitProd.zone.id,
              collectionPointId: splitProd.cp.id,
              deliveryWeek: wk.code,
              assignedKg: splitKg,
              producerPricePerKgCop: pr.producerPrice,
              pickupDatetime: wk.date,
              paymentDueDate: addDays(wk.date, payDays),
              status: "WEIGHED",
              confirmedAt: addDays(wk.date, -4),
              captureChannel: splitProd.producer.primaryChannel,
              capturedByUserId: splitProd.user.id,
              boletaPrintedAt: addDays(wk.date, -1),
            },
          });

          const confirmMsg = `✓ Sí cumplo: ${pr.name} ${splitKg} kg a $${pr.producerPrice}/kg para el ${wk.code}`;
          await prisma.messageEvidence.create({
            data: {
              entityType: "HARVEST_ASSIGNMENT",
              entityId: assignment.id,
              direction: "INBOUND",
              channel: splitProd.producer.primaryChannel,
              senderPhone: splitProd.user.phone,
              recipientPhone: "+573000000000",
              messageBody: confirmMsg,
              audioTranscript:
                splitProd.producer.primaryChannel === "WHATSAPP_AUDIO"
                  ? `Listo, sí cumplo con los ${splitKg} kilos de ${pr.name} el martes a las 6.`
                  : null,
              actionClicked: "SI_CUMPLO",
              contentSha256Hash: sha256(`${assignment.id}|${confirmMsg}|${wk.code}`),
            },
          });

          const lotCode = `RF-${wk.code}-${splitProd.zone.code.slice(0, 3)}-${pr.sku.slice(0, 3)}-${String(
            lotSeq++
          ).padStart(3, "0")}`;

          const actualKg =
            hasIncident && item.sku === "TOM-CHO" && splitProd === pCundi
              ? Math.max(10, splitKg - 20)
              : splitKg;

          const lot = await prisma.lot.create({
            data: {
              lotCode,
              qrPayload: `https://rutafresca.co/trazabilidad/${lotCode}`,
              harvestAssignmentId: assignment.id,
              producerId: splitProd.producer.id,
              associationId: splitProd.assoc?.id ?? null,
              zoneId: splitProd.zone.id,
              collectionPointId: splitProd.cp.id,
              productId: pr.id,
              farmName: splitProd.producer.farmName,
              municipality: splitProd.zone.municipality,
              harvestDate: addDays(wk.date, -1),
              weighedAt: wk.date,
              requestedKg: splitKg,
              actualKg,
              qualityResult:
                item.grade === "FUNCTIONAL" ? "RECLASSIFIED_FUNCTIONAL" : "APPROVED_STANDARD",
              weigherUserId: acopioUser.id,
              producerSignatureAck: true,
              routeId: route.id,
              weeklyOrderId: order.id,
              captureChannel:
                splitProd.producer.primaryChannel === "ACOPIO_PAPER"
                  ? "ACOPIO_PAPER"
                  : "ACOPIO_TABLET",
            },
          });

          // Settlement to producer
          const producerAmount = Math.round(actualKg * pr.producerPrice);
          await prisma.settlement.create({
            data: {
              settlementCode: `LIQ-PR-${String(settleSeq++).padStart(4, "0")}`,
              counterpartyType: "PRODUCER",
              counterpartyId: splitProd.producer.id,
              counterpartyName: splitProd.user.fullName,
              referenceType: "HARVEST_ASSIGNMENT",
              referenceId: assignment.id,
              deliveryWeek: wk.code,
              grossAmountCop: producerAmount,
              commissionCop: 0,
              subscriptionCop: 0,
              netAmountCop: producerAmount,
              dueDate: addDays(wk.date, payDays),
              paidAt: addDays(wk.date, Math.max(0, payDays - 1)),
              paymentMethod: payDays === 0 ? "EFECTIVO_ACOPIO" : "NEQUI",
              status: "PAID",
            },
          });

          // Create realistic incidents for analytics
          if (hasIncident && item.sku === "TOM-CHO" && splitProd === pCundi) {
            const inc = await prisma.incident.create({
              data: {
                incidentCode: `INC-${wk.code}-001`,
                weeklyOrderId: order.id,
                buyerOrgId: buyer.org.id,
                orderItemId: oi.id,
                lotId: lot.id,
                routeId: route.id,
                producerId: splitProd.producer.id,
                zoneId: splitProd.zone.id,
                productId: pr.id,
                deliveryWeek: wk.code,
                rootCause: "QUALITY_REJECTED_ACOPIO",
                affectedKg: 20,
                description: "20 kg de tomate llegaron sobremaduros al acopio; activado respaldo en Corabastos.",
                resolutionType: "CORABASTOS_BACKUP",
                slaResponseMinutes: 28,
                status: "RESOLVED",
                resolvedAt: new Date(wk.date.getTime() + 1000 * 60 * 45),
              },
            });
            await prisma.backupPurchase.create({
              data: {
                incidentId: inc.id,
                corabastosVendor: "Bodega 14 · Mayorista Aliado La Sabana",
                productId: pr.id,
                kg: 20,
                marketPriceCop: 5550,
                agreedPriceCop: pr.buyerPrice,
                totalOvercostCop: (5550 - pr.buyerPrice) * 20,
                overcostCapCop: 120000,
                platformAbsorbedCop: Math.min(120000, (5550 - pr.buyerPrice) * 20),
              },
            });
          }

          if (hasClimateSub && item.sku === "LEC-BAT" && splitProd === pBoyaca) {
            await prisma.incident.create({
              data: {
                incidentCode: `INC-${wk.code}-002`,
                weeklyOrderId: order.id,
                buyerOrgId: buyer.org.id,
                orderItemId: oi.id,
                lotId: lot.id,
                routeId: route.id,
                producerId: splitProd.producer.id,
                zoneId: splitProd.zone.id,
                productId: pr.id,
                deliveryWeek: wk.code,
                rootCause: "CLIMATE_CERTIFIED",
                affectedKg: 18,
                description:
                  "Helada certificada en Ventaquemada afectó 18 kg de lechuga; reemplazado automáticamente por espinaca pre-acordada (sin penalidad al productor).",
                resolutionType: "PREAGREED_SUBSTITUTE",
                substituteProductId: productMap.get("ESP-BOG")!.id,
                slaResponseMinutes: 19,
                status: "RESOLVED",
                resolvedAt: new Date(wk.date.getTime() + 1000 * 60 * 25),
              },
            });
          }
        }
      }

      // Delivery receipt (OTIF tracking)
      await prisma.deliveryReceipt.create({
        data: {
          weeklyOrderId: order.id,
          routeId: route.id,
          receivedAt: new Date(wk.date.getTime() + 1000 * 60 * 80),
          otifOnTime: !(wIdx === 1 && bIdx === 1),
          otifInFull: !hasIncident,
          wasteMermaKg: hasIncident ? 9 : 4,
          wasteMermaPct: hasIncident ? 3.8 : 1.9,
          receivedByName: buyer.user.fullName,
          notes: hasIncident
            ? "Faltante de tomate repuesto en menos de 45 minutos."
            : "Recepción conforme en ventana pactada, frescura excelente.",
          captureChannel: "WEB",
        },
      });

      // Buyer settlement
      const comm = Math.round(orderGross * buyer.org.commissionRate);
      const subProrated = Math.round(buyer.org.subscriptionFeeCop / 4);
      await prisma.settlement.create({
        data: {
          settlementCode: `LIQ-CO-${String(settleSeq++).padStart(4, "0")}`,
          counterpartyType: "BUYER",
          counterpartyId: buyer.org.id,
          counterpartyName: buyer.org.name,
          referenceType: "WEEKLY_ORDER",
          referenceId: order.id,
          deliveryWeek: wk.code,
          grossAmountCop: orderGross,
          commissionCop: comm,
          subscriptionCop: subProrated,
          netAmountCop: orderGross + comm + subProrated,
          dueDate: addDays(wk.date, 5),
          paidAt: addDays(wk.date, 3),
          paymentMethod: "PSE",
          status: "PAID",
        },
      });
    }
  }

  // Add one historical side-selling incident for realistic Diagnostic Analytics
  await prisma.incident.create({
    data: {
      incidentCode: "INC-2026-W47-003",
      buyerOrgId: createdBuyers[3].org.id,
      producerId: createdProducers[11].producer.id,
      zoneId: zChipaque.id,
      productId: productMap.get("PAP-PAS")!.id,
      deliveryWeek: "2026-W47",
      rootCause: "DIVERTED_SIDE_SELLING",
      affectedKg: 45,
      description:
        "Alza repentina de papa en Corabastos (+24% sobre banda) tentó venta parcial por fuera; cubierto con segunda zona en Toca.",
      resolutionType: "SECOND_ZONE_REALLOCATION",
      slaResponseMinutes: 35,
      status: "RESOLVED",
      resolvedAt: new Date("2026-11-17T06:15:00-05:00"),
    },
  });

  // 9. SEMANA ACTUAL ACTIVA: 2026-W48 (Martes 24 de noviembre de 2026 — coincide 100% con el Manual de Marca)
  const w48Date = new Date("2026-11-24T06:00:00-05:00");
  const w48PayDue = new Date("2026-12-02T17:00:00-05:00"); // "Le pagamos a más tardar el 2 de diciembre" (Manual de Marca!)

  // Orden activa de Claudia (Comedor Empresarial Grupo Andina)
  const orderClaudiaW48 = await prisma.weeklyOrder.create({
    data: {
      orderCode: "PED-2026-W48-01",
      buyerOrgId: createdBuyers[0].org.id,
      priceCycleId: cycle.id,
      deliveryWeek: "2026-W48",
      deliveryDate: w48Date,
      commitmentType: "PARTIAL",
      cutoffAt: new Date("2026-11-20T18:00:00-05:00"),
      adjustmentDeadlineAt: new Date("2026-11-23T12:00:00-05:00"),
      status: "ASSIGNED",
      captureChannel: "WEB",
      capturedByUserId: createdBuyers[0].user.id,
      notes: "Confirmado 85% del menú semanal; ajuste abierto hasta lunes mediodía.",
    },
  });

  const claudiaItems = [
    { sku: "LEC-BAT", kg: 110, grade: "STANDARD" },
    { sku: "ZAN-CHA", kg: 160, grade: "FUNCTIONAL" },
    { sku: "TOM-CHO", kg: 200, grade: "STANDARD" },
    { sku: "PAP-PAS", kg: 220, grade: "STANDARD" },
    { sku: "ESP-BOG", kg: 55, grade: "STANDARD" },
  ];

  const createdClaudiaItems = new Map<string, string>();
  for (const ci of claudiaItems) {
    const pr = productMap.get(ci.sku)!;
    const item = await prisma.orderItem.create({
      data: {
        weeklyOrderId: orderClaudiaW48.id,
        productId: pr.id,
        qualityGrade: ci.grade,
        requestedKg: ci.kg,
        adjustedKg: ci.kg,
        deliveredKg: 0,
        unitPriceCop: ci.grade === "FUNCTIONAL" ? pr.functionalPrice : pr.buyerPrice,
      },
    });
    createdClaudiaItems.set(ci.sku, item.id);
  }

  // Orden activa de Nutriser (Operador Ley 2046) y Campus Central
  const orderCampusW48 = await prisma.weeklyOrder.create({
    data: {
      orderCode: "PED-2026-W48-02",
      buyerOrgId: createdBuyers[1].org.id,
      priceCycleId: cycle.id,
      deliveryWeek: "2026-W48",
      deliveryDate: w48Date,
      commitmentType: "FULL",
      cutoffAt: new Date("2026-11-20T18:00:00-05:00"),
      adjustmentDeadlineAt: new Date("2026-11-23T12:00:00-05:00"),
      status: "LOCKED",
      captureChannel: "WEB",
      capturedByUserId: createdBuyers[1].user.id,
      notes: "Menú universitario semanal confirmado en firme.",
    },
  });

  for (const ci of [
    { sku: "PAP-PAS", kg: 320, grade: "STANDARD" },
    { sku: "ZAN-CHA", kg: 140, grade: "FUNCTIONAL" },
    { sku: "CEB-LAR", kg: 95, grade: "STANDARD" },
    { sku: "MOR-CAS", kg: 80, grade: "FUNCTIONAL" },
  ]) {
    const pr = productMap.get(ci.sku)!;
    await prisma.orderItem.create({
      data: {
        weeklyOrderId: orderCampusW48.id,
        productId: pr.id,
        qualityGrade: ci.grade,
        requestedKg: ci.kg,
        adjustedKg: ci.kg,
        deliveredKg: 0,
        unitPriceCop: ci.grade === "FUNCTIONAL" ? pr.functionalPrice : pr.buyerPrice,
      },
    });
  }

  const orderNutriW48 = await prisma.weeklyOrder.create({
    data: {
      orderCode: "PED-2026-W48-03",
      buyerOrgId: createdBuyers[5].org.id,
      priceCycleId: cycle.id,
      deliveryWeek: "2026-W48",
      deliveryDate: w48Date,
      commitmentType: "FULL",
      cutoffAt: new Date("2026-11-20T18:00:00-05:00"),
      adjustmentDeadlineAt: new Date("2026-11-23T12:00:00-05:00"),
      status: "LOCKED",
      captureChannel: "WEB",
      capturedByUserId: createdBuyers[5].user.id,
      notes: "Requiere certificado PDF de origen campesino por lote (Ley 2046 de 2020).",
    },
  });

  for (const ci of [
    { sku: "LEC-BAT", kg: 90, grade: "STANDARD" },
    { sku: "TOM-CHO", kg: 150, grade: "STANDARD" },
    { sku: "ARV-VER", kg: 75, grade: "STANDARD" },
    { sku: "LUL-CUN", kg: 85, grade: "STANDARD" },
  ]) {
    const pr = productMap.get(ci.sku)!;
    await prisma.orderItem.create({
      data: {
        weeklyOrderId: orderNutriW48.id,
        productId: pr.id,
        qualityGrade: ci.grade,
        requestedKg: ci.kg,
        adjustedKg: ci.kg,
        deliveredKg: 0,
        unitPriceCop: ci.grade === "FUNCTIONAL" ? pr.functionalPrice : pr.buyerPrice,
      },
    });
  }

  // Asignaciones EXACTAS del Manual de Marca para Don Luis Rodríguez (Ventaquemada, Boyacá) en Semana 48:
  // Lechuga 60 kg ($2.100), Zanahoria 90 kg ($1.600), Tomate 120 kg ($2.800) — Traer martes 24 a las 6 a. m., pago a más tardar 2 de diciembre
  const donLuis = createdProducers[0];
  const nubiaSabana = createdProducers[5];
  const josePapel = createdProducers[2];
  const pedroSabana = createdProducers[6];

  const luisAssignmentsSeed = [
    { sku: "LEC-BAT", kg: 60, status: "SENT" },
    { sku: "ZAN-CHA", kg: 90, status: "CONFIRMED" },
    { sku: "TOM-CHO", kg: 120, status: "CONFIRMED" },
  ];

  for (const la of luisAssignmentsSeed) {
    const pr = productMap.get(la.sku)!;
    const asgn = await prisma.harvestAssignment.create({
      data: {
        assignmentCode: `COS-2026-W48-LUIS-${la.sku.slice(0, 3)}`,
        orderItemId: createdClaudiaItems.get(la.sku) ?? null,
        productId: pr.id,
        producerId: donLuis.producer.id,
        associationId: assocVentaquemada.id,
        zoneId: zVentaquemada.id,
        collectionPointId: cpVentaquemada.id,
        deliveryWeek: "2026-W48",
        assignedKg: la.kg,
        producerPricePerKgCop: pr.producerPrice,
        pickupDatetime: w48Date,
        paymentDueDate: w48PayDue,
        status: la.status,
        confirmedAt: la.status === "CONFIRMED" ? new Date("2026-11-21T16:20:00-05:00") : null,
        captureChannel: "WHATSAPP_AUDIO",
        capturedByUserId: donLuis.user.id,
      },
    });

    const outBody = `✓ Le quedó vendido · ${pr.name} · ${la.kg} kilos · $${pr.producerPrice.toLocaleString("es-CO")} el kilo · Traer el martes 24, 6 a. m. · Punto de acopio de la vereda.`;
    await prisma.messageEvidence.create({
      data: {
        entityType: "HARVEST_ASSIGNMENT",
        entityId: asgn.id,
        direction: "OUTBOUND",
        channel: "WHATSAPP_AUDIO",
        senderPhone: "+573000000000",
        recipientPhone: donLuis.user.phone,
        messageBody: outBody,
        audioTranscript: `Don Luis, buen día de Ruta Fresca. Le quedó vendido ${la.kg} kilos de ${pr.name} a ${pr.producerPrice} pesos el kilo para traer el martes 24 a las 6 de la mañana al salón comunal de la vereda. Le pagamos a más tardar el 2 de diciembre. Responda con el botón Sí cumplo o mándenos un audio.`,
        contentSha256Hash: sha256(`${asgn.id}|OUT|${outBody}`),
      },
    });

    if (la.status === "CONFIRMED") {
      const inBody = `✓ Sí cumplo · Listo don Luis, confirmado para el martes 24 a las 6 a. m.`;
      await prisma.messageEvidence.create({
        data: {
          entityType: "HARVEST_ASSIGNMENT",
          entityId: asgn.id,
          direction: "INBOUND",
          channel: "WHATSAPP_AUDIO",
          senderPhone: donLuis.user.phone,
          recipientPhone: "+573000000000",
          messageBody: inBody,
          audioTranscript: `Listo señorita, sí cumplo con los ${la.kg} kilos de ${pr.name}. Allá nos vemos el martes temprano.`,
          actionClicked: "SI_CUMPLO",
          contentSha256Hash: sha256(`${asgn.id}|IN|${inBody}`),
        },
      });
    }
  }

  // Contraparte en Cundinamarca (segunda zona climática para los mismos productos de W48)
  const extraW48Assignments = [
    { prod: nubiaSabana, sku: "LEC-BAT", kg: 50, status: "CONFIRMED" },
    { prod: pedroSabana, sku: "ZAN-CHA", kg: 70, status: "CONFIRMED" },
    { prod: createdProducers[9], sku: "TOM-CHO", kg: 80, status: "CONFIRMED" },
    { prod: josePapel, sku: "PAP-PAS", kg: 140, status: "CONFIRMED" },
    { prod: nubiaSabana, sku: "ESP-BOG", kg: 55, status: "CONFIRMED" },
  ];

  for (const ea of extraW48Assignments) {
    const pr = productMap.get(ea.sku)!;
    const payDays =
      ea.prod.producer.paymentTerm === "CONTADO_MISMO_DIA"
        ? 0
        : ea.prod.producer.paymentTerm === "DAYS_1_3"
        ? 2
        : 8;
    await prisma.harvestAssignment.create({
      data: {
        assignmentCode: `COS-2026-W48-${String(assignSeq++).padStart(3, "0")}`,
        orderItemId: createdClaudiaItems.get(ea.sku) ?? null,
        productId: pr.id,
        producerId: ea.prod.producer.id,
        associationId: ea.prod.assoc?.id ?? null,
        zoneId: ea.prod.zone.id,
        collectionPointId: ea.prod.cp.id,
        deliveryWeek: "2026-W48",
        assignedKg: ea.kg,
        producerPricePerKgCop: pr.producerPrice,
        pickupDatetime: w48Date,
        paymentDueDate: addDays(w48Date, payDays),
        status: ea.status,
        confirmedAt: new Date("2026-11-21T17:10:00-05:00"),
        captureChannel: ea.prod.producer.primaryChannel,
        capturedByUserId: acopioUser.id,
      },
    });
  }

  // Ruta ofertada para Semana 48 lista para que Carlos Méndez (Transportador) la revise y acepte/ejecute
  const carlos = createdTransporters[0].transporter;
  const routeW48 = await prisma.route.create({
    data: {
      routeCode: "RUT-2026-W48-01",
      routeDate: w48Date,
      deliveryWeek: "2026-W48",
      transporterId: carlos.id,
      status: "OFFERED",
      totalKg: 1420,
      vehicleUtilizationPct: 50.7,
      estimatedKm: 168,
      detourKm: 12.5,
      agreedTariffCop: 457600,
      waitingMinutesTotal: 0,
      waitingCompCop: 0,
      cancellationCompCop: 0,
      grossCommissionRevCop: 138000,
      proratedSubRevCop: 87500,
      backupOvercostCop: 0,
      contributionMarginCop: -232100, // En piloto 0% (muestra claramente el reto económico del piloto vs post-piloto!)
      marginPerKgCop: -163.5,
      tariffModelUsed: "BASE_PLUS_KM",
      notes:
        "Ruta compartida Semana 48 (Boyacá + Sabana Occidente -> Chapinero/Teusaquillo). Tarifa pactada antes de salir con regla de compensación 35% ante cancelación.",
    },
  });

  await prisma.routeStop.createMany({
    data: [
      {
        routeId: routeW48.id,
        stopOrder: 1,
        stopType: "PICKUP_ACOPIO",
        refId: cpVentaquemada.id,
        label: cpVentaquemada.name,
        address: cpVentaquemada.veredaAddress,
        lat: cpVentaquemada.lat,
        lng: cpVentaquemada.lng,
        scheduledTime: "05:30",
        kgAmount: 410,
        status: "PENDING",
      },
      {
        routeId: routeW48.id,
        stopOrder: 2,
        stopType: "PICKUP_ACOPIO",
        refId: cpSubachoque.id,
        label: cpSubachoque.name,
        address: cpSubachoque.veredaAddress,
        lat: cpSubachoque.lat,
        lng: cpSubachoque.lng,
        scheduledTime: "06:45",
        kgAmount: 315,
        status: "PENDING",
      },
      {
        routeId: routeW48.id,
        stopOrder: 3,
        stopType: "DELIVERY_BUYER",
        refId: createdBuyers[0].org.id,
        label: createdBuyers[0].org.name,
        address: createdBuyers[0].org.address,
        lat: createdBuyers[0].org.lat,
        lng: createdBuyers[0].org.lng,
        scheduledTime: "07:45",
        kgAmount: 745,
        status: "PENDING",
      },
      {
        routeId: routeW48.id,
        stopOrder: 4,
        stopType: "DELIVERY_BUYER",
        refId: createdBuyers[5].org.id,
        label: createdBuyers[5].org.name,
        address: createdBuyers[5].org.address,
        lat: createdBuyers[5].org.lat,
        lng: createdBuyers[5].org.lng,
        scheduledTime: "08:15",
        kgAmount: 400,
        status: "PENDING",
      },
    ],
  });

  // 1 incidencia abierta en W48 por alerta de helada en Ventaquemada para demostrar la mesa de incidencias
  await prisma.incident.create({
    data: {
      incidentCode: "INC-2026-W48-001",
      weeklyOrderId: orderClaudiaW48.id,
      buyerOrgId: createdBuyers[0].org.id,
      productId: productMap.get("LEC-BAT")!.id,
      producerId: donLuis.producer.id,
      zoneId: zVentaquemada.id,
      deliveryWeek: "2026-W48",
      rootCause: "CLIMATE_CERTIFIED",
      affectedKg: 25,
      description:
        "Alerta preventiva IDEAM de helada en Ventaquemada: posible merma parcial de 25 kg en lechuga batavia. Sustituto pre-acordado (espinaca) o respaldo en Sabana Occidente disponibles.",
      resolutionType: "PENDING",
      status: "OPEN",
    },
  });

  console.log("✅ Seed completado con éxito:");
  console.log("   - 5 zonas (1 piloto Bogotá + 4 rurales en Boyacá y Cundinamarca)");
  console.log("   - 6 compradores institucionales, 4 asociaciones, 12 productores, 5 transportadores");
  console.log("   - 14 productos con precios SIPSA y calidad funcional");
  console.log("   - 3 semanas históricas completadas (W45-W47) + Semana 48 activa (Manual de Marca)");
  console.log("   - Credenciales demo (clave: rutafresca2026): ops@rutafresca.co | claudia@andina.com.co | luis.rodriguez@ventaquemada.org | acopio.ventaquemada@rutafresca.co | carlos.mendez@rutasaliadas.co");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
