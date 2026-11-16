-- VITA Alcohol & Habits: separate owner-private data with MFA. No public or anon access.
create table if not exists public.orbit_alcohol_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  standard_drinks numeric(5,2) not null check (standard_drinks > 0 and standard_drinks <= 20),
  context text not null default 'other' check (context in ('cooking','weekend_brunch','meal','social','stress','habit','other')),
  beverage text not null default '' check (char_length(beverage) <= 120),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists orbit_alcohol_entries_owner_date_idx on public.orbit_alcohol_entries(owner_id, occurred_at desc);
create table if not exists public.orbit_alcohol_checkins (
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  no_alcohol boolean not null default false,
  anxiety integer check (anxiety is null or anxiety between 0 and 10),
  urge integer check (urge is null or urge between 0 and 10),
  notes text not null default '' check (char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  primary key(owner_id,checkin_date)
);
create table if not exists public.orbit_alcohol_goals (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  weekday_ceiling numeric(5,2) check (weekday_ceiling is null or (weekday_ceiling >= 0 and weekday_ceiling <= 20)),
  weekend_ceiling numeric(5,2) check (weekend_ceiling is null or (weekend_ceiling >= 0 and weekend_ceiling <= 20)),
  updated_at timestamptz not null default now()
);
comment on table public.orbit_alcohol_entries is 'Private VITA self-reported alcohol log. No medically generated taper dosing.';
comment on table public.orbit_alcohol_checkins is 'Private VITA symptom/zero-drink day check-ins. Unknown days must not be treated as zero.';
comment on table public.orbit_alcohol_goals is 'Optional user-configured upper-limit goals only, never alcohol minimums or detox instructions.';
alter table public.orbit_alcohol_entries enable row level security;
alter table public.orbit_alcohol_checkins enable row level security;
alter table public.orbit_alcohol_goals enable row level security;
revoke all on public.orbit_alcohol_entries,public.orbit_alcohol_checkins,public.orbit_alcohol_goals from public, anon, authenticated;
grant select,insert,delete on public.orbit_alcohol_entries to authenticated;
grant select,insert,update,delete on public.orbit_alcohol_checkins to authenticated;
grant select,insert,update,delete on public.orbit_alcohol_goals to authenticated;
create policy orbit_alcohol_entries_select on public.orbit_alcohol_entries for select to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_entries_insert on public.orbit_alcohol_entries for insert to authenticated
with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_entries_delete on public.orbit_alcohol_entries for delete to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_checkins_select on public.orbit_alcohol_checkins for select to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_checkins_insert on public.orbit_alcohol_checkins for insert to authenticated
with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_checkins_update on public.orbit_alcohol_checkins for update to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_checkins_delete on public.orbit_alcohol_checkins for delete to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_goals_select on public.orbit_alcohol_goals for select to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_goals_insert on public.orbit_alcohol_goals for insert to authenticated
with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_goals_update on public.orbit_alcohol_goals for update to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_alcohol_goals_delete on public.orbit_alcohol_goals for delete to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
