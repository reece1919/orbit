-- Journal v1.1 — support multiple independent writing modes.
-- Existing entries remain intact and are classified as freewriting.
alter table public.orbit_journal_entries
  add column if not exists entry_kind text not null default 'freewrite',
  add column if not exists writing_prompt text not null default '';

alter table public.orbit_journal_entries
  add constraint orbit_journal_kind_valid
  check (entry_kind in ('reflection','story','dream','gratitude','freewrite'));

alter table public.orbit_journal_entries
  add constraint orbit_journal_prompt_length
  check (char_length(writing_prompt) <= 1500);

create index if not exists orbit_journal_owner_kind_day_idx
  on public.orbit_journal_entries(owner_id,entry_kind,entry_date desc);

comment on column public.orbit_journal_entries.entry_kind is
  'One of reflection, story, dream, gratitude, freewrite; historical entries default to freewrite.';
comment on column public.orbit_journal_entries.writing_prompt is
  'Optional preserved writing prompt selected by the user; empty for unprompted entries.';
