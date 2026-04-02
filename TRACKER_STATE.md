# ThreatGenix Tracker State
**Last updated:** 2026-04-01
**Updated by:** Session 5 — F-05, F-24, F-14 complete. All 12 features done. 65 E2E tests passing.
**Current week:** 1 of 8 (Day 1)
**Overall status:** ALL 12 LEAN PILOT FEATURES COMPLETE — 12/12

---

## Progress

### Features (Lean Pilot Scope -- Weeks 1-4)
| Feature | Status | Blocks Done | Blocks Total | Blockers | Notes |
|---------|--------|-------------|--------------|----------|-------|
| F-27: Threat Model CRUD | COMPLETE | 5 | 5 | -- | 3 endpoints, service layer, 7 tests passing |
| F-01: Intake Form | COMPLETE | 2 | 2 | -- | 3-field form, submit, navigation |
| F-02: Doc Upload & Parse | COMPLETE | 10 | 10 | -- | PDF validate, text extract, LLM extraction (Bedrock tool_use), upload endpoint, 6 tests |
| F-04: DFD Auto-Gen | COMPLETE | 10 | 10 | -- | DFD generator, layout engine, custom nodes, trust boundaries, DFDCanvas, 13 tests |
| F-05: DFD Editor | COMPLETE | 13 | 13 | -- | 4 backend CRUD blocks + 9 frontend editor blocks. 61 E2E tests. QA GATE: PASS |
| F-07: Rules Engine | COMPLETE | 8 | 8 | -- | 20 STRIDE rules, boundary crossing, deterministic engine, 119 tests |
| F-08: AI Enhancement | COMPLETE | 4 | 4 | -- | AI pass (Bedrock), threat merger, analyze endpoint, graceful degradation |
| F-10: Threat Table | COMPLETE | 6 | 6 | -- | STRIDE filter, summary, ThreatTable, StrideFilter, GenerateButton, page wiring |
| F-11: Threat Triage | COMPLETE | 4 | 4 | -- | PATCH triage endpoint, ThreatTriageModal, status indicators |
| F-13: Compliance Lookup | COMPLETE | 4 | 4 | -- | Compliance service, API, threat_subtype integration, batch lookup |
| F-14: PDF Report | COMPLETE | 5 | 5 | -- | WeasyPrint+Jinja2, GET /report endpoint, Export PDF button. QA GATE: PASS |
| F-24: Graceful Degradation | COMPLETE | 2 | 2 | -- | ai_skipped_reason field, frontend warning banner. QA GATE: PASS |

### Blocks Completed (Session 3)
| Block | Agent | Feature | Description | Status |
|-------|-------|---------|-------------|--------|
| B1 | backend-builder | F-27 | create_threat_model service | DONE |
| B2 | backend-builder | F-27 | list_threat_models service with threat_count JOIN | DONE |
| B3 | backend-builder | F-27 | get_threat_model service | DONE |
| B4 | backend-builder | F-27 | API route handlers POST/GET/GET-by-ID | DONE |
| B5 | backend-builder | F-27 | Router registration in main.py | DONE |
| F1 | frontend-builder | F-01 | IntakeForm component with 4 states | DONE |
| F2 | frontend-builder | F-01 | HomePage wiring with navigation | DONE |

### Blocks Completed (Session 4)
| Block | Agent | Feature | Description | Status |
|-------|-------|---------|-------------|--------|
| B6 | backend-builder | F-02 | doc_parser.py — validate_pdf + extract_text (PyMuPDF) | DONE |
| B7 | ai-builder | F-02 | ai_extraction.py — LLM prompt v1.0, Bedrock tool_use, banking terms | DONE |
| B8 | backend-builder | F-02 | bedrock_client.py — Converse API wrapper, ca-central-1 | DONE |
| B9 | backend-builder | F-02 | documents.py API — upload endpoint (validate→extract→LLM→store→DFD) | DONE |
| B10 | backend-builder | F-04 | dfd_generator.py — normalize_name, resolve_node, generate_dfd_from_parse_result | DONE |
| B11 | backend-builder | F-04 | dfd_layout.py — compute_layout (rank-based, dagre is JS-only) | DONE |
| B12 | backend-builder | F-04 | dfd.py API — GET DFD endpoint | DONE |
| F3 | frontend-builder | F-04 | DFDNodeTypes.tsx — Process, DataStore, ExternalEntity custom nodes | DONE |
| F4 | frontend-builder | F-04 | TrustBoundaryNode.tsx — dashed border group node + buildBoundaryNodes | DONE |
| F5 | frontend-builder | F-04 | DFDCanvas.tsx — ReactFlow + dagre layout + 4 states + view mode | DONE |
| F6 | frontend-builder | F-02 | DocumentUpload.tsx — file upload with 4 states | DONE |
| F7 | frontend-builder | F-02/F-04 | ThreatModelPage.tsx — wired upload + DFDCanvas with key remount | DONE |

### Infrastructure (Day 0)
| Component | Status | Notes |
|-----------|--------|-------|
| Docker Compose (Postgres + backend + frontend) | CODE EXISTS | Reviewed as part of F-27 work |
| FastAPI app shell (main.py, config, database) | VERIFIED | Router registered, endpoints working |
| SQLAlchemy models (6 models) | VERIFIED | Used in F-27 service layer |
| Pydantic schemas (20+ files) | VERIFIED | Used in F-27 endpoints |
| Alembic config | CODE EXISTS | No migration generated yet |
| Vite + React + TypeScript frontend | VERIFIED | IntakeForm and HomePage working |
| API client stub | CODE EXISTS | Not reviewed |
| Seed data | CODE EXISTS | Not reviewed |
| CI workflow (GitHub Actions) | CODE EXISTS | Not reviewed |
| Health check test | CODE EXISTS | Not reviewed |

### Velocity
- **Blocks completed this session:** 20 (13 F-05 + 2 F-24 + 5 F-14)
- **Blocks completed total:** 65
- **E2E tests:** 65 passing (QA gatekeeper)
- **Unit tests:** 179+ passing
- **Target velocity:** ~4.25 blocks/day
- **Actual velocity:** 65 blocks in Day 1 (15x target velocity)
- **Status:** ALL 12 FEATURES COMPLETE. Weeks 1-4 scope delivered in Day 1.

---

## Active Blockers

1. **BLOCKER-002: RESOLVED** — F-02 and F-04 decomposed and implemented. Remaining features (F-05 through F-24) still need decomposition before implementation.

2. **BLOCKER-003: PARTIALLY RESOLVED** — dagre config locked (LR, nodesep=80, ranksep=120), trust boundary strategy implemented (group nodes with dashed borders), Bedrock client created (ca-central-1). Remaining pre-Day 0 items need verification as features require them.

---

## Decision Log

### D-001: Lean scope -- 12 features, not 26 (2026-04-01)
**Context:** Initial MVP had 26 features. User said "go leaner."
**Decision:** 12 simplified features for weeks 1-4. 13 go-live hardening items for weeks 5-8. 6 post-pilot.
**Rationale:** 2 engineers, 8 weeks, 1 customer (EQ Bank), 1 user (Priya). Everything serves the demo script: upload doc, see DFD, edit, generate threats, see compliance, export PDF.
**Alternatives rejected:** Full 26-feature scope (impossible in 8 weeks at quality).
**Revisit when:** Pilot succeeds and customer #2 appears.

### D-002: 20 rules, not 40 (2026-04-01)
**Context:** Bottom 20 rules depend on element properties (uses_auth, validates_input) that require the full property panel (deferred to week 5).
**Decision:** Ship 20 well-tested rules. Add 20 more when property panel lands.
**Rationale:** 20 correct rules > 40 noisy rules for demo.
**Revisit when:** Property panel ships (week 5).

### D-003: PyMuPDF + LLM for PDF extraction (2026-04-01)
**Context:** Needed PDF parsing for F-02.
**Decision:** PyMuPDF for text extraction, LLM for component identification.
**Rationale:** PyMuPDF fastest for text. Docling overkill. LLM handles semantic extraction.
**Revisit when:** Extraction recall drops below 60%.

### D-004: NIST 800-53 only, not ISO 27001 (2026-04-01)
**Context:** EQ Bank's primary framework is NIST.
**Decision:** 20 NIST mapping entries. ISO added in week 6.
**Revisit when:** Customer needs ISO, or week 6 arrives.

### D-005: 15 custom agents for build pipeline (2026-04-01)
**Context:** Needed structured development process for AI-assisted build.
**Decision:** Created threatgenix-lead, lean-strategist, staff-engineer, scope-enforcer, product-strategist, builder, backend-builder, frontend-builder, ai-builder, rules-builder, tester, tracker, orchestrator, builder-protocol agents.
**Rationale:** Prevents hallucination propagation, ensures test coverage, maintains scope discipline.
**Revisit when:** Agent overhead exceeds value (if builds take 3x longer due to process).

### D-006: Backend tests use SQLite in-memory via dependency override (2026-04-01)
**Context:** Needed test isolation without requiring Docker for test runs.
**Decision:** Use SQLite in-memory database with FastAPI dependency override pattern.
**Rationale:** Fast, isolated, no Docker dependency for CI or local testing. Trade-off: some Postgres-specific features unavailable in tests.
**Revisit when:** Tests need Postgres-specific features (JSON operators, array types, etc.).

### D-007: Python 3.9 compatibility -- Optional[X] over X | None (2026-04-01)
**Context:** Models initially used Python 3.10+ union syntax (X | None) which broke on 3.9.
**Decision:** All models use Optional[X] from typing instead of X | None union syntax.
**Rationale:** Broader compatibility. Some CI/deployment environments may run 3.9.
**Revisit when:** Minimum Python version is raised to 3.10+.

---

## Lessons Learned

### L-001: Bypassing the agent pipeline creates unverified debt (2026-04-01)
**What happened:** Day 0 infrastructure was coded directly -- 49 files -- without consulting tracker, tester, scope-enforcer, or using builder decomposition.
**Root cause:** Urgency to see code generated quickly. Process felt like overhead before any code existed.
**Lesson:** The first code is the most important code to get right because every feature builds on it. Schema mismatches in Day 0 models propagate into every API endpoint, every frontend type, every test. Review Day 0 BEFORE building on top of it.
**Applies to:** All agents. Day 0 review is the immediate priority.
**Severity:** HIGH -- if models are wrong, every feature block starts with rework.

### L-002: Agent pipeline catches issues that direct coding misses (2026-04-01)
**What happened:** Agent pipeline caught 6 minor issues during F-27/F-01 implementation. Scope-enforcer found confidence/properties leaks. Tester found missing CHECK constraints.
**Root cause:** Single-agent coding has blind spots. Multi-agent review provides orthogonal perspectives.
**Lesson:** Pipeline verification is worth the time. The 6 issues caught early would have been harder to fix after multiple features built on top of them.
**Applies to:** All future blocks. Never skip scope-enforcer or tester steps.
**Severity:** MEDIUM -- validates the multi-agent approach.

---

## Failure Log

### FAIL-001: Day 0 built outside agent pipeline (2026-04-01)
**Discovered:** Session 2 start -- tracker created and noticed no review trail.
**Impact:** MEDIUM-HIGH -- 49 files of unverified infrastructure code. Schema may not match build plan. Patterns may not match project conventions.
**Resolution:** RESOLVED -- F-27 and F-01 work validated the core infrastructure (models, schemas, FastAPI app, React setup). Issues found were fixed during block implementation.
**Status:** CLOSED
**Time lost:** Minimal -- issues were caught and fixed during F-27 implementation.
**Prevention:** Always follow builder-protocol: tracker consultation first, builder decomposes, tester writes tests, scope-enforcer verifies alignment.

---

## Wins

### WIN-001: Planning phase completed thoroughly before code (2026-04-01)
**What happened:** 15 agents created, build plan reviewed by 5 agents, lean scope cut from 26 to 12 features, customer personas documented, all before writing implementation code.
**Why it worked:** Investing in planning meant the 12 features are well-defined with clear acceptance criteria, dependency graph, and cut list. No ambiguity about what to build.
**Reinforce:** The planning phase works. Do not skip it for future projects.

### WIN-002: 49 files of infrastructure scaffolded in one session (2026-04-01)
**What happened:** Docker, FastAPI, 6 SQLAlchemy models, 20+ Pydantic schemas, Alembic, Vite+React+TS, API client, seed data, CI, health test -- all created.
**Why it worked:** Build plan was detailed enough that scaffolding could be generated quickly.
**Reinforce:** Detailed build plans accelerate scaffolding. But scaffolding still needs review (see L-001).

### WIN-003: First 7 blocks completed and verified (2026-04-01)
**What happened:** F-27 (Threat Model CRUD) and F-01 (Intake Form UI) fully implemented and verified. 3 API endpoints, service layer, 7 tests passing, 3-field form with submit and navigation.
**Why it worked:** Builder decomposition into small blocks (B1-B5, F1-F2) kept each step focused and testable. Agent pipeline caught 6 issues early.
**Reinforce:** F-27 and F-01 are the foundation -- everything else builds on these. Getting them right first was the correct call.

### WIN-004: F-02 + F-04 critical path delivered with full pipeline (2026-04-01)
**What happened:** 12 blocks (B6-B12, F3-F7) delivered: PDF upload→LLM extraction→DFD generation pipeline. 27 backend tests passing, TS compiles clean. Code review caught 4 issues (sleeper bug in name normalization, deprecated asyncio, dead DOM code, license violation) — all fixed and re-verified.
**Why it worked:** Multi-agent pipeline (scope-enforcer → builder → specialized builders → tester → code-critic) caught a sleeper bug that would have silently dropped data flows in production. The exact-vs-normalized matching gap between ai_extraction.py and dfd_generator.py would have been very hard to debug in production.
**Reinforce:** Code review finding the sleeper bug justified the pipeline overhead. The tester→fix→re-test cycle works.

---

## Session History
| Session | Date | What happened | Blocks completed | Key decisions |
|---------|------|---------------|-----------------|---------------|
| 1 | 2026-04-01 | Planning: 15 agents, build plan (5-agent review), lean scope (12 features), MVP features, customer personas | 0 | D-001 through D-005 |
| 2 | 2026-04-01 | Day 0 scaffolding (49 files, outside pipeline). Tracker initialized. | 0 (code exists, unverified) | Need review before proceeding |
| 3 | 2026-04-01 | F-27 complete (B1-B5), F-01 complete (F1-F2). 7 blocks done. Pipeline validated. | 7 | D-006 (SQLite test isolation), D-007 (Python 3.9 compat) |
| 4 | 2026-04-01 | F-02 complete (B6-B9, F6-F7), F-04 complete (B10-B12, F3-F5). 12 blocks done. 27 tests. 4 review fixes applied. | 12 | dagre JS-only workaround (rank-based Python layout), normalized name matching for flow validation |
| 4b | 2026-04-01 | F-07 complete (B13-B20). 20 STRIDE rules, deterministic engine, 119 tests. 4 review fixes (CHECK constraint, column width, source alignment, test leak). | 8 | 3-layer hybrid engine architecture confirmed |
| 4c | 2026-04-01 | F-10, F-13, F-08, F-11 complete (18 blocks). Threat table, compliance lookup, AI enhancement, triage. 179 tests. 2 review fixes (compliance column width, URL encoding). | 18 | Parallel wave execution (3 streams), AI dedup heuristic accepted as-is for pilot |
| 5 | 2026-04-01 | App runnability fixed (lifespan+seed+docker). QA gatekeeper first run (42 tests, 3 bugs found+fixed). F-05 complete (13 blocks, 61 E2E). F-24 complete (2 blocks, 62 E2E). F-14 complete (5 blocks, 65 E2E). **ALL 12 FEATURES COMPLETE.** | 20 | QA gatekeeper mandatory before COMPLETE. Advisory locks for concurrency. Dedup by rule_id. |
