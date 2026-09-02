-- ============================================================
-- BrandTest — esquema completo de Supabase (consolidado)
-- Pegar en: Supabase > tu proyecto > SQL Editor > New query > Run
-- Si tu base de datos ya tiene algunas de estas partes corridas,
-- no pasa nada por volver a correr todo: los "if not exists" y
-- los nombres de política evitan duplicar lo que ya existe.
-- Si una política puntual ya existe, esa línea dará error "ya
-- existe" — es inofensivo, solo sáltate esa línea y sigue.
-- ============================================================


-- ============================================================
-- PARTE 1 — Usuarios y créditos (la base: login + créditos reales)
-- ============================================================

create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  whatsapp text unique,
  credits int not null default 10,
  plan text not null default 'libre',
  last_free_analysis timestamptz,
  total_analyses int not null default 0,
  registration_date timestamptz not null default now()
);

create table if not exists public.credit_history (
  id bigint generated always as identity primary key,
  whatsapp text not null,
  amount int not null,
  admin_note text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.credit_history enable row level security;

-- cada usuario solo puede ver y editar su propia fila
create policy "usuarios ven su propio registro"
  on public.users for select
  using (auth.uid() = id);

create policy "usuarios actualizan su propio registro"
  on public.users for update
  using (auth.uid() = id);

-- crea automáticamente la fila de usuario (con 10 créditos) al registrarse con Google
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, registration_date)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- PARTE 2 — Bandera de administrador (uso ilimitado)
-- Protegida a nivel de columna: aunque un usuario pueda editar su
-- propia fila (whatsapp, etc.), NO puede tocar is_admin desde el
-- navegador, ni siquiera intentándolo a propósito.
-- ============================================================

alter table public.users add column if not exists is_admin boolean not null default false;
revoke update (is_admin) on public.users from authenticated;

-- Márcate a ti mismo como admin — reemplaza el correo por el de tu
-- cuenta de Google con la que entraste a BrandTest, y corre esto UNA VEZ.
-- Quítale el -- del principio de la siguiente línea antes de correrla:
-- update public.users set is_admin = true where email = 'TU_CORREO_DE_GOOGLE@gmail.com';


-- ============================================================
-- PARTE 3 — Historial de diagnósticos guardados por el usuario.
-- No guarda la imagen (para no inflar la base) — solo el resumen.
-- ============================================================

create table if not exists public.diagnosis_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  brand_name text,
  typology text,
  overall_score int,
  plan text,
  created_at timestamptz not null default now()
);

alter table public.diagnosis_history enable row level security;

create policy "usuarios ven su propio historial"
  on public.diagnosis_history for select
  using (auth.uid() = user_id);

create policy "usuarios guardan en su propio historial"
  on public.diagnosis_history for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- PARTE 4 — Banco de calibración (solo admin)
-- El admin sube o fotografía marcas reales y decide él mismo la
-- tipología correcta — esto es la verdad de referencia (ground
-- truth) para afinar el motor con el tiempo. Protegido: solo
-- cuentas con is_admin=true pueden escribir o leer aquí.
-- ============================================================

create table if not exists public.calibration_samples (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users not null,
  image_path text not null,
  typology text not null,
  brand_name text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.calibration_samples enable row level security;

create policy "solo admins ven las muestras de calibracion"
  on public.calibration_samples for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

create policy "solo admins guardan muestras de calibracion"
  on public.calibration_samples for insert
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

-- Bucket de almacenamiento para las imágenes de calibración
insert into storage.buckets (id, name, public)
values ('calibration-images', 'calibration-images', false)
on conflict (id) do nothing;

create policy "admins suben imagenes de calibracion"
  on storage.objects for insert
  with check (
    bucket_id = 'calibration-images'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  );

create policy "admins leen imagenes de calibracion"
  on storage.objects for select
  using (
    bucket_id = 'calibration-images'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  );

-- ============================================================
-- PARTE 5 — Proteger los créditos a nivel de columna
-- Hoy cualquier usuario podía escribirse sus propios créditos desde
-- la consola del navegador (la política de "actualiza su propio
-- registro" lo permitía sin querer). A partir de ahora, ni el propio
-- dueño de la fila puede tocar estas columnas directamente — solo
-- las funciones de servidor (con la service role key) pueden.
-- ============================================================

revoke update (credits, plan, total_analyses, last_free_analysis) on public.users from authenticated;

-- ============================================================
-- PARTE 6 — Calibración ampliada: no solo tipología, también los
-- 6 indicadores y la cantidad de colores, en escala 1-10, más el
-- nivel de confianza del evaluador. Esto es lo que permite comparar
-- puntaje por puntaje (no solo "acertó/no acertó" la tipología).
-- ============================================================

alter table public.calibration_samples add column if not exists color_count_manual int;
alter table public.calibration_samples add column if not exists calidad_grafica_manual int;
alter table public.calibration_samples add column if not exists reproducibilidad_manual int;
alter table public.calibration_samples add column if not exists legibilidad_manual int;
alter table public.calibration_samples add column if not exists inteligibilidad_manual int;
alter table public.calibration_samples add column if not exists vocatividad_manual int;
alter table public.calibration_samples add column if not exists pregnancia_manual int;
alter table public.calibration_samples add column if not exists overall_manual int;
alter table public.calibration_samples add column if not exists confidence_manual int;

-- ============================================================
-- PARTE 7 — Permiso de admin para ver datos agregados (métricas)
-- Hoy cada usuario solo puede leer su propia fila (por diseño). Esto
-- agrega una política adicional: si eres admin, además puedes leer
-- TODAS las filas — necesario para el panel de Métricas. No toca
-- las políticas de escritura, que siguen intactas.
-- ============================================================

create policy "admins ven todos los usuarios"
  on public.users for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

create policy "admins ven todo el historial de diagnosticos"
  on public.diagnosis_history for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

-- ============================================================
-- PARTE 8 — Registro de créditos gastados (para Métricas). Hasta
-- ahora solo registrábamos créditos OTORGADOS (credit_history). Esto
-- guarda cada vez que se gastan créditos en un análisis, para poder
-- reportar el total real gastado, no solo el otorgado.
-- ============================================================

create table if not exists public.credit_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount int not null,
  plan text not null,
  created_at timestamptz not null default now()
);

alter table public.credit_usage_log enable row level security;

create policy "admins ven el uso de creditos"
  on public.credit_usage_log for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

-- ============================================================
-- PARTE 9 — Test de reconocimiento: cualquier usuario puede
-- responder qué tipología cree que es una muestra del banco de
-- calibración (sin ver la respuesta), y gana 1 crédito por acertar
-- O intentar (a definir en la función de servidor). La restricción
-- UNIQUE impide responder la misma muestra dos veces para
-- regalarse créditos infinitos.
-- ============================================================

create table if not exists public.recognition_responses (
  id bigint generated always as identity primary key,
  sample_id bigint references public.calibration_samples on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  answered_type text not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  unique (sample_id, user_id)
);

alter table public.recognition_responses enable row level security;

create policy "usuarios ven sus propias respuestas"
  on public.recognition_responses for select
  using (auth.uid() = user_id);

create policy "admins ven todas las respuestas de reconocimiento"
  on public.recognition_responses for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

-- ============================================================
-- PARTE 10 — Corrección de recursión infinita en políticas de admin
-- Las políticas que preguntaban "¿es admin?" consultando de nuevo la
-- tabla users (dentro de una política DE la tabla users) causaban
-- recursión infinita en Postgres, y eso rompía silenciosamente el
-- panel admin completo. Esta función evita el bucle: verifica
-- is_admin saltándose las políticas de seguridad para esa consulta
-- puntual (SECURITY DEFINER), sin abrir ningún hueco — solo la usan
-- las políticas mismas, nunca el navegador directamente.
-- ============================================================

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

drop policy if exists "admins ven todos los usuarios" on public.users;
drop policy if exists "solo admins ven las muestras de calibracion" on public.calibration_samples;
drop policy if exists "solo admins guardan muestras de calibracion" on public.calibration_samples;
drop policy if exists "admins suben imagenes de calibracion" on storage.objects;
drop policy if exists "admins leen imagenes de calibracion" on storage.objects;
drop policy if exists "admins ven todo el historial de diagnosticos" on public.diagnosis_history;
drop policy if exists "admins ven el uso de creditos" on public.credit_usage_log;
drop policy if exists "admins ven todas las respuestas de reconocimiento" on public.recognition_responses;

create policy "admins ven todos los usuarios"
  on public.users for select
  using (public.is_admin_user());

create policy "solo admins ven las muestras de calibracion"
  on public.calibration_samples for select
  using (public.is_admin_user());

create policy "solo admins guardan muestras de calibracion"
  on public.calibration_samples for insert
  with check (public.is_admin_user());

create policy "admins suben imagenes de calibracion"
  on storage.objects for insert
  with check (bucket_id = 'calibration-images' and public.is_admin_user());

create policy "admins leen imagenes de calibracion"
  on storage.objects for select
  using (bucket_id = 'calibration-images' and public.is_admin_user());

create policy "admins ven todo el historial de diagnosticos"
  on public.diagnosis_history for select
  using (public.is_admin_user());

create policy "admins ven el uso de creditos"
  on public.credit_usage_log for select
  using (public.is_admin_user());

create policy "admins ven todas las respuestas de reconocimiento"
  on public.recognition_responses for select
  using (public.is_admin_user());

-- ============================================================
-- PARTE 11 — Feedback de tipología y diagnóstico, migrado de
-- localStorage a Supabase. Antes vivía en db.typologyFeedback /
-- db.diagnosticFeedback (solo en el navegador de cada admin, se
-- perdía al cambiar de dispositivo o borrar datos del sitio). Ahora
-- es una tabla real: cualquier usuario autenticado puede insertar su
-- propio feedback, solo los admins pueden leerlo (panel "Valoración
-- de Marca"). `kind` distingue los dos tipos de evento que antes eran
-- dos arreglos separados.
-- ============================================================

create table if not exists public.brand_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('typology_correction', 'diagnostic_feedback')),
  -- typology_correction: predicted/corrected tienen el tipo detectado y el
  -- corregido. diagnostic_feedback: positive indica pulgar arriba/abajo.
  predicted_typology text,
  corrected_typology text,
  positive boolean,
  overall_score integer,
  plan text,
  created_at timestamptz not null default now()
);

alter table public.brand_feedback enable row level security;

create policy "usuarios registran su propio feedback"
  on public.brand_feedback for insert
  with check (auth.uid() = user_id);

create policy "admins ven todo el feedback"
  on public.brand_feedback for select
  using (public.is_admin_user());

-- ============================================================
-- PARTE 12 — Permitir borrar el propio historial de diagnósticos.
-- "Mi cuenta" ahora deja eliminar un diagnóstico guardado; antes no
-- había policy de delete, así que un intento de borrar fallaba
-- silenciosamente por RLS. Solo el dueño de la fila puede borrarla.
-- ============================================================

create policy "usuarios borran su propio historial"
  on public.diagnosis_history for delete
  using (auth.uid() = user_id);

-- ============================================================
-- PARTE 13 — Perfil de lectura del resultado (General / Diseñador /
-- Experto), implementado por el colaborador de diseño en el index.html
-- viejo. Nunca toca el motor de cálculo — solo cuánta profundidad de la
-- MISMA evaluación se muestra (grilla de indicadores, variables crudas).
-- Persiste acá para cuentas registradas; para invitados vive en
-- localStorage (brandex_profile), sin fila de DB que proteger.
-- ============================================================

alter table public.users add column if not exists profile text not null default 'general';
alter table public.users add constraint users_profile_check
  check (profile in ('general', 'disenador', 'experto'));

-- ============================================================
-- PARTE 14 — Catálogo de planes y paquetes de créditos (Paddle).
-- Config, no hardcodeada en el código: los price_id y montos viven acá
-- para poder ajustarlos sin tocar el frontend ni el backend.
-- ============================================================

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

-- ============================================================
-- PARTE 15 — Suscripciones. Separa "plan contratado" (esto) de la
-- tarifa por análisis que hoy vive en users.plan (libre/estandar/pro,
-- ver api/consume-credit.js) — ese campo NO se toca todavía.
-- ============================================================

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

-- ============================================================
-- PARTE 16 — Compras y protección contra doble cobro. paddle_transaction_id
-- es unique a propósito: si un webhook de Paddle se reintenta, el insert
-- falla en vez de acreditar créditos dos veces por el mismo pago.
-- ============================================================

create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  kind text not null check (kind in ('subscription', 'credit_package')),
  package_id text references public.credit_packages,
  amount_cents int not null,
  paddle_transaction_id text unique not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'paddle',
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)               -- idempotencia: webhook reintentado no se procesa dos veces
);

-- ============================================================
-- PARTE 17 — Blindaje de saldo negativo. Faltaba: sin esto un bug en
-- consume-credit.js podría dejar a alguien con créditos en negativo.
-- ============================================================

alter table public.users add constraint credits_non_negative check (credits >= 0);

-- ============================================================
-- PARTE 18 — Observabilidad de costo real de IA. Para dejar de estimar
-- el costo por análisis (~US$0.02-0.03 con claude-sonnet-5) y medirlo
-- de verdad, análisis por análisis.
-- ============================================================

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

-- Seed del catálogo (sección 4 del plan de suscripciones). paddle_price_id
-- queda en 'pending' hasta crear los productos reales en Paddle; los
-- planes/paquetes quedan inactivos hasta tener price_id real para que el
-- frontend no ofrezca comprar algo que aún no se puede cobrar.

insert into public.plans (id, name, monthly_price_cents, credits_included, paddle_price_id, active) values
  ('estudiante',  'Estudiante',  699,  30,  'pending', false),
  ('profesional', 'Profesional', 1999, 150, 'pending', false),
  ('empresa',     'Empresa',     7900, 600, 'pending', false)
on conflict (id) do nothing;

insert into public.credit_packages (id, name, price_cents, credits, paddle_price_id, active) values
  ('pequeno', 'Paquete Pequeño', 499,  20,  'pending', false),
  ('mediano', 'Paquete Mediano', 1299, 60,  'pending', false),
  ('grande',  'Paquete Grande',  3499, 200, 'pending', false)
on conflict (id) do nothing;

-- ============================================================
-- PARTE 19 — Acreditación atómica de créditos para el webhook de Paddle.
-- "credits = credits + delta" en una sola sentencia evita la carrera
-- fetch-then-update si dos webhooks llegan a la vez. Solo el servidor
-- (service role) puede llamarla — se revoca a anon/authenticated.
-- ============================================================

create or replace function public.add_credits(p_user_id uuid, p_delta int)
returns int
language sql
security definer
set search_path = public
as $$
  update public.users
     set credits = credits + p_delta
   where id = p_user_id
  returning credits;
$$;

revoke execute on function public.add_credits(uuid, int) from public;
revoke execute on function public.add_credits(uuid, int) from anon;
revoke execute on function public.add_credits(uuid, int) from authenticated;

-- ============================================================
-- PARTE 20 — Guardar el customer_id de Paddle en la suscripción para
-- poder abrir el Customer Portal hosteado (facturas, cambiar tarjeta,
-- cancelar) sin construir una pantalla de facturación propia.
-- ============================================================

alter table public.subscriptions add column if not exists paddle_customer_id text;

-- ============================================================
-- PARTE 21 — RLS en las tablas de pagos. Sin esto, cualquiera con la
-- anon key podría escribir el catálogo o leer compras ajenas. El catálogo
-- es lectura pública (los precios se muestran antes de comprar); todo lo
-- demás es del dueño o del admin. Escribir solo puede el service role
-- (webhook), que ignora RLS por diseño.
-- ============================================================

alter table public.plans enable row level security;
alter table public.credit_packages enable row level security;
alter table public.purchases enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "catalogo de planes visible para todos" on public.plans;
create policy "catalogo de planes visible para todos"
  on public.plans for select
  using (true);

drop policy if exists "catalogo de paquetes visible para todos" on public.credit_packages;
create policy "catalogo de paquetes visible para todos"
  on public.credit_packages for select
  using (true);

drop policy if exists "usuarios ven sus propias compras" on public.purchases;
create policy "usuarios ven sus propias compras"
  on public.purchases for select
  using (auth.uid() = user_id);

drop policy if exists "admins ven todas las compras" on public.purchases;
create policy "admins ven todas las compras"
  on public.purchases for select
  using (public.is_admin_user());

drop policy if exists "admins ven todas las suscripciones" on public.subscriptions;
create policy "admins ven todas las suscripciones"
  on public.subscriptions for select
  using (public.is_admin_user());

-- webhook_events: sin políticas — solo el service role la toca.

-- ============================================================
-- PARTE 22 — Rate limiting genérico para los endpoints del API. Cada
-- request registrada cuenta contra una ventana móvil (identificador =
-- user_id o IP + nombre del endpoint). Solo el service role escribe;
-- RLS habilitado sin políticas = invisible para el navegador.
-- ============================================================

create table if not exists public.rate_limit_log (
  id bigint generated always as identity primary key,
  identifier text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_log_lookup
  on public.rate_limit_log (identifier, endpoint, created_at desc);

alter table public.rate_limit_log enable row level security;

-- ============================================================
-- PARTE 23 — Cupones de créditos. Código canjeable una sola vez por
-- cuenta (constraint UNIQUE en coupon_redemptions), con tope global de
-- usos opcional definido por el admin al crear el cupón. La acreditación
-- es atómica vía redeem_coupon() — mismo patrón que add_credits().
-- ============================================================

create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  code text unique not null,
  credits int not null check (credits > 0),
  max_uses int check (max_uses is null or max_uses > 0),
  uses_count int not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id bigint generated always as identity primary key,
  coupon_id bigint references public.coupons on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  credits_granted int not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

create policy "admins administran cupones"
  on public.coupons for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "admins ven todos los canjes"
  on public.coupon_redemptions for select
  using (public.is_admin_user());

create policy "usuarios ven sus propios canjes"
  on public.coupon_redemptions for select
  using (auth.uid() = user_id);

-- Canjeo atómico: bloquea la fila del cupón (evita que dos canjes
-- simultáneos superen max_uses), valida estado y unicidad por cuenta,
-- inserta el canje, incrementa el contador y acredita en un solo paso.
create or replace function public.redeem_coupon(p_user_id uuid, p_code text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
  v_new_credits int;
begin
  select * into v_coupon from public.coupons
    where code = upper(trim(p_code)) for update;

  if not found then
    raise exception 'CUPON_NO_EXISTE';
  end if;
  if not v_coupon.active then
    raise exception 'CUPON_INACTIVO';
  end if;
  if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
    raise exception 'CUPON_AGOTADO';
  end if;
  if exists (
    select 1 from public.coupon_redemptions
    where coupon_id = v_coupon.id and user_id = p_user_id
  ) then
    raise exception 'CUPON_YA_USADO';
  end if;

  insert into public.coupon_redemptions (coupon_id, user_id, credits_granted)
  values (v_coupon.id, p_user_id, v_coupon.credits);

  update public.coupons set uses_count = uses_count + 1 where id = v_coupon.id;

  update public.users set credits = credits + v_coupon.credits
    where id = p_user_id
    returning credits into v_new_credits;

  return v_new_credits;
end;
$$;

revoke execute on function public.redeem_coupon(uuid, text) from public;
revoke execute on function public.redeem_coupon(uuid, text) from anon;
revoke execute on function public.redeem_coupon(uuid, text) from authenticated;

-- Cupón de prueba solicitado: 100 créditos, sin tope global de usos
-- (cada cuenta igual solo puede canjearlo una vez).
insert into public.coupons (code, credits, max_uses, active)
values ('PRUEBA100', 100, null, true)
on conflict (code) do nothing;
