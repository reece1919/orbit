-- ORBIT Journal: independent private writing module, separate from PULSE.
-- Client access requires the signed-in owner AND a verified AAL2 (MFA) session.
create table if not exists public.orbit_journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  title text not null default '',
  body text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orbit_journal_title_length check (char_length(title) <= 180),
  constraint orbit_journal_body_length check (char_length(trim(body)) between 1 and 50000),
  constraint orbit_journal_tags_count check (cardinality(tags) <= 12)
);
create index if not exists orbit_journal_owner_day_idx
  on public.orbit_journal_entries (owner_id, entry_date desc, updated_at desc);

alter table public.orbit_journal_entries enable row level security;
revoke all on table public.orbit_journal_entries from PUBLIC, anon, authenticated;
grant select, insert, update, delete on table public.orbit_journal_entries to authenticated;

create policy "orbit_journal_select_own" on public.orbit_journal_entries
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "orbit_journal_insert_own" on public.orbit_journal_entries
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "orbit_journal_update_own" on public.orbit_journal_entries
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "orbit_journal_delete_own" on public.orbit_journal_entries
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
create policy "orbit_journal_require_mfa" on public.orbit_journal_entries
  as restrictive for all to authenticated
  using (((select auth.jwt())->>'aal') = 'aal2')
  with check (((select auth.jwt())->>'aal') = 'aal2');

-- Server timestamps make optimistic concurrency checks meaningful on every device.
create or replace function public.orbit_journal_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $body$
begin
  new.updated_at := now();
  return new;
end
$body$;
revoke all on function public.orbit_journal_touch_updated_at() from PUBLIC, anon, authenticated;
create trigger orbit_journal_touch_updated_at
  before update on public.orbit_journal_entries
  for each row execute function public.orbit_journal_touch_updated_at();

comment on table public.orbit_journal_entries is
  'Owner-only, MFA-gated freeform writing for the ORBIT Journal module, separate from PULSE and workspace snapshots.';
