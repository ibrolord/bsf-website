# ThreatGenix AI -- Lean Pilot Scope (Scope Enforcer Cut)

**Created:** April 1, 2026
**Status:** REPLACES the 26-feature MVP list for planning purposes.
**Origin:** User said "lets go leaner." Scope enforcer cut 54% of features from the initial demo.
**Constraint:** 2 engineers, 8 weeks. ONE customer pilot (EQ Bank). ONE user (Priya).

---

## The Question That Drove Every Cut

> "What is the ABSOLUTE MINIMUM set of features that lets Priya run a pilot at EQ Bank and produce a threat model that enters their risk register?"

**The demo script:** Upload doc -> see DFD -> edit it -> generate threats -> see compliance -> export PDF. Under 30 minutes.

Everything that does not serve this script in weeks 1-4 either moves to weeks 5-8 (go-live hardening) or post-pilot.

---

## MUST -- Weeks 1-4 (12 features, simplified)

These make the demo script work. Nothing else.

### F-01: Intake Form (SIMPLIFIED)

**Was:** 5-7 field form with regulatory scope multi-select, deployment model dropdown, internet-facing toggle.
**Now:** 3 fields. System name (text), description (textarea), data classification (dropdown: Public / Internal / Confidential / Restricted).

**What was cut:**
- Regulatory scope multi-select: Hardcode OSFI B-13 + NIST 800-53. This is a Canadian bank pilot, not a multi-framework platform. Add the multi-select when customer #2 is a non-bank.
- Deployment model dropdown: Not used by the rules engine in a meaningful way at 20 rules. Add when rules reference it.
- Internet-facing toggle: Infer from doc parse, or set as a DFD node property.

**Acceptance criteria:**
- 3 fields, completes in under 1 minute
- Submitting creates a threat model workspace
- Data classification passed to rules engine
- Field values appear in PDF report scope section

---

### F-02: Document Upload and Parsing (SIMPLIFIED)

**Was:** PDF (50 pages) + plain text (100KB).
**Now:** PDF only. 30-page limit.

**What was cut:**
- Plain text support: Priya exports from Confluence to PDF. That is the workflow. Plain text adds a code path for zero pilot value.
- 50-page limit reduced to 30: No bank design doc that matters for threat modeling is 50 pages. The relevant architecture sections are 5-15 pages. If the PDF is 50 pages, 35 pages are appendices.

**Acceptance criteria:**
- Accepts PDF up to 30 pages
- Rejects non-PDF with clear error
- Extracts components with >= 60% recall on 3 reference docs (reduced from 5 -- we have one customer)
- Extraction completes in under 30 seconds for a 20-page PDF
- Zero-extraction case shows empty canvas with guidance
- Uses PyMuPDF + LLM extraction

---

### F-04: DFD Auto-Generation + dagre Layout (KEPT AS-IS)

This is the hero feature. No simplification.

**Acceptance criteria:** Same as original.

---

### F-05: DFD Editor (SIMPLIFIED)

**Was:** Drag, add/delete nodes, add/delete edges, trust boundaries, full property panel with boolean properties driving rule suppression.
**Now:** Drag, add/delete nodes, add/delete edges, trust boundaries. Properties limited to name and type. Full property panel moves to weeks 5-8.

**What was cut:**
- Full property panel (uses_auth, validates_input, uses_mtls, etc.): These drive rule suppression. Without them, rules over-fire. That is acceptable for a demo -- "look at all the threats we found" is a better demo than "look at how precisely we suppressed irrelevant threats." Precision matters for production. Volume demonstrates value for the demo.
- Auto-save with debounce: Keep manual save button for weeks 1-4. Auto-save is polish.

**Acceptance criteria:**
- Drag nodes to reposition
- Add new node (select type, name it)
- Delete node (connected edges also removed)
- Add edge (click source, drag to target)
- Delete edge
- Draw trust boundary around selected nodes
- Click element to see/edit name and type
- Save button persists state

---

### F-07: Rules Engine (SIMPLIFIED)

**Was:** 40 STRIDE rules.
**Now:** 20 STRIDE rules.

**What was cut:**
- 20 rules: The bottom 20 are edge cases and property-dependent rules that require the full property panel (which is deferred). Ship 20 rules that cover: trust boundary crossing (primary trigger), internet-facing elements, credential storage, unencrypted flows. ~3 rules per STRIDE category for common patterns.

**Acceptance criteria:**
- 20 rules implemented and tested
- Rules fire on (source, flow, target) tuples crossing trust boundaries
- Deterministic: same DFD = same output, every time
- Executes in under 500ms for 30-node DFD
- Each threat includes: ID, STRIDE category, description, severity, source="Rules"

---

### F-08: AI Enhancement -- Pass 1 (KEPT AS-IS)

This is the "wow" moment. Without it, this is Microsoft TMT in a browser. No changes.

**Acceptance criteria:** Same as original.

---

### F-10: Threat Table Display (SIMPLIFIED)

**Was:** 8 columns, sort by any column, filter by 4 dimensions.
**Now:** 6 columns, fixed sort (severity descending), filter by STRIDE category only.

**What was cut:**
- Affected Components column: Visible in the DFD. Redundant in the table.
- NIST Controls column inline: Show in compliance section, not cluttering the threat table.
- Sort by any column: Fixed sort by severity descending. Priya wants to see the worst threats first. That is the only sort that matters for a demo.
- Filters beyond STRIDE category: Filter by source (Rules/AI), status, severity -- all deferred. One filter is enough for 20-30 threats.

**Acceptance criteria:**
- Columns: ID, Description, STRIDE Category, Severity (High/Med/Low), Source (Rules/AI badge), Status (Open/Dismissed/Accepted)
- Fixed sort: severity descending
- Filter by STRIDE category
- Threat count shown

---

### F-11: Threat Triage (SIMPLIFIED)

**Was:** Accept, dismiss (with reason code dropdown), edit description, edit severity. All actions logged in audit trail.
**Now:** Accept and dismiss only. Dismiss requires free-text reason. No inline editing. No audit trail logging (deferred to weeks 5-8).

**What was cut:**
- Reason code dropdown: Free-text reason is faster to implement and more flexible. Structured reason codes are a reporting feature. Add when Marcus needs aggregate dismiss reasons across 20+ models.
- Inline description editing: Priya can note corrections in her review. For the pilot, the auto-generated description is the starting point. Editing is week 5-8.
- Inline severity editing: Same logic. Severity from the engine is the starting point.
- Audit trail logging of triage actions: Deferred with the full audit trail to weeks 5-8.

**Acceptance criteria:**
- Accept: one click, status changes to "Accepted"
- Dismiss: requires free-text reason, status changes to "Dismissed"
- Dismissed threats collapse to a "Dismissed" section

---

### F-13: Compliance Lookup (SIMPLIFIED)

**Was:** NIST 800-53 + ISO 27001 mapping, 40-60 entries.
**Now:** NIST 800-53 only. 20 entries covering the 20 rules.

**What was cut:**
- ISO 27001 mapping: EQ Bank's primary framework is NIST. ISO mapping is a lookup table -- pure data entry. Add in week 6 as a day of work.
- 40-60 entries: 20 rules = 20 mapping entries. The other 20-40 entries mapped to rules that do not exist yet.

**Acceptance criteria:**
- Lookup table maps STRIDE category + threat subtype to NIST 800-53 control IDs
- 20 mapping entries covering all 20 rules
- Every threat shows its mapped controls
- Deterministic: same threat type = same controls
- Controls appear in PDF report

---

### F-14: PDF Report (SIMPLIFIED)

**Was:** Full report with auto-generated executive summary, dismissed threats appendix, prompt hashes, methodology section.
**Now:** Title page, scope, DFD image, threat table, compliance mapping, methodology (model version only).

**What was cut:**
- Auto-generated executive summary: Priya writes her own. Auto-generated summaries are a liability -- if the summary says "12 high-severity threats" and the table shows 11, trust is broken. Let Priya write the summary.
- Dismissed threats appendix: She has the data. If needed, she adds a section manually. For the pilot, accepted threats are the deliverable.
- Prompt hash / rules engine version in methodology: Add in week 6 with LLM logging. For the demo, "Generated by ThreatGenix using STRIDE methodology + AI enhancement" is sufficient.

**Acceptance criteria:**
- Sections: Title page (system name, date, classification), Scope (intake fields), DFD diagram (rendered image), Threat table (accepted + open threats), Compliance mapping (per-threat + summary), Methodology (one paragraph)
- Renders in under 10 seconds
- Uses WeasyPrint
- DFD readable at A4/Letter size

---

### F-24: Graceful Degradation (KEPT AS-IS)

If AI fails during the demo, Priya sees a blank screen. This is 2 hours of engineering (timeout check + fallback to rules output). Non-negotiable.

**Acceptance criteria:** Same as original.

---

### F-27: Threat Model CRUD (SIMPLIFIED)

**Was:** Create, open, rename, delete, status workflow (Draft -> In Review -> Complete).
**Now:** Create and open only.

**What was cut:**
- Rename: She names it at creation. If she misspells it, she lives with it for the pilot.
- Delete: 3-5 models in a pilot. She does not need to delete any of them.
- Status workflow: Draft/In Review/Complete is process tooling. The pilot does not have a review workflow. Priya creates, Priya reviews, Priya exports PDF. Status is implicit.

**Acceptance criteria:**
- Completing intake form creates a new threat model
- Home page lists all threat models (flat list, sorted by last updated)
- Click to open (DFD + threats load)

---

## WEEKS 5-8 -- Go-Live Hardening

These are needed before EQ Bank uses ThreatGenix on real systems that produce artifacts entering the risk register. They are NOT needed for the demo.

| # | Feature | When | Notes |
|---|---------|------|-------|
| F-03 | Ephemeral doc handling (24hr delete) | Week 5 | Demo uses sanitized docs. Real docs need this. |
| F-06 | DFD element properties (full panel) | Week 5 | Drives rule suppression. Reduces noise for real use. |
| F-05+ | DFD editor enhancements (auto-save, property-change indicator) | Week 5 | Polish that matters for daily use, not demo. |
| F-07+ | Rules engine expansion (20 -> 40 rules) | Week 5-6 | Requires F-06 properties to suppress correctly. |
| F-11+ | Threat triage enhancements (edit description, edit severity, reason codes) | Week 5 | Needed for real threat model production. |
| F-15 | CSV export | Week 5 | Needed when Priya starts filing Jira tickets for real. |
| F-16 | SSO auth (WorkOS + Entra ID) | Week 6 | Procurement gate for paid deployment. Not pilot gate. Email/password fallback for weeks 1-5. |
| F-13+ | ISO 27001 mapping addition | Week 6 | Data entry. One day of work. |
| F-21 | Action audit trail | Week 6 | OSFI traceability. Needed before go-live. |
| F-22 | LLM call logging | Week 6 | AI governance. Needed for David's architecture review. |
| F-12 | Add custom threats | Week 7 | Priya's escape valve for false negatives. |
| F-19+ | Data residency hardening (VPC endpoints, egress tests) | Week 7 | ca-central-1 deployment from week 1. Formal verification before go-live. |
| F-18 | Per-tenant isolation | Week 7 | Matters at customer #2. Build before EQ Bank goes live so architecture is clean. |

**Infrastructure decisions that are week 1 but not "features":**
- F-19: Deploy in ca-central-1 (Terraform region = "ca-central-1"). Week 1. Zero effort.
- F-20: Encryption at rest + transit. RDS encryption ON, TLS ON. AWS defaults. Week 1. Zero effort.

---

## POST-PILOT -- Does Not Exist Until Pilot Succeeds

| # | Feature | Why it waits |
|---|---------|-------------|
| F-09 | AI Pass 2 (validation) | Pass 1 is sufficient. Priya triages manually, still faster than TMT. Optimization, not necessity. |
| F-17 | RBAC (Admin/Analyst/Reviewer) | ONE user during pilot. Hardcode everyone as admin. Add roles at customer #2 or when Marcus asks. |
| F-23 | SSE streaming | Spinner + "Generating... ~60 seconds" is fine. Priya waits longer for TMT to open. Cosmetic. |
| F-25 | Portfolio dashboard | 3-5 models in a flat list. Dashboard is a reporting feature for 20+ models. |
| F-26 | Confluence workaround doc | 3-line tooltip on upload screen: "Export your Confluence page to PDF, then upload here." Done. |
| F-28 | Data export/delete | Production data portability. Not needed for pilot with sanitized data. Build when David asks. |

---

## Summary

| Phase | Feature count | Eng-weeks (est.) |
|-------|--------------|-----------------|
| MUST (weeks 1-4) | 12 simplified | ~8 (2 eng x 4 wk) |
| Go-live hardening (weeks 5-8) | 13 items | ~8 (2 eng x 4 wk) |
| Post-pilot | 6 | After pilot succeeds |

**Reduction: 26 features (18 P0 + 7 P1 + 1 P2) cut to 12 simplified features for weeks 1-4.**

---

## Controversial Cuts -- Preemptive Defense

**"David will block without SSO."**
David blocks paid deployment without SSO. He does not block a free pilot on sanitized docs using email/password auth. SSO ships week 6, before procurement starts.

**"Per-tenant isolation is P0."**
For customer #2. There is ONE customer. Single-tenant deployment. Clean architecture means adding tenant isolation in week 7 is straightforward.

**"Audit trail is regulatory."**
For production. The pilot is not production. OSFI examines the bank's threat modeling process, not the evaluation tool. The pilot produces a PDF. The PDF enters the risk register. The audit trail matters when the tool is the system of record.

**"LLM logging from week 1."**
Standard application logs capture model calls for debugging. Formal governance logging (prompt hashes, token counts, admin dashboard) is a go-live requirement, not a demo requirement. Week 6.

**"40 rules, not 20."**
20 well-tested rules that fire correctly beat 40 half-tested rules where 20 over-fire because the property panel does not exist yet. Ship 20, add 20 more when the property panel lands in week 5.

---

*The pilot succeeds or fails on one thing: does Priya upload a real design doc and get output she would present to her CISO? Everything else is noise until that question is answered.*
