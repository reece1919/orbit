# ORBIT + GAIA — enforced MFA security baseline

**Status: AAL2 enforced.** The Supabase account has two distinct verified TOTP factors. ORBIT and GAIA were configured to request an authenticator code at login; successful challenge verification refreshes the application. The previously dismissible second-factor prompt now offers **Verify** or **Sign out**.

## Recovery

- Supabase Auth does **not** provide TOTP recovery codes. Keep two independently accessible authenticator factors enrolled, preferably on separate devices.
- Test a clean-browser login using each factor independently. The backend has been validated using simulated AAL1/AAL2 sessions, but only the account holder can complete a real-device MFA test.
- Do not unenroll your last available factor. If both factors become unavailable, recovery may require intervention by an authorized Supabase project administrator.
- A user with an existing AAL1 session will need to complete MFA to read or modify private data. This is intentional.

## Database enforcement

The migration in `supabase/migrations/20261013_enforce_orbit_gaia_mfa_aal2.sql` adds **RESTRICTIVE**, `authenticated` AAL2 rules to the following 11 public tables:
`fuel_food_entries`, `gaia_ai_reviews`, `gaia_custom_tasks`, `gaia_task_completions`, `orbit_chat_shortcuts`, `orbit_external_snapshots`, `plant_care_events`, `plant_photos`, `pulse_journals`, `pulse_moods`, `pulse_settings`.

The same AAL2 rule covers `storage.objects` for the private `gaia-plant-photos` bucket. The unrelated `rune_workspaces` table is expressly **not** covered.

Verification with simulated Supabase JWT claims after migration:
- **AAL1**: zero user-visible snapshot, mood, food, plant photo, and private bucket records.
- **AAL2**: existing user-owned snapshot, mood, food, plant photo, and private bucket records visible.
- Ownership RLS remains in place for both assurance levels; AAL2 never bypasses ownership rules.

## Edge Function enforcement

- `orbit-todoist`: verifies a user JWT and requires `aal2` for all authenticated POST actions. Preserves single-use PKCE public OAuth callback.
- `orbit-pulse`: verifies a user JWT and requires `aal2` for authenticated POST actions. Preserves the separate, secret-authenticated scheduler dispatch.
- Both Edge Functions use custom verified JWT checking and therefore preserve `verify_jwt=false` as it was before this migration.

## Frontend and automated checks

- GitHub Pages meta Content Security Policies for ORBIT and GAIA, plus strict-origin referrer policy; third-party Supabase SDK version pinned.
- Shared MFA UI in `security-mfa.js`, with account-based factor choice when more than one factor is enrolled.
- GitHub Actions: CodeQL, syntax validation, obvious secret checks, CSP check; Dependabot for GitHub Actions.
- GitHub Pages meta-CSP cannot implement server-only HTTP security headers.
- Security Advisor may still flag disabled leaked-password protection, which may require a paid tier; no paid features were enabled.

## Emergency rollback (administrator-controlled)

Only after confirming the account holder needs access restored, remove the 11 `require_verified_totp_aal2` policies from the named public tables and `gaia_photo_storage_require_aal2` from `storage.objects`. Revert the server-side AAL2 checks in both Edge Functions if necessary. Do **not** drop ownership policies or disable RLS itself. This is an emergency recovery procedure, not a normal login bypass.

## Follow-up acceptance tests

- Log in to ORBIT and GAIA in a fresh/private browser session; verify the six-digit challenge and then observe previously saved private records reappear.
- Sign out and repeat the challenge with the independent backup factor.
- Confirm Todoist and PULSE user API access after authentication.
- Check the latest GitHub Pages deployment and CodeQL Actions for a green result before treating the release as fully browser-verified.
