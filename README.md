# ORBIT — Personal Command Center

**v0.3 — Todoist and GAIA integration.** Health and money tracking are paused and have been removed from the visible interface. Previously saved health/money data, if any, remains inside the legacy browser data and backup format so upgrading does not silently erase it.

## Connected features

### Todoist

ORBIT uses the current official **Todoist API v1** (`https://api.todoist.com/api/v1/`) to:

- Fetch open tasks with pagination and display today/overdue, upcoming 14 days, or all open tasks.
- Create tasks in Todoist, including optional due date and priority.
- Complete tasks in Todoist, including recurring tasks (which Todoist moves to the next occurrence).
- Refresh manually or when returning to the browser tab.

**Connect:** Visit Todoist → Settings → Integrations → Developer to copy **your personal API token**. Paste it only in ORBIT running on a trusted HTTPS site, not in GitHub, the README, a ChatGPT conversation, or screenshots. Access tokens are kept only in the browser tab's `sessionStorage` (not ORBIT's local backup or the repository); click Disconnect to clear them. `sessionStorage` is accessible to scripts on that origin and browser restore behavior varies. For a future multi-user release, use a proper OAuth authorization-code flow with protected token storage, not personal tokens in a public client.

Do not treat the ChatGPT Todoist connector as authentication for ORBIT: connectors within ChatGPT cannot automatically authorize standalone GitHub Pages websites.

### GAIA

- Fetches `https://reece1919.github.io/gaia/plants.json` for the published catalog, health flags, new additions, care notes and curated follow-up definitions.
- Shows *published* care follow-ups even when not signed into GAIA, but completion is disabled until authorized.
- If ORBIT is published on **`https://reece1919.github.io`** (any repository subpath), the browser can reuse an existing GAIA Supabase session because storage is shared by origin, not by URL path. ORBIT uses GAIA's public publishable key and the same authenticated user to access the existing **owner-restricted** `gaia_task_completions` and `gaia_custom_tasks` tables.
- Lists personal GAIA tasks and allows marking unfinished tasks complete in GAIA. The GAIA sign-in itself remains on GAIA: sign in on the GAIA website, then refresh ORBIT.
- Checking a task does **not** log a watering or other plant care event. Do actual care logging in GAIA.
- No database schema change, new credentials, or exposure of private photos is required.

**Important:** Shared-origin sessions mean all websites you control under `https://reece1919.github.io/` should be treated as equally trusted. Keep those repositories free of untrusted scripts. GAIA public content and personal tasks have different privacy levels.

### Other useful features

- Project hub, quick links, local scratchpad, routines, and *optional local-only priorities* inherited from v0.2.
- Browser-local theme and data backup/restore. The backup does **not** contain Todoist tokens or synchronized Todoist/GAIA tasks.
- Previous v0.1/v0.2 local-data format (`helm-headquarters-v1`, version 1/2) is preserved so existing browser data survives the rename.

## Try it

1. Download and open the self-contained `orbit-v0.3-preview.html` to explore the layout. It can display published GAIA information where internet/CORS access is permitted. It **cannot** reuse your GAIA login unless served from the `reece1919.github.io` origin.
2. To test it as a development site, serve this folder with `python -m http.server 8000` and open `http://localhost:8000/`. Local test uses a separate browser origin and therefore cannot reuse your GAIA login.
3. For a real deployment, publish it through GitHub Pages over HTTPS.

## Deploy as its own GitHub repository

1. Create the repository `reece1919/orbit` in GitHub. Public is required for GitHub Pages on plans without private Pages hosting.
2. Upload these **four** root files: `index.html`, `styles.css`, `app.js`, `integrations.js` (the Markdown docs are optional).
3. In the repository Settings → Pages choose **Deploy from branch** → `main` / `(root)` and save.
4. After deployment, ORBIT should be at `https://reece1919.github.io/orbit/`. (This URL is **not live until published**.)
5. Sign into GAIA at `https://reece1919.github.io/gaia/` and refresh ORBIT. GAIA personal tasks will appear under GAIA; the public collection will appear without signing in.
6. Visit **Todoist & Tasks** and connect your Todoist token directly in your browser. Do not send the token to ChatGPT.

The ORBIT GitHub repository and GAIA repository remain separate. Both Pages sites share the `https://reece1919.github.io` origin for access to GAIA's existing browser session.

## Security and known limitations

- Personal Todoist API tokens in browser sessionStorage are an interim personal-use solution. They are not as robust as a backend-managed OAuth connection and remain exposed to malicious scripts running on the same origin. Do not install third-party scripts into ORBIT without reviewing them.
- API outages, revoked tokens, missing GAIA sign-in, rate limits or restrictive browser settings will show error/unavailable states rather than fake or cached account data.
- Data sync is on refresh and tab focus, not realtime push. Todoist fetch is capped at 2,000 tasks and displays a capped list of 100 per view. GAIA private task reads are capped at 1,000 per table.
- GAIA public notes are published observations, not automated plant health sensors or fixed watering deadlines.
- Sensitive legacy health/money records are not displayed, but may remain in browser localStorage and local backup exports from older versions; browser profiles and exports are not encrypted.
- For testing, browser simulations validated the main UI workflows and mocked service responses. Live personal Todoist and Supabase authorization have not yet been end-to-end tested on the published ORBIT domain.

## Files

- `index.html`: screen layout.
- `styles.css`: responsive design.
- `app.js`: original ORBIT local projects, notes, routines and priorities.
- `integrations.js`: Todoist API and GAIA published/private data integrations.
- `ORBIT-BLUEPRINT.md`: future architecture and priorities.
