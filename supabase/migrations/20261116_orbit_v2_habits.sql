-- ORBIT v2 private, owner-bound habit definitions and daily logs.
-- Additive: do not migrate or remove legacy browser-local routines.
create table if not exists public.orbit_habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  cadence text not null default 'daily' check (cadence in ('daily','weekly')),
  days_of_week smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  weekly_target smallint not null default 1 check (weekly_target between 1 and 7),
  reminder_time text check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reminder_enabled boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,owner_id),
  constraint orbit_habits_days_check check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);
create index if not exists orbit_habits_owner_index on public.orbit_habits(owner_id,archived_at,created_at);
create table if not exists public.orbit_habit_logs (
  habit_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  status text not null check(status in ('done','skipped')),
  updated_at timestamptz not null default now(),
  primary key(habit_id,log_date),
  foreign key(habit_id,owner_id) references public.orbit_habits(id,owner_id) on delete cascade
);
create index if not exists orbit_habit_logs_owner_date on public.orbit_habit_logs(owner_id,log_date desc);
comment on table public.orbit_habits is 'Private customizable habits and opt-in generic reminders. Never includes prescription instructions.';
comment on table public.orbit_habit_logs is 'Private daily habit completion or deliberate skips; missing does not mean skipped.';
alter table public.orbit_habits enable row level security;
alter table public.orbit_habit_logs enable row level security;
revoke all on public.orbit_habits,public.orbit_habit_logs from public,anon,authenticated;
grant select,insert,update,delete on public.orbit_habits,public.orbit_habit_logs to authenticated;
create policy orbit_habits_mfa_owner on public.orbit_habits for all to authenticated
 using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
 with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_habit_logs_mfa_owner on public.orbit_habit_logs for all to authenticated
 using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
 with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
-- Delivery ledger prevents duplicate notifications per device, date, and habit.
-- Habit kinds are stable ("habit_" plus UUID); old PULSE review kinds still allowed.
alter table public.pulse_push_deliveries drop constraint if exists pulse_push_deliveries_kind_check;
alter table public.pulse_push_deliveries add constraint pulse_push_deliveries_kind_check
 check (kind in ('morning','afternoon','evening','journal','review','review_snooze')
   or kind ~ '^habit_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
