# ThreatGenix Build Plan -- Weeks 1-4 (12 Features, 2 Engineers)

**Created:** April 1, 2026
**Status:** CANONICAL BUILD PLAN for weeks 1-4.
**Reviewed by:** Orchestrator (5-agent review: lean-strategist, product-strategist, threatgenix-lead, scope-enforcer, builder)
**Audience:** Builder agents. This is concrete enough to decompose into implementation blocks.

---

## 0. EXECUTIVE SUMMARY (Orchestrator Synthesis)

### The One Sentence
Get a real EQ Bank design doc through the extraction pipeline and in front of Priya's eyes by Day 7-10, before you build anything else.

### The OMTM (One Metric That Matters)
**"Time from PDF upload to Priya saying 'I would submit this report.'"** Target: under 30 minutes. Her current workflow: 3-6 hours.

### The Riskiest Assumption
"The AI-generated DFD from a PDF design doc is accurate enough that Priya corrects it rather than redrawing it." If wrong, the entire pilot fails. F-02 + F-04 are the make-or-break features.

### The "Wow" Sequence (3 things that sell it)
1. Upload her actual doc → DFD appears in 10 seconds (F-02 + F-04)
2. One click → STRIDE threats populate with system-specific detail (F-07 + F-08)
3. Export → PDF report with NIST mappings she'd hand to her CISO (F-13 + F-14)

### Build Confidence: 60%
Achievable IF: Bedrock works in ca-central-1, LLM extraction hits 60% recall in 2-3 prompt iterations, ReactFlow dagre produces acceptable layouts. NOT achievable if: Bedrock structured output needs >2 days of engineering, trust boundary rendering requires custom ReactFlow components.

### If Behind by Day 10 — Cut List (in order)
1. F-24 → simplify to try/catch (30 min vs 2 hours)
2. F-05 trust boundaries → display-only from auto-gen, not editable
3. F-08 → defer AI to week 3, ship rules-only
4. F-11 dismiss reason → one-click, no modal
5. F-14 DFD image → placeholder text in PDF
6. F-13 UI badges → keep in PDF only

### Block Estimate
~85 total blocks at ~2 hours each. 2 engineers x 4 weeks x 8 hours = 320 hours. 170 hours of block work + 150 hours of integration, debugging, prompt iteration, environment issues. Math works, no slack.

### Pre-Day 0 Checklist (BEFORE sprint starts)
- [ ] Verify Bedrock Claude model availability in ca-central-1 (EXISTENTIAL — do this TODAY)
- [ ] Get 2-3 real sanitized bank architecture PDFs from EQ Bank contact
- [ ] Write F-02 LLM extraction prompt template (blocks builder on Day 2)
- [ ] Write F-08 AI enhancement prompt template (blocks builder on Day 8)
- [ ] Define F-07 rule condition format: Python lambda, DSL, or function reference
- [ ] Lock dagre rankdir (LR or TB), nodesep, ranksep values
- [ ] Lock trust boundary rendering strategy (ReactFlow group nodes vs custom SVG)
- [ ] Lock DFD image capture (client-side ReactFlow.toImage() — update ReportRequest model to accept dfd_image_base64)
- [ ] Install WeasyPrint system deps in Dockerfile (cairo, pango)
- [ ] Pin ReactFlow version to avoid breaking API changes

### Milestones with Hypotheses
| Milestone | Date | What Priya Sees | Hypothesis Tested | Success Signal |
|-----------|------|-----------------|-------------------|----------------|
| The DFD Test | Day 10 | Upload real doc, DFD appears | "Extraction accurate enough to correct, not redraw" | "That's roughly right, I'd fix a few things" |
| The Threat Validation | Day 17 | Edit DFD, click Analyze, see threats | "Rules + AI threats match what she'd find manually" | Accepts 60%+ of threats without modification |
| The Deliverable | Day 28 | Full pipeline to PDF export | "Output is something she'd submit to her CISO" | PDF passes "would you present this?" test |

### What NOT to Measure (Weeks 1-4)
- Threat recall/precision against gold standard (you don't have one)
- Time savings percentage (need both methods on same system)
- Number of threats generated (more ≠ better)
- System performance beyond acceptance criteria thresholds
- NPS or satisfaction scores (sample size = 1)

### Scope-Enforcer Flag
The `confidence` column on `dfd_nodes` and dashed-border rendering for low-confidence elements is NOT in the lean scope. Store confidence if you want (cheap), but do NOT build the dashed-border UI. Cut it.

---

## 1. Technical Dependency Graph

```
F-27 (CRUD) ──────────────────────┐
F-01 (Intake) ────────────────────┤
                                  ▼
                          [ThreatModel exists]
                                  │
                    ┌─────────────┼──────────────┐
                    ▼             ▼              ▼
              F-02 (Doc Parse)   F-05 (Editor)  F-10 (Threat Table)
                    │             │              ▲
                    ▼             │              │
              F-04 (DFD Gen)     │              │
                    │             │              │
                    └──────┬──────┘              │
                           ▼                    │
                    [DFD exists in DB]          │
                           │                    │
                    ┌──────┴──────┐             │
                    ▼             ▼             │
              F-07 (Rules)  F-08 (AI Pass 1)   │
                    │             │             │
                    └──────┬──────┘             │
                           ▼                    │
                    [Threats exist] ────────────┘
                           │
                    ┌──────┼──────┐
                    ▼      ▼      ▼
              F-11    F-13    F-14
             (Triage) (Compliance) (PDF Report)

F-24 (Graceful Degradation) -- wraps F-08, no standalone dependency
```

### Critical Path (longest sequential chain):

```
Infrastructure -> F-27/F-01 -> F-02 -> F-04 -> F-07 -> F-10 -> F-14
                                                 └──> F-08 (parallel with F-07 output)
```

**Critical path duration estimate:** ~14 working days (3 weeks minus slack)

### Dependency Rules (hard constraints):
- F-02 requires F-27 (needs a threat_model_id to attach parsed data to)
- F-04 requires F-02 output (parsed components JSON)
- F-07 requires F-04 output (DFD with nodes, edges, trust boundaries)
- F-08 requires F-04 output + F-07 output (DFD + rules threats for context)
- F-10 requires F-07 output (threat records to display)
- F-11 requires F-10 (needs the threat table to triage within)
- F-13 requires F-07 (maps threats to NIST controls)
- F-14 requires F-01 + F-04 + F-07/F-08 + F-13 (all data sources for the report)
- F-05 requires F-04 (needs a DFD to edit; can also work on empty canvas)
- F-24 wraps F-08 (needs F-08 to exist before wrapping it)

### Soft Dependencies (interface contract only):
- F-05 and F-07 share the DFD data model but can be built in parallel once the model is defined
- F-10 and F-11 share the threats table but F-11 is a thin layer on F-10
- F-13 is a pure lookup table -- can be built anytime after the Threat model is defined

---

## 2. Data Model Foundation

These models MUST be defined and agreed upon before any feature work begins. They are the shared contracts.

### 2a. Database Tables (PostgreSQL)

```sql
-- Core workspace
CREATE TABLE threat_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_name     VARCHAR(255) NOT NULL,
    description     TEXT,
    data_classification VARCHAR(50) NOT NULL CHECK (data_classification IN ('Public', 'Internal', 'Confidential', 'Restricted')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parsed document storage
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    page_count      INTEGER NOT NULL,
    raw_text        TEXT,  -- extracted text, NOT the PDF binary
    parsed_components JSONB,  -- structured extraction output
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    parsed_at       TIMESTAMPTZ
);

-- DFD structure
CREATE TABLE dfd_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    node_type       VARCHAR(50) NOT NULL CHECK (node_type IN ('process', 'data_store', 'external_entity')),
    name            VARCHAR(255) NOT NULL,
    position_x      FLOAT NOT NULL DEFAULT 0,
    position_y      FLOAT NOT NULL DEFAULT 0,
    trust_boundary_id UUID REFERENCES trust_boundaries(id) ON DELETE SET NULL,
    properties      JSONB NOT NULL DEFAULT '{}',
    confidence      FLOAT DEFAULT 1.0,  -- 0.0-1.0, from parser
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dfd_edges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    source_node_id  UUID NOT NULL REFERENCES dfd_nodes(id) ON DELETE CASCADE,
    target_node_id  UUID NOT NULL REFERENCES dfd_nodes(id) ON DELETE CASCADE,
    label           VARCHAR(255) DEFAULT '',
    properties      JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trust_boundaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL DEFAULT 'Trust Boundary',
    node_ids        UUID[] NOT NULL DEFAULT '{}',  -- which nodes are inside
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Threats
CREATE TABLE threats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    display_id      VARCHAR(20) NOT NULL,  -- e.g., "T-001"
    description     TEXT NOT NULL,
    stride_category VARCHAR(20) NOT NULL CHECK (stride_category IN ('Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege')),
    severity        VARCHAR(10) NOT NULL CHECK (severity IN ('High', 'Medium', 'Low')),
    source          VARCHAR(20) NOT NULL CHECK (source IN ('Rules', 'AI', 'AI+Rules')),
    status          VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Accepted', 'Dismissed')),
    dismiss_reason  TEXT,
    rule_id         VARCHAR(50),  -- which rule generated this, if any
    ai_enhanced     BOOLEAN DEFAULT FALSE,
    original_rule_threat_id UUID REFERENCES threats(id),  -- if AI enhanced a rules threat
    affected_node_ids UUID[] DEFAULT '{}',
    affected_edge_ids UUID[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance mapping (static lookup, seeded not user-generated)
CREATE TABLE compliance_mappings (
    id              SERIAL PRIMARY KEY,
    stride_category VARCHAR(20) NOT NULL,
    threat_subtype  VARCHAR(100) NOT NULL,
    nist_control_id VARCHAR(20) NOT NULL,  -- e.g., "AC-4"
    nist_control_name VARCHAR(255) NOT NULL,  -- e.g., "Information Flow Enforcement"
    UNIQUE(stride_category, threat_subtype, nist_control_id)
);
```

### 2b. Pydantic Models (FastAPI)

```python
# ── Intake / Threat Model ──

class ThreatModelCreate(BaseModel):
    system_name: str = Field(..., max_length=255)
    description: str = Field("", max_length=500)
    data_classification: Literal["Public", "Internal", "Confidential", "Restricted"]

class ThreatModelResponse(BaseModel):
    id: UUID
    system_name: str
    description: str
    data_classification: str
    created_at: datetime
    updated_at: datetime

class ThreatModelListItem(BaseModel):
    id: UUID
    system_name: str
    data_classification: str
    created_at: datetime
    updated_at: datetime
    threat_count: int = 0

# ── DFD ──

class DFDNodeCreate(BaseModel):
    node_type: Literal["process", "data_store", "external_entity"]
    name: str = Field(..., max_length=255)
    position_x: float = 0
    position_y: float = 0
    trust_boundary_id: Optional[UUID] = None
    properties: dict = {}

class DFDNodeResponse(BaseModel):
    id: UUID
    node_type: str
    name: str
    position_x: float
    position_y: float
    trust_boundary_id: Optional[UUID]
    properties: dict
    confidence: float

class DFDNodeUpdate(BaseModel):
    name: Optional[str] = None
    node_type: Optional[Literal["process", "data_store", "external_entity"]] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    trust_boundary_id: Optional[UUID] = None

class DFDEdgeCreate(BaseModel):
    source_node_id: UUID
    target_node_id: UUID
    label: str = ""

class DFDEdgeResponse(BaseModel):
    id: UUID
    source_node_id: UUID
    target_node_id: UUID
    label: str
    properties: dict

class TrustBoundaryCreate(BaseModel):
    name: str = "Trust Boundary"
    node_ids: list[UUID]

class TrustBoundaryResponse(BaseModel):
    id: UUID
    name: str
    node_ids: list[UUID]

class DFDResponse(BaseModel):
    """Full DFD for a threat model -- used by F-04, F-05, F-07, F-08"""
    nodes: list[DFDNodeResponse]
    edges: list[DFDEdgeResponse]
    trust_boundaries: list[TrustBoundaryResponse]

# ── Document Parsing ──

class ParsedComponent(BaseModel):
    name: str
    component_type: Literal["process", "data_store", "external_entity"]
    confidence: float = Field(ge=0.0, le=1.0)
    description: str = ""

class ParsedFlow(BaseModel):
    source: str  # name, matched to component
    target: str
    label: str = ""
    confidence: float = Field(ge=0.0, le=1.0)

class ParsedBoundary(BaseModel):
    name: str
    contains: list[str]  # component names

class DocumentParseResult(BaseModel):
    """Output of F-02, input to F-04"""
    components: list[ParsedComponent]
    flows: list[ParsedFlow]
    boundaries: list[ParsedBoundary]
    raw_text_excerpt: str = ""  # first 2000 chars, for AI context

class DocumentUploadResponse(BaseModel):
    document_id: UUID
    filename: str
    page_count: int
    parse_result: DocumentParseResult

# ── Threats ──

class ThreatResponse(BaseModel):
    id: UUID
    display_id: str
    description: str
    stride_category: str
    severity: str
    source: str
    status: str
    dismiss_reason: Optional[str]
    rule_id: Optional[str]
    ai_enhanced: bool
    original_rule_threat_id: Optional[UUID]
    affected_node_ids: list[UUID]
    affected_edge_ids: list[UUID]
    compliance_controls: list["ComplianceControlRef"] = []
    created_at: datetime

class ThreatTriageRequest(BaseModel):
    status: Literal["Accepted", "Dismissed"]
    dismiss_reason: Optional[str] = None  # required if status == "Dismissed"

class ComplianceControlRef(BaseModel):
    nist_control_id: str
    nist_control_name: str

# ── Rules Engine ──

class RuleDefinition(BaseModel):
    """Internal model for rule definitions (loaded from YAML/JSON, not DB)"""
    rule_id: str  # e.g., "STRIDE-S-001"
    stride_category: str
    threat_subtype: str  # e.g., "trust_boundary_spoofing"
    description_template: str  # "The {source.name} may be spoofed when communicating with {target.name}"
    severity: Literal["High", "Medium", "Low"]
    condition: str  # evaluated against (source, edge, target) tuple
    requires_boundary_crossing: bool = True

class RuleEngineOutput(BaseModel):
    threats: list[ThreatResponse]
    execution_time_ms: float
    rules_evaluated: int
    rules_fired: int

# ── AI Pass ──

class AIPassInput(BaseModel):
    dfd: DFDResponse
    rules_threats: list[ThreatResponse]
    doc_excerpt: str
    system_name: str
    data_classification: str

class AIThreatRaw(BaseModel):
    """What we ask the LLM to return (structured JSON output)"""
    description: str
    stride_category: str
    severity: str
    enhances_rule_threat_id: Optional[str] = None  # display_id of rules threat, or null for net-new
    reasoning: str

class AIPassOutput(BaseModel):
    threats: list[AIThreatRaw]
    model_id: str
    input_tokens: int
    output_tokens: int
    latency_ms: float

# ── PDF Report ──

class ReportRequest(BaseModel):
    threat_model_id: UUID
    # no other options for weeks 1-4

class ReportData(BaseModel):
    """Assembled by the report service, passed to WeasyPrint template"""
    system_name: str
    description: str
    data_classification: str
    created_at: datetime
    generated_at: datetime
    dfd_image_base64: str  # PNG of the DFD, rendered server-side or captured client-side
    threats: list[ThreatResponse]  # only Open + Accepted
    compliance_summary: list[ComplianceControlRef]
    methodology_text: str
```

### 2c. API Endpoints

```
# ── Threat Model CRUD (F-27, F-01) ──
POST   /api/threat-models                          -> ThreatModelResponse
GET    /api/threat-models                          -> list[ThreatModelListItem]
GET    /api/threat-models/{id}                     -> ThreatModelResponse

# ── Document Upload/Parse (F-02) ──
POST   /api/threat-models/{id}/documents           -> DocumentUploadResponse
       (multipart/form-data, PDF file)

# ── DFD (F-04 auto-gen, F-05 editor) ──
GET    /api/threat-models/{id}/dfd                 -> DFDResponse
POST   /api/threat-models/{id}/dfd/nodes           -> DFDNodeResponse
PATCH  /api/threat-models/{id}/dfd/nodes/{node_id} -> DFDNodeResponse
DELETE /api/threat-models/{id}/dfd/nodes/{node_id} -> 204
POST   /api/threat-models/{id}/dfd/edges           -> DFDEdgeResponse
DELETE /api/threat-models/{id}/dfd/edges/{edge_id} -> 204
POST   /api/threat-models/{id}/dfd/boundaries      -> TrustBoundaryResponse
DELETE /api/threat-models/{id}/dfd/boundaries/{id}  -> 204
PUT    /api/threat-models/{id}/dfd                 -> DFDResponse
       (bulk save -- editor sends full DFD state on "Save" click)

# ── Threat Generation (F-07, F-08) ──
POST   /api/threat-models/{id}/analyze             -> list[ThreatResponse]
       (runs rules engine + AI pass; returns combined results)
       Query param: ?rules_only=true (skip AI, used by F-24 fallback)

# ── Threats (F-10, F-11) ──
GET    /api/threat-models/{id}/threats              -> list[ThreatResponse]
       Query params: ?stride_category=Spoofing
PATCH  /api/threat-models/{id}/threats/{threat_id}  -> ThreatResponse
       (triage: accept/dismiss)

# ── Compliance (F-13) ──
GET    /api/compliance/mappings                     -> list[ComplianceMapping]
       (returns the full static lookup table)
GET    /api/threat-models/{id}/threats/{threat_id}/controls -> list[ComplianceControlRef]
       (returns controls for a specific threat)

# ── PDF Report (F-14) ──
POST   /api/threat-models/{id}/report              -> binary PDF (application/pdf)
```

---

## 3. Risk-Ordered Build Sequence

### HIGH RISK -- Build First (might not work as designed)

| Feature | Risk | Why |
|---------|------|-----|
| **F-02: Doc Parse** | HIGH | LLM extraction quality is unknown. Prompt engineering needed. May need multiple iterations to hit 60% recall. The entire pipeline depends on this output quality. |
| **F-08: AI Pass 1** | HIGH | LLM structured output reliability is unknown. JSON enforcement may fail. Context window limits with large DFDs. Bedrock ca-central-1 availability/latency untested. |
| **F-04: DFD Auto-Gen** | MEDIUM-HIGH | dagre layout quality with real parsed data is unknown. Edge routing, label overlap, trust boundary rendering may need tuning. ReactFlow + dagre integration has edge cases. |
| **F-14: PDF Report** | MEDIUM | WeasyPrint rendering of DFD images at A4 size, table pagination, and CSS-to-PDF fidelity are all unknowns. DFD-to-image capture is a separate sub-problem. |

### MEDIUM RISK -- Build Middle

| Feature | Risk | Why |
|---------|------|-----|
| **F-07: Rules Engine** | MEDIUM | The logic is deterministic and clear, but writing 20 well-tuned rules with correct severity assignments takes iteration. Rule conditions against the DFD data model must be precisely defined. |
| **F-05: DFD Editor** | MEDIUM | ReactFlow editing is well-documented, but trust boundary drag interaction, edge deletion UX, and save-state management have integration complexity. |
| **F-24: Graceful Degradation** | LOW-MEDIUM | Straightforward error handling, but must be tested against real failure modes (timeout, bad JSON, Bedrock 503). |

### LOW RISK -- Build Last ("just code")

| Feature | Risk | Why |
|---------|------|-----|
| **F-01: Intake Form** | LOW | 3 fields, one API call, one React form. |
| **F-27: Threat Model CRUD** | LOW | Standard CRUD. List page + open. |
| **F-10: Threat Table** | LOW | Table component with 6 columns, one filter. Standard React. |
| **F-11: Threat Triage** | LOW | Two buttons (accept/dismiss) + one text input. PATCH endpoint. |
| **F-13: Compliance Lookup** | LOW | Static lookup table. Seed data + GET endpoint. Pure data entry. |

### Risk-Informed Build Order:
1. F-02 (Doc Parse) -- validate LLM extraction works AT ALL
2. F-04 (DFD Auto-Gen) -- validate dagre layout with real parsed output
3. F-08 (AI Pass 1) -- validate Bedrock structured output + fallback
4. F-07 (Rules Engine) -- deterministic but needs iteration on rule quality
5. F-05 (DFD Editor) -- ReactFlow interactions
6. F-14 (PDF Report) -- WeasyPrint rendering
7. Everything else (F-01, F-27, F-10, F-11, F-13, F-24) -- low risk, clear path

---

## 4. Integration Points

### Simple Integrations (pass JSON, no shared state)

| Connection | Type | Notes |
|-----------|------|-------|
| F-01 -> F-27 | Form submit creates DB record | POST /api/threat-models, returns UUID |
| F-13 -> F-10 | Lookup table join | Threat table queries compliance_mappings by stride_category + threat_subtype |
| F-13 -> F-14 | Same lookup, different renderer | PDF template iterates threats, includes controls |
| F-11 -> F-10 | PATCH updates row in table | Status change re-renders one table row |
| F-07 -> F-10 | Rules output stored as threat rows | GET /api/threats returns them |

### Complex Integrations (shared state, real-time updates, coordination)

| Connection | Complexity | Why | Contract |
|-----------|-----------|-----|----------|
| **F-02 -> F-04** | HIGH | Parse output must exactly match DFD generation input. Component names become node names. Flow source/target must resolve to node IDs. Boundary containment must be consistent. | `DocumentParseResult` is the contract. F-04 consumes it directly. |
| **F-04 -> F-07** | HIGH | Rules engine evaluates (source, edge, target) tuples. It must understand trust boundary membership to determine boundary crossing. DFD state must be fully materialized. | `DFDResponse` is the contract. Rules engine reads it as a graph. |
| **F-04 + F-07 -> F-08** | HIGH | AI pass receives the full DFD + all rules threats + doc excerpt. Prompt assembly is complex. Output must reference existing threat display_ids for enhancement. | `AIPassInput` is the contract. Prompt template must be carefully structured. |
| **F-05 -> F-07** | MEDIUM | After DFD edits, user clicks "Re-analyze." Editor must save DFD state, then trigger /analyze. UI must show loading state and replace threat table. | Save (PUT /dfd) then POST /analyze. Sequential. |
| **F-04/F-05 -> F-14** | MEDIUM | PDF needs a rendered DFD image. Two options: (a) server-side rendering with headless browser, (b) client captures canvas as PNG and sends to server. Option (b) is simpler for weeks 1-4. | Client sends DFD as base64 PNG in the report request, OR we use a server-side approach. Decision needed day 1. |
| **F-08 -> F-24** | MEDIUM | Graceful degradation wraps the AI call with timeout + retry + fallback. Must intercept at the right layer (around the Bedrock client, not the endpoint). | Wrapper around the Bedrock client. Returns `AIPassOutput` or `None`. |

---

## 5. Week-by-Week Build Plan

### Notation
- **Eng-A:** Backend-leaning engineer (FastAPI, DB, LLM integration)
- **Eng-B:** Frontend-leaning engineer (React, Vite, ReactFlow)
- Day 0 = Monday of week 1

### Pre-Week 1: Infrastructure (Day 0, both engineers, 1 day)

Both engineers pair on scaffolding. See Section 7 for details.

**Deliverable:** Both engineers can run `make dev` and see a React app talking to a FastAPI backend with a PostgreSQL database. CI runs. Bedrock SDK can be imported.

---

### WEEK 1 (Days 1-5): Foundation + High-Risk Validation

**Goal:** Validate the two riskiest features (doc parsing, DFD generation) and establish the data pipeline.

| Day | Eng-A (Backend) | Eng-B (Frontend) |
|-----|-----------------|------------------|
| 1 | DB migrations: all tables. Seed compliance_mappings with 20 NIST entries. | React app shell: routing, layout, home page skeleton. |
| 1 | Implement `POST /api/threat-models` and `GET /api/threat-models` (F-27 + F-01 backend) | Implement intake form UI (F-01): 3 fields, submit calls API |
| 2-3 | **F-02: Doc Parse backend.** PyMuPDF text extraction. LLM prompt for component extraction. Parse PDF -> `DocumentParseResult`. Iterate on prompt until 60% recall on 1 reference doc. | **F-04: DFD rendering.** ReactFlow canvas component. dagre layout function. Render hardcoded test DFD (3 nodes, 2 edges, 1 boundary) with correct shapes. |
| 4-5 | **F-02 continued.** Wire up `POST /api/threat-models/{id}/documents`. Store parsed result. Handle error cases (non-PDF, >30 pages). Test with 2nd reference doc. | **F-04: Connect to backend.** `GET /api/threat-models/{id}/dfd` loads DFD. Wire F-02 upload -> F-04 auto-gen pipeline. dagre layout on real parsed data. Tune layout params. |

**Week 1 Exit Criteria:**
- Upload a PDF, see a DFD rendered on screen with correct node types
- Intake form creates a threat model, appears in list
- Compliance lookup table seeded with 20 entries

**Week 1 Risk Mitigation:**
- If doc parsing quality is poor by day 3, Eng-A switches to a simpler extraction prompt (fewer fields, higher confidence threshold). The 60% recall target is tested against 1 doc, not 3.
- If dagre layout is ugly with real data, Eng-B hardcodes layout params (node spacing, rank direction) rather than making them dynamic.

---

### WEEK 2 (Days 6-10): Threat Engine + DFD Editing

**Goal:** Rules engine produces threats from a DFD. AI pass produces enhanced threats. Editor allows corrections.

**NOTE (Orchestrator rebalance):** Original plan overloaded this week (5 features in 5 days). Remaining 10 rules + F-24 moved to Week 3 Day 11. AI Pass gets full 3 days.

| Day | Eng-A (Backend) | Eng-B (Frontend) |
|-----|-----------------|------------------|
| 6-7 | **F-07: Rules Engine.** Implement rule evaluation framework. Load rules from YAML. Implement 10/20 rules (trust boundary crossing focus). `POST /api/threat-models/{id}/analyze?rules_only=true` | **F-05: DFD Editor.** Drag nodes (ReactFlow built-in). Add node (type picker modal). Delete node (+ cascade edges). Add edge (click source, drag to target). |
| 8-10 | **F-08: AI Pass 1 (full 3 days).** Day 8: Bedrock Claude client in ca-central-1, prompt assembly from `AIPassInput`. Day 9: Structured JSON output parsing, retry on bad JSON, response validation. Day 10: Integration into `POST /api/threat-models/{id}/analyze` (full pipeline: rules + AI), end-to-end test with real DFD. | **F-05 continued (Day 8-9).** Delete edge. Trust boundary creation (select nodes, group). Save button -> `PUT /api/threat-models/{id}/dfd`. Property panel (name + type only). **F-10: Threat Table (Day 10).** Table component. 6 columns. Severity sort. STRIDE filter dropdown. Source badges. Wire to `GET /api/threats`. |

**MOVED TO WEEK 3 DAY 11:** F-07 remaining 10 rules + F-24 graceful degradation.

**Week 2 Exit Criteria:**
- Edit a DFD (add/delete nodes and edges, trust boundaries)
- Click "Analyze" -> see threats in a table (10 rules + AI)
- 10 rules implemented and tested, 10 more coming Day 11

**Week 2 Risk Mitigation:**
- If Bedrock ca-central-1 is unavailable or Claude is not available there, Eng-A implements a mock AI pass that returns 3 hardcoded AI threats. Real integration moves to week 3. Rules-only is the fallback.
- If AI structured output is unreliable, increase retry count to 3 and add output repair (parse partial JSON). Worst case: ship rules-only for the demo and add AI in week 3-4.
- Eng-B: design the DFD canvas component for editability from Day 2 (Week 1), even though editing isn't wired until Week 2. Avoids rewrite.

---

### WEEK 3 (Days 11-15): Complete Rules, Triage, Compliance, PDF

**Goal:** Full workflow works end-to-end. All 20 rules. Triage threats. Compliance. PDF export.

**NOTE (Orchestrator rebalance):** Absorbed remaining 10 rules + F-24 from Week 2. Tighter but better distributed.

| Day | Eng-A (Backend) | Eng-B (Frontend) |
|-----|-----------------|------------------|
| 11 | **F-07: Remaining 10 rules.** Complete all 20 rules, test against reference DFD. **F-24: Graceful Degradation.** Try/catch wrapper around Bedrock call, return rules-only on any failure. (2 hours, not a full day.) **F-11: Triage backend.** `PATCH /api/threats/{id}` for accept/dismiss. Dismiss requires reason validation. | **F-11: Triage UI.** Accept button, dismiss button + reason modal. Dismissed section (collapsed). Status badges in table. |
| 12 | **F-13: Compliance backend.** `GET /api/compliance/mappings`. Join logic: for each threat, lookup by stride_category + threat_subtype -> return controls. Add `compliance_controls` to ThreatResponse. | **F-13: Compliance UI.** Show NIST control IDs as badges on each threat row. Hover shows control name. |
| 13 | **Integration: Re-analyze flow.** After DFD edit + save, POST /analyze re-runs rules + AI. Existing threats replaced. Triage state reset with warning. **F-07 unit tests:** Test all 20 rules with expected inputs/outputs. | **Integration: Re-analyze UI.** "Re-analyze" button appears after DFD edits. Loading state during analysis. Threat table refreshes with new results. Triage reset warning dialog. |
| 14-15 | **F-14: PDF Report backend.** WeasyPrint template (HTML+CSS). Assemble `ReportData`. Render sections: title, scope, DFD image, threat table, compliance, methodology. `POST /api/threat-models/{id}/report` returns PDF binary. | **F-14: PDF Report frontend.** "Export PDF" button. DFD canvas-to-PNG capture (ReactFlow's `toImage()`). Send to backend. Download resulting PDF. Loading state. |

**Week 3 Exit Criteria:**
- All 20 rules implemented and unit tested
- Accept/dismiss threats, see status change
- Every threat shows NIST controls
- Export a PDF with all sections populated
- Re-analyze after DFD edit works
- AI failure gracefully falls back to rules-only

**Week 3 Risk Mitigation:**
- Day 11 is heavy for Eng-A (10 rules + F-24 + F-11 backend). If behind, push F-11 backend to Day 12 morning and overlap with F-13.
- If WeasyPrint rendering is poor, use a simpler HTML template (no CSS grid, just tables). PDF quality is "would Priya present this" not "is it beautiful."
- DFD image capture: use ReactFlow's built-in `toImage()`. If that fails, ship PDF without DFD image and add placeholder text. (Cut list item #5.)

---

### WEEK 4 (Days 16-20): Polish, Test, End-to-End

**Goal:** Demo script works flawlessly. Edge cases handled. Performance acceptable.

| Day | Eng-A (Backend) | Eng-B (Frontend) |
|-----|-----------------|------------------|
| 16 | End-to-end testing: upload 3 reference PDFs, verify full pipeline. Fix parsing/rules issues found. | UI polish: loading states, error messages, empty states ("No threats yet"), responsive layout. |
| 17 | Performance: doc parse < 30s, rules < 500ms, AI < 30s, PDF render < 10s. Optimize bottlenecks. | F-27 completion: home page lists all models, click to open, last-updated sort. |
| 18 | Edge cases: empty DFD (no nodes), zero threats, PDF with 0 extractable text, 30-page PDF performance. F-24 testing: kill Bedrock mid-request. | Edge cases: empty states for all screens, error boundaries, file upload validation (non-PDF rejection, >30 pages rejection). |
| 19 | Bug fixes from testing. Compliance mapping audit: verify all 20 entries are correct. | Bug fixes from testing. Cross-browser check (Chrome, Firefox). |
| 20 | **Demo rehearsal.** Run the exact demo script: upload doc -> see DFD -> edit it -> generate threats -> triage -> see compliance -> export PDF. Time it. Fix anything that breaks. | **Demo rehearsal.** Same. Both engineers run it independently. |

**Week 4 Exit Criteria (Demo Script):**
1. Upload a 15-page bank architecture PDF
2. DFD appears in < 30 seconds with correct components
3. Edit DFD: add a missing node, delete an incorrect one, add trust boundary
4. Click "Analyze" -> threats appear (rules + AI) in < 60 seconds
5. Triage: accept 5 threats, dismiss 2 with reasons
6. See NIST controls on each threat
7. Export PDF -> readable report with all sections
8. Total time: under 30 minutes

---

## 6. Parallel vs Sequential Build

### Can be built fully in parallel (no shared state or APIs):

| Pair | Why parallel |
|------|-------------|
| F-01 (Intake Form) and F-13 (Compliance Lookup seeding) | F-01 writes to threat_models table. F-13 writes to compliance_mappings table. Zero overlap. |
| F-02 backend (Doc Parse) and F-05 frontend (DFD Editor UI) | F-02 produces data. F-05 consumes DFD state. They share the DFD data model but not code. Can build simultaneously once the model is defined. |
| F-07 (Rules Engine) and F-05 (DFD Editor) | Rules engine reads DFD. Editor writes DFD. Different code paths. Can build in parallel once DFDResponse model is locked. |
| F-10 (Threat Table UI) and F-08 (AI Pass backend) | Table displays threats regardless of source. AI pass creates threats. No coupling beyond the ThreatResponse model. |
| F-11 (Triage) and F-13 (Compliance display) | Both operate on threat rows but different columns/actions. |

### Must be sequential (output of one is input to next):

```
F-27/F-01  ──THEN──>  F-02  ──THEN──>  F-04  ──THEN──>  F-07/F-08
                                                              │
                                                              THEN
                                                              │
                                                         F-10/F-11/F-13/F-14
```

### Can overlap with interface contract (model defined, implementation parallel):

| Feature A | Feature B | Contract |
|-----------|-----------|----------|
| F-02 (Parse) | F-04 (DFD Gen) | `DocumentParseResult` model. Eng-A builds parser, Eng-B builds renderer. Both use the same test fixture JSON. |
| F-07 (Rules) | F-08 (AI Pass) | Both produce `ThreatResponse`. F-08 also reads F-07 output but can use test fixtures. |
| F-04 (DFD Gen) | F-05 (DFD Editor) | Both use `DFDResponse`. Gen creates it, Editor modifies it. Same ReactFlow canvas component. |

---

## 7. Infrastructure That Must Exist Before Feature Work (Day 0)

### Repository Structure

```
threatgenix/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, middleware
│   │   ├── config.py            # Settings (pydantic-settings, env vars)
│   │   ├── database.py          # SQLAlchemy async engine + session
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── threat_model.py
│   │   │   ├── dfd.py
│   │   │   ├── threat.py
│   │   │   └── compliance.py
│   │   ├── schemas/             # Pydantic request/response models
│   │   │   ├── __init__.py
│   │   │   ├── threat_model.py
│   │   │   ├── dfd.py
│   │   │   ├── threat.py
│   │   │   ├── document.py
│   │   │   └── compliance.py
│   │   ├── api/                 # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── threat_models.py
│   │   │   ├── documents.py
│   │   │   ├── dfd.py
│   │   │   ├── threats.py
│   │   │   ├── compliance.py
│   │   │   └── reports.py
│   │   ├── services/            # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── doc_parser.py    # F-02: PyMuPDF + LLM extraction
│   │   │   ├── dfd_generator.py # F-04: parsed components -> DFD nodes/edges
│   │   │   ├── rules_engine.py  # F-07: rule evaluation
│   │   │   ├── ai_pass.py       # F-08: Bedrock integration
│   │   │   ├── compliance.py    # F-13: lookup logic
│   │   │   └── report.py        # F-14: WeasyPrint rendering
│   │   └── rules/               # Rule definitions
│   │       └── stride_rules.yaml
│   ├── migrations/              # Alembic
│   ├── tests/
│   ├── templates/               # WeasyPrint HTML templates
│   │   └── report.html
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/                 # API client (fetch wrappers)
│   │   │   └── client.ts
│   │   ├── components/
│   │   │   ├── IntakeForm.tsx       # F-01
│   │   │   ├── DFDCanvas.tsx        # F-04, F-05
│   │   │   ├── ThreatTable.tsx      # F-10
│   │   │   ├── ThreatTriage.tsx     # F-11
│   │   │   ├── ComplianceBadge.tsx  # F-13
│   │   │   └── ModelList.tsx        # F-27
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   └── ThreatModelPage.tsx
│   │   └── types/               # TypeScript types mirroring Pydantic models
│   │       └── api.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml           # PostgreSQL + backend + frontend
├── Makefile                     # dev, test, migrate, seed
└── .github/
    └── workflows/
        └── ci.yml               # lint + type check + test
```

### Day 0 Checklist (both engineers, pair on this)

| Item | Owner | Time | Notes |
|------|-------|------|-------|
| Create Git repo with branch strategy (main + feature branches) | Either | 15 min | Trunk-based with short-lived feature branches |
| Backend: FastAPI app with health check endpoint `GET /api/health` | Eng-A | 30 min | Returns `{"status": "ok"}` |
| Backend: SQLAlchemy async setup + Alembic migration scaffold | Eng-A | 30 min | PostgreSQL connection via DATABASE_URL env var |
| Backend: pydantic-settings config loading (DATABASE_URL, BEDROCK_REGION, etc.) | Eng-A | 15 min | |
| Backend: CORS middleware configured for local dev | Eng-A | 5 min | |
| Backend: requirements.txt with pinned versions | Eng-A | 10 min | fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic, boto3, pymupdf, weasyprint |
| Backend: Dockerfile | Eng-A | 15 min | |
| Frontend: Vite + React + TypeScript scaffold | Eng-B | 15 min | `npm create vite@latest frontend -- --template react-ts` |
| Frontend: Install ReactFlow, dagre, tailwind (or CSS framework) | Eng-B | 15 min | |
| Frontend: API client module with base URL config | Eng-B | 20 min | Typed fetch wrappers |
| Frontend: TypeScript types file mirroring Pydantic schemas | Eng-B | 30 min | Generated or manual. Must match schemas exactly. |
| Frontend: Basic routing (react-router): `/` (home), `/models/:id` (workspace) | Eng-B | 15 min | |
| docker-compose.yml: PostgreSQL 16 + backend + frontend | Either | 20 min | |
| Makefile: `make dev`, `make test`, `make migrate`, `make seed` | Either | 15 min | |
| CI: GitHub Actions -- lint (ruff), type check (pyright + tsc), test (pytest) | Either | 30 min | |
| Verify Bedrock access: boto3 client can list models in ca-central-1 | Eng-A | 15 min | AWS credentials via env vars or IAM role. Confirm Claude model is available. |
| Seed script: insert 20 compliance_mappings rows | Eng-A | 20 min | Part of `make seed` |
| Test fixture: 1 reference bank PDF + gold-standard parse result JSON | Either | 30 min | Used by both engineers for testing throughout |

### Environment Variables (Day 0)

```env
DATABASE_URL=postgresql+asyncpg://threatgenix:password@localhost:5432/threatgenix
BEDROCK_REGION=ca-central-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_MAX_TOKENS=4096
BEDROCK_TIMEOUT_SECONDS=30
ALLOWED_ORIGINS=http://localhost:5173
PDF_MAX_PAGES=30
```

---

## 8. Key Design Decisions to Lock Before Building

These need explicit decisions before day 1 coding. Indecision here causes rework.

| Decision | Options | Recommendation | Impact |
|----------|---------|----------------|--------|
| DFD image for PDF report | (a) Client captures canvas as PNG, sends with report request. (b) Server renders DFD with headless browser. | **(a) Client capture.** Simpler. ReactFlow has `toImage()`. Avoids headless browser dependency. | F-14 implementation approach |
| Threat replacement on re-analyze | (a) Delete all threats, regenerate. (b) Merge: keep triage state for unchanged threats. | **(a) Delete and regenerate.** Simpler. For weeks 1-4, re-analyze is rare. Warn user "triage will be reset." | F-07/F-08 re-run behavior |
| Rule definitions storage | (a) YAML files in repo. (b) Database table. | **(a) YAML files.** 20 rules, no UI to edit them. Version controlled. Loaded at startup. | F-07 implementation |
| AI prompt for doc parsing (F-02) | (a) Single prompt: extract components + flows + boundaries. (b) Two prompts: first extract components, then extract flows. | **(a) Single prompt.** Fewer Bedrock calls, simpler code. If quality is bad, split in week 2. | F-02 LLM strategy |
| Frontend state management | (a) React Context + useState. (b) Zustand. (c) Redux. | **(b) Zustand.** Lightweight, no boilerplate. Good for DFD state (nodes/edges are complex objects). | All frontend features |

---

## 9. The 20 STRIDE Rules (F-07 Scope)

These are the specific 20 rules to implement. Each rule evaluates a (source, edge, target) tuple or a standalone node property.

### Spoofing (3 rules)
- S-01: External entity to process across trust boundary (identity spoofing)
- S-02: Process to process across trust boundary (service spoofing)
- S-03: External entity without authentication property

### Tampering (4 rules)
- T-01: Data flow crossing trust boundary without encryption
- T-02: Data store accessible from outside trust boundary
- T-03: Process receiving input from external entity (input tampering)
- T-04: Data flow without integrity validation

### Repudiation (3 rules)
- R-01: External entity performing writes without logging
- R-02: Process modifying data store without audit trail
- R-03: Trust boundary crossing without authenticated identity

### Information Disclosure (4 rules)
- I-01: Data flow crossing trust boundary with sensitive data
- I-02: Data store containing credentials accessible cross-boundary
- I-03: Unencrypted data flow between any two nodes
- I-04: Process exposing data to external entity across boundary

### Denial of Service (3 rules)
- D-01: External entity with unbounded input to process
- D-02: Process with multiple inbound flows (resource exhaustion target)
- D-03: Single point of failure (process with no redundancy, all flows through it)

### Elevation of Privilege (3 rules)
- E-01: Process crossing trust boundary with elevated data classification
- E-02: External entity with direct data store access (bypassing process)
- E-03: Trust boundary with more than 3 entry points (broad attack surface)

---

## 10. Compliance Mapping Seed Data (F-13, 20 Entries)

| Rule ID | STRIDE | Threat Subtype | NIST 800-53 Controls |
|---------|--------|---------------|---------------------|
| S-01 | Spoofing | Trust boundary identity spoofing | IA-2, IA-8 |
| S-02 | Spoofing | Service spoofing | IA-3, SC-8 |
| S-03 | Spoofing | Unauthenticated entity | IA-2, IA-5 |
| T-01 | Tampering | Unencrypted cross-boundary flow | SC-8, SC-13 |
| T-02 | Tampering | Cross-boundary data store access | AC-3, AC-4 |
| T-03 | Tampering | External input tampering | SI-10, SI-15 |
| T-04 | Tampering | No integrity validation | SI-7, SC-8 |
| R-01 | Repudiation | Unlogged writes | AU-2, AU-3 |
| R-02 | Repudiation | Unaudited data modification | AU-2, AU-12 |
| R-03 | Repudiation | Unauthenticated boundary crossing | AU-3, IA-2 |
| I-01 | Info Disclosure | Sensitive data cross-boundary flow | SC-8, SC-28 |
| I-02 | Info Disclosure | Credential store exposure | SC-28, IA-5 |
| I-03 | Info Disclosure | Unencrypted data flow | SC-8, SC-13 |
| I-04 | Info Disclosure | Cross-boundary data exposure | AC-4, SC-7 |
| D-01 | Denial of Service | Unbounded external input | SC-5, SI-10 |
| D-02 | Denial of Service | Resource exhaustion target | SC-5, CP-9 |
| D-03 | Denial of Service | Single point of failure | CP-9, CP-10 |
| E-01 | Elevation of Privilege | Cross-boundary privilege escalation | AC-6, AC-3 |
| E-02 | Elevation of Privilege | Direct data store access bypass | AC-3, AC-4 |
| E-03 | Elevation of Privilege | Broad trust boundary surface | AC-4, SC-7 |

---

## 11. OPEN ITEMS -- Must Resolve Before Building (Builder Agent Gaps)

These were identified by the builder agent during decomposition readiness assessment. Blocks are not decomposable until these are resolved.

### CRITICAL (Blocks Day 1-2 work)

**GAP-1: F-02 LLM Extraction Prompt Template**
The builder needs the exact system message and user message that tells Claude to extract `ParsedComponent`, `ParsedFlow`, and `ParsedBoundary` objects from raw PDF text. Including: how to handle ambiguous components, confidence thresholds, and output enforcement method (Bedrock tool_use vs JSON mode).

**GAP-2: F-08 AI Enhancement Prompt Template**
The builder needs the prompt for threat generation: instructions for referencing existing threat display_ids, distinguishing enhancement vs net-new, STRIDE category assignment, severity reasoning.

**GAP-3: F-07 Rule Condition Format**
The `RuleDefinition` model has `condition: str`. What is this string? Options:
- (a) Python callable name (simplest -- function reference)
- (b) DSL expression string
- (c) Dynamic code execution (NOT recommended -- security risk)
**Recommendation: (a) Python callable.** Each rule maps to a function in `rules_engine.py`. No dynamic execution, no DSL, no security risk.

### IMPORTANT (Blocks Mid-Week 1)

**GAP-4: dagre Layout Parameters**
Lock: `rankdir` = "LR" (left-to-right), `nodesep` = 80, `ranksep` = 120, `edgesep` = 30. Adjust during Week 1 testing.

**GAP-5: Trust Boundary Rendering in ReactFlow**
**Recommendation:** Use ReactFlow's built-in `parentNode` feature. Trust boundaries are parent nodes with `type: "group"`. Child nodes use `parentNode` prop. This gives free drag-with-parent behavior and visual grouping. Avoid custom SVG overlays.

**GAP-6: DFD Image Capture for PDF**
**Locked: Client-side capture.** Use `ReactFlow.toImage({ quality: 1.0, type: 'image/png' })`. Update `ReportRequest` model to include `dfd_image_base64: str` field. Frontend sends PNG with report request.

**GAP-7: Node Shape Specs**
- Process: rounded rectangle (not circle -- circles don't fit text well), #4A90D2 fill, white text
- Data Store: rectangle with double top/bottom border, #F5A623 fill, white text
- External Entity: rectangle, #7B8D8E fill, white text
- All nodes: 180x60px, 14px font. Adjust during testing.

### DEPENDENCY CONCERNS (Builder Worries)

**WORRY-1: F-02 to F-04 name matching.** Parser may extract "Payment Gateway" but flow references "payment-gateway". Need fuzzy matching (Levenshtein or normalized comparison) in F-04 when resolving flow sources/targets to node IDs.

**WORRY-2: Trust boundary source of truth.** `dfd_nodes.trust_boundary_id` AND `trust_boundaries.node_ids` is redundant. **Lock: `trust_boundaries.node_ids` is source of truth.** `trust_boundary_id` on nodes is a computed convenience field populated on read. Rules engine uses `trust_boundaries.node_ids` to determine boundary membership.

**WORRY-3: F-08 hallucinated threat IDs.** If AI references `enhances_rule_threat_id: "T-099"` and T-099 doesn't exist, **ignore the reference** -- treat it as a net-new AI threat. Log the mismatch for debugging.

**WORRY-4: Re-analyze timing.** After DFD edit + Save, the threat table shows stale threats. **Lock: Save does NOT auto-trigger re-analyze.** User clicks "Re-analyze" explicitly. This avoids surprise data loss and gives user control.

**WORRY-5: ReportRequest model gap.** Add `dfd_image_base64: Optional[str] = None` to `ReportRequest`. If not provided, PDF renders without DFD image (placeholder text).

---

## 12. Summary: What the Builder Agent Needs to Know

1. **Start with shared data models.** The Pydantic schemas and DB tables in Section 2 are the contracts. Define them, commit them, and do not change them without both engineers agreeing.

2. **Week 1 is about risk reduction.** If doc parsing and DFD generation work, the project succeeds. If they do not work by end of week 1, escalate immediately.

3. **The critical path runs through the backend.** F-02 -> F-04 -> F-07 -> F-08 is the chain. Eng-A must not get blocked on UI work. Eng-B can work in parallel on editor and table components using test fixtures.

4. **AI is optional; rules are not.** F-24 (graceful degradation) means the demo works without AI. Rules engine is the true foundation. AI is the "wow factor" but not the load-bearing wall.

5. **20 rules, not 40.** The lean scope is 20 rules. Do not build 40. The 20 rules listed in Section 9 are the specific ones.

6. **PDF report is the deliverable.** F-14 is what Priya hands to her CISO. It must look professional. Allocate time in week 3 for template polish.

7. **Re-analyze replaces threats.** When the user edits the DFD and re-analyzes, all existing threats are deleted and regenerated. Triage state is lost. This is acceptable for weeks 1-4. Warn the user.

---

*This plan is designed to be decomposed into implementation blocks by the builder agent. Each section maps to specific code that needs to be written, in a specific order, by a specific engineer.*
