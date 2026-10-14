# ORBIT Wellness snapshot (pilot)

ORBIT reads a **daily, source-attributed wellness summary**, not an exported medical history.
The browser is read-only and must authenticate with the ORBIT Supabase account and TOTP MFA (AAL2).
The first approved import was created on 2026-10-14; an independent daily ChatGPT automation will attempt further imports.

## Data path

Apple Health, through the user's connected ChatGPT Health app, is the measurement source.
A scheduled ChatGPT task may retrieve selected metrics and insert them via the authorized Supabase connector.
The published ORBIT client uses its existing, public **publishable** Supabase key and reads `public.wellness_daily`.
It has no insert, update or delete grants. The table has RLS enabled and only permits selecting the owner's rows at AAL2.

## Scope and omissions

Metrics: daily step count, resting heart rate, scale weight, body-fat percentage, and sleeping minutes **only when currently measured**.
Use the actual America/Los_Angeles measurement date. Exclude today's incomplete day. Missing metrics remain null.
Do not put individual heart-rate samples, medications, diagnoses, medical documents, health profile, full HealthKit export, raw device identifiers or personally identifying information in GitHub, Gmail, Todoist, analytics or log messages.

Never invent, carry forward, or extrapolate observations. A stale sleep reading is not current sleep data.
For step counts that may be duplicated across phone and watch, use Apple Health's merged aggregate rather than summing raw samples.
Never represent a successful schedule configuration as proof that a future scheduled Health connector read will succeed.
The daily automation only updates records when real, verified Health measurements are available.

## Storage governance

- **Owner verification:** A scheduled admin write must verify exactly one owner by the existing signed-in ORBIT account identity, rather than embedding an auth UUID in public code.
- **Data access:** Table RLS and browser privileges are listed in `supabase/wellness_daily.sql`. Never expose `service_role` or Health API credentials to the client.
- **Disabling synchronization:** Disable the `ORBIT Daily Wellness Sync` automation. The stored database records persist until explicitly deleted.
- **Deleting snapshots:** With explicit user approval, perform a scoped admin deletion for the uniquely verified owner, then verify affected rows. Do not remove unrelated FUEL or PULSE records.
- **Compliance:** This is not a medical EHR, clinical decision tool, or HIPAA compliance claim.
- **Monitoring:** Supabase currently warns that leaked-password protection is disabled; address this independently in Auth settings. Review third-party privacy policies before expanding beyond this limited pilot.

## Smoke test

1. Sign into ORBIT and complete TOTP.
2. Navigate to Wellness from the top system launcher.
3. Confirm the latest values have correct measurement dates; sleep with no recent data is shown as missing.
4. Use Reload data to re-read stored snapshots (it does **not** fetch Apple Health).
5. On a signed-out or non-MFA session, confirm no data appears.
6. Verify the database has no `anon` SELECT grants and no `authenticated` INSERT / UPDATE / DELETE grants.
