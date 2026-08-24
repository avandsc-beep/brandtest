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
