# Change Management Gap Analysis (Detailed)

Date: 2026-03-10  
Primary audience: Product Manager, Business Architect, AI process for user-story generation  
Objective: Identify what is left to implement to reach a state-of-the-art, standards-aligned change management system across manufacturing, automotive, aerospace, electronics, and construction.

## Prioritization Scale

| Importance | Meaning for Planning |
|---|---|
| `Critical` | Needed to claim enterprise-grade, standards-aligned change governance across regulated industries. Prioritize immediately. |
| `High` | Strong competitive and compliance impact; should be in near-term roadmap after critical items. |
| `Medium` | Valuable accelerator and efficiency feature; plan after governance/compliance core. |

## Detailed Gap Backlog (Story-Ready)

| Gap ID | Importance | Industry Coverage | Current State (Observed) | State-of-the-Art Target | What Must Happen (Definition of Done Direction) | Candidate Story Seeds | EXA (User View) |
|---|---|---|---|---|---|---|---|
| GAP-01 | Critical | All | System produces row-level diff outputs but no formal ECO/ECN object lifecycle. | End-to-end controlled change workflow with states and policy gates. | Implement change object (`Draft -> Impact Review -> Approval -> Released -> Implemented -> Closed`), enforce state transitions, mandatory approvals, and full transition audit. | As an engineering lead, I need controlled change states so no unapproved BOM change reaches release. | I create a change request from a diff, move it to review, and the system blocks release until all required approvals are complete. |
| GAP-02 | Critical | All | Access is mostly owner/invitee/admin; no function-specific approval routing. | Role-based workflow by function (Engineering, Purchasing, Quality, Manufacturing, Support). | Add granular RBAC/ABAC and approval matrices by change class, commodity, plant, and risk level. | As a product manager, I need configurable approval routing so each change gets the right reviewers. | When I submit a high-risk supplier change, it auto-routes to Engineering, Purchasing, and Quality based on policy and waits for all sign-offs. |
| GAP-03 | Critical | Manufacturing, Automotive, Aerospace | Effectivity/change-control fields are secondary context only. | Full effectivity management (date/serial/lot/plant/unit) on every approved change. | Add effectivity schema, validation rules, overlap/conflict detection, and effectivity-aware diff/release views. | As a manufacturing lead, I need effectivity windows so plants apply the right revision at the right time. | I set start/end dates and serial ranges for a change, and the system validates conflicts before release. |
| GAP-04 | Critical | All | Diff results exist, but release baseline governance is not a controlled configuration baseline process. | Immutable, approved configuration baselines with controlled supersession and rollback trace. | Introduce baseline entity, release signature checkpoints, supersession linking, and baseline integrity checks. | As a support lead, I need authoritative baselines so operations can trace exactly what was active in production. | I publish an approved baseline, and later teams can always see which baseline was active for each product and when it was superseded. |
| GAP-05 | High | Automotive, Aerospace | No APQP/PPAP package workflow in current product surfaces. | Automated APQP/PPAP evidence packaging tied to each approved change. | Generate submission bundles from change data, validations, and evidence; support customer-specific templates and approval checkpoints. | As a purchasing lead, I need PPAP-ready outputs so supplier/customer approvals are faster and auditable. | I click generate package and get a customer-ready APQP/PPAP bundle with linked evidence and approval status. |
| GAP-06 | High | Aerospace, Manufacturing, Automotive | Audit events exist, but no explicit Change Control Board (CCB) operating model. | CCB-ready governance with meeting agenda, decision capture, and exception policy handling. | Add CCB queue, decision records, waiver/deviation flows, and linkage to affected BOM revisions. | As an engineering manager, I need CCB decisions linked to BOM deltas for audit readiness. | I prepare a CCB agenda from pending changes, record decisions in-app, and every approval or waiver is tied to the exact BOM revision. |
| GAP-07 | High | Electronics | No material declaration compliance engine for IEC 62474 / IPC declaration flows. | Integrated compliance check for declarable substances and threshold violations. | Model declaration data, ingest supplier declarations, evaluate rules, block risky releases, and generate compliance reports. | As a compliance lead, I need automatic material compliance checks before release. | I upload supplier declarations, and the system flags restricted-substance issues before I can release the change. |
| GAP-08 | High | Electronics, Manufacturing | Traceability exists at comparison level, not full lot/serial genealogy levels. | End-to-end part/material genealogy aligned to electronics/manufacturing traceability practices. | Add traceability level model, lot/serial linkage, upstream/downstream impact traversal, and recall-ready queries. | As a support lead, I need genealogy queries so incidents can isolate affected builds quickly. | During an incident, I enter a lot or serial and instantly see all impacted assemblies and downstream products. |
| GAP-09 | High | Construction | Current workflow is BOM-centric; not BIM information-delivery workflow native. | ISO 19650/IDM-aligned construction information change packages. | Add CDE-aligned roles, information delivery milestones, issue/change package handoffs, and approval gates per project phase. | As a construction PM, I need information delivery gates so design/build changes are contractually controlled. | I submit a model information change package and it follows project-stage gates with approvals by the correct CDE roles. |
| GAP-10 | High | Construction, Manufacturing, Electronics | No native open-standard exchange orchestration across IFC/AP242/IPC flows. | Standards-native interoperability for digital thread continuity. | Implement import/export adapters and validation for IFC, AP242, and IPC exchange profiles with schema checks and mapping governance. | As a business architect, I need standards connectors so change data moves across toolchain without manual rework. | I import from one engineering system and export to another using standards profiles, with schema validation preventing broken handoffs. |
| GAP-11 | High | All | Current impact view is row delta-focused; no business impact/risk scoring engine. | Multi-dimensional impact analysis (cost, schedule, quality, supplier risk, compliance). | Add impact scoring model, configurable risk rules, and decision dashboards before approval. | As a change approver, I need impact scores so high-risk changes trigger stronger governance. | Before approving, I see one risk score with cost, schedule, supplier, and compliance impact broken down. |
| GAP-12 | High | All regulated contexts | Audit export/archive exists, but long-term immutable legal-hold-grade control is partial. | WORM-capable, policy-driven audit retention/legal hold with tamper evidence. | Add immutable storage policy controls, legal hold workflows, retention policy by tenant/region, and integrity attestation. | As a compliance owner, I need non-repudiable audit retention for external audits and disputes. | When legal hold is enabled, audit records are locked from deletion and I can produce integrity-proof export packages for auditors. |
| GAP-13 | Medium | All | Notifications exist, but closed-loop action management is limited. | Actionable tasks with due dates, escalation, SLA tracking, and acknowledgment. | Convert notifications into workflow tasks; add assignment, reminders, overdue escalation, and completion evidence. | As a support lead, I need SLA-tracked tasks so change actions are not lost. | A completion alert becomes an assigned task with due date, reminders, and escalation if I do not close it on time. |
| GAP-14 | Medium | All | Supplier sharing is present (view/invite/revoke), but collaboration is minimal. | Controlled supplier collaboration workspace with structured response capture. | Add supplier response forms, attachment workflows, approval requirements, and supplier-side audit trail. | As purchasing, I need supplier commitments captured against each change package. | I invite a supplier to respond to a change package, collect their attachments and commitments, and approve or reject in one flow. |
| GAP-15 | Medium | Automotive, Aerospace, Manufacturing | No direct integration pattern to quality events (NCR/CAPA/8D). | Closed-loop quality integration from issue to change and back to verification. | Add quality-event links, mandatory corrective-action trace, and effectiveness verification checkpoints post-implementation. | As quality lead, I need CAPA linkage so recurring defects are measured against change outcomes. | I link an NCR/CAPA record to a change and later confirm whether defect recurrence drops after implementation. |
| GAP-16 | Medium | All | Metrics are technical/performance focused; limited function-facing governance KPIs. | Executive/functional dashboards for engineering, purchasing, support, and compliance. | Add KPI layer (`approval lead time`, `change aging`, `rework rate`, `supplier response SLA`, `compliance pass rate`) and drilldowns. | As a product manager, I need KPI visibility to prioritize backlog by business impact. | I open a dashboard by function and see aging approvals, rework rate, and supplier SLA misses with drilldown by plant or program. |
| GAP-17 | Medium | All | AI story generation input is not explicitly modeled as structured gap entities. | Machine-readable gap model for AI-assisted backlog decomposition. | Add canonical gap schema (`capability`, `standard_driver`, `risk`, `persona`, `acceptance_criteria`, `dependencies`) and export endpoint. | As an AI process owner, I need structured gap exports to auto-generate high-quality user stories. | I export the gap list as structured JSON and the AI process turns each gap into epics, stories, and acceptance criteria automatically. |

## Cross-Industry Priority View

| Importance | Recommended Sequence |
|---|---|
| `Critical` | GAP-01, GAP-02, GAP-03, GAP-04 |
| `High` | GAP-05, GAP-06, GAP-07, GAP-08, GAP-09, GAP-10, GAP-11, GAP-12 |
| `Medium` | GAP-13, GAP-14, GAP-15, GAP-16, GAP-17 |

## Suggested Epic Grouping

| Epic Group | Gaps |
|---|---|
| Change Governance Core | GAP-01, GAP-02, GAP-03, GAP-04 |
| Industry Compliance Packs | GAP-05, GAP-06, GAP-07, GAP-08, GAP-09 |
| Digital Thread + Interoperability | GAP-10, GAP-11, GAP-12 |
| Operational Excellence + AI Backlog Automation | GAP-13, GAP-14, GAP-15, GAP-16, GAP-17 |

## Evidence Basis (Current Platform)

- Change taxonomy and classification: `apps/backend/src/diff/diff-contract.ts`, `apps/backend/src/diff/classification.service.ts`
- Rationale propagation: `apps/backend/src/diff/diff-computation.service.ts`
- Match decision paths: `apps/backend/src/diff/matcher.service.ts`
- Audit/retention/admin surfaces: `apps/backend/src/audit/*`, `apps/backend/src/retention/*`, `apps/backend/src/admin/*`
- Product scope and stage boundaries: `V1_SPEC.md`, `PRODUCT_PLAN.md`, `V1_KnoWNLimitations.md`

## Standards Basis (Checked 2026-03-10)

- ISO 9001, ISO 10007, ISO 10303-242
- IATF 16949 and AIAG Core Tools references
- AS9100D, AS9145, EIA-649C
- IEC 62474, IPC-1752, IPC-2591, IPC-DPMX/2581
- ISO 19650-1, ISO 19650-2, ISO 29481-1:2025, ISO 16739-1 standard lineage
