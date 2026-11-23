# Ruta Fresca — Plataforma B2B de Cosecha Programada

> **«Se cosecha lo que usted ya pidió.»**  
> *Que lo cultivado en Cundinamarca y Boyacá llegue vendido y a tiempo a las cocinas de Bogotá.*

Aplicación web/PWA full-stack diseñada a partir de la documentación de Fase 1 y Fase 2 de **Ruta Fresca** (Universidad Nacional de Colombia · Noviembre de 2026).

---

## Módulos implementados

1. **Landing e Inicio de Sesión (`/`, `/login`)**: propuesta de valor por actor, flujo semanal de 6 etapas, métricas vivas del piloto y selector rápido de perfiles demo (activable vía `NEXT_PUBLIC_ENABLE_DEMO_SWITCHER`).
2. **Vinculación y Gobierno del Dato (`/vinculacion`)**: registro de compradores, productores (con **encuesta de línea base digital** para evitar sesgo de exclusión) y transportadores, más bitácora auditable y revocable bajo **Ley 1581 de 2012** (incluyendo lectura en voz alta).
3. **Portal del Comprador Institucional (`/comprador`)**: precios pactados por ciclo frente a SIPSA, toggle de **Calidad Funcional (-15 % a -25 %)**, pedidos semanales parciales/flexibles, acuerdos previos de sustitutos (garantía 11/11), recepción OTIF/merma y descarga de **Certificado PDF de Origen Campesino (Ley 2046 de 2020)**.
4. **Espacio del Productor y Simulador WhatsApp/Voz (`/productor`)**: lenguaje cotidiano sin tecnicismos, botones grandes `✓ Sí cumplo` / `✗ No alcanzo`, simulador interactivo de WhatsApp con notas de voz (TTS + grabación real + enlace `wa.me`) con respaldo hash SHA-256 (**Ley 527 de 1999**), planeación orientativa de siembra por ciclo, pagos flexibles (contado / 1–3 d / ≤ 8 d) y descarga PDF fiel al Manual de Marca de la **Boleta de Pedido** y el **Afiche de Acopio**.
5. **Punto de Acopio — Tableta Offline-First (`/acopio`)**: pesaje real, inspección de calidad (`Estándar`, `Calidad Funcional`, `Rechazado`), generación automática de **Código de Lote + QR**, captura asistida sin celular y **cola local en IndexedDB** con simulador de corte de señal y sincronización idempotente.
6. **Hoja de Ruta del Transportador Aliado (`/transportador`)**: tarifa total pactada antes de salir, reglas visibles de compensación por espera (`>30 min`) y cancelación (`35 %`), mapa offline del corredor Boyacá–Cundinamarca–Bogotá, control de paradas y **Hoja de Ruta PDF**.
7. **Torre de Control Operativa y Analítica (`/operaciones`)**:
   - **KPIs del Piloto** vs metas oficiales (Activación, Pedidos/mes, Retención, OTIF, Merma, Margen/kg).
   - **5 Preguntas Analíticas** (Descriptiva, Diagnóstica, Predictiva oferta, Predictiva retención y Prescriptiva) + **Auditoría Antisesgo Digital**.
   - **Motor de Asignación Multi-Zona** (divide cada producto en ≥ 2 climas distintos considerando alertas IDEAM sin penalizar productores sin app).
   - **Planificador de Rutas Compartidas (VRP) + Semáforo de Margen por Kilo (Regla R2)** + comparador de 4 escenarios post-piloto (`0 %`, `3 %`, `Híbrido 2,5 % + Plan $350k`, `3 % + Flete`).
   - **Mesa de Incidencias, Sustitutos y Respaldo Corabastos** (con tope de sobrecosto y exención patrimonial ante evento climático certificado).
   - **Monitor en vivo SIPSA (DANE) / IDEAM** y **Tesorería**.

---

## Arranque local rápido

```bash
cd /home/Maxstep/Documentos/Rutafresca/app
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Credenciales demo (contraseña: `rutafresca2026`)
- **Compradora (Claudia)**: `claudia@andina.com.co`
- **Productor (Don Luis · Ventaquemada)**: `luis.rodriguez@ventaquemada.org`
- **Punto de Acopio (Offline)**: `acopio.ventaquemada@rutafresca.co`
- **Transportador (Carlos Méndez)**: `carlos.mendez@rutasaliadas.co`
- **Torre de Control**: `ops@rutafresca.co`

---

## Scripts útiles

- `npm run typecheck` — Validación estricta TypeScript (`tsc --noEmit`).
- `npm test` — Pruebas unitarias de los 6 motores de dominio y los 4 generadores PDF (`vitest`).
- `npm run build` — Compilación de producción Next.js.
- `npm run db:reset` — Reinicia y vuelve a sembrar las 4 semanas de datos del piloto.

## Integración a producción (PostgreSQL y WhatsApp Cloud API)

1. **PostgreSQL**: en `prisma/schema.prisma`, cambiar `provider = "sqlite"` por `provider = "postgresql"` y definir `DATABASE_URL` en `.env`.
2. **WhatsApp Business Cloud API (Meta)**: en `.env`, definir `WHATSAPP_ADAPTER_MODE="meta_cloud_api"`, `WHATSAPP_CLOUD_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.
