# DRIFTMARK — Driftbound Writing Workbench

**Website:** https://reece1919.github.io/orbit/driftmark/

DRIFTMARK lives in the existing ORBIT GitHub Pages repository at /driftmark/. It combines a private reference atlas with a guided article-writing desk for Eilmark.

## Authorship rule

The AI plans; the author writes. By default, creative assistance supplies short key points, references, unresolved questions, and a focused prompt for each article section. It must not supply paragraphs, sample openings, quotations it invented, or a finished article. Draft prose belongs in the author's section editor only.

The interface preserves the distinction between an author decision that remains open and uncertainty that belongs within the fictional world. Canon status is separate from writing status.

## Writing workflow (v0.2)

1. Open or create an entry. Add the article's purpose, audience, and relevant atlas references.
2. Choose **Prepare AI planning brief**, then copy the instructions into the existing Driftbound GPT or creative chat.
3. Bring back the JSON response through **Import AI brief**. Preview its points, questions, and prompts before applying it.
4. Work through the sections. The plan is beside an initially empty draft editor. Write in your own words, record decisions, and review each drafted section.
5. **Save to cloud** to keep the plan, decisions, and prose together across devices.
6. **Export your article** as plain text or World Anvil BBCode, review it, then transfer it manually.

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

Workspace/backup version 2 adds an article object; version 1 remains readable. JSON backups include plans, original text, section drafts, decisions, and any unsaved editor changes. Backup restoration remains an explicit replacement action with confirmation and rejects unsupported versions and duplicate entry IDs.

## Private storage and login

- Uses the existing GAIA/ORBIT Supabase project and same-origin login.
- Existing owner-only, AAL2/MFA access and revision-checked saving are retained.
- Uses the existing JSONB payload column. No new table, authentication provider, model endpoint, or paid AI integration was added.
- Private entries and drafts are never committed to the public repository.
- An unsuccessful save or revision conflict leaves the editor intact. Save before leaving; an exported backup can preserve pending changes.

## Integration boundary

The planning brief currently uses an explicit copy-and-paste handoff. DRIFTMARK does not automatically invoke the custom GPT, load live World Anvil articles, or publish to World Anvil. Reuse of the existing GPT Action remains pending inspection of its current configuration.

A future AI connection must write into planning fields only and keep the authorship rule above. Any World Anvil writes must be reviewed and preserve the destination's privacy and draft status.

## Validation

Run: node --test driftmark/tests/writing.test.cjs

Tests cover AI import restrictions, empty draft initialization, draft and decision preservation, JSON reload, source labels, and exports excluding planning material. Syntax checks and HTML control/script-order checks passed.

The current Supabase payload column was verified as JSONB. Authenticated browser save/reload and visual desktop/tablet/mobile checks were not available in this session; the existing shared login and save API were retained.

