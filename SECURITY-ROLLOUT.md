# ORBIT / GAIA free security rollout

Status: **Enrollment and TOTP challenge UI deployed; mandatory enforcement NOT activated.** No verified second factors or live sign-in tests were performed by the coding assistant.

## Recovery decision — required before enforcement
Supabase Auth **does not provide TOTP recovery codes**. Enroll an authenticator on your primary device, verify it, then enroll a second independent authenticator (ideally a separate phone/tablet or password-manager vault with separate recovery). Sign out on a spare browser and confirm sign-in with each authenticator. Protect your Supabase admin account separately. A lost-factor account may require authorized manual recovery in the Supabase Dashboard; do not assume email/password alone can bypass an enforced MFA policy.

**Do not enable RLS AAL2 constraints or Edge Function AAL2 rejection until the user confirms both backup factors and recovery planning, and provides explicit permission.** Do not silently switch mandatory MFA on via a repo deploy. Enrollment normally ends other sessions; re-authenticate on other devices.

## Stage A — Current
- ORBIT Settings → Your account → Manage authenticators.
- GAIA → Care journal/account → Manage authenticators.
- Supabase TOTP `enroll`, `challengeAndVerify`, `listFactors`, `getAuthenticatorAssuranceLevel`. Secret/QR displayed only while enrolling. No secret is saved to source or local project storage.
- Existing sign-in remains enabled. If a verified factor exists, the UI prompts for its six-digit code, but the button can still close during this recovery-first rollout. **UI prompts are not security enforcement.**
- Browser meta CSP deployed, external Supabase JS package pinned, both projects have CodeQL/security workflows and Dependabot config.
- Server-side private data RLS already restricts by account ID. Server-only OAuth and push secret tables cannot be read by anon/authenticated.

## Stage B — After recovery approval
1. Enroll at least two independently recoverable authenticators and test each on a fresh login.
2. Introduce **opted-in** AAL2 RLS restrictive policies for sensitive application tables: ORBIT PULSE, FUEL, saved snapshots, ChatGPT shortcut; GAIA private care records, notes, photos, and custom tasks. Test with aal1 and aal2 sessions. Ensure storage policies also check the JWT assurance level.
3. Make both Edge Functions require AAL2 for user actions when factor enrollment is complete, with step-up guidance instead of generic failures. Scheduled PULSE backend dispatch stays service-only.
4. Disable MFA bypass in frontend only after backend policies and recovery verification are confirmed.
5. Re-test Todoist, PULSE, FUEL, and GAIA on desktop and iPhone. Define an administrator-assisted recovery procedure and backup of nonsecret user content.

## Additional checks
- Never commit service-role keys, private VAPID signing keys, cron authorization tokens, or TOTP secrets.
- Frontend publishable Supabase API keys are not secrets. RLS/role grants enforce privacy.
- GitHub Pages **cannot set all security headers via an HTML meta tag** (e.g. HSTS and frame-ancestors). CSP in meta form is still useful, with that limitation.
- Basic API probes (Oct 13, 2026): Todoist and PULSE correctly rejected unauthenticated POST with 401, untrusted Origin with 403. More negative tests are needed with separate authorized accounts, expired tokens, invalid inputs and failure/retry simulation.
- GitHub CodeQL and security actions run for the two **public** repositories without a paid subscription; check Actions output for pass/fail.
- Supabase Security Advisor reports leaked-password checks disabled (may require paid tier) and intentional RLS-without-policy on backend-only tables. No paid features were enabled.
