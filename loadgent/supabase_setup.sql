-- Estiba 3D · configuración de la base de datos en Supabase
-- Pégalo completo en: tu proyecto → SQL Editor → New query → Run

-- Un renglón por usuario, con todo su proyecto guardado como un solo JSON.
create table if not exists public.proyectos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);

-- Nadie puede leer ni escribir nada si no está de por medio esta regla.
alter table public.proyectos enable row level security;

-- Cada usuario solo puede ver y guardar su propio renglón (el suyo, nunca el de otro).
create policy "cada usuario ve solo su proyecto"
  on public.proyectos for select
  using (auth.uid() = user_id);

create policy "cada usuario guarda solo su proyecto"
  on public.proyectos for insert
  with check (auth.uid() = user_id);

create policy "cada usuario actualiza solo su proyecto"
  on public.proyectos for update
  using (auth.uid() = user_id);
