# ORBIT — Headquarters for Execution, Logic, and Memory

**v0.7 — Secure cross-device Todoist OAuth connection, responsive PC/tablet/iPhone dashboard, shared ORBIT/GAIA sign-in, and GAIA/FUEL integrations.** Other health metrics and money tracking remain paused. Previously saved health/money data, if any, remains inside the legacy browser data and backup format so upgrading does not silently erase it.

## Celestial Navigation redesign (v0.8)

The ORBIT homepage now presents an interactive solar-system navigation map instead of a generic header. The central ORBIT core is surrounded by four accessible planetary navigation buttons: Tasks (amber), GAIA (green), FUEL (orange) and Projects (violet). Clicking a planet uses ORBIT's existing section routing. No external illustration or new data dependencies are needed; planetary rings, stars and glows are built in CSS.

- `celestial.css` is a separate, cache-versioned theme stylesheet layered after the original styles, preserving all existing logic and Supabase/Todoist integrations.
- The interface uses midnight-navy surfaces, electric cyan highlights, thin orbit lines, and restrained glass-like cards; task/GAIA/FUEL summaries retain their real linked data.
- Desktop displays the complete navigation star chart, tablet reflows the map with large touch targets, and iPhone uses a compact four-planet arrangement above the existing quick actions and persistent bottom navigation.
- Includes visible keyboard focus styles and respects `prefers-reduced-motion`.
- The existing light-mode option remains available; the dark cosmic look is the intended default.
- No changes were made to Todoist OAuth authorization, FUEL records, GAIA data, or browser-local notes and routines.

**Testing:** Repository code, field IDs, navigation destinations, JS syntax, and stylesheet structure were checked. GitHub Pages publishing and pixel-level rendering on actual devices should be verified in a browser.

## Adaptive home dashboard (v0.6)

- Desktop: compact greeting, primary quick actions, three connected-source summary cards, a two-column agenda and source overview, with projects and device-local notes below.
- Tablet: two-column layouts where space allows, touch-sized controls, and a collapsible navigation drawer in portrait widths.
- iPhone: fast tasks/FUEL/GAIA actions at the top, a compact daily snapshot, stacked panels, and persistent bottom navigation (Home, Tasks, FUEL, GAIA, More) with iPhone safe-area padding.
- No new data duplication: existing Todoist/GAIA/FUEL integration fields and their source-of-truth behavior are retained. A failed or missing integration displays its existing fallback state; it does not invent results.
- Account-specific local notes, routines, and priorities **remain device-local**. The responsive redesign does not add cross-device synchronization.
- GitHub Pages remains public; signed-in dashboard data is protected by existing GAIA Supabase RLS where applicable. The frontend login is not an encryption boundary for legacy browser-local notes.
- The responsive code was checked for JS syntax and required DOM IDs; real-device visual tests on published GitHub Pages are still recommended.

## Connected features

### Todoist OAuth / v0.7

ORBIT now uses Todoist's [OAuth Client ID Metadata Document](https://developer.todoist.com/api/v1/) support, with PKCE, instead of asking for a user-created developer app or a personal API token.

- `todoist-oauth-client.json`: public metadata. The `client_id` is the HTTPS URL of that file; Todoist fetches it directly. No OAuth client secret is embedded in GitHub.
- `supabase/functions/orbit-todoist/index.ts`: Supabase Edge Function deployed as `orbit-todoist`. **Callback URL**: `https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/orbit-todoist?mode=callback`. The GET callback is public; POST requests are authenticated with a verified ORBIT Supabase user session inside the function.
- The frontend invokes POST `status` / `start` / `api` / `disconnect`; tokens never reach the browser through these endpoints. The function only proxies allowed task-list, create-task, and complete-task actions.
- `public.orbit_todoist_connections` and `public.orbit_todoist_oauth_states` have RLS enabled and are revoked from anon and authenticated database clients. Only the Supabase server-side credential can access these tables.
- OAuth state and PKCE verifier are short-lived, single-use server-side values. The actual approved access token is AES-GCM encrypted using a purpose-separated HKDF key derived from the server-side Supabase secret. **The encrypted tokens must be migrated/re-authorized before rotating the server credential**; for production, prefer an independently managed encryption key. Never copy service keys to GitHub or ChatGPT.
- Upon connecting, an existing temporary browser token is discarded. ORBIT then reads tasks through its backend on any device signed into the same GAIA/ORBIT account.
- A temporary personal-token form remains under Advanced fallback, and only that old path uses per-tab `sessionStorage`.
- This is **not** a Todoist-created product. ORBIT Personal Command Center is not created by, affiliated with, or supported by Todoist.
- Read/write task permissions (`data:read_write`) are required. ORBIT doesn't request the separate destructive `data:delete` permission. Disconnect deletes the ORBIT-side connection, but does not necessarily revoke the authorization in Todoist's settings.
- Validating source syntax and deployment isn't equivalent to successfully completing the live approval flow. **The user must open ORBIT → Todoist & Tasks → Connect with Todoist and approve in Todoist**, then confirm that tasks load and a second device can see them.

### Todoist

ORBIT uses the current official **Todoist API v1** (`https://api.todoist.com/api/v1/`) to:

- Fetch open tasks with pagination and display today/overdue, upcoming 14 days, or all open tasks.
- Create tasks in Todoist, including optional due date and priority.
- Complete tasks in Todoist, including recurring tasks (which Todoist moves to the next occurrence).
- Refresh manually or when returning to the browser tab.

**Connect:** Visit Todoist → Settings → Integrations → Developer to copy **your personal API token**. Paste it only in ORBIT running on a trusted HTTPS site, not in GitHub, the README, a ChatGPT conversation, or screenshots. Access tokens are kept only in the browser tab's `sessionStorage` (not ORBIT's local backup or the repository); click Disconnect to clear them. `sessionStorage` is accessible to scripts on that origin and browser restore behavior varies. For a future multi-user release, use a proper OAuth authorization-code flow with protected token storage, not personal tokens in a public client.

Do not treat the ChatGPT Todoist connector as authentication for ORBIT: connectors within ChatGPT cannot automatically authorize standalone GitHub Pages websites.

### FUEL — Conversational food logging and private journal

- **Ask FUEL** opens the dedicated ChatGPT Project: https://chatgpt.com/g/g-p-6acd6e86e82081919497cb8e044c60bd/project .
- **FUEL** navigation opens a private daily food journal: calories, meal history, macronutrients, date filtering, and manually confirmed fallback entries.
- Source of truth: `public.fuel_food_entries` in the existing GAIA Supabase project, governed by account-owner row-level security. Anonymous users cannot read or write food entries.
- Manual food entries are saved directly through the user's signed-in Supabase session (not browser localStorage).
- ChatGPT Projects **do not inherit write access to Supabase just because a link exists**. To enable saving from FUEL, authorize the connected Supabase app inside the Project. Then open ORBIT → FUEL → **Copy FUEL setup** and append the copied, account-specific instructions to the FUEL Project instructions.
- The setup contains the authenticated user's UUID, a non-secret account identifier. It never includes passwords, service-role credentials or browser access tokens. When the connected Supabase app is unavailable, FUEL must say it has **not** saved the meal.
- Never rely solely on natural-language instructions as a security boundary for an administrator-level Supabase connector. Restrict app access appropriately; ORBIT's own database operations use authenticated owner RLS.
- Apple Health writeback is **not implemented**. A separate authorized iPhone Shortcut or native HealthKit bridge is needed. Do not claim food entries have synced to Apple Health until that exists.
- Food calorie and macro figures are estimates unless verified against labels and portion sizes. The dashboard includes zero data until actual meals have been saved.

### GAIA

- Fetches `https://reece1919.github.io/gaia/plants.json` for the published catalog, health flags, new additions, care notes and curated follow-up definitions.
- Shows *published* care follow-ups even when not signed into GAIA, but completion is disabled until authorized.
- If ORBIT is published on **`https://reece1919.github.io`** (any repository subpath), the browser can reuse an existing GAIA Supabase session because storage is shared by origin, not by URL path. ORBIT uses GAIA's public publishable key and the same authenticated user to access the existing **owner-restricted** `gaia_task_completions` and `gaia_custom_tasks` tables.
- Lists personal GAIA tasks and allows marking unfinished tasks complete in GAIA. Sign directly into ORBIT with the same GAIA email and password. Existing GAIA sessions on the shared GitHub Pages origin are recognized automatically.
- Checking a task does **not** log a watering or other plant care event. Do actual care logging in GAIA.
- No database schema change, new credentials, or exposure of private photos is required.

**Important:** Shared-origin sessions mean all websites you control under `https://reece1919.github.io/` should be treated as equally trusted. Keep those repositories free of untrusted scripts. GAIA public content and personal tasks have different privacy levels.

### Other useful features

- Project hub, quick links, local scratchpad, routines, and *optional local-only priorities* inherited from v0.2.
- Browser-local theme and data backup/restore. The backup does **not** contain Todoist tokens or synchronized Todoist/GAIA tasks.
- Earlier v0.1–v0.3 data is not imported automatically. After signing into ORBIT, Settings offers **Import older ORBIT browser data** when applicable; this prevents exposing old anonymous-browser data to the wrong account. All new local data is keyed to your signed-in Supabase user ID.

## Try it

1. Use the published HTTPS website for authentication. A standalone local-file preview does not reuse GAIA browser sessions and may be blocked by browser network/CORS restrictions.
2. To test it as a development site, serve this folder with `python -m http.server 8000` and open `http://localhost:8000/`. Local test uses a separate browser origin and therefore cannot reuse your GAIA login.
3. For a real deployment, publish it through GitHub Pages over HTTPS.

## Deploy as its own GitHub repository

1. Create the repository `reece1919/orbit` in GitHub. Public is required for GitHub Pages on plans without private Pages hosting.
2. Upload these **five** root files: `index.html`, `styles.css`, `auth.js`, `app.js`, `integrations.js` (the Markdown docs are optional).
3. In the repository Settings → Pages choose **Deploy from branch** → `main` / `(root)` and save.
4. After deployment, ORBIT should be at `https://reece1919.github.io/orbit/`. (This URL is **not live until published**.)
5. Open ORBIT, sign in using your existing GAIA email and password. GAIA personal tasks load privately; the published catalog is loaded in the dashboard.
6. Visit **Todoist & Tasks** and connect your Todoist token directly in your browser. Do not send the token to ChatGPT.

The ORBIT GitHub repository and GAIA repository remain separate. Both Pages sites share the `https://reece1919.github.io` origin for access to GAIA's existing browser session.

## Security and known limitations

- ORBIT sign-in and GAIA use the same Supabase browser session. Sign-out on one site also signs out of the other on this browser after session state refresh. GitHub Pages HTML/JS remains public; Supabase owner-only RLS protects GAIA tasks. Never put secret keys in the repository.
- ORBIT local priorities, projects, routines, and notes are saved to account-namespaced **browser localStorage**, not the database. They are not encrypted, are not cross-device sync, and are not protected from another person with access to the same browser profile or its developer tools. The UI sign-in is not server-side access control for these browser-local records.
- Personal Todoist API tokens in browser sessionStorage are supported only as a temporary fallback. They are not as robust as a backend-managed OAuth connection and remain exposed to malicious scripts running on the same origin. Do not install third-party scripts into ORBIT without reviewing them.
- API outages, revoked tokens, missing GAIA sign-in, rate limits or restrictive browser settings will show error/unavailable states rather than fake or cached account data.
- Data sync is on refresh and tab focus, not realtime push. Todoist fetch is capped at 2,000 tasks and displays a capped list of 100 per view. GAIA private task reads are capped at 1,000 per table.
- GAIA public notes are published observations, not automated plant health sensors or fixed watering deadlines.
- Sensitive legacy health/money records are not displayed, but may remain in browser localStorage and local backup exports from older versions; browser profiles and exports are not encrypted.
- For testing, browser simulations validated the main UI workflows and mocked service responses. Live personal Todoist and Supabase authorization have not yet been end-to-end tested on the published ORBIT domain.

## Files

- `index.html`: screen layout.
- `styles.css`: responsive design.
- `auth.js`: shared GAIA Supabase sign-in, sign-out, and session checking.
- `app.js`: original ORBIT local projects, notes, routines and priorities.
- `integrations.js`: Todoist API and GAIA published/private data integrations.
- `fuel.js`: private Supabase food journal and one-click FUEL Project setup.
- `ORBIT-BLUEPRINT.md`: future architecture and priorities.

## ORBIT sign-in details

No separate Supabase project or database table is needed. The ORBIT login form calls `signInWithPassword` on GAIA's existing Supabase project using only its publishable key. ORBIT checks the session with `getUser` before displaying the workspace. A public GitHub Pages site can never protect the downloaded HTML itself; private GAIA data remains protected by owner-scoped RLS.

Account-specific local data is saved under `orbit-v04-user-<user-id>`. Import older browser data using **Settings → Import older ORBIT browser data** after confirming the correct account. Any legacy money or health entries remain in legacy browser storage and are not visible in ORBIT.

No signup, reset-password email links, or new account management is included in v0.4; use the established GAIA account to manage your password. For new email-link flows returning to ORBIT, add `https://reece1919.github.io/orbit/**` to Supabase Auth redirect allowlist in the dashboard before enabling those flows.