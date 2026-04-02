# ThreatGenix AI -- Definitive MVP Feature List
**Created:** April 1, 2026
**Status:** CANONICAL. If it is not on this list, it does not get built in the 8-week MVP.
**Constraints:** 2 engineers, 8 weeks. V1 target: challenger banks (EQ Bank, Tangerine).

---

## How to Read This Document

Each feature has:
- **Persona:** Who needs it (Priya = analyst/user, Marcus = director/budget, David = architect/gatekeeper, Samira = CISO/sponsor)
- **Evidence:** Why we believe this persona needs it
- **Acceptance criteria:** Specific, testable. If it passes these, it ships. If it does not, it does not.
- **Priority:** P0 = ship fails without it. P1 = pilot fails without it. P2 = nice but can launch without.

---

## Category 1: Intake and Document Processing

### F-01: Structured Intake Form (P0)

**What it does:** 5-7 field form (system name, description, data classification, deployment model, regulatory scope, public/private) that sets parameters for the threat engine.

**Persona:** Priya (primary), Marcus (secondary)
**Why Priya:** She currently conducts intake calls and manually translates scoping info into TMT parameters. This replaces the verbal-to-manual step. Her quote: "I need it to do the first 80%."
**Why Marcus:** Standardizes intake across analysts. He has inconsistency between Priya and his other analyst.

**Evidence:** Research doc Section 7 specifies these exact fields. Persona doc confirms Priya spends Monday doing intake calls. OSFI B-13 requires documented scope for every threat model.

**Acceptance criteria:**
- Form has exactly these fields: system name (text), description (text area, 500 char max), data classification (dropdown: Public / Internal / Confidential / Restricted), deployment model (dropdown: On-prem / Private Cloud / Public Cloud / Hybrid / SaaS), regulatory scope (multi-select: OSFI B-13 / PCI DSS / PIPEDA / NIST 800-53 / ISO 27001), internet-facing (yes/no)
- Submitting the form creates a threat model workspace
- Data classification value is passed to the rules engine and affects which rules fire
- Form completes in under 2 minutes for a returning user
- All field values appear in the final PDF report "Scope" section

---

### F-02: Document Upload and Parsing (P0)

**What it does:** Upload a PDF or plain text design doc. System extracts components (processes, data stores, external entities), data flows, and infers trust boundaries. Output is structured JSON that feeds DFD generation.

**Persona:** Priya
**Why:** She currently reads 40-page design docs and manually draws DFDs. This is 30-60 minutes of her 3-6 hour workflow. Her quote: "I need it to do the first 80% -- the boilerplate enumeration."

**Evidence:** Research doc Section 8 Step 2. Persona doc: "Can it ingest existing architecture artifacts so she does not have to manually re-draw every DFD?" (Priya's evaluation criterion #2). JPMorgan's Auspex validates this approach.

**Acceptance criteria:**
- Accepts PDF (up to 50 pages) and plain text (up to 100KB)
- Rejects other file types with a clear error message
- Extracts components with >= 70% recall on 5 reference bank architecture docs (measured against gold-standard)
- Extraction completes in under 30 seconds for a 20-page PDF
- Uses PyMuPDF + LLM extraction (locked decision)
- If zero components are extracted, shows empty canvas with guidance: "We could not extract components. Add them manually."
- Uploaded document is deleted within 24 hours of parsing (ephemeral policy)

---

### F-03: Ephemeral Document Handling (P0)

**What it does:** Design doc originals are parsed, extracted, and deleted from storage within 24 hours. A disclaimer is shown on upload confirming this policy.

**Persona:** David (primary), Samira (secondary)
**Why David:** His #1 concern: "What happens to our architecture data when it is inside their system?" Ephemeral handling plus a visible policy directly addresses this.
**Why Samira:** AI governance risk. She needs to know data handling is controlled.

**Evidence:** Anti-pattern #22: "Don't store design docs long-term. Parse, extract, delete within 24 hours." David's persona: "Threat model data is among the most sensitive non-customer data a bank produces." Replaces PII scanner (cut from MVP -- disclaimer + ephemeral policy is sufficient for V1).

**Acceptance criteria:**
- Upload screen shows disclaimer: "Your document will be parsed and deleted within 24 hours. Only extracted architecture data is retained."
- A background job deletes original files from S3 within 24 hours of upload
- Deletion is logged in the audit trail with timestamp
- No original document content is stored in the database (only extracted structured data)

---

## Category 2: DFD Generation and Editing

### F-04: Auto-Generated DFD with Layout (P0)

**What it does:** Generates a data flow diagram from parsed document output. Renders on a React Flow canvas with dagre auto-layout. Shows processes (circles), data stores (parallel lines), external entities (rectangles), data flows (arrows), and trust boundaries (dashed rectangles).

**Persona:** Priya
**Why:** DFD drawing is 30-60 minutes of her current workflow. Auto-generation with corrections is the core time savings. Anti-pattern #3: "Don't let the DFD editor become the product. Editable = must. Best-in-class = trap."

**Evidence:** Research doc Section 8: "Auto-generate DFD, analyst edits" is listed as THE CORE. Security Compass acquired Devici specifically to get AI-generated DFDs from text, validating this approach.

**Acceptance criteria:**
- DFD renders within 5 seconds of extraction completing
- Displays all 3 node types with visually distinct shapes
- Trust boundaries render as dashed rectangles grouping contained nodes
- dagre layout produces a readable left-to-right or top-to-bottom diagram (no overlapping nodes)
- Low-confidence elements (AI was unsure) have dashed borders
- Each element shows its name and type

---

### F-05: DFD Editor -- Core Interactions (P0)

**What it does:** Drag nodes to reposition. Add new nodes (process, data store, external entity). Delete nodes. Add and delete edges (data flows). Draw trust boundaries around groups of nodes. Edit element properties via a side panel.

**Persona:** Priya
**Why:** AI extraction will be ~70-80% accurate. She MUST be able to correct the DFD. Anti-pattern #8: "Don't build read-only output. Editing IS the product."

**Evidence:** Priya's persona: TMT is her current tool despite crashing, because it lets her draw and edit. POC doc: editing listed as core POC feature. Principal engineer review: "Analysts won't trust uneditable diagrams."

**Acceptance criteria:**
- Drag any node to a new position (position persists on save)
- Add a new node: click button, select type, name it, it appears on canvas
- Delete a node: select it, press Delete or click remove button. Connected edges are also removed.
- Add an edge: click source node, drag to target node. Edge appears with a default label.
- Delete an edge: select it, press Delete or click remove
- Draw a trust boundary: select multiple nodes, click "Create Boundary," boundary rectangle appears around them
- Side panel: click any element to open properties. Edit all properties listed in the DFD data model (e.g., for a process: uses_auth, validates_input, uses_mtls, internet_facing, handles_pii)
- Property changes that affect rules engine fire a visual indicator: "Rules may have changed. Click Re-analyze."
- All edits saved to database (no "save" button -- auto-save with debounce)

---

### F-06: DFD Element Properties (P1)

**What it does:** Each DFD element has typed properties that drive the rules engine. Properties are set via the side panel when an element is selected.

**Persona:** Priya, David
**Why Priya:** Properties control which rules fire. Setting `uses_mtls=true` suppresses spoofing threats. This is how she tunes the model to reality.
**Why David:** When he reviews a threat model, he checks whether the DFD properties match the actual architecture. Incorrect properties mean incorrect threats.

**Evidence:** Tech doc DFD Data Model section: properties listed for each element type. Rule schema shows suppress_conditions reference properties. Anti-pattern #9: "Don't ignore noise. 20 high-relevance threats > 80 garbage."

**Acceptance criteria:**
- Process nodes have: uses_auth, validates_input, uses_mtls, runs_as, internet_facing, handles_pii (all boolean or enum)
- Data Store nodes have: encrypted_at_rest, stores_credentials, stores_logs, data_classification, store_type
- External Entity nodes have: authenticates_itself, entity_type (human/system), trust_level
- Data Flow edges have: encrypted_in_transit, protocol, authenticates_source, authenticates_destination, crosses_boundary (auto-set based on trust boundary positions)
- Default values are set by the doc parser where possible; remaining default to "unknown"
- "Unknown" properties generate a visual warning: "Set properties for more accurate threats"

---

## Category 3: Hybrid Threat Engine

### F-07: Rules Engine -- STRIDE Baseline (P0)

**What it does:** For every (source, flow, target) tuple in the DFD, pattern-matches against STRIDE rules. Trust boundary crossing is the primary trigger. Element properties suppress inapplicable threats. Output: deterministic threat list.

**Persona:** Priya (primary), David (secondary), Marcus (secondary)
**Why Priya:** This is the "first 80%" she needs automated. STRIDE enumeration takes her 60-120 minutes per model.
**Why David:** Deterministic output is auditable. He can verify exactly why a threat was generated.
**Why Marcus:** Consistent quality regardless of which analyst runs it. His #3 evaluation criterion.

**Evidence:** Research doc Section 6: STRIDE used by 88% of orgs. Anti-pattern #20: "Don't generate compliance mappings with AI." Same logic applies: deterministic where possible. JPMorgan Auspex generated 9 novel threats per model with a similar approach. Tech doc: "Rules = floor, AI = ceiling."

**Acceptance criteria:**
- 40 STRIDE rules implemented at ship (locked decision; 30 ready for week-4 demo)
- Rules evaluate every (source, flow, target) tuple where the flow crosses a trust boundary
- Rules also fire for elements with specific properties (e.g., internet_facing=true, stores_credentials=true) regardless of boundary crossing
- Property-based suppression works: setting uses_mtls=true on a flow suppresses the corresponding spoofing rule
- Same DFD with same properties produces identical threat output every time (deterministic)
- Rules execute in under 500ms for a DFD with up to 30 nodes and 50 edges
- Each generated threat includes: ID, STRIDE category, description (from template with variable substitution), affected components, severity, source="Rules"
- Rules re-fire automatically within 2 seconds of any DFD edit

---

### F-08: AI Enhancement -- Pass 1 (P0)

**What it does:** Single LLM call (Bedrock Claude, ca-central-1) that receives the DFD + rules output + source doc excerpt. Rewrites generic rules threats with system-specific context. Generates net-new threats rules missed. Each AI threat declares whether it enhances an existing rule threat (by ID) or is net-new.

**Persona:** Priya
**Why:** Rules give completeness but are generic. AI gives context. "The {source} may be spoofed" becomes "The payment-gateway API can be spoofed via forged OAuth tokens from the mobile app, bypassing the API gateway rate limiter." This is what makes ThreatGenix better than TMT.

**Evidence:** JPMorgan Auspex: "+9 novel threats per model" from AI. Research doc: "Copilot, not replacement. Humans must review." Target 50-55% accuracy, which is useful as a starting point.

**Acceptance criteria:**
- Single Bedrock Claude call in ca-central-1 (data residency P0)
- AI threats are visually distinct from rules threats (badge: "AI" vs "Rules")
- Each AI threat that enhances a rules threat shows the original rules threat ID
- Net-new AI threats are clearly marked as "AI-generated"
- Structured JSON output enforced (no freeform prose from LLM)
- If LLM returns invalid JSON: retry once, then fall back to rules-only
- If LLM times out (>30 seconds): fall back to rules-only, show "AI enhancement unavailable" message
- AI pass runs on initial "Generate Threats" action only (not on every DFD edit)
- Analyst can click "Re-analyze" to re-run AI pass after DFD edits

---

### F-09: AI Validation -- Pass 2 (P1)

**What it does:** Second LLM call that validates Pass 1 output against the source document. Checks: do referenced components actually exist? Are claimed data flows real? Scores risk (5x5 matrix: Likelihood x Impact). Flags low-confidence threats for human review.

**Persona:** Priya, David
**Why Priya:** Reduces noise. She currently dismisses 70% of TMT threats as boilerplate. Pass 2 pre-filters the worst hallucinations.
**Why David:** Confidence flagging tells him which AI outputs to scrutinize during his review.

**Evidence:** Tech doc: "Pass 2 validates Pass 1 against source doc." Anti-pattern #31: "Don't let HITL negate the value prop. If triaging AI takes longer than manual, tool is negative value." Pass 2 reduces triage burden.

**Acceptance criteria:**
- Runs after Pass 1 completes (not in parallel -- sequential)
- Added in week 6 (locked decision: single pass weeks 1-5, add Pass 2 in week 6)
- Validates that components referenced in AI threats exist in the DFD
- Produces a 5x5 risk score (Likelihood 1-5 x Impact 1-5) for each threat
- Flags threats with confidence < 0.5 as "Low Confidence" with dashed border in threat table
- Low-confidence threats sorted to bottom of threat table by default
- If Pass 2 fails or times out: Pass 1 results shown without validation (graceful degradation)

---

## Category 4: Threat Table

### F-10: Threat Table Display (P0)

**What it does:** Tabular view of all generated threats. Columns: ID, Threat Description, STRIDE Category, Affected Components, Severity (High/Med/Low initially, 5x5 score after Pass 2), NIST Controls, Source (Rules/AI/AI+Rules), Status (Open/Dismissed/Accepted).

**Persona:** Priya (primary), David (secondary)
**Why Priya:** This is her primary workspace. She spends 60-120 minutes per model reviewing, editing, and triaging threats.
**Why David:** He reviews threat tables during his quality gate. He needs to quickly assess completeness and accuracy.

**Evidence:** POC doc Section 4. Research doc: "Analyst reviews, edits, approves. We accelerate, not replace."

**Acceptance criteria:**
- All columns listed above are visible
- Source column shows badge: "Rules" (blue), "AI" (purple), "AI+Rules" (teal)
- Status defaults to "Open" for all new threats
- Sort by any column (click column header)
- Filter by: STRIDE category, source (Rules/AI), status (Open/Dismissed/Accepted), severity
- Threat count shown: "Showing X of Y threats"

---

### F-11: Threat Triage -- Accept, Dismiss, Edit (P0)

**What it does:** Analyst can accept a threat (confirms it is valid), dismiss it (with mandatory reason code), or edit the description and severity.

**Persona:** Priya
**Why:** This is the core interaction. ThreatGenix produces a draft. Priya produces the threat model. Without triage, the output is just a list, not a reviewed artifact.

**Evidence:** Anti-pattern #4: "Don't build smart threat dismissal. Force reason codes." Anti-pattern #35: "Don't build explicit feedback loops. Instrument implicit signals: what they accept/edit/delete/add."

**Acceptance criteria:**
- Accept: one-click, changes status to "Accepted," adds analyst name and timestamp
- Dismiss: requires selecting one reason code from: Not Applicable / Already Mitigated / Below Risk Threshold / Duplicate. Reason is stored and appears in audit trail and PDF report.
- Edit description: inline text editing, saves on blur
- Edit severity: dropdown change, saves immediately
- All triage actions logged in audit trail (who, what, when, previous value, new value)
- Dismissed threats move to a "Dismissed" section (collapsed by default, expandable)

---

### F-12: Add Custom Threats (P1)

**What it does:** Analyst can manually add a threat that neither rules nor AI generated.

**Persona:** Priya
**Why:** She catches things the engine misses. If she cannot add them in the tool, she exports to Word and adds them there -- and never comes back. Anti-pattern #8.

**Evidence:** Anti-pattern #32: "False negatives are 10x worse than false positives." Custom threat addition is the analyst's escape valve for false negatives. POC doc explicitly lists this as MVP (not POC) feature.

**Acceptance criteria:**
- "Add Threat" button in threat table
- Form fields: description (required), STRIDE category (required dropdown), affected components (multi-select from DFD elements), severity (required dropdown)
- Custom threats have source = "Manual"
- Custom threats appear in PDF report identically to other threats
- Custom threats are included in CSV export

---

## Category 5: Compliance Mapping

### F-13: Deterministic Compliance Lookup (P0)

**What it does:** Maps each threat's STRIDE category + subtype to NIST 800-53 and ISO 27001 control IDs using a lookup table. No AI. 100% accuracy required.

**Persona:** Priya (primary), Marcus (secondary), David (secondary)
**Why Priya:** Control mapping takes her 30-60 minutes per model. Lookup tables do it instantly.
**Why Marcus:** OSFI B-13 requires traceability: threats to mitigations to evidence. This is the "mitigations" piece.
**Why David:** He audits control mappings. If one is wrong, he rejects the model. Deterministic = verifiable.

**Evidence:** Anti-pattern #20: "Don't generate compliance mappings with AI. One wrong NIST control ID = regulatory problem. Lookup tables. Always." Tech doc Layer 3. Research doc: "Banks use Unified Control Framework."

**Acceptance criteria:**
- Lookup table maps STRIDE category + threat subtype to NIST 800-53 control IDs
- Lookup table also maps to ISO 27001 control IDs
- 40-60 mapping entries covering all 40 MVP rules
- Every threat in the threat table shows its mapped controls
- Controls display as clickable IDs that show the control name on hover
- 100% accuracy: every mapping manually audited before ship
- Mapping is deterministic: same threat type always produces same controls
- Controls appear in PDF report per-threat and in a summary compliance table

---

## Category 6: Export and Reporting

### F-14: PDF Report Export (P0)

**What it does:** One-click export generates a PDF report containing: executive summary, system scope (from intake form), DFD diagram (rendered as image), threat table with triage status, compliance mapping table, risk summary, timestamps, and model metadata.

**Persona:** Priya (primary), Marcus (secondary), Samira (indirect)
**Why Priya:** "Does it generate reports that meet OSFI expectations? If she has to reformat everything into her bank's template anyway, the tool adds friction." (Priya evaluation criterion #3)
**Why Marcus:** He uses these reports for OSFI evidence packages. He currently assembles them in PowerPoint. A ready-made PDF saves him weeks of prep.
**Why Samira:** The PDF is what she sees when Marcus presents to the Board Risk Committee.

**Evidence:** Research doc Section 6: "What auditors check: documented threats + countermeasures, DFD with trust boundaries, timestamp within audit period, system-specific not generic, traceability." Anti-pattern #6: "Don't build a report template engine. Hardcode formats."

**Acceptance criteria:**
- 1 PDF template (locked decision)
- Sections in order: Title page (system name, date, analyst, classification), Executive Summary (auto-generated: X threats identified, Y accepted, Z dismissed, top 3 by severity), Scope (intake form fields), DFD Diagram (rendered image of current DFD state), Threat Table (all accepted + open threats with full detail; dismissed threats in appendix with reason codes), Compliance Mapping (per-threat controls + summary table), Methodology (states STRIDE + rules version + AI model version)
- PDF renders in under 10 seconds
- Uses WeasyPrint (locked decision)
- DFD diagram in PDF is readable at A4/Letter size
- All timestamps in Eastern Time (bank's timezone)
- Report includes: prompt hash, rules engine version, AI model version (provenance per anti-pattern #33)
- PDF passes visual review: "An analyst would present this to their CISO without reformatting"

---

### F-15: CSV Threat Export (P0)

**What it does:** Export the threat table as CSV for manual Jira import.

**Persona:** Priya
**Why:** She currently copies threat IDs into Jira tickets manually. CSV export lets her bulk-import. This is the V1 remediation workflow. Jira API is V1.5.

**Evidence:** Research doc Section 8: "Export to Jira (V1: CSV, V2: API)." Locked decision: CSV, not Jira API.

**Acceptance criteria:**
- CSV columns: Threat ID, Description, STRIDE Category, Affected Components, Severity, Risk Score (if Pass 2), NIST Controls, ISO Controls, Status, Dismiss Reason (if dismissed), Source
- One row per threat
- UTF-8 encoding, comma-delimited, quoted strings
- Download triggers immediately (no async generation)
- File name: `{system-name}_threats_{date}.csv`

---

## Category 7: Authentication, Authorization, and Tenancy

### F-16: SSO Authentication via WorkOS (P0)

**What it does:** SAML SSO login with Entra ID (Azure AD) via WorkOS. MFA enforced. Session management with configurable timeout.

**Persona:** David (primary), Marcus (secondary)
**Why David:** "Must support SAML 2.0 or OIDC SSO. Must support MFA." This is his dealbreaker #4. No SSO = procurement rejects the tool.
**Why Marcus:** He needs to demonstrate to procurement that the tool meets identity standards.

**Evidence:** Anti-pattern #23: "Don't build your own auth. WorkOS or Auth0. Banks need SAML SSO with Entra ID." David's persona: SSO is a dealbreaker. Marcus's persona: "No SSO support" listed as explicit dealbreaker.

**Acceptance criteria:**
- WorkOS integration supporting SAML 2.0 with Entra ID
- MFA enforced (WorkOS handles this)
- Session timeout configurable per tenant (default 30 minutes of inactivity)
- Logout button in UI, clears session server-side
- Login page branded with ThreatGenix (not generic WorkOS)
- Fallback: if WorkOS integration is blocked during pilot, email/password auth is available (anti-pattern #23 allows this as temporary fallback)

---

### F-17: Role-Based Access Control (P1)

**What it does:** Three roles: Admin (manage tenant settings, users), Analyst (full CRUD on threat models), Reviewer (read-only access to threat models and reports).

**Persona:** Marcus (primary), David (secondary)
**Why Marcus:** He manages a team. He needs to give Priya analyst access and give himself and David reviewer access.
**Why David:** He reviews threat models but should not accidentally edit them. Read-only role protects integrity.

**Evidence:** POC/MVP doc: "Role-based access: Admin, Analyst, Reviewer (read-only)." David's persona: "RBAC -- not all analysts should see all threat models."

**Acceptance criteria:**
- Admin can: invite users, assign roles, view all threat models, edit tenant settings
- Analyst can: create, edit, delete threat models they own; view all threat models in their tenant
- Reviewer can: view threat models, export PDF/CSV. Cannot edit DFD, threats, or triage.
- Role is assigned at invite time and changeable by Admin
- Unauthorized actions return 403 and show "You do not have permission" in UI

---

### F-18: Per-Tenant Data Isolation (P0)

**What it does:** Each customer gets a separate PostgreSQL schema and S3 prefix. Tenant context enforced on every API call via middleware. No cross-tenant data access possible.

**Persona:** David (primary), Samira (secondary)
**Why David:** "Airtight tenant isolation from day one." His architecture review will specifically test cross-tenant access.
**Why Samira:** A cross-tenant data leak is a breach. Breach = existential.

**Evidence:** Tech doc: "PostgreSQL per-tenant schemas. Row-level security as backup." Anti-pattern #41: "Your threat model DB IS a high-value attack target."

**Acceptance criteria:**
- Each tenant gets a dedicated PostgreSQL schema (not just row-level filtering)
- Each tenant gets a dedicated S3 prefix with bucket policy enforcement
- API middleware extracts tenant ID from authenticated session and scopes all queries
- Cross-tenant access test: authenticated user in Tenant A cannot access any data from Tenant B (returns 404, not 403 -- do not confirm resource existence)
- Tenant ID logged on every API request in audit trail

---

## Category 8: Data Residency and Security

### F-19: Canada-Only Data Residency (P0)

**What it does:** All infrastructure, data storage, LLM inference, and observability in AWS ca-central-1. No data transits to any US or other non-Canadian region.

**Persona:** David (primary), Samira (secondary), Priya (tertiary)
**Why David:** "Where exactly is the data? Which AWS region? Does telemetry or logging data leave Canada?" This is his #2 evaluation criterion.
**Why Samira:** AI governance risk if data leaves Canada.
**Why Priya:** "Data residency: Does data stay in Canada? If it leaves ca-central-1, it is a non-starter." (Priya dealbreaker)

**Evidence:** Anti-pattern #39: "Don't send design docs to US-based AI APIs. Use AWS Bedrock in ca-central-1." Every persona lists data residency as a hard requirement. This is the single most unanimous requirement across all personas.

**Acceptance criteria:**
- All AWS resources deployed in ca-central-1 only (hardcoded in Terraform, no variable)
- LLM inference via AWS Bedrock in ca-central-1
- VPC endpoints for S3, Bedrock, RDS (no public internet transit for internal services)
- Egress gateway allowlist: only ca-central-1 AWS endpoints
- Observability tools either self-hosted in ca-central-1 or Canadian-region only
- Verified by egress test: no traffic leaves ca-central-1 (automated test in CI/CD)
- Zero data retention on LLM calls (contractual with AWS Bedrock)

---

### F-20: Encryption at Rest and in Transit (P0)

**What it does:** AES-256 encryption at rest via AWS KMS. TLS 1.2+ in transit. Single KMS key for V1 (per-tenant keys from customer #4).

**Persona:** David
**Why:** "Encryption details (AES-256 at rest, TLS 1.3 in transit, key management approach)" -- explicitly in his evaluation checklist.

**Evidence:** Tech doc security section. David's persona evaluation criteria #1.

**Acceptance criteria:**
- PostgreSQL encrypted at rest with AES-256 via RDS encryption (KMS-managed key)
- S3 bucket encrypted at rest with AES-256 via SSE-KMS
- All API traffic over TLS 1.2 or higher
- KMS key is AWS-managed for V1 (customer-managed keys documented as V1.5 roadmap item)
- No unencrypted data at rest anywhere in the system

---

## Category 9: Audit Trail and Observability

### F-21: Action Audit Trail (P0)

**What it does:** Logs every user action: threat model created/edited, DFD modified, threat triaged (with before/after values), report exported, document uploaded/deleted. Exportable as CSV for GRC review.

**Persona:** Marcus (primary), David (secondary), Samira (indirect)
**Why Marcus:** OSFI examiners check traceability: threats to mitigations to evidence. The audit trail IS the evidence. His persona: "He spends 2-3 weeks before each review assembling evidence."
**Why David:** He reviews threat model quality. The audit trail shows who made what decisions and when.

**Evidence:** Anti-pattern #33: "Audit trail for every AI recommendation from day one. OSFI requires provenance." POC/MVP doc: "Every action logged: who, what, when."

**Acceptance criteria:**
- Every API write operation logged: user ID, tenant ID, action type, resource ID, timestamp, before-value, after-value
- Threat triage logs: threat ID, previous status, new status, reason code (if dismissed), user ID, timestamp
- Document lifecycle logs: uploaded, parsed, deleted
- Audit log viewable by Admin role in UI (table with filters by date range, user, action type)
- Audit log exportable as CSV
- Audit log entries are append-only (no editing or deleting audit records)
- Audit log retained for duration of tenant account (no automatic purge in V1)

---

### F-22: LLM Call Logging (P0)

**What it does:** Every LLM call is logged from week 1: prompt hash (not full prompt -- contains sensitive data), response hash, model version, token count (input + output), latency, success/failure, tenant ID.

**Persona:** Marcus (primary), David (secondary)
**Why Marcus:** Cost tracking and AI governance. He needs to answer: "How much are we spending on AI per threat model?" and "Can we show OSFI that AI usage is governed?"
**Why David:** AI model transparency. He needs to verify: which model, what data was sent, was training opt-out enforced?

**Evidence:** Flagged as ADD item in orchestrator review: "Basic LLM call logging from week 1 (audit trail anti-pattern)." Anti-pattern #33: "Model version, input hash, confidence, analyst action, timestamp."

**Acceptance criteria:**
- Every Bedrock API call logged: timestamp, model ID, model version, input token count, output token count, latency (ms), HTTP status code, prompt hash (SHA-256), response hash (SHA-256), tenant ID, threat model ID
- Full prompts are NOT stored (they contain architecture data). Only hashes for correlation.
- Log entries viewable by Admin role in a dedicated "AI Usage" page
- Summary metrics displayed: total calls this month, total tokens, average latency, failure rate
- Logs exportable as CSV
- Implemented from week 1 (not retrofitted later)

---

## Category 10: Infrastructure and Streaming

### F-23: SSE Streaming for Pipeline Progress (P1)

**What it does:** Server-sent events stream pipeline progress to the frontend during the doc parse + threat generation flow (which takes 30-90 seconds). Shows: "Parsing document... Extracting components... Generating DFD... Running rules... AI analyzing... Complete."

**Persona:** Priya
**Why:** A 30-90 second wait with a spinner feels broken. Streaming progress maintains trust and shows the system is working.

**Evidence:** Tech doc decisions: "UX: Page load -> SSE streaming. 30-90 sec pipeline needs progress." Anti-pattern #45: "First session must produce useful artifact in <30 minutes."

**Acceptance criteria:**
- SSE endpoint streams status messages as the pipeline progresses
- Minimum 5 distinct status messages during a full pipeline run
- Frontend shows current step with a progress indicator (not a spinner)
- If any step fails, the error message is streamed and displayed (not a silent failure)
- Threat results stream in as they are generated (rules results appear before AI results)

---

### F-24: Graceful Degradation on AI Failure (P0)

**What it does:** If AI (Pass 1 or Pass 2) fails, times out, or returns invalid output, the system falls back to rules-only results. Analyst always gets deterministic rules output regardless of AI availability.

**Persona:** Priya
**Why:** She cannot be blocked by AI flakiness. Rules-only output is still valuable -- it is what TMT gives her today, but faster and with compliance mapping.

**Evidence:** Tech doc error handling table. Anti-pattern #31: rules baseline always available. "AI fails -> analyst still has rules baseline."

**Acceptance criteria:**
- LLM invalid JSON: retry once, then return rules-only results with message "AI enhancement unavailable. Showing rules-based analysis."
- LLM timeout (>30 seconds): return rules-only results with same message
- Bedrock service unavailable: return rules-only results with same message
- "Re-analyze" button available to retry AI after failure
- Rules-only results are never blocked or delayed by AI processing

---

## Category 11: Portfolio and Metrics

### F-25: Portfolio Dashboard (P1)

**What it does:** Landing page after login showing: total threat models (count), models by status (draft/in-review/complete), open findings count (unresolved threats across all models), recently updated models. Simple table + summary cards.

**Persona:** Marcus (primary)
**Why:** He reports monthly to the CISO on: models completed vs. target, open findings, coverage percentage. He currently assembles this in Excel. This gives him a live view.

**Evidence:** Flagged as ADD item in orchestrator review: "Portfolio dashboard (model count, open findings -- Marcus needs this for OSFI)." Marcus's persona: "Monthly security metrics to the CISO. He tracks: number of threat models completed vs. target, open high/critical findings." Anti-pattern #44: "Don't measure logins. Measure: threat acceptance rate, output entering risk registers."

**Acceptance criteria:**
- Dashboard is the landing page after login
- Summary cards: Total Models (count), Models Complete (count), Open High/Critical Findings (count), Models Updated This Month (count)
- Table: all threat models sorted by last-updated. Columns: system name, status (Draft/In Review/Complete), created date, last updated, threat count, open findings count, analyst name
- Click any row to open that threat model
- Data updates on page load (no real-time refresh needed)
- Loads in under 2 seconds for up to 100 threat models

---

## Category 12: Pilot Support

### F-26: Confluence-to-PDF Workaround Documentation (P2)

**What it does:** A help page or in-app guide explaining how to export a Confluence page to PDF and upload it to ThreatGenix, since V1 does not support direct Confluence integration.

**Persona:** Priya
**Why:** Most bank design docs live in Confluence. V1 only accepts PDF/text upload. Without this workaround doc, Priya hits a wall on her first real use.

**Evidence:** Flagged as ADD item in orchestrator review: "Pilot workaround doc for Confluence -> PDF export." Priya's persona: "Confluence docs" are her primary artifact source.

**Acceptance criteria:**
- In-app help section (or tooltip on upload page) with step-by-step: "To import from Confluence: 1. Open your Confluence page. 2. Click ... > Export to PDF. 3. Upload the PDF here."
- Includes note: "Direct Confluence integration is on our roadmap."
- Maximum 5 steps, with screenshots or illustrations
- Accessible from the document upload screen

---

## Category 13: Threat Model Workspace Management

### F-27: Threat Model CRUD (P0)

**What it does:** Create a new threat model (via intake form), open an existing one, rename it, delete it (with confirmation). List all threat models for the tenant.

**Persona:** Priya, Marcus
**Why Priya:** She manages 12-15 active models per year. She needs to find and reopen them.
**Why Marcus:** He needs visibility into all models across his team.

**Acceptance criteria:**
- Create: completing the intake form creates a new threat model in "Draft" status
- List: all threat models for the tenant shown on the portfolio dashboard
- Open: click to open any model (DFD + threat table + properties load)
- Rename: editable system name field in the threat model view
- Delete: confirmation dialog ("This will permanently delete this threat model and all associated data. This cannot be undone."), Admin and owning Analyst only
- Status workflow: Draft -> In Review -> Complete (manual status change via dropdown)

---

### F-28: Customer Data Export and Delete (P1)

**What it does:** Tenant admin can export all their data (threat models, DFDs, threat tables, audit logs) as a ZIP of JSON + CSV files, and request full tenant data deletion.

**Persona:** David (primary), Marcus (secondary)
**Why David:** "Data portability. Export formats. API access to extract data programmatically." His evaluation criterion #4. Also his fear: "If the vendor goes under, can they export everything?"
**Why Marcus:** Regulatory requirement under PIPEDA. Also reduces his vendor risk concern.

**Evidence:** Tech doc security section: "Customer export-and-delete (nothing persists if unwanted)." David's persona: data portability is a dealbreaker criterion.

**Acceptance criteria:**
- Admin can trigger "Export All Data" from tenant settings
- Export produces a ZIP containing: threat_models.json (all models with full detail), threat_tables.csv (all threats across all models), dfd_data.json (all DFD structures), audit_log.csv (full audit trail)
- Export download available within 5 minutes for up to 100 threat models
- Admin can request "Delete All Data" -- confirmation dialog with typed confirmation ("DELETE"), then all tenant data purged within 72 hours
- Deletion logged in a separate system-level audit log (not the tenant's own audit log, which is being deleted)

---

## Summary: Feature Count by Priority

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 18 | Ship literally fails without these |
| **P1** | 7 | Pilot with EQ Bank fails without these |
| **P2** | 1 | Nice to have, can launch without |
| **Total** | 26 | |

### P0 Features (Must Ship)
F-01 Intake Form, F-02 Doc Upload/Parse, F-03 Ephemeral Doc Handling, F-04 DFD Auto-Generation, F-05 DFD Editor, F-07 Rules Engine, F-08 AI Pass 1, F-10 Threat Table Display, F-11 Threat Triage, F-13 Compliance Lookup, F-14 PDF Report, F-15 CSV Export, F-16 SSO Auth, F-18 Tenant Isolation, F-19 Data Residency, F-20 Encryption, F-21 Action Audit Trail, F-22 LLM Call Logging, F-24 Graceful Degradation, F-27 Threat Model CRUD

### P1 Features (Must Have for Pilot)
F-06 DFD Element Properties, F-09 AI Pass 2, F-12 Add Custom Threats, F-17 RBAC, F-23 SSE Streaming, F-25 Portfolio Dashboard, F-28 Data Export/Delete

### P2 Features (Nice to Have)
F-26 Confluence Workaround Doc

---

## Locked Technical Decisions (Not Features -- Constraints)

These are not features to build. They are decisions already made that constrain implementation:

| Decision | Detail |
|----------|--------|
| Rules count | 40 STRIDE rules for MVP (30 for week-4 demo) |
| AI passes | Single pass weeks 1-5, add Pass 2 in week 6 |
| Doc parsing | PyMuPDF + LLM extraction |
| Pricing | $24K/year flat team license |
| PDF templates | 1 template |
| Remediation export | CSV (not Jira API) |
| LLM provider | Claude via AWS Bedrock, ca-central-1 |
| Auth provider | WorkOS |
| Frontend | React + Vite + React Flow + dagre |
| Backend | FastAPI + SSE |
| Database | PostgreSQL per-tenant schemas |
| PDF generation | WeasyPrint |
| Orchestration | Plain async Python (not LangGraph) |

---

## EXPLICITLY OUT OF MVP (and Why)

These items were considered and deliberately excluded. If someone proposes adding any of these, point them to this section.

### Cut by Orchestrator Review (Scope Creep)

| Feature | Why it is out |
|---------|--------------|
| **Banking element palette** (core banking, payment gateway presets) | No customer asked for it. Priya can add nodes manually with correct names. Zero interview evidence. Premature abstraction. |
| **Undo/redo with full history** | Browser undo (Ctrl+Z) handles text fields. React Flow supports single-level undo. Full history stack is 3-5 days of engineering for a feature analysts did not request. |
| **Version history / DFD snapshots** | No workflow in V1 that requires comparing DFD versions. Audit trail logs changes. Snapshot UI is 5+ days. Build when customers ask. |
| **Source annotations on elements** (bidirectional doc-to-DFD mapping) | Requires maintaining a mapping between parsed doc sections and DFD elements. Complex, fragile when DFD is edited. V1.5 after doc parsing stabilizes. |
| **Batch property editing** (select multiple nodes, set property) | Only useful with 15+ nodes. Most V1 DFDs will have 5-12 nodes. Individual property editing is sufficient. Build when DFDs get larger. |
| **3 PDF templates** | 1 template is enough for MVP. Banks will request specific formatting once they are paying customers. Add templates per customer request. |
| **PII scanner on upload** | Ephemeral doc handling (F-03) plus the upload disclaimer mitigates this risk sufficiently. PII scanning is a separate engineering effort (regex for IPs, NER for names) that delays launch. V1.5. |
| **Token budget alerts per tenant** | Only 1 customer at launch. LLM cost logging (F-22) gives visibility. Alerts are premature before there are multiple tenants with varying usage. |
| **"Criticality" field in intake form** | No risk acceptance workflow in V1. Criticality drives "who can accept risk" decisions, which require an approval workflow we are not building. The field has no downstream effect. |

### Already Excluded in Prior Docs

| Feature | Why it is out | When |
|---------|--------------|------|
| Jira API integration | CSV export sufficient. OAuth complexity adds 1-2 weeks. | V1.5 (month 4-5) |
| Word/Docx export | Banks want PDF for audit. Word is nice-to-have. | V1.5 |
| Confluence/SharePoint live upload | Text/PDF upload covers 80%. Live integrations are scope creep. | V2 |
| Image/diagram parsing | Too hard at current accuracy levels. Analyst draws or corrects DFD. | V2 |
| Attack chains | Compounds errors at 50-55% accuracy. Net-new threats from Pass 1 are sufficient. | V2 |
| Approval workflows | Analyst -> Director -> CISO sign-off. Important but not blocking for pilot. | V2 |
| Remediation tracking | V1 just exports tickets. Tracking requires Jira integration. | V2 |
| Code/IaC integration | Terraform/CloudFormation parsing. High interview signal but weeks of work. | V2 |
| Multi-methodology (PASTA, LINDDUN) | STRIDE only for V1. 88% of orgs use STRIDE. | V2 |
| Shareable review links | External sharing requires separate auth flow. Reviewer role handles internal sharing. | V1.5 |
| Custom report templates | Hardcode 1 template. Add per customer request after first sale. | V1.5 |
| Cross-customer threat intelligence | Network effect feature. Requires multiple customers. | V3 |
| Self-hosted deployment | Required for Big 5 banks. SaaS-only for challengers. | V3 |
| .tm7 import | Anti-pattern #10: "Nobody migrates old models." Every model is for a new/changed system. | Never (unless strong signal) |

---

## Week 8 Exit Criteria (Ship/No-Ship)

These are the acceptance tests for the MVP as a whole. All must pass.

1. Upload a real bank design doc (PDF, 15+ pages) and get a DFD generated in under 30 seconds
2. Analyst corrects the DFD to match the real architecture in under 10 minutes
3. Threat engine produces >= 60% recall, >= 50% precision on 5 reference architectures
4. Compliance mappings are 100% correct (manual audit of every mapping entry)
5. Full audit trail: every action, every LLM call, every threat decision logged and exportable
6. PDF report passes visual review: "I would present this to my CISO without reformatting"
7. Data residency verified: automated egress test confirms no traffic leaves ca-central-1
8. Tenant isolation verified: cross-tenant access test returns 404 on all endpoints
9. SSO login works via Entra ID test tenant
10. End-to-end: doc upload to reviewed draft threat model in under 30 minutes (analyst time, not wall clock)

---

*This is the canonical feature list. If it is not on this list, it does not get built in the 8-week MVP. No exceptions without updating this document and re-running the scope review.*
