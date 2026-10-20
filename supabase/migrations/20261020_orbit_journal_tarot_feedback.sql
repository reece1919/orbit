-- Extend the existing owner-only, MFA-protected ORBIT Journal; no existing writing is erased.
-- The existing table's RLS policies and ownership rules stay in force.
alter table public.orbit_journal_entries
  drop constraint orbit_journal_kind_valid;

alter table public.orbit_journal_entries
  add constraint orbit_journal_kind_valid
  check (entry_kind in ('reflection','story','dream','gratitude','freewrite','tarot'));

alter table public.orbit_journal_entries
  add column feedback_notes text not null default '',
  add column tarot_data jsonb not null default '{}'::jsonb;

alter table public.orbit_journal_entries
  add constraint orbit_journal_feedback_length
  check (char_length(feedback_notes) <= 15000);

alter table public.orbit_journal_entries
  add constraint orbit_journal_tarot_data_valid
  check (jsonb_typeof(tarot_data) = 'object' and octet_length(tarot_data::text) <= 30000);

comment on column public.orbit_journal_entries.feedback_notes is
  'Private, optional feedback notes supplied manually by the user. No automatic AI critique.';
comment on column public.orbit_journal_entries.tarot_data is
  'Manual tarot spread and cards saved as structured reflection, not automated divination.';