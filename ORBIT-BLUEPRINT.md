# ORBIT — Architecture and roadmap

## Purpose

ORBIT coordinates specialized personal workspaces. It is a headquarters for monitoring work and executing tasks, not a duplicate database for every subsystem.

## Current baseline: v0.3

| Domain | Source of truth | Integration | Writes from ORBIT |
|---|---|---|---|
| Tasks | Todoist | Todoist API v1; per-tab personal token | Create and complete tasks |
| Plants | GAIA public `plants.json` and owner-restricted Supabase task tables | Published catalog + authorized GAIA session | Mark GAIA tasks complete |
| Routines | ORBIT browser localStorage | Browser-local | Log, undo, edit |
| Projects and scratchpad | ORBIT browser localStorage | Browser-local | Edit |
| Health | Paused | None | None |
| Money | Paused | None | None |

### Ownership rules

Todoist is authoritative for recurring and scheduled tasks. GAIA remains authoritative for plants and actual care-event logging. Completing a plant task is *not* the same as recording a watering or treatment event. ORBIT local priorities are an optional scratchpad, not a second synchronized task service.

### Privacy controls

- All remote writes use service APIs authenticated to the user. No tokens or passwords are embedded in the repository, and owner-restricted GAIA tables have RLS enabled.
- Published GAIA plant records can be viewed by anyone; signed-in task data cannot.
- Shared GitHub Pages origin permits session reuse between `reece1919.github.io/helm` and `/gaia`, but also means scripts on either site are inside one browser trust boundary.
- Todoist personal token is tab-scoped; production-quality OAuth+backend should replace it if this project expands.
- Paused personal health/money data is not surfaced. Legacy local records are retained for reversibility but are not cloud synced.

## Proposed subsequent releases

1. **v0.4 usability:** Streamline daily overview around incomplete Todoist tasks, GAIA follow-ups and routines; add editable homepage layout and better context for overdue items.
2. **v0.5 identity and security:** Replace Todoist personal-token flow with secure OAuth and backend token storage; consider independent auth domain for ORBIT and explicit GAIA shared-access policies. Evaluate privacy and threat model before expanding.
3. **v0.6 cross-device settings:** Migrate local ORBIT routines, projects, and scratchpad to owner-restricted tables under suitable authenticated accounts (not anonymous public data).
4. **v0.7 project-specific interfaces:** Driftbound creative planning; streaming schedule and assets; selectively integrate compatible services rather than copying their full databases.
5. **Only on new request:** Revisit health and finance widgets with intentionally scoped permissions and secure handling.

## Non-goals for v0.3

No bank API, financial figures, Apple Health data, medication schedules, private photo repository, background alarms, or automatic tasks on behalf of the user without explicit interaction.


## v0.4 shared account
- ORBIT login uses GAIA Supabase Auth and the same browser origin/session.
- GAIA task reads continue through existing owner-only RLS, with a single client instance.
- ORBIT local state is per-account and browser-only; cross-device ORBIT sync is a separate future milestone.
- Todoist token is isolated to the signed-in account in tab session storage, with separate Todoist authorization.
## FUEL (v0.5)

FUEL is the conversational nutrition logging specialist. ORBIT links to the dedicated ChatGPT Project and shows a private Supabase-backed food journal, daily calories and macronutrients. The table `public.fuel_food_entries` is owner-restricted by RLS. Manual logging is available from ORBIT as a fallback. ChatGPT writing requires enabling the user's Supabase app inside the FUEL Project and adding account-specific instructions via the ORBIT `Copy FUEL setup` control. Apple Health sync is not yet implemented; an authorized iPhone Shortcut or HealthKit bridge will be needed.
