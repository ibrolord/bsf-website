# ThreatGenix AI -- Customer Personas
## Canadian Challenger Banks (V1 Target Market)

**Last updated:** 2026-03-24
**Target segment:** Challenger banks (EQ Bank, Tangerine, Laurentian, Simplii, Manulife Bank)
**Typical team size at these orgs:** 3-8 person AppSec/Product Security team within a larger CISO org of 30-80

---

## Persona 1: Priya Narayanan -- The Practitioner

**Role:** Senior Threat Modeling Analyst / Application Security Analyst
**Archetype:** Primary User, Day-One Champion

### Who She Is

- **Title:** Senior Application Security Analyst
- **Reports to:** Manager, Application Security (or Director, Product Security)
- **Team:** 1 of 2-3 people who actually build threat models; sits within a 5-7 person AppSec team
- **Experience:** 5-8 years in security. Started in IT audit or SOC, moved into AppSec. Holds CISSP, working toward CCSP. Has used STRIDE since her second job.
- **Age/stage:** Early-to-mid 30s. Building her technical brand. Wants to be known as the threat modeling expert internally.
- **Salary band:** $95K-$120K CAD. Knows she is underpaid relative to Big Five equivalents doing the same work.
- **Location:** Toronto or remote-first (post-COVID challenger banks are mostly hybrid, 2 days in-office).

### Her Day-to-Day

Priya's week looks like this:

- **Monday:** Intake calls with 2 dev teams. One is launching a new API for open banking. The other is migrating a batch processing job to AWS Lambda. Neither team brought a complete design doc. The open banking team forgot trust boundaries entirely. The Lambda team has no idea what IAM role the function will assume. She spends the call asking questions the architects should have already answered.
- **Tuesday-Wednesday:** She is in Microsoft Threat Modeling Tool on her Windows VM (her daily driver is a Mac, so she runs Parallels). She draws data flow diagrams manually based on her intake notes and whatever architecture docs she could find in Confluence (half of which are outdated). She runs STRIDE analysis, generating 40+ threats per model, most of which are boilerplate. She manually filters to the 8-12 that actually matter for this system.
- **Thursday:** She maps threats to NIST 800-53 controls and writes up the report in Confluence. She spends 45 minutes formatting tables. She copies threat IDs into Jira tickets manually, tagging the owning dev team. She knows half these tickets will sit in backlog for months.
- **Friday:** She reviews a lighter threat model update for a system that added a new third-party integration. She also has a backlog of 3 models that are "in progress" but stalled because dev teams haven't responded to her follow-up questions about data classification and service account details.

She does 12-15 full threat models per year, plus 20-30 lighter reviews and updates. Each full model takes 2-4 weeks calendar time (waiting on dev teams) but only 3-6 hours of her actual focused work.

**Tools she uses daily:**
- Microsoft TMT (grudgingly -- it crashes, the templates are stale, no macOS native, no collaboration features)
- Draw.io or Visio for diagrams that need to look presentable to leadership
- Excel for risk scoring and control mapping matrices
- Confluence for reports
- Jira for remediation tracking
- Slack for chasing dev teams who ghost her follow-up questions
- Occasionally OWASP Threat Dragon, which she tried and abandoned because it lacked STRIDE automation

### Her Goals

**Professional:**
- Reduce the calendar time per threat model from 2-4 weeks to under 1 week. She knows 80% of the delay is not her work -- it is waiting for information and chasing people.
- Build a consistent, auditable threat model library that she can reference when OSFI examiners ask "show me your threat models for internet-facing systems."
- Be recognized as the person who modernized threat modeling at her bank. This is her path to a senior/staff title or a management role.

**Personal:**
- Stop doing the same repetitive STRIDE enumeration by hand. She knows what the threats are for a standard web API. She wants to focus on the novel, interesting attack vectors -- not re-deriving "spoofing of external entity" for the 200th time.
- Leave work at a reasonable hour. The threat model queue is growing faster than she can clear it, and she is starting to feel the burnout.

### Her Fears

- **Audit exposure:** OSFI B-13 says "maintain cyber threat models." If an examiner pulls a sample of 5 systems and she cannot produce a current threat model for 2 of them, that is a finding. Findings cascade to her manager, her director, and the CISO. She will be the one explaining the gap.
- **Missing something real:** Her worst nightmare is a breach on a system she modeled where the attack vector was something she should have caught but did not because she was rushing through boilerplate threats. She worries about this more than she admits.
- **Becoming a bottleneck:** Dev teams already see her as a gate. If she slows down further, teams will start skipping threat modeling entirely or doing their own half-baked versions that do not meet OSFI standards. Then she inherits the cleanup.
- **Tool lock-in and data loss:** She has 4 years of threat models in .tm7 files. If she moves to a new tool and cannot migrate or reference her history, she loses institutional knowledge.

### How She Evaluates Tools

**What matters (ranked):**
1. Does it actually speed up the STRIDE enumeration and control mapping? She will not adopt a tool that is just a prettier drawing canvas.
2. Can it ingest existing architecture artifacts (Confluence docs, draw.io diagrams, maybe even IaC templates) so she does not have to manually re-draw every DFD?
3. Does it generate reports that meet OSFI expectations? If she has to reformat everything into her bank's template anyway, the tool adds friction, not removes it.
4. Does it run on macOS natively or in a browser? She will not keep maintaining a Windows VM just for threat modeling.
5. Does it integrate with Jira for ticket creation?
6. Data residency: Does data stay in Canada? If it leaves ca-central-1, it is a non-starter. She will get asked this question by her security architecture team during procurement.

**Dealbreakers:**
- Requires uploading production architecture data to a US-hosted service.
- Cannot export to PDF/Confluence-compatible format.
- No support for STRIDE as a methodology (some newer tools push PASTA or attack trees only).
- Requires more than 15 minutes of setup before she can model her first system.

**Who else needs to approve:**
- Her manager (budget holder for small tools, typically under $10K/year).
- Security Architecture or Enterprise Architecture team (for tooling standards compliance).
- Procurement/vendor risk if the contract exceeds a threshold (usually $25K/year at challenger banks).
- IT/Cloud team for SaaS security review (SOC 2 Type II, penetration test report, data residency confirmation).

### Her Relationship to ThreatGenix

**She is the PRIMARY USER and the internal CHAMPION.**

Priya is the person who will find ThreatGenix on LinkedIn, request a demo, run a pilot on 2-3 models, and then go to her manager with a business case. She is the one who will live in the product daily. If she loves it, she sells it internally. If she finds it annoying, clunky, or inaccurate, she kills the deal by simply stopping using it during the pilot.

Her advocacy is necessary but not sufficient. She cannot approve budget alone. She needs her manager and potentially the Director/CISO to sign off.

### What Message Resonates

**DO say:** "ThreatGenix cuts your STRIDE enumeration and control mapping from 2 hours to 15 minutes -- and generates the OSFI-ready report automatically. You focus on the threats that actually matter."

**DO NOT say:** "AI-powered security platform that transforms your threat modeling practice." This is too vague. She has seen 50 tools claim this. She wants to see it work on a real system she is modeling right now.

**The demo that wins her:** Upload one of her existing Confluence design docs or draw.io diagrams. Watch ThreatGenix auto-generate a DFD with trust boundaries, run STRIDE, and produce a report she can compare against the model she already built manually. If the AI catches the missing trust boundary between the CDN and the API gateway that she also caught manually, she is sold.

### Her Quote

> "I don't need AI to tell me what STRIDE is. I need it to do the first 80% -- the boilerplate enumeration, the control mapping, the report formatting -- so I can spend my time on the 20% that actually requires a human brain. And I need it to run in Canada. That's not negotiable."

---

## Persona 2: Marcus Chen -- The Budget Holder

**Role:** Manager / Director, Application Security
**Archetype:** Economic Buyer, Internal Champion (if convinced)

### Who He Is

- **Title:** Director, Product Security (or Manager, Application Security -- titles vary at challenger banks)
- **Reports to:** CISO or VP, Information Security
- **Team:** Manages 4-7 people including threat modelers, AppSec engineers, and possibly a security champion program coordinator.
- **Experience:** 12-18 years in security. Started technical (pen testing or security engineering), moved into management. Holds CISSP and CISM. Has been through multiple OSFI examinations.
- **Age/stage:** Late 30s to mid 40s. Established leader. Thinking about his next move -- CISO at a smaller institution or VP at his current one.
- **Salary band:** $140K-$175K CAD (director level at a challenger bank; Big Five pays more).
- **Location:** Toronto. In-office 3 days a week because he attends leadership meetings and OSFI prep sessions in person.

### His Day-to-Day

Marcus does not build threat models anymore. He did, 6-8 years ago, and he still understands the methodology deeply. Now his job is:

- **Capacity planning:** He has 2-3 analysts doing threat models for 60+ applications in scope. The math does not work. At 12-15 models per analyst per year, he can cover 30-45 systems. The remaining 15-30 are either unmodeled or have stale models from 2+ years ago. OSFI examiners sample randomly. This is the gap that keeps him up at night.
- **OSFI preparation:** Every 12-18 months, OSFI does a supervisory review. He needs to show that cyber threat models exist for critical systems, that they are current, and that remediation items are being tracked. He spends 2-3 weeks before each review assembling evidence, chasing down completed Jira tickets, and making sure reports are formatted consistently. His team calls this "audit season" and dreads it.
- **Stakeholder management:** He spends significant time negotiating with development leadership about which systems get threat modeled and when. Dev leaders push back because threat modeling adds 2-4 weeks to their release timeline. Marcus has to make the case that this is regulatory hygiene, not optional.
- **Vendor management and tooling:** He manages the AppSec tooling budget ($50K-$150K/year at a challenger bank, covering SAST, DAST, SCA, and any manual tools). Threat modeling has historically had zero dedicated budget because Microsoft TMT is free. This means any new tool competes against "free."
- **Reporting upward:** Monthly security metrics to the CISO. He tracks: number of threat models completed vs. target, open high/critical findings, mean time to remediate, percentage of in-scope systems with current models. The last metric is the one he cannot move fast enough.

**Tools he personally uses:**
- PowerPoint (for leadership decks and OSFI evidence packages)
- Excel (for metrics dashboards -- he does not have a fancy BI tool)
- Jira dashboards (to track remediation across teams)
- Confluence (to review his team's reports)
- His team's output is his input

### His Goals

**Professional:**
- Get threat model coverage from ~55% of in-scope systems to 90%+ without hiring another analyst. His headcount request for FY2027 was denied. He needs to do more with the same team.
- Survive the next OSFI examination with zero material findings related to threat modeling.
- Standardize threat model quality across his team. Right now, Priya's models are thorough and consistent. The other analyst's models are less rigorous. He needs a tool that enforces a baseline.

**Personal:**
- Demonstrate measurable improvement in his team's output to justify his case for the CISO/VP role. "I increased threat model coverage by 2x without adding headcount" is a compelling story.
- Reduce the pre-audit fire drill. He wants threat models to be continuously audit-ready, not scrambled together 3 weeks before OSFI shows up.

### His Fears

- **OSFI material finding:** A material finding on threat modeling coverage goes to the Board Risk Committee. His name is on the response plan. This is career-damaging at a challenger bank where the CISO is 2 levels above him, not 5.
- **Team attrition:** Priya is his best analyst. If she burns out on repetitive work and leaves for a Big Five bank that pays $20K more, he cannot replace her quickly. The market for experienced threat modeling analysts in Canada is thin. Typical time-to-hire: 4-6 months.
- **Tool risk:** He has been burned by SaaS vendors before. One went through an acquisition and doubled pricing. Another had a data breach. If he adopts ThreatGenix and it fails, he owns that decision. If he sticks with Microsoft TMT and OSFI finds coverage gaps, he can point to resource constraints. There is an asymmetry in blame that makes him cautious.
- **AI accuracy:** If an AI-generated threat model misses a critical threat, and that becomes an audit finding or worse, a breach, the fact that "the AI missed it" is not a defense. His team is still accountable. He needs to understand the AI's false negative rate.

### How He Evaluates Tools

**What matters (ranked):**
1. ROI narrative: How many additional threat models can my existing team produce per year? If ThreatGenix doubles throughput, that is worth $83K-$155K/year in avoided hiring (one FTE equivalent). This is the business case.
2. Audit readiness: Does ThreatGenix produce artifacts that directly satisfy OSFI B-13 Section 3.1.6? Can he generate a "state of threat modeling" report for OSFI prep in 30 minutes instead of 3 weeks?
3. Quality consistency: Does the tool enforce a standard methodology (STRIDE, NIST 800-53 mapping) regardless of which analyst uses it?
4. Vendor risk: SOC 2 Type II, Canadian data residency, company stability (funding, runway, customer count), incident response SLA, data processing agreement compliant with PIPEDA.
5. Integration: Jira, Confluence, SSO (Okta/Azure AD). If it does not support SSO, procurement will reject it.
6. Price: Needs to be justifiable against the "free" baseline of Microsoft TMT. Sweet spot is $15K-$40K/year for a team license -- significant enough to take seriously, small enough to approve without VP-level sign-off at most challenger banks.

**Dealbreakers:**
- No SOC 2 Type II report.
- Data leaves Canada.
- No SSO support.
- Per-model pricing that makes cost unpredictable. He needs a flat annual number for budget planning.
- Vendor has fewer than 2 years of operating history and no reference customers in Canadian financial services. (Note: this is a real challenge for ThreatGenix at launch -- addressed in the Relationship section.)

**Approval chain:**
- He can approve tools up to ~$25K/year at most challenger banks.
- Above that, his CISO needs to sign off.
- Procurement runs a vendor risk assessment regardless of price if the tool processes confidential data (which threat models absolutely do).
- Legal reviews the MSA and DPA.

### His Relationship to ThreatGenix

**He is the ECONOMIC BUYER and the deal gatekeeper.**

Marcus will not find ThreatGenix himself. Priya will bring it to him. His first reaction will be cautious interest followed by a series of risk questions: Who is behind this company? Where is the data stored? Do you have a SOC 2? Who else in Canadian banking is using this?

If Priya runs a successful pilot and can show him "I modeled System X in 45 minutes instead of 5 hours, and the output met our documentation standard," Marcus will build the business case. But he will need help. He will want:
- A one-page ROI calculator he can put in front of the CISO.
- A reference customer (even one) in Canadian financial services.
- A vendor risk questionnaire pre-filled with answers about data residency, encryption, and incident response.

The founder's EQ Bank and BMO background is a significant trust signal for Marcus. It says "this person has sat in my chair and understands my constraints." Lead with this in the sales conversation.

### What Message Resonates

**DO say:** "Your team does 30-45 models a year. You need to cover 60+ systems. ThreatGenix lets the same team cover 80+ without hiring, and every model is OSFI-ready from day one. Here is the math."

**DO NOT say:** "We use cutting-edge AI to revolutionize threat modeling." He does not care about the technology. He cares about the outcome: coverage, consistency, and audit readiness.

**The meeting that wins him:** A 30-minute call where the founder (who worked at EQ Bank and BMO) walks Marcus through: (1) the coverage gap problem, using numbers Marcus will recognize as accurate; (2) a live demo where an existing design doc becomes a complete threat model in 20 minutes; (3) the ROI model showing payback in under 6 months based on avoided hiring; (4) the data residency and SOC 2 story. In that order.

### His Quote

> "I don't have a tooling problem. I have a capacity problem. I have three people covering sixty systems, and OSFI doesn't care about my headcount constraints. If this tool can get me to 90% coverage without adding heads, I'll find the budget. But I need to know the AI isn't going to miss something that gets me a finding."

---

## Persona 3: David Okafor -- The Security Architect Gatekeeper

**Role:** Senior Security Architect / Enterprise Security Architecture
**Archetype:** Technical Evaluator, Potential Blocker

### Who He Is

- **Title:** Senior Security Architect (or Principal Security Architect at larger challenger banks)
- **Reports to:** Director, Security Architecture or Chief Architect. Often in a different reporting line than AppSec -- he sits in Enterprise Architecture or Technology Risk, not under the CISO.
- **Team:** 3-5 security architects. They define security standards, review architecture decisions, and own the control framework mapping (NIST 800-53, ISO 27001).
- **Experience:** 15-20 years. Deep infrastructure and cloud background. Was a systems architect or cloud architect before specializing in security. Holds CISSP, CCSP, and possibly TOGAF.
- **Age/stage:** Mid 40s. He is not climbing anymore. He is the institutional expert. People come to him.
- **Salary band:** $135K-$165K CAD. He could make more at a Big Five but values the smaller team and broader influence at a challenger bank.
- **Location:** Toronto or Ottawa. In-office 2-3 days.

### His Day-to-Day

David does not build threat models. But he does two things that make him critical:

1. **He reviews threat models for architectural accuracy.** When Priya completes a threat model for a new system, David (or someone on his team) reviews it to ensure the data flow diagram correctly represents the actual architecture, the trust boundaries are placed correctly, and the control mappings align with the bank's control framework. He catches errors. He is the quality gate.
2. **He approves new security tooling.** Any SaaS tool that processes confidential bank data goes through his team's security architecture review. He evaluates: data flow, encryption (at rest and in transit), authentication/authorization model, API security, network architecture, compliance posture. His "no" kills deals.

He also:
- Defines the bank's reference architectures for cloud (AWS, Azure).
- Maintains the internal security standards and guidelines that threat modelers reference.
- Participates in incident response as the architecture subject matter expert.
- Reviews third-party vendor integrations (which is directly relevant to threat modeling -- third-party data flows are the most common gap in design docs).

**Tools he personally uses:**
- AWS console and CloudFormation/Terraform (he reads IaC to understand actual architecture, not just what the design doc says)
- Internal architecture repository (typically Confluence or an enterprise architecture tool like LeanIX or Ardoq)
- Draw.io / Visio for his own reference architecture diagrams
- Jira for tracking architecture review findings

### His Goals

**Professional:**
- Ensure that security tooling adopted by the bank meets his architectural and compliance standards. He is the last line of defense against shadow IT in the security function.
- Improve the accuracy of threat models. He is tired of reviewing models where the DFD does not match the actual deployed architecture. He wants threat models to be grounded in reality, not aspirational design docs.

**Personal:**
- Protect his credibility. If he approves a tool that later has a data breach or compliance issue, his judgment is questioned. He would rather block something questionable than approve something risky.
- Maintain his influence. The security architect role is advisory, not authoritative. His power comes from being right, consistently. If a tool he blocked turns out to be genuinely useful and someone goes over his head, he loses credibility.

### His Fears

- **Vendor data breach:** If ThreatGenix stores threat model data (which includes detailed architecture descriptions, data flows, trust boundaries, and control gaps for the bank's systems) and gets breached, the attacker has a roadmap for compromising the bank. This is his number one concern. Threat model data is among the most sensitive non-customer data a bank produces.
- **AI hallucination in security context:** If the AI generates a threat model that says "Control X mitigates Threat Y" and that mapping is wrong, it creates a false sense of security. He has seen this with other AI security tools. He will stress-test the AI's accuracy.
- **Architectural drift:** If ThreatGenix generates DFDs based on stale design docs, the threat model is wrong from the start. He wants to know: how does ThreatGenix ensure the architecture input is current?
- **Lock-in and data portability:** If the bank puts 3 years of threat models into ThreatGenix and the vendor goes under, can they export everything? In what format?

### How He Evaluates Tools

**What matters (ranked):**
1. Security posture of the vendor itself. SOC 2 Type II is table stakes. He will also want: penetration test summary, encryption details (AES-256 at rest, TLS 1.3 in transit, key management approach), network architecture diagram, incident response plan, backup and disaster recovery.
2. Data residency and data flow. Where exactly is the data? Which AWS region? Are there any sub-processors outside Canada? Does telemetry or logging data leave Canada? What about the AI model -- is inference happening in Canada or does data hit a US-based API?
3. Authentication and authorization. Must support SAML 2.0 or OIDC SSO. Must support RBAC (not all analysts should see all threat models -- some are for crown jewel systems with restricted access). Must support MFA.
4. Data portability. Export formats. API access to extract data programmatically.
5. AI model transparency. What model powers the AI? Is it a hosted LLM (OpenAI, Anthropic, etc.)? If so, what is the data processing agreement? Is the bank's data used for model training? This is a P0 question.

**Dealbreakers:**
- AI inference happens outside Canada (even if storage is in Canada).
- Bank data is used for model training.
- No SOC 2 Type II.
- No SSO/SAML support.
- Cannot export all data in a standard, machine-readable format.
- The vendor cannot provide a network architecture diagram of their own platform.

**He does not approve budget. He approves architecture.**

### His Relationship to ThreatGenix

**He is the TECHNICAL GATEKEEPER and potential BLOCKER.**

David does not seek out ThreatGenix. He enters the picture when Marcus's team submits a "New SaaS Vendor" request through the internal review process. David receives the request and begins his evaluation. He will:

1. Request ThreatGenix's security documentation package (SOC 2, pen test summary, architecture diagram, DPA).
2. Map ThreatGenix's data flow: what data enters the system, where it is processed, where it is stored, what leaves the system.
3. Evaluate the AI component specifically: what model, where inference runs, data retention policy, training data policy.
4. Produce a recommendation: Approve, Approve with Conditions, or Reject.

If ThreatGenix does not have its security documentation ready and organized, David will delay the review indefinitely. He has a backlog of 15-20 vendor reviews. Tools that come with incomplete documentation go to the bottom of the pile.

The fastest path through David is to proactively provide everything he needs before he asks. The founder's banking background is a signal that they know what David will ask for. Use that.

**Turning David from Blocker to Ally:**

If ThreatGenix's own threat model is available as a sample artifact ("here is how we modeled our own platform"), David will be impressed. It demonstrates that the company eats its own cooking and that the output is high quality. This is the single most powerful move in the sales process for this persona.

### What Message Resonates

**DO say:** "All data stays in AWS ca-central-1. AI inference runs in Canada. No data is used for model training. Here is our SOC 2 report, pen test summary, architecture diagram, and DPA. We also built a threat model of our own platform using ThreatGenix -- here it is."

**DO NOT say:** Anything about features, workflow improvement, or ROI. He does not care about that. Those are Marcus's and Priya's concerns. David cares about one thing: is this tool safe to deploy in our environment?

### His Quote

> "I don't care how fast it makes threat modeling. I care what happens to our architecture data when it's inside their system. Show me the data flow. Show me where inference runs. Show me the SOC 2. Then we can talk."

---

## Persona 4: Samira Khorasani -- The CISO Sponsor

**Role:** Chief Information Security Officer
**Archetype:** Executive Sponsor, Final Approval for Strategic Purchases

### Who She Is

- **Title:** CISO (or VP, Information Security at banks that do not use the CISO title)
- **Reports to:** CRO (Chief Risk Officer) or CTO, with a dotted line to the Board Risk Committee
- **Team:** Oversees 30-60 people across AppSec, SecOps, GRC, Identity, and Security Architecture.
- **Experience:** 20+ years. Has held CISO or deputy CISO roles at 2-3 institutions. Deep regulatory experience. Knows OSFI examiners by name.
- **Age/stage:** Late 40s to mid 50s. This is her destination role. She is focused on legacy -- building a security program that outlasts her tenure.
- **Salary band:** $220K-$300K+ CAD (total comp including bonus).
- **Location:** Toronto. In-office 4 days. She is visible.

### Her Day-to-Day

Samira does not touch threat models, tools, or technical artifacts. Her world is:

- **Board and executive communication:** Monthly reports to the Board Risk Committee. Quarterly presentations to the Executive Committee. She translates technical risk into business language. "We have threat model coverage for 55% of in-scope systems" becomes "We have blind spots in our understanding of attack surface for 27 critical systems, including our core banking integration and open banking API."
- **Regulatory relationship management:** Direct interaction with OSFI. She manages supervisory expectations, responds to examination findings, and negotiates timelines for remediation. She has 6-12 months to close a material finding before it escalates.
- **Budget defense:** She fights for her annual budget against competing priorities from Technology, Product, and Operations. Security is a cost center. Every dollar she spends needs to be justified in terms of risk reduction or regulatory compliance.
- **Strategic program building:** She is building a security program that is proportionate to the bank's risk profile (OSFI's language). This means she needs to show not just that controls exist, but that they are effective and continuously improving.
- **Incident management:** She is the executive accountable during a security incident. She briefs the CEO, the Board, and potentially the media. The quality of her team's threat models directly affects incident response speed -- if the team has a current threat model for the breached system, they understand the attack surface immediately.

### Her Goals

**Professional:**
- Zero material OSFI findings in her tenure. This is her primary KPI.
- Demonstrate program maturity improvement year-over-year. She uses a maturity model (often based on NIST CSF or C2M2) and reports progress to the Board.
- Build a reputation as a CISO who modernizes security without excessive spending. Challenger banks cannot outspend Big Five banks on security. She needs to be smarter, not richer.

**Personal:**
- Maintain Board confidence. If the Board loses confidence in her, she is replaced. Board confidence is built through consistent, clear communication and no surprises.
- Attract and retain talent. She knows her compensation bands are below Big Five. She retains people through culture, interesting work, and modern tooling. Giving her team good tools is a retention strategy.

### Her Fears

- **A breach that was foreseeable.** Not just any breach -- a breach where the post-mortem reveals the attack vector was in scope for threat modeling and was either not modeled or modeled inadequately. This is career-ending.
- **OSFI escalation.** A material finding that she cannot close within the expected timeframe. This triggers heightened supervisory attention, additional reporting requirements, and Board-level scrutiny.
- **Key person dependency.** If Marcus or Priya leaves and threat modeling capability drops, she has a single point of failure in a regulatory-mandated activity. She wants the process to be tool-enabled and repeatable, not dependent on individual expertise.
- **AI governance exposure.** If her team adopts an AI tool that mishandles data or produces inaccurate outputs, and this surfaces in an OSFI examination, she has an AI governance problem on top of a threat modeling problem. She needs to know the AI is governed.

### How She Evaluates Tools

Samira does not evaluate tools in the traditional sense. She evaluates strategic investments. Her filter:

1. **Does this close a regulatory gap?** If Marcus tells her "this tool gets us from 55% to 90% threat model coverage," she hears "this reduces our probability of a material OSFI finding by a factor of X." That is what she cares about.
2. **Is the vendor going to be around in 3 years?** She does not want to explain to the Board why a critical security tool's vendor went bankrupt. She will ask about funding, runway, and customer traction.
3. **Does this create new risk?** AI tools processing sensitive security data create AI governance risk. She needs to know her team has evaluated this and the risk is acceptable.
4. **What is the total cost of ownership?** Not just license cost. Implementation time, training, ongoing maintenance, integration work. What does her team NOT do while they are adopting this tool?
5. **Can I tell a good story about this to the Board?** "We adopted an AI-powered threat modeling platform built by former Canadian banking security professionals, hosted entirely in Canada, that doubled our threat model coverage" -- that is a story that works.

**She will approve the purchase if:**
- Marcus recommends it with data.
- David has cleared it architecturally.
- The price is reasonable relative to the value (she is comparing against the cost of hiring another analyst, ~$100K+ fully loaded).
- It does not create a P0 vendor risk.

### Her Relationship to ThreatGenix

**She is the EXECUTIVE SPONSOR. She does not use the product, evaluate the product, or (usually) even see the product. She approves the investment based on her team's recommendation.**

Samira enters the picture in two scenarios:
1. The annual cost exceeds Marcus's approval authority (roughly $25K+ at most challenger banks).
2. The AI component triggers an AI governance review, which may require her sign-off.

She will spend a maximum of 15 minutes on this decision. She will read Marcus's one-page business case. She may ask David one question: "Are you comfortable with the data residency and AI governance posture?" If both say yes, she signs.

**The risk for ThreatGenix:** If Marcus or David cannot give Samira a clean recommendation, the deal dies at her level. She will not overrule her team to adopt a tool. She trusts their judgment. This means the sale is actually won or lost with Personas 1-3. Samira is the rubber stamp, but only if everything upstream is clean.

### What Message Resonates

Samira will likely never see a ThreatGenix pitch deck. But if she does, the message that resonates is:

**DO say:** "Built by former EQ Bank and BMO threat modeling practitioners. Canadian-hosted. Doubles your team's threat model coverage without adding headcount. OSFI-ready output."

**DO NOT say:** Anything about AI, machine learning, or technology. She does not care about the mechanism. She cares about the outcome: regulatory compliance, risk reduction, and team efficiency.

**If you get 5 minutes with Samira** (e.g., at a CISO roundtable, a conference, or a warm intro): Lead with the founder story. "I was the person building threat models at EQ Bank and BMO. I lived the 55% coverage problem. I built the tool I wished I had. It is hosted in Canada, it is purpose-built for OSFI compliance, and it doubles analyst throughput." That is a 30-second pitch that gets a follow-up meeting -- with Marcus, not Samira. She will delegate the evaluation.

### Her Quote

> "I don't need another AI tool. I need 90% threat model coverage before the next OSFI examination, and I need my team to stop burning out. If your product does that and doesn't create a new risk vector, talk to my Director."

---

## Persona Interaction Map: How the Deal Moves

```
Priya (User/Champion)
  |
  | "I found this tool, it cut my modeling time by 70%, here's my pilot data"
  v
Marcus (Budget Holder)
  |
  +---> David (Security Architect)
  |       |
  |       | "Architecture review: Approve / Approve with conditions / Reject"
  |       v
  |     (If Approved)
  |
  | "Business case: ROI + regulatory coverage + David's approval"
  v
Samira (CISO)
  |
  | "Approved. Track it in our quarterly metrics."
  v
Procurement / Legal (Contract execution)
```

**Critical path:** Priya --> Marcus --> David (parallel) --> Samira
**Most likely point of failure:** David's architecture review (if security documentation is incomplete)
**Second most likely point of failure:** Marcus's risk aversion (if no reference customers exist in Canadian banking)

---

## Implications for ThreatGenix Go-to-Market

### What to Build Before Selling

1. **SOC 2 Type II report** (or at minimum, Type I with a Type II timeline). Non-negotiable for David.
2. **Pre-filled vendor risk questionnaire** in the format Canadian banks expect (CAIQ or SIG Lite). Save David and procurement 2 weeks of back-and-forth.
3. **OSFI B-13 compliance mapping document** showing exactly how ThreatGenix output satisfies Section 3.1.6 requirements. This is Marcus's internal selling tool.
4. **ROI calculator** showing throughput increase and avoided hiring cost. This is Marcus's business case to Samira.
5. **ThreatGenix's own threat model** built using ThreatGenix. This is the most powerful sales artifact for David. It is also a quality proof for Priya.

### How to Sequence the Sale

1. **Find Priya.** LinkedIn, security meetups (OWASP Toronto, SecTor conference), or direct outreach to AppSec teams at target banks.
2. **Give Priya a free pilot.** 30 days, 3-5 models, no procurement required if the tool does not touch production data during the pilot (use sanitized architecture docs).
3. **Arm Priya with data.** After the pilot, give her a comparison report: time per model (before vs. after), threats identified (manual vs. ThreatGenix), coverage gap closed.
4. **Meet Marcus.** Priya introduces. Lead with the founder story and the ROI math. Provide the vendor risk questionnaire and SOC 2 proactively.
5. **Survive David.** Proactively send the security documentation package. Offer a technical deep-dive call. Show the self-threat-model.
6. **Samira sees a one-pager.** Marcus handles this. Your job is to make Marcus's job easy by giving him the artifacts.

### Pricing Guidance Based on Personas

- Priya's pain threshold: She will advocate for a tool up to ~$500/month without much internal friction. Above that, it feels expensive to her.
- Marcus's budget authority: Typically $15K-$30K/year without needing CISO approval at a challenger bank.
- Samira's value comparison: She is comparing against ~$120K/year (fully loaded cost of another analyst). Anything under $50K/year with demonstrable throughput doubling is an easy yes.
- **Sweet spot for V1:** $18K-$30K/year for a team license (3-5 seats). Low enough for Marcus to approve, high enough to signal enterprise seriousness, and easy ROI story against an analyst hire.
