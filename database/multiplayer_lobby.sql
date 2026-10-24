-- My Kingdom: primo incremento multiplayer (identità e directory).
-- Da applicare SOLTANTO al futuro progetto Supabase dedicato a My Kingdom.
-- Non eseguire sul progetto DEMOS. Nessuna risorsa dei salvataggi locali è accreditata online.
begin;

create table if not exists public.mk_kingdoms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (
    char_length(name) between 3 and 40 and
    name = btrim(name) and
    name !~ '[[:cntrl:]]'
  ),
  created_at timestamptz not null default now()
);

create index if not exists mk_kingdoms_recent_idx
  on public.mk_kingdoms (created_at desc);

alter table public.mk_kingdoms enable row level security;

-- Revoca ogni privilegio implicito, incluso quello di modificare owner_id.
revoke all on table public.mk_kingdoms from public, anon, authenticated;
grant select, insert on table public.mk_kingdoms to authenticated;

drop policy if exists mk_kingdoms_directory_read on public.mk_kingdoms;
create policy mk_kingdoms_directory_read
  on public.mk_kingdoms
  for select
  to authenticated
  using (true);

drop policy if exists mk_kingdoms_create_own on public.mk_kingdoms;
create policy mk_kingdoms_create_own
  on public.mk_kingdoms
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

-- Volutamente NESSUNA policy di UPDATE/DELETE e nessuna API di risorse:
-- impossibile importare unilateralmente saldi o inventari da un save locale.
-- Per P2P economico serve un ledger server-authoritative con inventari,
-- accantonamento atomico e funzioni transazionali, in una fase successiva.

commit;
