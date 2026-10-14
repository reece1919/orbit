# DRIFTMARK — Driftbound Writing Workbench

**Website:** https://reece1919.github.io/orbit/driftmark/

DRIFTMARK lives in the existing ORBIT GitHub Pages repository at /driftmark/. It combines a private reference atlas with a guided article-writing desk for Eilmark.

## Authorship rule

The AI plans; the author writes. By default, creative assistance supplies short key points, references, unresolved questions, and a focused prompt for each article section. It must not supply paragraphs, sample openings, quotations it invented, or a finished article. Draft prose belongs in the author's section editor only.

The interface preserves the distinction between an author decision that remains open and uncertainty that belongs within the fictional world. Canon status is separate from writing status.

## Writing workflow (v0.3)

1. Open or create an entry. Add the article's purpose, audience, and relevant atlas references.
2. Choose **Prepare AI planning brief**, then copy the instructions into the existing Driftbound GPT or creative chat.
3. Bring back the JSON response through **Import AI brief**. Preview its points, questions, and prompts before applying it.
4. Work through the sections. The plan is beside an initially empty draft editor. Write in your own words, record decisions, and review each drafted section.
5. **Save to cloud** to keep the plan, decisions, and prose together across devices.
6. For an attached World Anvil article, choose **Review World Anvil update**, compare the current destination with your writing, acknowledge review, and save. **Export your article** also provides plain text or World Anvil BBCode for manual transfer.

The built-in starter outline is clearly labeled. It is generic planning guidance, not an AI response or established lore.

## Planning-brief safeguards

- Brief JSON has version, article_title, purpose, audience, and sections.
- Each section has id, title, points, questions, prompt, and references. Points carry text, status, and source; references carry label, HTTPS URL or empty string, and supplied excerpt or empty string.
- Point labels: established, proposed, undecided, in_world_uncertainty, needs_checking. A point marked established requires a source label; the dashboard does not independently verify that claim.
- Import rejects unknown fields, including draft/body/reviewed/completed. Applying a plan never inserts prose or marks a section complete.
- Existing drafts and decisions match by stable section ID or title. Unmatched sections containing the author's text are retained. A changed plan requires fresh review.
- Draft and review counts reflect the author's section drafts; ticking key points does not count as writing.
- Article exports contain section drafts and headings only. Planning notes, decisions, references, and existing mixed notes are excluded.

## Existing entries and backups

All earlier entry fields and original working text are preserved. Original text remains under **Existing text and working notes**; the author can copy prose into the appropriate draft section.

Workspace/backup version 3 adds World Anvil source snapshots. Versions 1 and 2 remain readable. JSON backups include plans, original text, section drafts, decisions, source snapshots, and any unsaved editor changes. Credentials are excluded by explicit field serialization. Backup restoration remains an explicit replacement action with confirmation and rejects unsupported versions and duplicate entry IDs.

## Private storage and login

- Uses the existing GAIA/ORBIT Supabase project and same-origin login.
- Existing owner-only, AAL2/MFA access and revision-checked saving are retained.
- Uses the existing JSONB payload column. No new table, authentication provider, model endpoint, or paid AI integration was added.
- Private entries and drafts are never committed to the public repository.
- An unsuccessful save or revision conflict leaves the editor intact. Save before leaving; an exported backup can preserve pending changes.

## World Anvil connection (v0.3)

The supplied Driftbound GPT Action schema identifies https://worldanvil-proxy.onrender.com as its service. A live unauthenticated read returned HTTP 401 requiring x-auth-token. DRIFTMARK reuses this service through the private driftmark-worldanvil Edge Function.

- Open Connect World Anvil and enter the existing World Anvil user token used by the GPT.
- The token stays in memory for this tab. It is never stored in browser storage, workspace payloads, JSON backups, source code, logs written by this integration, or response bodies. Reconnect after reload; disconnect or sign-out clears it. Pending connection responses cannot restore a token after sign-out or cancellation.
- The Edge Function requires a valid Supabase user JWT, the existing owner's identity, and AAL2/MFA. CORS is restricted to the existing GitHub Pages origin. It uses no admin credential or new database tables.
- Connect verifies the World Anvil identity and permission to the Driftbound world. Browse lists articles in pages of 50.
- Read current main article text; add a private cached reference or attach it to the current entry. Imported source text does not fill section drafts.
- AI planning briefs receive the attached or selected source snapshots and their read dates. AI assistance remains the existing copy-and-paste handoff.
- Write section drafts, then choose Review World Anvil update. The current destination and proposed main text appear together. The author must acknowledge review before saving.
- The backend checks the latest source fingerprint before PATCH, sends content only, and reads the article back to verify the text and unchanged title, category, parent, privacy, draft, and WIP metadata. Missing privacy or edit permission blocks the update. Read counters are excluded from the fingerprint.
- Changed sources return a conflict. Every write attempt consumes its review, including a lost response. Read the current destination in a new review before retrying an uncertain update.
- Successful saves update the private source snapshot and attempt to save the writing workspace. A cloud failure keeps the editor and asks the author to save.
- Version 3 stores source snapshots and remains compatible with backups 1 and 2. Credentials are excluded by explicit field serialization.

This version reads and updates existing articles. Create a destination article in World Anvil before attaching a new draft. Specialized template fields, categories, and publication settings are not edited. There is no delete operation.

World Anvil exposes no atomic conditional update in the supplied schema. Rechecking before PATCH narrows the chance of an intervening edit; it cannot eliminate the gap between the read and write.

## Validation

Run: `node --test driftmark/tests/*.test.cjs driftmark/tests/*.test.mjs`

The 32 tests cover authored-text preservation, planning imports, exports, source serialization, verified JWT/MFA handling, origin restrictions, conflicts, content-only PATCH and read-back, pagination, token clearing, cancelled connections, and uncertain writes. The GitHub workflow also checks all frontend and backend source syntax.

The existing JSONB table, owner/MFA policies, and workspace migration were inspected. The interrupted credential-storage migration did not run. This integration needs no database migration or admin key.

Authenticated end-to-end reads and saves need the owner's existing World Anvil token; those are not claimed as verified without it. Visual browser QA was unavailable in this environment. AI planning remains a copy-and-paste handoff to the existing GPT and cannot insert article prose.

