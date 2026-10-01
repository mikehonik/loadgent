-- DarnelCube 3D · maestro permanente por usuario
-- Pégalo en: Supabase → SQL Editor → New query → Run
-- Se puede correr aunque ya hayas corrido los anteriores; no borra nada.

-- Un solo maestro por usuario: su catálogo de productos, tarimas y conversiones.
-- Vive aparte de los escenarios, así está disponible siempre, sin importar cuál abras.
create table if not exists public.maestro (
  user_id uuid primary key references auth.users(id) on delete cascade,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);

alter table public.maestro enable row level security;

drop policy if exists "ver solo mi maestro" on public.maestro;
create policy "ver solo mi maestro"
  on public.maestro for select
  using (auth.uid() = user_id);

drop policy if exists "crear solo mi maestro" on public.maestro;
create policy "crear solo mi maestro"
  on public.maestro for insert
  with check (auth.uid() = user_id);

drop policy if exists "actualizar solo mi maestro" on public.maestro;
create policy "actualizar solo mi maestro"
  on public.maestro for update
  using (auth.uid() = user_id);
