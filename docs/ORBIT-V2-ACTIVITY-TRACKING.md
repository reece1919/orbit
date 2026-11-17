# ORBIT 2.1 | Habits & Activities

## Why this change

ORBIT is a digital bullet journal, so it should help remember enjoyable experiences as well as chores. Gaming, television, reading, creativity, hygiene and other everyday experiences are equally valid records.

## Three recording styles

- **Check-off**: one check per day (e.g. go outside, make bed).
- **Count**: how many times (e.g. brush teeth twice, drink glasses of water).
- **Duration**: minutes per day (e.g. gaming 90 min, watch TV 45 min, read 30 min).

All records can remain optional. Setting **Treat as a goal** is what makes an activity count toward scheduled daily or weekly targets. Leisure templates have goals and push reminders **off by default**.

New activities can be created from scratch or started from editable templates. Presets do not save anything until the user selects Save. Templates: brush teeth, gaming, watch TV, reading, make art, exercise, drink water, go outside, time with friends, and cook.

Count and duration records can include a 500-character note, suitable for a game title, show name, or creative project. Today's total can be updated and is also visible in the **Recent recordings** list.

## Privacy / data preservation

- Extend existing owner-only, MFA-gated orbit_habits and orbit_habit_logs tables with additive columns. Existing habits remain check-off goals; old completed records have amount 1.
- No old habit logs are deleted. No GAIA schema or plant data changes.
- The server uses amount to decide whether a weekly goal has genuinely been reached. No-goal observations never count toward a completion quota.
- Push notifications continue to use neutral lock-screen wording and are sent only when user explicitly enables account, device, and individual habit reminders. Even if an amount is below a daily target, the act of recording suppresses another reminder that day.

## Rollout verification

1. Run all Node tests, JS syntax checks and CodeQL.
2. Apply the additive 20261117_orbit_activity_tracking.sql migration before deploying the revised orbit-pulse Edge Function.
3. Validate owner/MFA RLS permissions, default values, and security advisors.
4. Deploy orbit-pulse preserving the existing cron authentication and verify_jwt=false.
5. Merge app and confirm GitHub Pages publication.
6. Test creating the TV and Gaming duration templates, the Brush teeth count template, and user-defined activities in an authenticated browser. Test note persistence and complete vs. partial goal behavior.
7. Confirm older Routines and GAIA remain unaffected.

## Current limitations

The record is **one daily total per activity**, not individual timed sessions. Minutes are entered manually; ORBIT doesn't infer gaming or TV time from Steam or streaming apps. Historic entries are read-only in this release. There is no auto-created deficit or streak for casual leisure activities.
