# BrandTest — Plan de implementación: suscripciones, créditos y pasarela de pago

**Estado:** listo para empezar a codear.
**Depende de:** el análisis completo (arquitectura, precios de IA, modelo financiero de los 3 planes) ya se hizo aparte — este documento es el "cómo", no el "por qué". Si necesitás repasar el razonamiento de precios/márgenes, es el pliego de cargos publicado como artefacto en la conversación anterior.
**No implementar sin revisar:** los 3 precios de planes siguen siendo una propuesta, no algo cerrado. Ajustalos en la sección 4 antes de crear los productos en Paddle.

---

## 1. Pasarela de pago: Paddle

### Por qué no Stripe

Confirmado directo en `stripe.com/global`: Stripe solo da cuentas de cobro (dashboard, payouts) en **Brasil y México** dentro de Latinoamérica. Bolivia no está — no hay forma de crear una cuenta Stripe válida sin una entidad constituida en un país soportado (ej. una LLC en EE.UU. vía Stripe Atlas, con todo el costo/papeleo que eso implica). No es la opción para arrancar.

### Por qué Paddle

Paddle está confirmado en su lista oficial de países soportados **con Bolivia incluida** para vender. Además, Paddle es **Merchant of Record (MoR)**: legalmente el que le vende al usuario final es Paddle, no vos. Eso significa:

- Paddle cobra al usuario (tarjeta, y en algunos países más medios locales), calcula y paga el IVA/sales tax que corresponda en el país del comprador — vos no tenés que registrarte para IVA en cada país donde tengas un cliente.
- Paddle te paga a vos (el "seller") por transferencia bancaria o PayPal, en USD. Esa transferencia la recibe cualquiera de tus cuentas de **Meru** o **Takenos** sin fricción — son exactamente el tipo de cuenta que existe para esto.
- Maneja suscripciones recurrentes y productos de pago único (los paquetes de créditos) con la misma API — no hace falta armar dos integraciones distintas.

**Contrapartida:** la comisión de Paddle (~5% + fee fijo, confirmar la tarifa vigente en tu dashboard al crear la cuenta) es más alta que el ~2.9% + $0.30 de Stripe directo. Es el costo de no necesitar una entidad legal en otro país para empezar a cobrar. Dado el análisis de márgenes ya hecho (73-92% de margen bruto en los tres planes, dominado por costo de IA casi nulo), este delta de comisión no compromete la rentabilidad — se absorbe sin drama.

### Alternativa a evaluar en paralelo

**Lemon Squeezy** es otro Merchant of Record con el mismo modelo (factura él, te paga a vos), pagos vía PayPal en 200+ países. No pude confirmar a Bolivia específicamente en su lista pública durante la investigación — si querés, antes de comprometerte a Paddle, andá a `lemonsqueezy.com` → crear cuenta de vendedor y fijate si te deja completar el onboarding con Bolivia como país. Si te acepta, es una alternativa válida con fees similares. Si no, seguí con Paddle.

### Camino futuro (no ahora)

Cuando el negocio facture lo suficiente como para justificar el trámite, migrar a Stripe directo vía una entidad en EE.UU. (o país soportado) baja la comisión por transacción a la mitad aproximadamente. No es una prioridad para el lanzamiento — Paddle ya resuelve el problema real, que es "no puedo cobrar nada hoy".

---

## 2. Cómo se integra Paddle (Paddle Billing, API v2 — no la versión "Classic")

Conceptos que vas a usar:

| Concepto Paddle | Para qué |
|---|---|
| **Product** | Un contenedor lógico (ej. "BrandTest Profesional", "Paquete de créditos Mediano"). |
| **Price** | El precio de un Product. Puede ser `recurring` (suscripción mensual) o `one_time` (paquete de créditos). Un Product puede tener varios Price (ej. mensual/anual), pero para arrancar alcanza con uno por plan. |
| **Paddle.js (Checkout overlay)** | Widget de checkout que se abre en el frontend — no hace falta construir un formulario de tarjeta propio. |
| **Webhooks** | Paddle notifica eventos (`subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed`, `transaction.payment_failed`) a un endpoint tuyo. Esto es lo único que debe decidir el estado real de pago/crédito — nunca el frontend. |
| **Customer Portal** | Paddle tiene un portal propio hosteado donde el usuario puede ver facturas, cambiar tarjeta, cancelar. Usalo en vez de construir una pantalla de facturación propia. |

### Pasos de configuración (en el dashboard de Paddle, no en código)

- [ ] Crear cuenta en Paddle (sandbox primero: `sandbox-vendors.paddle.com`) con Bolivia como país.
- [ ] Crear 3 **Products** recurrentes: `brandtest-estudiante`, `brandtest-profesional`, `brandtest-empresa`, cada uno con un **Price** mensual en USD (usar los montos de la sección 4).
- [ ] Crear 3-4 **Products** de pago único para los paquetes de créditos: `creditos-pequeno`, `creditos-mediano`, `creditos-grande` (y `creditos-empresa` si lo cotizás aparte).
- [ ] Anotar los `price_id` de cada uno — van a vivir en la tabla `plans` / `credit_packages` de Supabase (sección 3), no hardcodeados en el frontend.
- [ ] Generar credenciales: API key (para llamadas server-to-server) y el **webhook secret** (para verificar la firma `Paddle-Signature`).
- [ ] Configurar la URL del webhook apuntando a `/api/webhooks/paddle` (todavía no existe — se crea en la sección 5).

---

## 3. Migraciones de base de datos (Supabase)

Seguir la misma convención que ya usa `api/supabase_schema.sql`: aditivo, con `if not exists`, agregado como una `PARTE` nueva numerada al final del archivo (hoy va hasta la PARTE 12).

- [ ] **PARTE 13 — Catálogo de planes y paquetes** (config, no hardcodeada en el código):

```sql
create table if not exists public.plans (
  id text primary key,                    -- 'estudiante' | 'profesional' | 'empresa'
  name text not null,
  monthly_price_cents int not null,
  credits_included int not null,
  paddle_price_id text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_packages (
  id text primary key,                    -- 'pequeno' | 'mediano' | 'grande' | 'empresa'
  name text not null,
  price_cents int not null,
  credits int not null,
  paddle_price_id text not null,
  active boolean not null default true
);
```

- [ ] **PARTE 14 — Suscripciones** (separa "plan contratado" de la tarifa por análisis que hoy vive en `users.plan`):

```sql
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  plan_id text references public.plans not null,
  status text not null,                   -- 'active' | 'past_due' | 'canceled' | 'paused'
  paddle_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "usuarios ven su propia suscripcion"
  on public.subscriptions for select
  using (auth.uid() = user_id);
```

- [ ] **PARTE 15 — Compras y protección contra doble cobro:**

```sql
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  kind text not null check (kind in ('subscription', 'credit_package')),
  package_id text references public.credit_packages,
  amount_cents int not null,
  paddle_transaction_id text unique not null,   -- evita procesar el mismo pago dos veces
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'paddle',
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)               -- idempotencia: un webhook reintentado no se procesa dos veces
);
```

- [ ] **PARTE 16 — Blindaje de saldo negativo** (falta hoy, es una sola línea):

```sql
alter table public.users add constraint credits_non_negative check (credits >= 0);
```

- [ ] **PARTE 17 — Observabilidad de costo real de IA** (para dejar de estimar el costo por análisis y medirlo):

```sql
create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  provider text not null default 'anthropic',
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_usd_estimate numeric(10,6),
  created_at timestamptz not null default now()
);

alter table public.ai_usage_events enable row level security;

create policy "admins ven el uso de ia"
  on public.ai_usage_events for select
  using (public.is_admin_user());
```

> Nota sobre `users.plan`: hoy ese campo se sobreescribe con la última tarifa usada (`libre`/`estandar`/`pro`) en cada análisis (ver `api/consume-credit.js`). Una vez que `subscriptions.plan_id` existe, `users.plan` debería dejar de significar eso — pero **no lo cambies todavía**: es un campo que el código en producción usa activamente. Se migra recién en el paso 5 de la sección 6, con cuidado.

---

## 4. Precios a cargar en Paddle (ajustar antes de crear los productos)

| Plan/paquete | Precio | Créditos | `plans.id` / `credit_packages.id` |
|---|---:|---:|---|
| Estudiante | US$6.99/mes | 30/mes | `estudiante` |
| Profesional | US$19.99/mes | 150/mes | `profesional` |
| Empresa | US$79/mes | 600/mes compartidos | `empresa` |
| Paquete Pequeño | US$4.99 | 20 | `pequeno` |
| Paquete Mediano | US$12.99 | 60 | `mediano` |
| Paquete Grande | US$34.99 | 200 | `grande` |

Estos números vienen del análisis financiero previo (costo real de IA por análisis ≈ US$0.016–0.03 con `claude-sonnet-5`). Si los cambiás, no toques código — solo la fila correspondiente en `plans`/`credit_packages` y el Price en el dashboard de Paddle.

---

## 5. Endpoints nuevos a crear (`api/`)

Mismo patrón que ya usan `api/consume-credit.js` y `api/analyze-brand.js`: función serverless de Vercel, ESM, valida todo server-side, nunca confía en el navegador.

- [ ] **`api/checkout.js`** — recibe `{ planId | packageId }` del frontend con la sesión del usuario, arma los `customData` (user_id) que Paddle va a devolver en el webhook, y responde con lo necesario para abrir el checkout overlay de Paddle.js en el cliente.
- [ ] **`api/webhooks/paddle.js`** — el más importante de todos:
  1. Verifica la firma `Paddle-Signature` con el webhook secret (nunca proceses un webhook sin verificar la firma).
  2. Chequea `webhook_events` — si el `event_id` ya existe, responde 200 y no hace nada más (idempotencia).
  3. Según `event_type`:
     - `subscription.created` / `subscription.updated` → upsert en `subscriptions`, y si `status='active'`, acredita `credits_included` del plan a `users.credits` (solo si es la renovación de un período nuevo, no en cada webhook duplicado).
     - `subscription.canceled` → marca `status='canceled'`, no revoca créditos ya otorgados del período en curso.
     - `transaction.completed` de un paquete de créditos → inserta en `purchases`, acredita `credits` del paquete.
     - `transaction.payment_failed` → marca el intento, no toca créditos.
  4. Inserta el `event_id` en `webhook_events` recién al terminar de procesar con éxito.
- [ ] **`api/subscription-status.js`** — `GET` simple: devuelve el plan activo, fecha de renovación, y saldo desglosado (incluidos del mes + comprados) para el dashboard.

**No tocar todavía:** `api/consume-credit.js` y `api/credit-user.js` siguen funcionando como hoy hasta el paso de migración de `users.plan` (sección 6). `api/credit-user.js` (el flujo manual de WhatsApp) se deja como está — pasa a ser el respaldo de soporte, no se borra.

---

## 6. Orden de implementación recomendado

- [x] **1. Migraciones de base de datos** — HECHO (2026-09-01). Aplicadas al proyecto real como PARTE **14 a 21** (el schema ya iba por la 13 cuando se escribió este plan): catálogo, suscripciones, compras, idempotencia, constraint de créditos, ai_usage_events, add_credits() atómica y RLS de todas las tablas nuevas. Catálogo cargado con los precios de la sección 4, con `paddle_price_id='pending'` y `active=false` hasta tener los price_id reales.
- [ ] **2. Cuenta de Paddle en sandbox** + productos/precios cargados (sección 1-2). **ÚNICO BLOQUEANTE MANUAL:** crear la cuenta en `sandbox-vendors.paddle.com`, cargar los 6 productos, y actualizar `plans`/`credit_packages` con los `price_id` reales + `active=true`.
- [x] **3. `api/webhooks/paddle.js`** — HECHO (2026-09-01): firma HMAC verificada, idempotencia doble (webhook_events + purchases), créditos acreditados en `transaction.completed` vía `add_credits()`. Falta probarlo contra el simulador de Paddle cuando exista la cuenta sandbox (paso 2).
- [x] **4. `api/checkout.js` + UI en el frontend** — HECHO (2026-09-01): `api/checkout.js`, `src/hooks/useBilling.js` (carga Paddle.js, overlay, polling post-pago) y `src/components/dashboard/BillingSection.jsx`. La sección se oculta sola mientras el catálogo esté inactivo.
- [ ] **5. Migrar el significado de `users.plan`**: una vez que `subscriptions` está poblándose de verdad, actualizar `api/consume-credit.js` para que el costo por análisis salga del saldo de créditos (plan + comprados) en vez de la tarifa `libre/estandar/pro` por análisis. Este es el único paso que toca un archivo en producción — hacerlo con ventana de mantenimiento corta y `test_engine.js` corrido antes y después.
- [x] **6. UI de saldo/plan en el dashboard** — HECHO (2026-09-01): plan activo con estado y fecha de renovación, compra de paquetes, y link al Customer Portal de Paddle (`api/customer-portal.js` + botón "Gestionar suscripción").
- [x] **7. Pestaña "Facturación" en el admin** — HECHO (2026-09-01): `src/components/admin/BillingTab.jsx` con MRR, suscripciones, ingresos y gasto real de IA (que ahora se registra en cada análisis desde `api/analyze-brand.js`).
- [ ] **8. Pasar Paddle de sandbox a producción**: nuevas API keys/webhook secret de producción en Vercel, nuevos `price_id` reales en `plans`/`credit_packages`, probar un cobro real de bajo monto antes de anunciar el lanzamiento.

---

## 7. Variables de entorno nuevas (`.env.example`)

```text
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_ENV=sandbox
```

(`PADDLE_ENV` en `sandbox` durante todo el desarrollo; cambiar a `production` recién en el paso 8 de la sección 6, junto con las keys reales.)

---

## 8. Primera tarea concreta para arrancar

Antes de escribir una sola línea de `api/webhooks/paddle.js`: crear la cuenta sandbox de Paddle y cargar los 6 productos de la sección 4. Sin eso no hay `price_id` que poner en las migraciones, y todo lo demás queda bloqueado.
