-- Darnel Cube · escenarios con nombre
-- Pégalo completo en: tu proyecto de Supabase → SQL Editor → New query → Run
-- Se puede correr aunque ya hayas corrido el anterior; no borra nada de lo que ya tenías.

-- Varios escenarios por usuario, cada uno con su nombre.
create table if not exists public.escenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);

-- Para que la lista de cada usuario salga rápido.
create index if not exists escenarios_por_usuario on public.escenarios (user_id, actualizado desc);

-- Un mismo usuario no puede tener dos escenarios con el mismo nombre
-- (así "Guardar" sobre un nombre que ya existe lo actualiza en vez de duplicarlo).
create unique index if not exists escenarios_nombre_unico on public.escenarios (user_id, lower(nombre));

-- Nadie ve nada si no pasa por estas reglas.
alter table public.escenarios enable row level security;

drop policy if exists "ver solo mis escenarios" on public.escenarios;
create policy "ver solo mis escenarios"
  on public.escenarios for select
  using (auth.uid() = user_id);

drop policy if exists "crear solo mis escenarios" on public.escenarios;
create policy "crear solo mis escenarios"
  on public.escenarios for insert
  with check (auth.uid() = user_id);

drop policy if exists "actualizar solo mis escenarios" on public.escenarios;
create policy "actualizar solo mis escenarios"
  on public.escenarios for update
  using (auth.uid() = user_id);

drop policy if exists "borrar solo mis escenarios" on public.escenarios;
create policy "borrar solo mis escenarios"
  on public.escenarios for delete
  using (auth.uid() = user_id);
