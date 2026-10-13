# DRIFTMARK — Driftbound Creative Atlas

**Website:** https://reece1919.github.io/orbit/driftmark/

DRIFTMARK is a standalone worldbuilding workspace living in the existing ORBIT GitHub Pages repository at `/driftmark/`. The default setting is **Eilmark** (the Driftbound universe).

## Current capabilities (v0.1)
- Worldbuilding entries with category (Locations, Characters, Factions, Lore, Timeline, Scenes, Drafts, Ideas), status, tags, URL and working text.
- Search/filter, create/edit/delete, revision-checked private cloud saving, and manual JSON export/import with overwrite confirmation.
- Standalone responsive web interface, deep-linked from desktop and mobile ORBIT navigation.
- World Anvil **reference links** and a separate shortcut; **not** an automated World Anvil publishing integration.

## Private storage & sign-in
- Shares the GAIA/ORBIT Supabase project and login: `zdurujqwhxqrwbhwzzxg`.
- Private `public.driftmark_workspaces` rows keyed by `owner_id`; owner-only RLS requires an **authenticated AAL2/MFA** session. Public visitors have no select permission.
- Uses the existing publishable Supabase client key (safe for browser) and same-origin Supabase auth storage, not a separate login provider or bill.
- App creates an empty personal workspace on first verified access. Data is **not** committed to public GitHub.
- Saving uses `revision` compare-and-swap to prevent stale clients from silently overwriting another device's changes. A conflict preserves the unsaved editor and warns the user.
- No offline mutation queue in v0.1. Confirm a successful save status before navigating away; export JSON for backups.

## Operations
Edit `index.html`, `style.css`, `app.js` in this directory. GitHub Pages serves them under the `orbit` repository path.

**Not yet verified through a live browser:** open in ORBIT-signed-in desktop and mobile browser, check AAL2, create an entry, edit it, reload, and load it on a second device. Verify errors and conflict behavior. The GitHub commit is not evidence of a successful browser test.

## Suggested next work
- World Anvil article type mapping, manual copy/paste publishing flow, and confirmed API feasibility before offering direct writes.
- Relationship graph, location atlas, timelines, research backlinks.
- Entry markdown preview and safer draft autosave with conflict handling.
- Visual regression and real browser smoke tests.
