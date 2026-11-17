-- ORBIT 2.0: broaden habits into everyday activities without changing legacy records.
-- Existing habits remain check-off goals. Existing Done logs retain amount 1.
alter table public.orbit_habits
  add column if not exists category text not null default 'other',
  add column if not exists entry_type text not null default 'checkoff',
  add column if not exists goal_enabled boolean not null default true,
  add column if not exists daily_target numeric(8,2) not null default 1,
  add column if not exists unit_label text not null default 'times';
alter table public.orbit_habits
  add constraint orbit_habits_category_check check
    (category in ('hygiene','health','movement','home','creative','leisure','social','learning','other')),
  add constraint orbit_habits_entry_type_check check
    (entry_type in ('checkoff','count','duration')),
  add constraint orbit_habits_target_check check
    (daily_target > 0 and daily_target <= 100000),
  add constraint orbit_habits_unit_check check
    (char_length(unit_label) between 1 and 24);

alter table public.orbit_habit_logs
  add column if not exists amount numeric(8,2) not null default 1,
  add column if not exists note text not null default '';
alter table public.orbit_habit_logs
  add constraint orbit_habit_logs_amount_check check
    (amount >= 0 and amount <= 100000),
  add constraint orbit_habit_logs_note_check check
    (char_length(note) <= 500);

comment on column public.orbit_habits.entry_type is 'checkoff, count, or duration in minutes';
comment on column public.orbit_habits.goal_enabled is 'False for observational activities such as watching TV or gaming';
comment on column public.orbit_habit_logs.amount is 'Daily total, not number of separate sessions';
comment on column public.orbit_habit_logs.note is 'Optional user-authored context such as a game or show title';
-- Existing owner-only AAL2 RLS policies and grants remain unchanged.
