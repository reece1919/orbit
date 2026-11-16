# ORBIT 2.0 | Daily Review

## What this milestone delivers

The **Daily Review** screen is a nightly bullet-journal entry point. The default reminder is **8:30 PM**, editable in Review → Reminder settings.

- A single screen to record mood, energy, stress and daily alcohol standard drinks. Blank drink count means not logged; **0 is explicitly alcohol-free**.
- A short daily reflection using the existing PULSE journal, and existing PULSE mood data rather than duplicating it.
- Read-only recent Apple Health summary and links to Body, Tasks and Calendar.
- A customizable evening checklist with independent step completion.
- Explicit **Save check-in**, **Finish daily review**, **Skip tonight**, and **Snooze 30 min**. Skip is not treated as completion.
- A home-page launcher, sidebar item, mobile Review tab and notification deep link.

## Configure push notifications

1. In VITA → Mind, set up the browser's ORBIT Web Push subscription; test the device from there.
2. On iPhone, ORBIT must be installed as a Safari Home Screen web app and launched from its icon. Browser notification permission and device settings may suppress alerts.
3. Open Daily Review → Reminder settings. Check **Remind me to do my daily review** and save.
4. To avoid extra PULSE mood/journal alerts, uncheck **Also send the separate PULSE mood and journal reminders**, then save.
5. Test at the scheduled time. The existing PULSE server dispatcher runs every ten minutes, so an alert may arrive shortly after 8:30, not at the exact second.

The user must explicitly opt in on their account and device. **No new reminder is enabled by the migration itself.** A review is suppressed after Finished or Skipped, and one follow-up can be sent after Snoozed. Push lock-screen wording does not include any health or alcohol details.

## Private storage

- New orbit_daily_reviews and orbit_review_settings tables use owner-only RLS with authenticator assurance aal2.
- Existing pulse_moods, pulse_journals, and read-only wellness_daily remain authoritative.
- New columns in pulse_settings configure review reminder timing and optional suppression of separate PULSE reminders.
- Existing GAIA tables are unchanged. No existing review/health/journal entries are removed or migrated.

## Release order

1. GitHub CI and CodeQL green.
2. Apply the new migration in the shared Supabase project. The schema change is additive.
3. Deploy the revised orbit-pulse Edge Function with verify_jwt=false, preserving its existing cron authentication. Its private secrets remain server-side.
4. Merge the frontend, confirm the deployed branch, and smoke-test the authenticated app on desktop/mobile.
5. Enable and test device push by explicit user action.

## Known limitations / next work

- Today's date uses the device's local date. Add timezone-based rollover tests for travel and DST.
- Scheduled Web Push cannot guarantee delivery if device push/Focus settings block it.
- Full habit tracking, targeted medication reminders and historical trends are future milestones.
- Alcohol recording here is self-report only and cannot assess withdrawal safety or prescribe a taper.
- The journal quick-entry uses the existing PULSE daily journal. MUSE unification is a later migration.
