# ORBIT 2.0: Habit tracking (Milestone 2)

## Purpose

Make ORBIT a practical digital bullet journal, with habits recorded once and reflected automatically in the 8:30 PM Daily Review. GAIA stays outside this change.

## Features

- Private habit definitions: on selected weekdays, or N completions per week.
- Daily actions: Done, Skip, Undo. Missing days are unknown, not failures.
- Weekly progress based on completed records, Monday to Sunday.
- Optional named reminder times per habit; actual push payloads are **generic**, never containing habit titles, medication names, or health data.
- Completion-aware notifications: no reminder after Done or Skip that day; weekly reminders stop when target is already met.
- A dedicated Habits page, plus today’s habits in Daily Review.
- Soft Archive, retaining history and disabling that habit’s reminders.
- The old Routines page and local history stay intact; no automatic migration or deletion.

## Reminder setup

1. Enable and test ORBIT device notifications from VITA → Mind; account notifications must be enabled.
2. Create a habit, choose the days and (optional) weekly goal.
3. Pick a reminder time and explicitly enable that habit’s reminders.
4. Open Daily Review to record any remaining habits, or log them as they happen.

ORBIT's push dispatcher checks every ten minutes and notifications can arrive a little after the specified time. Operating systems, Focus modes and offline devices can block delivery. The PULSE notification service worker routes habit alerts to ?view=habits.

## Storage and security

- New public.orbit_habits and public.orbit_habit_logs tables are restricted to the owner and MFA assurance level AAL2.
- The owner_id plus habit_id foreign key keeps a user's log tied to their own habit.
- Habit reminder delivery reuses PULSE's existing server-only subscriptions and delivery ledger. No new notification tokens are exposed to the frontend.
- No GAIA plant tables, PULSE mood data, MUSE entries, or legacy Routines data are modified.

## Release steps

1. Make sure repository CI and CodeQL pass on the PR.
2. Apply additive Supabase migration before deploying the revised Edge Function.
3. Update orbit-pulse with verify_jwt=false, preserving cron authentication and server-only secrets.
4. Merge the frontend and validate GitHub Pages deployment.
5. Test on desktop and installed mobile PWA with a harmless test habit. Confirm Save/Skip/Undo persistence and opt-in notification delivery.

## Future milestone

- Custom habit groups, 30/90-day trend charts, smarter patterns, and ability to integrate preexisting external data where authorized.
- More nuanced per-habit snooze and quiet hours; not included in this release.
- Medication **recording** only, no recommendations on dosing or prescriptions.
