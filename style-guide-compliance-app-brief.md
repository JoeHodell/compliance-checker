# Project Brief: Style Guide Compliance Checker
### The Harrington Agency — Internal Tool Concept

## 1. Summary

An internal tool that ingests client style/copy guides, converts them into a structured, queryable rule set per client, and then checks uploaded documents against those rules — flagging violations inline so an employee can catch style drift before a deliverable goes to proofing or out the door.

Core loop:
- Upload a style guide once per client → app extracts and stores rules.
- Upload a working document, select the client → app scans the doc and shows exactly where it breaks that client's rules.
- Employee reviews flags, accepts/dismisses, and can add a rule on the spot if the guide missed something → the rule set gets smarter over time.

## 2. Problem Statement

Copy and proofing work at an agency involves juggling multiple client-specific style rules simultaneously — banned words, formatting conventions, tone requirements, naming conventions, voice restrictions (e.g., first-person-only, no third-party references), structural requirements (e.g., no "Option X" labels, specific banner colors, font rules). These rules live in scattered PDFs, decks, or institutional memory, and checking a new draft against them is manual, slow, and error-prone — especially under deadline pressure or when someone other than the usual writer touches a client's copy.

## 3. Goals

- Centralize each client's style guide into one authoritative, structured rule set.
- Let any employee — not just the person who memorized the guide — check a document against client rules in minutes, not a full read-through.
- Make flags specific and actionable (what rule, where, why) rather than a vague "this looks off."
- Let the rule set evolve — style guides are living documents, and employees discover unwritten conventions through practice.
- Reduce proofing errors that currently get caught late (or not at all) — merge tag mistakes, tone violations, banned phrasing, structural inconsistencies.

## 4. Non-Goals (v1)

- Not a generative copywriting tool — it flags deviations, it doesn't rewrite copy for the user (though a "suggest a compliant alternative" feature could be a v2 add-on).
- Not a design/layout checker (font, color, banner placement) unless the client guide explicitly defines those as text-adjacent rules — visual QA is a separate problem.
- Not a multi-tenant SaaS product initially — scoped for internal agency use across your existing client roster.

## 5. Users & Roles

- **Employee**: any employee at the agency can access the app, upload documents, run checks, and propose new rules. No login gatekeeping beyond being on the team — this is an internal tool for company-wide use, not exposed to the public internet.
- **Admin**: approves *new* rule proposals — ones an employee adds from a document check that weren't in the original guide. Rules extracted directly from an uploaded style guide go active automatically and are freely editable by any employee; only net-new rules need admin sign-off, since those represent someone's interpretation rather than the client's own written guide. Multiple people can hold the admin role — any admin can act on any pending item, no per-client ownership split needed in v1.

No client-facing access — this is an internal QA tool.

## 6. Core Features

### 6.1 Client & Style Guide Management

- Create/select a client (e.g., Central Park Conservancy, GLAAD, Cooper Union, LKSOM).
- Upload a style guide document (PDF, DOCX, or pasted text) per client.
- App parses the guide and extracts a structured rule set (see Section 7).
- Extracted rules go active automatically — no admin approval needed for a first-pass extraction, since they're sourced directly from the client's own guide. Employee should still skim them for extraction errors (see Section 8), and can edit any rule at any time; edits don't need approval either.
- Support multiple guide uploads per client over time (append/merge, don't overwrite) — style guides get updated, and old rules shouldn't silently vanish without review.

### 6.1a Onboarding Flow (new clients & guide updates)

This needs to be a real, repeatable workflow from day one — not just a one-time bulk seed at build time — since new clients and revised guides will keep arriving after launch.

**New client onboarding:**
- Create the client record (name, any basic metadata).
- Upload their style guide(s) — supports multiple files at once if a client's guide is split across docs (e.g., a core style guide plus a separate glossary).
- App runs extraction, rules go active automatically per Section 6.1's auto-approval rule.
- Employee does a quick skim/edit pass on the extracted set (not required, but recommended before the client's first real document check).

**Updated guide for an existing client:**
- Upload the new/revised guide version to that client's existing record.
- App extracts rules from the new version and diffs against the current active set — new rules go active automatically (same as onboarding); changed or removed rules should be surfaced for review rather than silently overwritten, since a rule someone already edited manually shouldn't get clobbered by a re-extraction.
- Prior guide version stays in history (Section 10) rather than being deleted.

This flow should be self-serve for any employee, not admin-gated — consistent with new clients/updates not requiring approval, only net-new rules proposed from documents do (Section 6.4).

### 6.2 Rule Set (the heart of the system)

Each rule is stored as a discrete, structured record, not just a paragraph of text — so it can be checked programmatically and referenced individually. See data model below.

### 6.3 Document Upload & Check

- Upload a working document (DOCX, PDF, or pasted text).
- Select which client's rule set to check it against.
- App runs the document against every active rule for that client.
- Results shown as a single flag list with severity tags (Hard rule vs. Style preference), sortable and filterable (by severity, status, rule category) rather than a flat chronological dump — needed once documents get long or a doc has a high flag count.
- Overall summary at the top: X hard violations, Y style flags, clean/not-clean at a glance.

### 6.4 Rule Feedback Loop

On any flagged (or unflagged) passage, any employee can:
- Dismiss a flag as a false positive (optionally: "why," to improve future extraction).
- Edit an existing rule directly — no approval needed, since it's already an active, guide-sourced rule.
- Propose a brand-new rule directly from the document ("this should always be flagged going forward") without having to go back and re-upload the whole guide.
- Rule edits apply immediately. New rule proposals sit in a pending queue until an admin approves them — at which point they go active and apply to future checks for that client. This keeps genuinely new interpretations reviewed, while letting the guide-sourced rule set stay fast and low-friction to maintain.
- Optional: track how often each rule fires and gets dismissed, to surface rules that may need tightening or retiring.

### 6.5 History & Audit

- Store past checks per document/client so employees can see what was flagged and what was resolved before a deliverable went out.
- Rule change log: who added/edited/removed a rule and when — useful for institutional memory when a client's preferences shift.

### 6.6 Standard Copy/Grammar Checking

Alongside client-specific rule checking, every document check also runs a general grammar, spelling, and mechanical pass — the standard stuff that isn't client-specific (subject-verb agreement, typos, punctuation errors, run-ons, misused homophones, etc.).

- Applies to every document check regardless of client — this layer isn't part of any client's rule set, it runs universally.
- Shows up in the same single flag list as client-specific flags (Section 6.3), tagged with its own category (e.g., "Grammar/Mechanical") so it's visually distinct from client style flags but not a separate screen to check.
- Severity: grammar/spelling issues default to Hard rule (objectively wrong), distinct from client style preferences which vary in severity.
- Same accept/dismiss interaction as any other flag — a "grammar" flag can still be a false positive (e.g., intentional sentence fragments in ad copy), so it shouldn't be auto-corrected without review.
- This layer needs no client setup and no extraction step — it's built into the checking engine itself, not sourced from a guide.

## 7. Data Model (high level)

**Client**
- id, name, active guides (list), created_at

**Rule**
- id, client_id
- rule_type (discrete / lookup_table) — discrete rules carry a single pattern/logic; lookup_table rules hold a set of term-pairs (wrong → right) under one reviewable record, for guides with large volumes of straightforward word-swaps or proper-noun spellings
- category (banned word/phrase, required phrasing, tone/voice, structural/formatting, naming convention, POV/voice restriction, other)
- description (human-readable)
- pattern/logic (the checkable form — could be a literal string/regex for hard rules, a natural-language instruction passed to an LLM check for fuzzier tone rules, or a term-pair list for lookup_table rules)
- severity (hard rule / style preference)
- source (extracted from guide vs. manually proposed, with source guide reference/quote if applicable)
- status (pending / active / archived)
- proposed_by, approved_by
- created_at, updated_at

**Document Check**
- id, client_id, document reference, uploaded_at, uploaded_by
- results: list of flags, each with rule_id (nullable — null for grammar/mechanical flags, which aren't tied to a client rule), flag_source (client_rule / grammar), location in doc (offset or paragraph ref), matched text, employee resolution (pending/accepted/dismissed)

## 8. How Rule Extraction & Checking Would Actually Work

This is the technical crux, worth being explicit about since "remember all the information" and "show everything that goes against the guide" are doing a lot of work:

- **Extraction (guide → rules)**: Style guides are prose, not structured data. The realistic approach is an LLM pass that reads the guide and proposes discrete rules in the structured format above. Per the auto-approval decision (Section 6.1), these go active immediately rather than sitting in a review queue — employees can still skim and edit anything that looks off, but nothing blocks on that review.
- **Checking (document → flags)**:
  - *Hard rules* (banned words, required phrases, formatting patterns like "no em dashes," "no 'Option X' labels") can be checked deterministically with string/regex matching — fast, cheap, no false negatives.
  - *Soft rules* (tone, voice, "human and varied language," "no AI writing tropes") need an LLM pass over the document with the relevant rules in context, since these require judgment, not pattern matching.
  - A hybrid approach — deterministic checks first, LLM check second for anything not caught by hard rules — keeps costs down and catches more.
- **Grammar/mechanical checking** (Section 6.6): this is a solved problem elsewhere, so it's worth using an existing grammar-checking engine (e.g., LanguageTool, which has a free/open-source option and an API) rather than reinventing it — feeding its output into the same flag list as client rules. An LLM pass is a fallback if a dedicated grammar API doesn't fit the stack, but a purpose-built grammar checker will likely be faster and more precise than an LLM for this specific layer.

## 9. UX Flow (v1)

- **Home**: list of clients, "Add client" button.
- **Client page**: shows current active rule set (grouped by category), upload-new-guide button, rule history.
- **Post-extraction review screen**: proposed rules appear here already active, in an editable table — employee can skim and edit/discard any before moving on, but nothing is blocked on approval.
- **Check a document**: select client → upload/paste doc → run check.
- **Results view**: single flag list, sortable and filterable (severity, status, category) — each entry shows the passage, rule broken, why, and accept/dismiss/propose-edit actions.
- **Propose rule inline**: from anywhere in the results view, "flag this as a rule" opens a small form pre-filled with the selected text; goes to the shared admin pending queue.
- **Admin queue**: pending rule proposals across all clients, visible to any admin, approve/edit/reject — any admin can action any item, no per-client assignment needed in v1.

## 10. Tech Considerations

- Document parsing: DOCX/PDF text extraction (standard libraries handle this well).
- Grammar/mechanical checking: a dedicated grammar-checking engine (e.g., LanguageTool) integrated as its own pass, feeding into the same flag list as client rules — see Section 8.
- LLM integration: Anthropic API (Claude) is a natural fit given your existing workflow — both for guide extraction and soft-rule checking. Structured JSON outputs for rule extraction so results map cleanly to the data model.
- Storage: relational DB (rules, clients, checks, users) — nothing exotic needed at this scale.
- Auth: custom login (company email + password) rather than piggybacking on THA's existing Microsoft 365 — simpler to build and manage for this app's scope. Needed so employee vs. admin roles can be enforced.
- Frontend: given the highlight/annotate requirement, something like a rich-text or PDF viewer with overlay annotations (similar to how Google Docs suggestions or Grammarly render inline comments).
- Hosting: as a deployed web app reachable by the whole team, needs real hosting (not a local script) — this is where Claude Code comes in for the actual build once the approach is validated.

## 11. Phased Rollout

**Phase 1 (MVP):**
- LLM-assisted extraction of rules from your actual style guides (docs/PDFs), with rules going active automatically per the auto-approval flow above. Build and validate against PIH's guide only — it's already in hand, so it's the first real test of extraction and the checking UX.
- Document upload + check against PIH's rule set to validate the checking UX end to end.
- Single flag list with severity tags, accept/dismiss actions.
- Onboarding flow built and working (see Section 6.1a) — needed from day one. The remaining client guides (GLAAD, Cooper Union, LKSOM, Central Park Conservancy, and any others) are held back on purpose and used as the first real test of this flow once it's built, rather than pre-seeded at build time. This means the onboarding flow gets exercised with real guides early, not just theoretical.
- Standard grammar/mechanical checking (Section 6.6) running on every document check alongside client rules — this is universal, not client-specific, so it should be live from the first version.

**Phase 2:**
- Remaining client guides (GLAAD, Cooper Union, LKSOM, CPC, etc.) onboarded through the onboarding flow itself — serves as its real-world test.
- Employee-facing propose-a-rule flow, admin approval queue.
- Company-wide access rollout.

**Phase 3:**
- Rule performance tracking (fire/dismiss rates).
- Audit log / rule history view.
- Possible: suggested compliant rewrites alongside flags.

## 12. Open Questions

- Who gets admin access initially — just you, or a small set of leads across the clients you work on?
- THA's own internal formatting standards (MEMORANDUM header, banner colors, no "Option X" labels, no em dashes) are out of scope for now per your call — worth revisiting once the per-client version is solid, since that layer would apply across every client.

## 13. Success Metrics

- Reduction in style/tone corrections caught at the proofing stage vs. earlier in drafting.
- Time saved per document check vs. manual guide review.
- Rule set growth and refinement rate (a healthy sign the feedback loop is working, not a sign of instability).
- Employee adoption — used voluntarily on live client work, not just as a formality.
