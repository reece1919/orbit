# QUILL — Driftbound Writing Workbench

**Website:** https://reece1919.github.io/orbit/driftmark/

QUILL, formerly DRIFTMARK, lives in the existing ORBIT GitHub Pages repository at /driftmark/. It combines a private reference atlas with a guided article-writing desk for Eilmark.

## Authorship rule

The AI plans; the author writes. By default, creative assistance supplies short key points, references, unresolved questions, and a focused prompt for each article section. It must not supply paragraphs, sample openings, quotations it invented, or a finished article. Draft prose belongs in the author's section editor only.

The interface preserves the distinction between an author decision that remains open and uncertainty that belongs within the fictional world. Canon status is separate from writing status.

## Writing workflow (v0.6)

1. Open or create an entry. Add the article's purpose, audience, and relevant atlas references.
2. Choose **Prepare AI planning brief**, then copy the instructions into the existing Driftbound GPT or creative chat.
3. Bring back the JSON response through **Import AI brief**. Preview its points, questions, and prompts before applying it.
4. Read the formatted World Anvil reference and work through the sections. Use the visual editor to write and format your own words beside the plan. **Use World Anvil text in this section** deliberately brings the attached article into the active draft; category fields have their own **Use current text as my starting draft** action. Existing drafts require confirmation before replacement. Record decisions and review each drafted section.
5. **Save to cloud** to keep the plan, decisions, and prose together across devices.
6. For an attached World Anvil article, choose **Review World Anvil update**, compare the current destination with your writing, acknowledge review, and save. **Export your article** also provides plain text or World Anvil BBCode for manual transfer.

The built-in starter outline is clearly labeled. It is generic planning guidance, not an AI response or established lore.

## Visual formatting

World Anvil references, category-field references, and both sides of the update review show formatted text by default. Drafts open in **Visual** mode with paragraph/headings/quote styles, bold, italic, underline, bullet and numbered lists, links, and undo/redo. **BBCode** switches to the underlying source when needed. The toolbar wraps on mobile. Tables imported from World Anvil display as tables and their cell text can be edited visually; adding/removing table structure remains a BBCode operation.

The persisted draft remains a BBCode string in the existing workspace and backups. An untouched visual draft round-trips byte for byte; edited supported elements retain original wrappers and arguments, while new formatting converts back to World Anvil BBCode. Section-local undo cannot restore another section's writing. Oversized edits are rejected as a whole rather than silently truncated. Source articles longer than the 80,000-character section limit remain readable but cannot be imported wholesale into one section.

The renderer supports common headings, paragraphs, emphasis, lists (including hyphen lists), quotes, links, tables, line breaks, and alignment. World Anvil article mentions and wiki-style references appear as preserved article-link items. Advanced embeds, custom layouts/styles, restrictions, hidden comments, unsupported paired tags, and ambiguous block layouts are preserved as noneditable items. Their source stays intact; full text is readable where available. Images, maps, and other embeds are represented by placeholders, and World Anvil theme CSS is not reproduced. Use BBCode view to change those advanced items.

Source content is parsed as BBCode, never trusted as HTML. HTML text is escaped; generated elements and link protocols use allowlists. No remote images, iframes, scripts, custom styles, or new network destinations are loaded. Pasted external HTML is ignored in favor of plain text. Copy/paste within formatted QUILL views also carries a BBCode clipboard representation, which is parsed through the same safe renderer. Dropped HTML/files are blocked. Plain-text exports remove formatting; World Anvil exports and reviewed writes retain BBCode. Formatting does not add AI prose or change the saved-token, login, MFA, or publication-review paths.

Syntax follows the official [World Anvil formatting guide](https://www.worldanvil.com/learn/bbcode-tutorials/basic-bbcode), [list guide](https://www.worldanvil.com/learn/bbcode-tutorials/lists), and [external-link guide](https://www.worldanvil.com/learn/bbcode-tutorials/external-links).

## Planning-brief safeguards

- Brief JSON has version, article_title, purpose, audience, and sections.
- Each section has id, title, points, questions, prompt, and references. Points carry text, status, and source; references carry label, HTTPS URL or empty string, and supplied excerpt or empty string.
- Point labels: established, proposed, undecided, in_world_uncertainty, needs_checking. A point marked established requires a source label; the dashboard does not independently verify that claim.
- Import rejects unknown fields, including draft/body/reviewed/completed. Applying a plan never inserts prose or marks a section complete.
- Existing drafts and decisions match by stable section ID or title. Unmatched sections containing the author's text are retained. A changed plan requires fresh review.
- Draft and review counts reflect the author's section drafts; ticking key points does not count as writing.
- Article exports contain section drafts and headings only. Planning notes, decisions, references, and existing mixed notes are excluded.

## Naming compatibility

QUILL keeps the existing `/driftmark/` address, cloud workspace table, protected World Anvil function/RPC names, JavaScript interfaces, and BBCode clipboard type. The stable JSON backup identifier remains `DRIFTMARK` so earlier backups and clients remain compatible; new download filenames use `quill-atlas-YYYY-MM-DD.json`. This is a branding change and performs no data or credential migration.

## Existing entries and backups

All earlier entry fields and original working text are preserved. Original text remains under **Existing text and working notes**; the author can copy prose into the appropriate draft section.

Workspace/backup version 5 adds article-index links and reconciliation status alongside the existing category-page drafts and explicit source kinds. Versions 1–4 remain readable. Plans, original notes, section drafts, decisions, source snapshots, and update choices survive cloud saves and JSON exports. Older clients reject version 5 rather than silently stripping its fields. Backup imports accept up to 100 MB and 110,000 entries and still require explicit replacement confirmation. JSON backups include plans, original text, section drafts, decisions, source snapshots, and any unsaved editor changes. Credentials are excluded by explicit field serialization. Backup restoration remains an explicit replacement action with confirmation and rejects unsupported versions and duplicate entry IDs.

## Private storage and login

- Uses the existing GAIA/ORBIT Supabase project and same-origin login.
- Existing owner-only, AAL2/MFA access and revision-checked saving are retained.
- Uses the existing JSONB payload column. No new table, authentication provider, model endpoint, or paid AI integration was added.
- Private entries and drafts are never committed to the public repository.
- An unsuccessful save or revision conflict leaves the editor intact. Save before leaving; an exported backup can preserve pending changes.

## World Anvil connection (v0.3.1)

Saved connections restore automatically after a verified ORBIT login, including a new tab or page reload. Enter the existing user token once through **Check and save connection**.

The supplied Driftbound GPT Action schema identifies https://worldanvil-proxy.onrender.com as its service. A live unauthenticated read returned HTTP 401 requiring x-auth-token. QUILL reuses this service through the private driftmark-worldanvil Edge Function.

- Open Connect World Anvil and enter the existing World Anvil user token used by the GPT.
- Connect validates the existing user token and saves it encrypted in Supabase Vault. Later requests and new page loads use this saved account connection without returning the token to the browser. It is excluded from browser storage, workspace payloads, JSON backups, source code, and application logs.
- Sign-out clears this tab's connection state while the encrypted account connection remains available after the next verified login. **Forget saved connection** deletes its private mapping and Vault secret. Private writing is preserved.
- The Edge Function requires a valid Supabase user JWT, the existing owner's identity, and AAL2/MFA before any private storage access. CORS is restricted to the existing GitHub Pages origin. A separate service client uses the built-in server environment credential exclusively for the connection RPCs; this key never reaches frontend code.
- The mapping table and privileged functions live in the unexposed `driftmark_private` schema with RLS enabled and browser-role access revoked. Public RPC wrappers are SECURITY INVOKER and service-only. Private functions also enforce the trusted service-role claim and the fixed owner ID. Writes and deletion use a per-owner transaction lock. Deleting an account mapping cleans up its Vault secret.
- Connect verifies the World Anvil identity and permission to the Driftbound world. Browse lists articles in pages of 50.
- Read current main article text; add a private cached reference or attach it to the current entry. Imported source text does not fill section drafts.
- AI planning briefs receive the attached or selected source snapshots and their read dates. AI assistance remains the existing copy-and-paste handoff.
- Write section drafts, then choose Review World Anvil update. The current destination and proposed main text appear together. The author must acknowledge review before saving.
- The backend checks the latest source fingerprint before PATCH, sends content only, and reads the article back to verify the text and unchanged title, category, parent, privacy, draft, and WIP metadata. Missing privacy or edit permission blocks the update. Read counters are excluded from the fingerprint.
- Changed sources return a conflict. Every write attempt consumes its review, including a lost response. Read the current destination in a new review before retrying an uncertain update.
- Successful saves update the private source snapshot and attempt to save the writing workspace. A cloud failure keeps the editor and asks the author to save.
- Version 5 stores article and category source snapshots plus article-index links and remains compatible with backups 1–4. Credentials are excluded by explicit field serialization.

This version reads and updates existing articles and category-page text. Create a destination article or category in World Anvil first. Specialized article template fields, category hierarchy, page layout, and publication settings are not edited. There is no delete operation.

World Anvil exposes no atomic conditional update in the supplied schema. Rechecking before PATCH narrows the chance of an intervening edit; it cannot eliminate the gap between the read and write.

## Category-page writing (v0.4)

1. Choose **Browse category pages** using the existing saved connection. Categories are paginated in groups of 100; the browser can switch between categories and articles.
2. Read the live category, then choose **Open category writing desk**. If a private desk already exists for that category, its plan and drafts are retained and its source is refreshed. Save any current unsaved entry before switching.
3. The desk has seven fixed fields: **Main description**, **Preview excerpt**, and **Custom content 1–5**. Each has its own planning points, questions, notes, and empty author draft. Custom-block placement follows the current World Anvil layout.
4. Use **Prepare AI planning brief** and **Import AI brief** as usual. Category plans must keep the fixed IDs `description`, `excerpt`, and `custom1`–`custom5`. AI imports cannot insert drafts, select fields for update, or reroute prose to another field.
5. Write a field yourself, or explicitly choose **Use current text as my starting draft**. Typing selects that field for update. Uncheck **Include this field in the World Anvil update** to keep a draft private. An included empty draft explicitly clears that field; untouched empty editors are excluded.
6. **Save to cloud** to preserve private drafts without changing World Anvil. **Review World Anvil update** reads the destination again, shows only selected fields that differ, and requires acknowledgement of any clears.
7. Saving uses the stored token entirely on the server, checks the source fingerprint, PATCHes only the selected changed text fields, then reads back every returned text field and protected metadata. A mismatch is reported as uncertain; a fresh review is required before retrying.

The official [World Anvil Boromir schema](https://www.worldanvil.com/api/external/boromir/swagger-documentation) includes these fields in `CategoryUpdate` through `CategoryExtended` and `Category`. Category text uses `description`, not the article `content` field. The GPT Action schema's narrower PATCH definition does not limit QUILL's own broker, but the existing Render service must forward these fields. Missing fields remain readable as private drafts and cannot be sent. Missing edit permission, privacy state, or subscriber-group metadata blocks a write. Category draft/WIP values may be null in the official schema; they are protected without imposing article-specific boolean requirements.

Privacy, subscriber groups, parent, covers, redirects, display flags, ordering, CSS classes, and layout metadata are never included in the update body. The backend verifies that they and untouched text fields remain unchanged on read-back. No new database migration or credential-store change is required.

## Automatic article reconciliation (v0.5)

After verified ORBIT sign-in, QUILL opens the saved cloud workspace first, restores the existing World Anvil account connection, and automatically loads the entire available Driftbound article index. Signing in or completing authenticator verification while QUILL is already open starts this process without requiring Refresh. Auth calls are deferred outside the auth event callback. Saving a connection also starts loading. The index is saved before loading main reference text, so titles appear before all article reads finish. Reference text is loaded sequentially and checkpointed every ten results. **Reconcile articles** repeats the check; **Stop loading** retains completed checkpoints.

Reconciliation matches the immutable World Anvil article ID, never the title. New IDs receive new entries with empty author drafts. Existing IDs refresh only their source snapshot and reconciliation metadata. The author's title, category, tags, URL, writing status, original notes, purpose, section plans, drafts, decisions, reviews, creation date, and last author-edit date remain untouched. A remote rename is retained as the source title without replacing a custom dashboard title. Locally duplicated drafts are retained rather than collapsed. Unlinked local work and category-page entries are left intact.

Only a completed index scan may mark linked entries **Not returned by World Anvil · kept locally**. This does not assert deletion; access, filtering, or upstream changes may explain absence. A partial or interrupted scan adds confirmed rows without marking other entries missing. Failed content reads retain the previous cached source and all local work; a new title without readable main text remains an indexed entry. Reconciliation never publishes, deletes, or changes World Anvil content.

Automatic cloud saves use the existing owner/MFA policies and revision compare-and-swap. A cloud failure or conflict stops further import and reports that reconciliation is incomplete. Checkpoint saves preserve the active editor and its dirty flag; they do not reopen the editor or replace its drafts. Source updates refresh its attached reference only when the link still matches. JSON export includes unsaved editor work. Refresh with unsaved writing rechecks references without asking to discard that editor. An account change prevents late reads from reaching a new checkpoint.

The complete imported source is available under **World Anvil reference text**, separate from author drafts. Local-only entries, unavailable source text, changed sources, and unreturned entries carry explicit status labels. Automatic startup article loading requires the existing connection to be saved. It uses the existing protected article-list and article-read endpoints and needs no backend or database migration. Specialized article template fields and category-page content are outside this automatic article scan.

## Validation

Run: `node --test driftmark/tests/*.test.cjs driftmark/tests/*.test.mjs`

The 125 tests cover authored-text preservation, planning imports, exports, source serialization, verified JWT/MFA handling, origin restrictions, conflicts, content-only PATCH and read-back, pagination, restoring saved connections, sanitized storage errors, forgetting credentials, sign-out during requests, and uncertain writes. Category tests also cover all seven text fields, partial PATCH, reviewed empty-field clears, unchanged fields and metadata, fixed planning IDs, selected-field drafts, and reload preservation. Reconciliation tests cover complete and partial pagination, stable-ID deduplication, remote renames, missing articles, cached failures, reference-only updates, owner changes, stopping, rate limits, cloud revision conflicts, automatic login loading, and preserving a dirty active editor in both its backup and later save. Formatting tests additionally exercise safe rendering, literal text and comments, malformed/deep nesting, tables, both list syntaxes, exact untouched round-trips, adjacent edits around preserved items, link changes, visual/source switching, clipboard sanitation, size limits, section-local undo, draft navigation/reload, category selection, and formatted review/sign-out. These use deterministic DOM adapters; browser engine/layout and native formatting-command behavior are not covered by those adapters. The GitHub workflow also checks all frontend and backend source syntax.

Storage migration `20261014192310_persist_driftmark_worldanvil_connection` was applied from `supabase/functions/driftmark-worldanvil/connection.sql`. A rolled-back database test verified credential round-trip, rotation, encrypted storage, wrong-owner rejection, input validation, and removal of both the mapping and Vault secret. Catalog checks confirmed RLS, service-only RPC permissions, browser-role denial of the private schema and decrypted Vault view, and SECURITY INVOKER public wrappers. The existing writing table remains in use.

The private mapping intentionally has no browser RLS policies, which denies direct row access. The [Supabase linter's informational no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) reflects this design; credential operations use only the protected service functions.

The saved owner connection and live article import were verified after the reconciliation release: on 2026-10-14, the private workspace held all 205 indexed articles with 205 cached source texts and no unavailable text. Category forwarding/writes have automated simulated-service coverage; a live category write is not claimed as verified. Visual browser QA was unavailable in this environment (the browser executable is absent); formatting has parser, serialization, workbench, and reviewed-update integration coverage. AI planning remains a copy-and-paste handoff to the existing GPT and cannot insert article prose.

