-- ORBIT 2.0, evening review (additive and owner-private).
-- Does not alter GAIA data or existing PULSE entries.
create table if not exists public.orbit_daily_reviews (
  owner_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null,
  alcohol_standard_drinks numeric(5,2) check (alcohol_standard_drinks is null or (alcohol_standard_drinks between 0 and 40)),
  tomorrow_reviewed boolean not null default false,
  completed_steps text[] not null default '{}',
  finished_at timestamptz,
  skipped_at timestamptz,
  snoozed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(owner_id,review_date)
);
comment on table public.orbit_daily_reviews is 'Owner-private daily review state. NULL alcohol means unrecorded; 0 means explicitly no drinks. No clinical withdrawal advice.';
create table if not exists public.orbit_review_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  evening_steps jsonb not null default
    '[{"id":"prepare-tomorrow","title":"Prepare for tomorrow"},{"id":"wind-down","title":"Wind down for bed"}]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint orbit_review_evening_steps_array check (jsonb_typeof(evening_steps)='array' and jsonb_array_length(evening_steps)<=20)
);
alter table public.orbit_daily_reviews enable row level security;
alter table public.orbit_review_settings enable row level security;
revoke all on public.orbit_daily_reviews,public.orbit_review_settings from public,anon,authenticated;
grant select,insert,update,delete on public.orbit_daily_reviews,public.orbit_review_settings to authenticated;
create policy orbit_daily_reviews_owner_mfa on public.orbit_daily_reviews for all to authenticated
  using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
  with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy orbit_review_settings_owner_mfa on public.orbit_review_settings for all to authenticated
  using (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
  with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
-- Piggyback on the existing PULSE device registration, scheduler, and time zone.
-- Disabled by default; opt-in from Daily Review is required.
alter table public.pulse_settings
  add column if not exists review_time text not null default '20:30',
  add column if not exists review_reminders_enabled boolean not null default false;
alter table public.pulse_settings
  add constraint pulse_settings_review_time_check
  check (review_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
-- New kinds share the existing per-device/per-day idempotency ledger.
alter table public.pulse_push_deliveries drop constraint if exists pulse_push_deliveries_kind_check;
alter table public.pulse_push_deliveries
  add constraint pulse_push_deliveries_kind_check
  check (kind in ('morning','afternoon','evening','journal','review','review_snooze'));
