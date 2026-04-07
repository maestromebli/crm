# AI-Powered CRM: Unified Manufacturing & Sales — Implementation-Oriented Product Specification

**Version:** 1.0  
**Audience:** Product, UX, Engineering, Legal/Ops stakeholders  
**Stack assumption:** PostgreSQL, event-driven backend, object storage for files, external Diia.Signature provider  

This document is **implementation-oriented**: it is intended to decompose into epics, user stories, DB migrations, API contracts, and UI tickets—not generic CRM theory.

**Companion architecture (documents as first-class entities, contract structure, Diia.Signature, versioning, readiness gates):** [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md). Use it for DB shapes, UX rules, edge cases, and automation inventory; this spec remains the end-to-end product narrative.

---

## SECTION 1 — IDEAL END-TO-END BUSINESS FLOW

### Step 1 — Lead intake (creation)

| Attribute | Definition |
|-----------|------------|
| **Step name** | Lead captured |
| **Business goal** | Capture demand with minimal friction; avoid duplicate records. |
| **Who performs** | Sales, marketing automation, partner, inbound call center, or system (web form / integration). |
| **Where in UI** | **Leads** list + quick-create; **Inbox** (message → create lead); **Dashboard** widget “Новий лід”; optional embedded form. |
| **Required data** | Title/summary, **source**, **pipeline** (or default), **stage** (e.g. New), **owner** (or queue rules). |
| **Optional** | Contact hints (name, phone, email), product interest, budget, geography, channel thread id. |
| **Automatic** | Dedup suggestion (phone/email fuzzy); default pipeline/stage; SLA clock start; activity log `LEAD_CREATED`; optional AI classification + score draft. |
| **Manual** | Confirm/correct AI fields; choose owner if not auto-assigned. |
| **AI** | Classify intent (kitchen / office / etc.), language, urgency; extract entities from free text; flag risk (competitor mention, “urgent today”). |
| **Files** | Usually none; optional photos from messenger → **unlinked ingest** → user confirms link. |
| **Events emitted** | `lead.created`, `lead.owner_assigned`, `ai.lead_classified` (async). |
| **State** | Lead `OPEN`, stage = first of lead pipeline. |
| **Blockers** | None for creation; **duplicate conflict** blocks “save as new” until user resolves merge/skip. |
| **If missing** | If no owner and no queue rule → assign to **round-robin pool** or **unassigned queue** (visible on dashboard). |

**Who creates the lead:** anyone with `lead.create`; integrations with service account; public form with captcha + rate limits.

**How it enters DB:** API `POST /leads` or workflow trigger `inbound.message.received` → create lead + link conversation.

---

### Step 2 — Qualification

| Attribute | Definition |
|-----------|------------|
| **Step name** | Qualification complete |
| **Business goal** | Decide fit, budget realism, authority, timeline; convert or disqualify. |
| **Who performs** | Sales (primary); Manager may override stage. |
| **Where** | **Unified workspace** tab **Qualification** (once deal exists, same tab on deal); on pure lead, **Lead** workspace variant or lead detail until conversion. |
| **Required** | Qualification checklist (configurable per pipeline): e.g. budget range, decision maker, technical feasibility flag, payment ability. |
| **Optional** | Competitor, objections, internal notes. |
| **Automatic** | Tasks from template; reminders if SLA; AI “missing fields” panel; on all required checks → emit `lead.qualified`. |
| **Manual** | Mark checklist items; write notes; schedule call. |
| **AI** | Next questions to ask; summarize last 3 conversations; detect contradictions (client said “next month” vs task “this week”). |
| **Files** | Optional reference photos, competitor brochures → categories `REFERENCE`, `BRIEF`. |
| **Events** | `lead.qualification.updated`, `lead.qualified`, `lead.disqualified`. |
| **State** | Stage moves to **Qualified** or **Lost**; may set `health=at_risk`. |
| **Blockers** | Hard blocker if **mandatory qualification fields** empty (configurable). |
| **If missing** | Show **blocker strip** in workspace + task “Complete qualification”. |

**Who qualifies:** Sales with `lead.qualify` / `deal.qualify` (same checklist model post-conversion).

---

### Step 3 — Conversion (Lead → Contact + Deal)

| Attribute | Definition |
|-----------|------------|
| **Step name** | Convert to Deal |
| **Business goal** | Single operational spine: **Deal** becomes canonical record for money + documents + production. |
| **Who performs** | Sales (button **Convert**). |
| **Where** | Workspace **Qualification** footer or **Overview**; Lead detail CTA. |
| **Required** | **Client** (Person or Company) — create or link; **Deal title**; **Deal pipeline**; initial **deal stage** (e.g. Qualified / Opportunity). |
| **Optional** | Link existing contact; carry conversation links. |
| **Automatic** | Create `Deal`, link `Lead.dealId`, copy/bridge files & messages; inherit owner; log `DEAL_CREATED`; open **Unified Deal Workspace**. |
| **Manual** | Resolve duplicate client. |
| **AI** | Suggest client match; suggest deal title from thread. |
| **Files** | Clone lead attachments to deal scope (new `file_entity_links` pointing to same `file_version` active). |
| **Events** | `deal.created`, `lead.converted`, `file.linked` (bulk). |
| **State** | Lead may move to **Converted** (terminal) or stay linked as historical. |
| **Blockers** | Cannot convert without **client identity** (minimum phone OR email OR company name per policy). |
| **If missing** | Inline form in modal **or** side drawer (prefer drawer to avoid modal overload). |

**Who confirms deal readiness:** Sales creates deal; **Manager** may approve stage jump to “Proposal” if policy requires (`deal.stage.approve`).

---

### Step 4 — Measurement

| Attribute | Definition |
|-----------|------------|
| **Step name** | Measurement scheduled & completed |
| **Business goal** | Capture dimensions, constraints, photos; feed proposal accuracy. |
| **Who performs** | Sales or **Operations/Measurer** role. |
| **Where** | Workspace tab **Measurement**; **Calendar** event type `MEASUREMENT` linked to deal. |
| **Required** | Measurement **status** = completed; **structured measurement record** (rooms/lines or freeform + attachments); geo/time optional. |
| **Optional** | CAD later; second visit. |
| **Automatic** | Calendar reminders; when measurement marked complete → `measurement.completed`; readiness recompute; AI summary of notes. |
| **Manual** | Upload sheets/photos; enter numeric fields. |
| **AI** | Read handwriting from photo (async, review required); flag missing dimensions. |
| **Files** | `MEASUREMENT_SHEET`, `OBJECT_PHOTO`, `DRAWING` (draft). |
| **Events** | `measurement.scheduled`, `measurement.completed`, `file.uploaded`. |
| **State** | `workspace_meta.measurementComplete` or DB table `measurement.status` (prefer DB as source of truth). |
| **Blockers** | Production gate (not proposal gate) may allow proposal without measurement depending on business—**config per product line**. Default: **proposal allowed**, **production blocked** without measurement + drawings policy. |
| **If missing** | Readiness widget shows **missing measurement**; sticky action **Schedule measurement**. |

---

### Step 5 — Proposal (commercial proposal / КП)

| Attribute | Definition |
|-----------|------------|
| **Step name** | Proposal sent & client response tracked |
| **Business goal** | Formal offer with price, terms, validity; auditable versions. |
| **Who performs** | Sales; **Designer/pricing** may fill technical appendix. |
| **Where** | Tab **Proposal**: version list + editor/preview + send log. |
| **Required** | Active **proposal version** with status `APPROVED_INTERNAL` before external send (configurable); PDF artifact; validity date. |
| **Optional** | Multiple alternatives (A/B). |
| **Automatic** | Generate PDF from template; numbering; notify client (email/TG template); on send → `proposal.sent`. |
| **Manual** | Edit variables; internal approval if workflow requires. |
| **AI** | Draft scope from measurement notes; suggest upsell; risk scan (unrealistic lead time). |
| **Files** | `QUOTE_PDF` (generated), source `CALCULATION`. |
| **Events** | `proposal.version_created`, `proposal.approved`, `proposal.sent`, `proposal.viewed`, `proposal.accepted`, `proposal.rejected`. |
| **State** | Proposal version state machine; deal `workspace_meta.proposalSent` mirrors for quick UI or derived from DB. |
| **Blockers** | Send externally blocked until internal approval if enabled. |
| **If missing** | Cannot mark “client accepted” without at least one `sent` version. |

---

### Step 6 — Contract generation (structured object)

| Attribute | Definition |
|-----------|------------|
| **Step name** | Contract draft ready |
| **Business goal** | Legally consistent document tied to deal variables; immutable legal blocks. |
| **Who performs** | Sales (draft); **Legal/Admin** approves locked clauses. |
| **Where** | Tab **Contract**: structured editor + clause toggles + preview. |
| **Required** | Template; populated variables; clause validation passes. |
| **Optional** | Annexes linked as separate file entities. |
| **Automatic** | Generate document snapshot; create `contract_version`; hash content; log. |
| **Manual** | Toggle optional clauses; fill delivery/install blocks. |
| **AI** | Suggest variables from proposal; highlight risky empties; compare to prior deal templates. |
| **Files** | Generated `CONTRACT` PDF draft; template assets in admin. |
| **Events** | `contract.generated`, `contract.edited`, `contract.submitted_for_approval`. |
| **State** | See Section 4 lifecycle. |
| **Blockers** | Invalid variables / missing mandatory clauses. |
| **If missing** | Validation panel lists field-level blockers. |

---

### Step 7 — Internal contract approval

| Attribute | Definition |
|-----------|------------|
| **Step name** | Internal approval |
| **Business goal** | Prevent unapproved terms leaving the company. |
| **Who performs** | Manager or Legal (role + permission). |
| **Where** | Contract tab **Approval** panel + **Tasks** “Approve contract”. |
| **Required** | Approver identity, timestamp, optional comment. |
| **Optional** | Conditional second approver over amount threshold. |
| **Automatic** | Notify approver; on approve → state `APPROVED_INTERNAL`; unlock “Send for signature”. |
| **Manual** | Approve/Reject with reason. |
| **AI** | None auto-approve; optional “diff vs standard template”. |
| **Files** | None new; may attach **internal comment PDF** (discouraged—prefer structured comments). |
| **Events** | `contract.approved_internal`, `contract.approval_rejected`. |
| **State** | Contract status transition. |
| **Blockers** | Signature send disabled until approved. |
| **If missing** | Sticky action disabled with tooltip **why**. |

**Who approves contract:** users with `contract.approve`; dual approval via workflow rule.

---

### Step 8 — Signature (Diia + company)

| Attribute | Definition |
|-----------|------------|
| **Step name** | Fully signed |
| **Business goal** | Legally executed agreement; single signed artifact as source of truth. |
| **Who performs** | **Company signer** (authorized); **Client**; system orchestrates. |
| **Where** | Tab **Contract** signature panel; status in header chip. |
| **Required** | Signature request tied to **contract version**; signers defined; final PDF stored. |
| **Optional** | Parallel vs sequence (legal policy). |
| **Automatic** | Poll/webhook status; store signed file; lock contract version; category `CONTRACT` signed child or `signed_contracts` taxonomy; notify deal owner. |
| **Manual** | Resend, replace version (supersedes), cancel. |
| **AI** | Pre-sign risk summary (“payment terms missing”). |
| **Files** | Signed PDF immutable; supersession creates new version chain. |
| **Events** | `signature.sent`, `signature.viewed`, `signature.signed` (per signer), `contract.fully_signed`. |
| **State** | See Section 5. |
| **Blockers** | Expired request; Diia failure; mismatch of signer phone/email. |
| **If missing** | Retry + support playbook; audit entries. |

**Who sends for signature:** Sales with `contract.send_signature` **after** internal approval.

---

### Step 9 — Payment

| Attribute | Definition |
|-----------|------------|
| **Step name** | Prepayment / milestone confirmed |
| **Business goal** | Financial gate before heavy production; audit trail. |
| **Who performs** | Finance or Sales with `payment.confirm` (split duties in permissions). |
| **Where** | Tab **Payment** (milestones); optional ERP/bank webhook. |
| **Required** | At least one **confirmed** milestone per policy (e.g. prepayment 30%). |
| **Optional** | Full payment before production vs progressive. |
| **Automatic** | Readiness recompute; notify when bank webhook matches amount (if integrated). |
| **Manual** | Upload `PAYMENT_CONFIRMATION`; tick milestone with reference number. |
| **AI** | Parse bank SMS/PDF (human confirm). |
| **Files** | `PAYMENT_CONFIRMATION`, `INVOICE`. |
| **Events** | `payment.milestone_confirmed`, `payment.received`. |
| **State** | `payment_milestone.status = CONFIRMED`. |
| **Blockers** | Production blocked if policy not satisfied. |
| **If missing** | Readiness shows **Waiting for payment** with CTA. |

**Who confirms payment:** ideally **Finance**; Sales only if `payment.confirm.low_amount` under threshold.

---

### Step 10 — Handoff package

| Attribute | Definition |
|-----------|------------|
| **Step name** | Handoff ready & accepted |
| **Business goal** | Operations receives complete, frozen package. |
| **Who performs** | Sales builds; **Operations** accepts. |
| **Where** | Tab **Handoff** + **Handoff** module for formal acceptance UI. |
| **Required** | Checklist complete; mandatory files present; **signed contract** linked; measurement artifacts. |
| **Optional** | Internal handoff notes. |
| **Automatic** | Generate manifest; checksums; on accept → `handoff.accepted`. |
| **Manual** | Upload missing files; override with approval. |
| **AI** | Check manifest vs required list. |
| **Files** | `TECH_CARD`, `DRAWING` final, `SPEC`, `INSTALL_SCHEME`, etc. |
| **Events** | `handoff.submitted`, `handoff.accepted`, `handoff.rejected`. |
| **State** | Handoff record `PENDING | ACCEPTED | REJECTED`. |
| **Blockers** | Rejection returns deal to **Sales** with reasons. |
| **If missing** | Each missing item is a **blocker card** with assignee. |

**Who transfers to production:** Sales triggers **Create production order**; **Operations** launches when gates pass.

---

### Step 11 — Production launch (gated)

| Attribute | Definition |
|-----------|------------|
| **Step name** | Production launched |
| **Business goal** | Factory work starts only when legal, financial, and technical readiness satisfied. |
| **Who performs** | Operations with `production.launch`. |
| **Where** | Tab **Production** + **Production** module. |
| **Required** | **Readiness engine** = all mandatory checks green OR approved override. |
| **Optional** | Partial launch phases (material order vs CNC) as sub-states. |
| **Automatic** | Create `production_order`; sync to external MES optional; notify sales “in production”. |
| **Manual** | Launch button (enabled only if green). |
| **AI** | Predict delay risk from historical similar jobs. |
| **Files** | Release **frozen** handoff file set; new files go to `production` categories. |
| **Events** | `production.order_created`, `production.launched`, `readiness.override_applied`. |
| **State** | Production order `PLANNED → ACTIVE`. |
| **Blockers** | Any readiness fail; legal hold flag. |
| **If missing** | Launch button shows **popover listing each missing item** with deep link to tab. |

**Who accepts in production:** Operations user with `handoff.accept` then `production.launch` (separation of duties optional).

---

### Cross-cutting: “Who does what” summary

| Action | Primary actor | Permission key (example) |
|--------|---------------|---------------------------|
| Create lead | Sales / system | `lead.create` |
| Qualify | Sales | `lead.qualify` |
| Convert | Sales | `lead.convert` |
| Measurement | Ops/Sales | `measurement.complete` |
| Proposal send | Sales | `proposal.send` |
| Contract edit | Sales/Legal | `contract.edit` / `contract.edit.legal` |
| Contract approve | Manager/Legal | `contract.approve` |
| Send signature | Sales | `contract.send_signature` |
| Confirm payment | Finance | `payment.confirm` |
| Build handoff | Sales | `handoff.submit` |
| Accept handoff | Ops | `handoff.accept` |
| Launch production | Ops | `production.launch` |
| Override readiness | Manager | `readiness.override` (audited) |

---

## SECTION 2 — UNIFIED WORKSPACE UI SCHEMA

### A. Top header

**Purpose:** Always answer “what is this, who owns it, how healthy, what’s the $, what’s next?”

| Element | Behavior |
|---------|----------|
| **Record title** | Deal title; subtitle client name + primary contact. |
| **Client name** | Link to **Client** record (drawer preview, full page in new tab optional). |
| **Lead/deal state** | Chips: **Stage**, **CRM status** (open/won/lost/hold), **Contract status**, **Signature status**, **Payment status** (collapsed to 2–3 chips + “+2” overflow). |
| **Owner** | Deal owner; quick reassignment (permission-gated). |
| **Assignee(s)** | Secondary: measurer, designer, installer; max 3 avatars + tooltip. |
| **Priority** | P1–P4 or Low/Med/High; color dot. |
| **SLA / due date** | Next SLA breach countdown; link to calendar. |
| **Expected amount** | Deal `value` + currency; editable inline if permitted. |
| **Health/risk** | `ok / at_risk / blocked` + human label from AI or rules. |
| **Quick actions** | Phone, message, schedule (opens composer in Messages tab without navigation). |
| **Breadcrumbs** | `Угоди > [Client] > [Deal]` — shallow; workspace is home for deal. |

---

### B. Stage progress bar

**Visual:** Horizontal pipeline with **past (solid)**, **current (emphasis)**, **future (muted)**, **blocked (red lock)**.

Per stage segment tooltip:

- Completed by **User** at **time**
- Or **Blocked:** reason code + link to tab
- **Next required:** single phrase (“Підпис клієнта”)

**Auto-updates** from workflow (stage transitions) never silent: **Activity** entry + optional toast “Стадія змінена: … Чому: …”.

---

### C. Main layout

| Zone | Role |
|------|------|
| **Left** | App side nav (global modules) — unchanged. |
| **Center** | Tab content — primary work surface. |
| **Right sidebar** | Context: AI, checklist, blockers (fixed width 320–380px; collapsible on tablet). |
| **Sticky bottom bar** | Stage-aware actions — always visible on desktop; bottom sheet on mobile. |
| **Top tabs** | Workspace-local tabs (not global module switch). |
| **Timeline** | **Activity** tab = full feed; each other tab footer “Останні 3 події” optional. |
| **Drawers** | File preview, approval detail, signature session status — **drawer over panel**; avoid stacking >1. |
| **Inline editing** | Safe fields (title, value, dates) inline; legal/contract **never** inline unstructured—use editor tab. |
| **Forms vs preview** | Contract: **split view** 40/60 editor-preview; Proposal: same pattern. |

---

### D. Required tabs — detailed

#### Tab: Overview

| Aspect | Spec |
|--------|------|
| **Purpose** | Single-screen health: what’s done, what’s blocking, key dates, KPI strip. |
| **Layout** | 2-column grid: left “Статуси”, right “Наступні кроки”; below “Ключові файли” thumbnails. |
| **Components** | Readiness meter; stage summary; last message snippet; payment summary; contract status card. |
| **Fields** | Read-only mirrors; drill-through links to tabs. |
| **Actions** | “Відкрити заблокований крок” deep links. |
| **AI** | Executive summary 5 bullets; “Top 3 risks”. |
| **Automation** | Refreshes on any `deal.*` event. |
| **Permissions** | All roles with `deal.view`. |
| **Edge** | New deal empty → checklist “Створіть клієнта, замір, КП…”. |
| **Loading** | Skeleton cards. |
| **Error** | Partial load with retry per widget. |

#### Tab: Messages

| Aspect | Spec |
|--------|------|
| **Purpose** | Omnichannel thread tied to deal (TG, email, SMS future). |
| **Layout** | Thread center, composer bottom, attachment drop zone. |
| **Components** | Message bubbles; channel icons; internal vs client toggle; templates. |
| **Actions** | Send, attach, create task from message, “convert attachment → file entity”. |
| **AI** | Summarize thread; suggest reply; detect intent; extract TODOs → tasks. |
| **Automation** | Incoming message → SLA reset; optional auto-tag. |
| **Permissions** | `conversation.view`, `message.send`. |
| **Edge** | Unlinked channel → force link wizard. |
| **Empty** | “Ще немає повідомлень” + connect channel CTA. |

#### Tab: Qualification

| Aspect | Spec |
|--------|------|
| **Purpose** | Structured BANT/MEDDIC-style checklist (configurable). |
| **Layout** | Checklist left, notes right. |
| **Components** | Checkbox groups; risk flags; convert button. |
| **Actions** | Complete, disqualify, convert to deal. |
| **AI** | “Missing info” from messages. |
| **Automation** | On all required → suggest stage move. |
| **Permissions** | `deal.qualify`. |
| **Edge** | Already converted → read-only checklist with audit. |

#### Tab: Measurement

| Aspect | Spec |
|--------|------|
| **Purpose** | Capture visit data + files. |
| **Layout** | Form sections + gallery grid. |
| **Components** | Dynamic fields per product template; map pin optional. |
| **Actions** | Schedule (calendar), complete, request re-measure. |
| **AI** | Photo dimension extraction (review). |
| **Automation** | Complete → notify proposal owner. |
| **Permissions** | `measurement.edit`. |
| **Edge** | Multiple visits → versioned measurement records. |

#### Tab: Proposal

| Aspect | Spec |
|--------|------|
| **Purpose** | Versioned commercial offers. |
| **Layout** | Version timeline left; editor/preview center. |
| **Components** | Variables table; PDF preview; send log. |
| **Actions** | New version, internal approve, send to client, mark accepted/rejected. |
| **AI** | Draft from measurement; compare versions. |
| **Automation** | Client portal “viewed” webhook. |
| **Permissions** | `proposal.edit`, `proposal.send`, `proposal.approve`. |
| **Edge** | Concurrent edit → lock by user session. |

#### Tab: Contract

| Aspect | Spec |
|--------|------|
| **Purpose** | Structured contract lifecycle + Diia. |
| **Layout** | Status header; sub-tabs: **Зміст**, **Погодження**, **Підпис**, **Історія**. |
| **Components** | Clause list, variable panel, PDF preview, signature timeline. |
| **Actions** | Generate, edit, submit approval, send signature, replace version, download. |
| **AI** | Risk scan; missing variable highlight. |
| **Automation** | Webhooks update signature state. |
| **Permissions** | Fine-grained (Section 9). |
| **Edge** | Superseded version read-only. |

#### Tab: Payment

| Aspect | Spec |
|--------|------|
| **Purpose** | Milestones + proofs. |
| **Layout** | Table of milestones; upload per row. |
| **Components** | Amount, due date, status, bank ref field. |
| **Actions** | Confirm, upload proof, request finance review. |
| **AI** | Parse proof PDF. |
| **Automation** | Confirm → readiness refresh. |
| **Permissions** | `payment.confirm`. |
| **Edge** | Overpayment → exception task. |

#### Tab: Files

| Aspect | Spec |
|--------|------|
| **Purpose** | Single pane for all deal-linked files with strong taxonomy. |
| **Layout** | Filter chips + grouped accordion by category + “Required missing” pinned top. |
| **Components** | Cards with badges: source, version, legal/production tags. |
| **Actions** | Upload, replace (version), recategorize (permission), lock, preview. |
| **AI** | Suggest category; near-duplicate detection. |
| **Automation** | Required file upload → notify + workflow. |
| **Permissions** | `file.upload`, `file.approve`, `file.delete`. |
| **Edge** | Large files → async processing state. |

#### Tab: Handoff

| Aspect | Spec |
|--------|------|
| **Purpose** | Build and freeze ops package. |
| **Layout** | Checklist + manifest table + submit/accept. |
| **Components** | File picker from deal files; auto-manifest generation. |
| **Actions** | Submit to ops, accept/reject, request clarification. |
| **AI** | Completeness check vs template. |
| **Automation** | Submit → tasks for ops queue. |
| **Permissions** | `handoff.submit`, `handoff.accept`. |
| **Edge** | Rejection reasons templated. |

#### Tab: Production

| Aspect | Spec |
|--------|------|
| **Purpose** | Launch gated; post-launch read-only summary in CRM (detail in Production module). |
| **Layout** | Readiness list + launch button + link-out to MES. |
| **Components** | Blocker list; ETA; order id. |
| **Actions** | Create order, launch (if green), request override. |
| **AI** | Delay prediction. |
| **Automation** | Launch → stage update. |
| **Permissions** | `production.launch`. |
| **Edge** | External MES down → retry queue. |

#### Tab: Activity Log

| Aspect | Spec |
|--------|------|
| **Purpose** | Immutable human-readable audit + technical JSON expandable. |
| **Layout** | Virtualized list; filters by actor, type, date. |
| **Components** | Icons per event type; diff viewer for field changes. |
| **Actions** | Export CSV (permission). |
| **AI** | “Explain this change” for selected entry. |
| **Automation** | Every state change writes here. |
| **Permissions** | `audit.view` vs `audit.view.limited` (hide sensitive). |
| **Edge** | High volume → sampling + raw export for admin. |

---

### E. Right sidebar (always)

1. **AI summary** (refresh, last updated time, “regenerate”).  
2. **Next best action** (one primary CTA + secondary).  
3. **Risk flags** (chips, click → evidence in Activity).  
4. **Checklist progress** (readiness + handoff).  
5. **Recent events** (last 5, link all).  
6. **Linked records** (lead, order, conversations).  
7. **Reminders** (tasks due).  
8. **Blockers** (aggregated from all gates).  
9. **Internal notes** (pinned note + AI summary of notes).

---

### F. Sticky action bar — enablement matrix (conceptual)

| Action | Enabled when | Disabled reason (tooltip) |
|--------|--------------|---------------------------|
| Send message | Always (perm) | No channel linked |
| Call client | Phone exists | Missing phone |
| Schedule measurement | Deal open | No permission |
| Generate proposal | Measurement complete (config) | Missing measurement |
| Edit proposal | Draft exists | Locked after send until new version |
| Generate contract | Proposal accepted (config) | Proposal not accepted |
| Send for approval | Draft complete | Validation errors |
| Send for signature | Internal approved | Not approved |
| Mark payment | Milestone pending | Finance only |
| Request missing files | Blockers exist | — |
| Create handoff | Contract signed + payment policy | Readiness red |
| Transfer to production | Handoff accepted + readiness | List blockers |

**Hidden vs disabled:** Prefer **disabled + tooltip** for discoverability; hide only if role lacks permission entirely.

---

### G. UX rules

1. **Minimize jumps:** Any deep link from notification opens **workspace + tab + scroll target** via URL `?tab=contract§ion=signature`.  
2. **One flow:** Module pages (Deals list) are **entry**; work happens in workspace.  
3. **Why status changed:** Every automated transition includes **reason code** + link to triggering event.  
4. **Blockers:** Aggregated sidebar + banner in header if `blocked`.  
5. **Mandatory next:** Single CTA in sidebar “Наступний крок”.  
6. **Reduce clicks:** Inline edit for safe fields; templates for messages.  
7. **Modal overload:** Drawers for preview/approval; modals only for destructive confirm.  
8. **Mobile:** Read-only overview + messages + file upload; editing contract **discouraged** — show “Відкрити на ПК” for heavy tasks.

---

## SECTION 3 — FILE ARCHITECTURE AND FILE UX

### A. File taxonomy (categories)

**Client & sales**

- `CLIENT_ID`, `BRIEF`, `REFERENCE`, `OBJECT_PHOTO`

**Technical**

- `MEASUREMENT_SHEET`, `DRAWING`, `SPEC`, `TECH_CARD`, `INSTALL_SCHEME`

**Commercial**

- `CALCULATION`, `QUOTE_PDF`, `CONTRACT`, `INVOICE`, `PAYMENT_CONFIRMATION`

**Legal / execution**

- `CONTRACT_SIGNED_CLIENT`, `CONTRACT_SIGNED_COMPANY`, `CONTRACT_FULLY_EXECUTED` (or single `CONTRACT` + `legal_status` on `file_version`)

**Operations**

- `HANDOFF_MANIFEST`, `PRODUCTION_RELEASE`, `ACCEPTANCE_ACT`, `RESULT_PHOTO`

**System**

- `TEMPLATE_ASSET`, `GENERATED_EXPORT`, `IMPORTED_ATTACHMENT`

*Align with existing enums where possible; extend schema with `subcategory` JSON for finer grain.*

---

### B. Upload points (exact)

| Location | Allowed categories | Who | Auto-link | Metadata | Auto name | AI | Versioning |
|----------|-------------------|-----|-----------|----------|-----------|----|------------|
| Lead card | BRIEF, REFERENCE, OBJECT_PHOTO | Sales | `lead_id` | Source | Y + original kept | Suggest category | On replace |
| Messages | All (with confirm) | User in thread | `conversation_id` + suggest `deal_id` | Channel msg id | Y | Classify + link suggestion | New version if same hash? dedup |
| Measurement tab | MEASUREMENT_SHEET, OBJECT_PHOTO, DRAWING | Measurer | `deal_id` + `measurement_id` | Required flags | Y | OCR | On replace |
| Proposal tab | CALCULATION, QUOTE_PDF | Sales | `proposal_version_id` | Generated flag | Auto for PDF | None | Proposal versions immutable once sent |
| Contract tab | CONTRACT, annex types | Legal/Sales | `contract_version_id` | Legal flag | Auto | Risk scan | Immutable post-send; new version = new row |
| Payment tab | PAYMENT_CONFIRMATION, INVOICE | Finance | `payment_milestone_id` | Bank ref | Y | Parse amount | Append-only proofs |
| Handoff tab | TECH_CARD, DRAWING, SPEC | Sales/Ops | `handoff_id` | Manifest line | Y | Completeness | Freeze on submit |
| Production tab | PRODUCTION_RELEASE, RESULT_PHOTO | Ops | `production_order_id` | — | Y | None | Controlled |
| Files module (bulk) | Any (role-limited) | Power users | User picks entity | Batch tags | Y | Batch classify | Standard |
| Workspace drag-drop | Same as Files tab | Same | Current `deal_id` | Drop coordinates N/A | Y | Same | Same |

---

### C. File display

- **Default:** grouped accordion **By category**; toggle **By stage** (derived from `linked_at_stage`).  
- **Cards:** thumbnail/icon, title, size, version badge, **source** badge, **required** pill.  
- **List view** for power users.  
- **PDF preview** inline drawer; **images** lightbox.  
- **Version history** side panel per file logical key (`file_asset_id`).  
- **Missing required** pinned section at top of Files tab + Overview.  
- **Used in** chip: “У договорі v3”, “У КП v2”.

---

### D. Lifecycle states

`UPLOADED → VIRUS_SCAN → PROCESSING → AVAILABLE → LINKED → APPROVED → LOCKED → ARCHIVED`  
Parallel flags: `required_optional`, `approval_status`, `ai_status`.

Errors: `QUARANTINED`, `FAILED`.

---

### E. Metadata (columns + JSON)

**Table `file_asset`:** logical grouping.  
**Table `file_version`:** `storage_key`, `sha256`, `size`, `mime`, `uploaded_by`, `created_at`, `preview_status`, `ocr_status`, `is_active`, `legal_hold`, `production_critical`.

**Junction `file_entity_link`:** `entity_type`, `entity_id`, `role` (e.g. primary_drawing), `linked_at_stage`, `required_rule_id`.

---

### F. Versioning rules

- **Replace** creates new `file_version`, previous retained; **active** pointer moves.  
- **Signed contract:** new signature round → **new contract_version** + new file_version; old marked `superseded`.  
- **Proposal:** once `sent`, binary locked; edits = new `proposal_version`.  
- **Handoff:** on submit, snapshot **manifest hash**; changes after reject create new handoff revision.

---

### G. Required file logic

- Rules table: `pipeline_id` × `stage` × `product_type` → list of required `category` + optional `template`.  
- **Blocks production** if rule `blocks_production=true`.  
- UI: **Deal Files** + **Overview** + **Production** tab.  
- Reminders: workflow on SLA.  
- **Override:** `readiness.override` + reason + second approver optional.

---

### H. Ingestion from conversations

1. Attachment arrives → store blob → virus scan → `file_version`.  
2. If thread linked to **one deal** → auto-link with category `IMPORTED_ATTACHMENT` + **needs_review=true**.  
3. If ambiguous → **Inbox queue** “Призначити файлу угоду”.  
4. AI proposes **category** + **deal** (confidence); user one-clicks confirm.  
5. Dedup: **hash** match → suggest “Посилання на існуючий файл”.  

---

### I. File permissions

| Action | Admin | Manager | Sales | Ops | Viewer |
|--------|-------|---------|-------|-----|--------|
| Upload | ✓ | ✓ | ✓ (scoped) | ✓ (scoped) | ✗ |
| Rename | ✓ | ✓ | own uploads | ✗ | ✗ |
| Recategorize | ✓ | ✓ | ✓ with audit | limited | ✗ |
| Replace | ✓ | ✓ | if not locked | if not locked | ✗ |
| Delete | ✓ | ✓ | soft only | ✗ | ✗ |
| Approve | ✓ | ✓ | ✗ | ✓ technical | ✗ |
| Lock | ✓ | Legal | ✗ | ✗ | ✗ |
| Share externally | ✓ | ✓ | watermarked | ✗ | ✗ |
| Export | ✓ | ✓ | own deals | ✓ | read-only |

---

### J. File automation examples

1. Photo in thread after “замір” keyword → suggest `OBJECT_PHOTO` + link measurement.  
2. Contract fully signed → generate `CONTRACT_FULLY_EXECUTED` + lock prior drafts.  
3. Missing `DRAWING` → daily reminder + block production.  
4. Proposal approved → generate PDF to `QUOTE_PDF`.  
5. Payment proof uploaded → auto-match milestone if amount within tolerance.

---

### K. File UX rules

- Never hide **required missing**.  
- Never show legal and production files **without badges**.  
- Always show **version + source + active**.  
- Signed always **green lock**; outdated **strikethrough + superseded link**.

---

## SECTION 4 — CONTRACT SYSTEM

### A. Contract data model (conceptual tables)

- **`contract_template`**: `id`, `name`, `deal_type`, `jurisdiction`, `body_ast` (structured JSON), `variable_schema`, `clause_set_id`, `active_version`.  
- **`contract_template_version`**: immutable snapshots.  
- **`contract_clause`**: reusable blocks with `legal_lock boolean`.  
- **`contract`**: `deal_id` unique active chain pointer, `current_version_id`.  
- **`contract_version`**: `status`, `content_json`, `rendered_pdf_file_version_id`, `hash`, `valid_from`, `supersedes_version_id`.  
- **`contract_variable_value`**: key-value per version.  
- **`contract_approval`**: approver, decision, comment, timestamp.  
- **`contract_signature_request`**: provider refs, sequence, expiration.  
- **`contract_audit_event`**: granular diffs.

**Structured object:** `content_json` is source of truth; PDF is **rendered artifact**.

---

### B. Template system

- Variables: `{{client.name}}`, `{{deal.value}}`, `{{payment.schedule}}`.  
- Clause library with **IDs**; optional toggles per deal type.  
- **Locked** clauses: no user edit; only Legal template update.  
- **Editable regions:** markdown or block editor with guardrails.  
- Annexes: separate `file_version` links with order index.

---

### C. Contract editor UX

- **Split view:** variables form (left), clause toggles (collapsible), live PDF (right).  
- **Validation panel:** blocking vs warning.  
- **Internal comments** threaded by `clause_id`.  
- **Version compare:** diff of variables + clause set changes.  
- **Readiness for signature:** checklist (all variables, approvals, PDF fresh).

---

### D. Contract lifecycle states

| State | Who sets | Automation | Blocks |
|-------|----------|------------|--------|
| DRAFT | System/user on create | — | — |
| GENERATED | Generate action | PDF render job | — |
| EDITED | User save | audit | — |
| PENDING_INTERNAL_APPROVAL | Submit | notify approvers | external send |
| APPROVED_INTERNAL | Approver | unlock signature prep | — |
| SENT_FOR_SIGNATURE | Send | timer + reminders | edit locked |
| VIEWED_BY_CLIENT | Webhook | notify owner | — |
| CLIENT_SIGNED / COMPANY_SIGNED | Webhook | sequential unlock | — |
| FULLY_SIGNED | Webhook | lock + handoff enable | edits forbidden |
| DECLINED / EXPIRED | User/provider | tasks | must new version |
| SUPERSEDED | New version | archive old | old not sendable |

---

## SECTION 5 — SIGNATURE FLOW (DIIA.SIGNATURE)

### A. Actors

- **Company signer:** user with `signature.sign.company` + Diia qualified profile.  
- **Client signer:** external; identified by phone/email + Diia session.  
- **Internal approver:** already in contract approval.  
- **Backup signer:** optional `signer_role=BACKUP`.

---

### B. Sequence options

- Default **client first, company second** (common B2C) — **configurable per template**.  
- **Parallel** only if legally validated for template type.

---

### C. Signature UX in workspace

- **Panel:** Signer rows with status badges (Pending / Viewed / Signed / Declined).  
- **Actions:** Send, Resend, Cancel, Replace document (new version).  
- **Preview:** signed PDF thumbnail after completion.  
- **Timers:** expiry countdown.

---

### D. Diia integration UX (continuous feel)

1. **Prepare:** validate contract version hash + signers.  
2. **Send:** CRM calls provider → stores `provider_request_id`.  
3. **User redirect:** open **new tab** or **system browser**; CRM shows “Очікуємо підпис…” with **Cancel** + **Я вже підписав** (manual refresh rare).  
4. **Return:** deep link ` /deals/:id/workspace?tab=contract&sig=done ` + toast.  
5. **Status:** server-side **polling** (backoff) + **webhook** primary.  
6. **Failure:** actionable error (“Diia недоступна”) + retry with idempotency key.  
7. **Storage:** signed PDF to object storage; **immutable** `file_version`.  
8. **Identity:** display Diia-verified name if provider returns (PII policy).  
9. **Auto-fill:** optional pull address/ID into contract variables **only** with user consent checkbox.

---

### E. Signature lifecycle (product-level)

`NOT_PREPARED → PREPARED → SENT → VIEWED → PARTIALLY_SIGNED → FULLY_SIGNED → DECLINED → EXPIRED → FAILED → REPLACED`

Mapped to DB + provider sub-states.

---

### F. Signature audit

Append-only `signature_audit_event`: initiator, request id, document hash, signer id, timestamps, IP (if policy), provider payload ref, replacement chain.

---

## SECTION 6 — DATABASE ARCHITECTURE (POSTGRESQL)

### Core entities (tables) — purpose & keys

*(Abbreviated field lists; implement as migrations.)*

| Table | Purpose | Keys / notes |
|-------|---------|--------------|
| `users`, `teams`, `team_members` | Identity | `users.id` UUID |
| `roles`, `permissions`, `role_permissions`, `user_roles` | RBAC | composite PKs |
| `clients` | Account/person | type enum |
| `contacts` | People | FK `client_id` nullable |
| `leads` | Top of funnel | FK `pipeline_stage`, `owner_id`, `deal_id` |
| `deals` | Operational spine | FK `client_id`, `pipeline_stage`, `owner_id`, JSON `workspace_meta` transitional only |
| `pipelines`, `pipeline_stages` | Configurable flow | `sort_order` unique per pipeline |
| `conversations`, `messages` | Comms | `deal_id` nullable until linked |
| `tasks` | Work | polymorphic `entity_type/id` |
| `calendar_events` | Scheduling | FK `deal_id` optional |
| `file_assets` | Logical file | stable id across versions |
| `file_versions` | Binary versions | FK `file_asset_id`, `sha256` index |
| `file_entity_links` | Many-to-many | `(file_asset_id, entity_type, entity_id, role)` |
| `measurements` | Structured measure | FK `deal_id`, status |
| `proposal_versions` | Commercial | FK `deal_id`, status, PDF FK |
| `contracts`, `contract_versions` | Legal object | FK deal, status enum |
| `contract_templates`, `contract_template_versions`, `contract_clauses` | Templates | |
| `contract_approvals` | Approvals | |
| `signature_requests`, `signature_signers`, `signature_events` | Diia | provider ids indexed |
| `payment_milestones` | Payments | FK deal, amount, status |
| `checklists`, `checklist_items`, `checklist_templates` | Handoff/readiness | |
| `handoff_packages`, `handoff_events` | Ops boundary | manifest hash |
| `production_orders`, `production_events` | Shop floor | external id |
| `notifications` | User alerts | outbox pattern |
| `automation_rules`, `automation_triggers`, `automation_actions`, `automation_runs` | Engine | JSON graph + version |
| `ai_insights`, `ai_recommendations` | AI artifacts | confidence, model, prompt hash |
| `activity_logs` | Audit | append-only, partitioned by month |
| `custom_field_definitions`, `custom_field_values` | Extensibility | EAV scoped by entity |
| `readiness_rules`, `readiness_evaluations` | Gates | cached snapshot per deal |
| `idempotency_keys` | Webhooks/jobs | unique key |

### Indexes (minimum)

- `deals(owner_id, updated_at DESC)`  
- `deals(pipeline_id, stage_id)`  
- `messages(conversation_id, created_at)`  
- `file_versions(sha256)`  
- `file_entity_links(entity_type, entity_id)`  
- `activity_logs(entity_type, entity_id, created_at DESC)`  
- `automation_runs(status, created_at)`  
- `signature_requests(provider_request_id)` UNIQUE  

### Soft delete

- `deleted_at` on user-facing entities; **never delete** `activity_logs`, `file_versions` (archive flag).  

### Concurrency

- `deals.row_version` integer optimistic lock for workspace saves.  
- Contract edits: **lease lock** row `contract_edit_session`.  

### Source of truth

- **Stage:** `deals.stage_id` + `deal_stage_history`.  
- **Signature:** `signature_requests.status` + provider events.  
- **Readiness:** `readiness_evaluations` snapshot; rules in config tables.  
- **Files active:** `file_versions.is_active` per asset.  

### Idempotency

- Webhooks: `idempotency_keys` + unique `(provider, event_id)`.  

---

## SECTION 7 — WORKFLOW ENGINE (N8N / HUBSPOT HYBRID)

### A. Trigger types (catalog)

`lead.created`, `lead.updated`, `message.received`, `task.overdue`, `qualification.completed`, `deal.stage_changed`, `measurement.scheduled`, `measurement.completed`, `proposal.version_sent`, `proposal.accepted`, `contract.generated`, `contract.approved`, `signature.sent`, `signature.signed`, `payment.confirmed`, `file.uploaded`, `file.approved`, `handoff.submitted`, `handoff.accepted`, `readiness.evaluated`, `production.launched`, `ai.risk_detected`, `sla.breached`, `user.action.manual`

### B. Condition types

Field compare, in-list, expression JSON (safe DSL), time window, role check, amount threshold, file rule satisfied, related record status, AI flag.

### C. Action types

Update stage, create task, send notification, post internal note, generate PDF, start signature flow, block production flag, run AI job, webhook out, create handoff draft, set variable, assign owner, escalate.

### D. Execution model

- **Sync:** lightweight field updates in same txn as user action.  
- **Async:** queue (e.g. BullMQ / PG queue); **retry** exponential; **DLQ** after N; **idempotency** key per `(rule_id, trigger_event_id)`.  
- **Partial failure:** compensate only for internal actions; external calls **never** rollback signed artifacts—use compensating **new** events.  
- **Observability:** `automation_runs` with trace_id, payload JSON, duration.

### E. 25 example workflows

1. **Lead SLA:** `lead.created` → if no task in 2h → notify owner + manager.  
2. **Auto-assign owner:** round-robin by region.  
3. **Qualification done:** move lead stage → suggest convert.  
4. **Convert:** copy files → message in deal thread.  
5. **Measurement scheduled:** calendar invite template.  
6. **Measurement complete:** task “Prepare КП”.  
7. **Proposal sent:** wait 7d → reminder client.  
8. **Proposal accepted:** allow contract generation.  
9. **Contract generated:** task legal if amount > X.  
10. **Contract approved:** enable signature button notification.  
11. **Signature fully signed:** set deal flag + notify finance.  
12. **Payment confirmed:** recompute readiness.  
13. **Missing drawing:** block production + daily digest.  
14. **Handoff submitted:** ops queue task.  
15. **Handoff rejected:** reopen sales tasks with reasons.  
16. **Readiness green:** notify ops “Ready to launch”.  
17. **Production launched:** notify sales + client template message.  
18. **Message contains “скасувати”:** AI risk → task manager.  
19. **File uploaded payment proof:** assign finance review.  
20. **Duplicate phone:** create review task.  
21. **AI risk high:** force `health=at_risk`.  
22. **Contract expiring soon:** renewal task.  
23. **Client viewed but not signed:** reminder sequence capped at 3.  
24. **Integration webhook ERP:** push order on launch.  
25. **Monthly:** archive deals lost > 90d (soft).

*(Each: actor = system; visibility = Activity + optional notification; failure = DLQ + admin dashboard.)*

---

## SECTION 8 — READINESS GATE BEFORE PRODUCTION

### Checks (each item)

| Check | Source of truth | Satisfied by | Override | UI surface | Automation |
|-------|-----------------|--------------|----------|------------|------------|
| Fully signed contract | `contract_versions.status=FULLY_SIGNED` | Legal flow | CEO + Legal log | Contract chip + Production tab | Blocks launch |
| Payment / prepayment | `payment_milestones` policy | Finance confirm | Finance manager | Payment tab | Notify sales |
| Measurement complete | `measurements.status` | Measurer | Ops director | Measurement | Block handoff optional |
| Required files | `file_entity_links` + rules | Upload + approve | Manager + reason | Files + sidebar | Daily digest |
| Active proposal/contract version | DB pointers | System | N/A | Overview | — |
| Checklist | `checklist_items` | Ops/Sales | Manager | Handoff | Submit handoff |
| Handoff accepted | `handoff.status` | Ops accept | N/A | Handoff | Enables launch |
| No blocking risk | `deal.health != blocked` | User clears / AI | Manager | Sidebar | Workflow pause |

### Outcomes

`READY_HANDOFF`, `READY_PRODUCTION`, `BLOCKED`, `RETURN_DATA`, `RETURN_SALES`, `WAIT_PAYMENT`, `WAIT_SIGNATURE` — stored on `readiness_evaluations.outcome` with reasons JSON array.

---

## SECTION 9 — ROLES, PERMISSIONS, APPROVALS

### Roles: Admin, Manager, Sales, Operations, Viewer

**Matrix (✓ / — / scoped)**

| Capability | Admin | Manager | Sales | Ops | Viewer |
|------------|-------|---------|-------|-----|--------|
| Lead create | ✓ | ✓ | ✓ | — | — |
| Qualify | ✓ | ✓ | ✓ | — | — |
| Deal edit | ✓ | ✓ | ✓ own | limited | — |
| Measurement | ✓ | ✓ | ✓ | ✓ | — |
| Proposal edit/send | ✓ | ✓ | ✓ | — | — |
| Contract edit (non-legal) | ✓ | ✓ | ✓ | — | — |
| Contract legal edit | ✓ | Legal | — | — | — |
| Contract approve | ✓ | ✓ | — | — | — |
| Send signature | ✓ | ✓ | ✓ | — | — |
| Payment confirm | ✓ | ✓ finance | — | — | — |
| File upload | ✓ | ✓ | ✓ | ✓ | — |
| File approve | ✓ | ✓ | — | ✓ tech | — |
| File lock | ✓ | Legal | — | — | — |
| Readiness override | ✓ | ✓ | — | — | — |
| Handoff submit | ✓ | ✓ | ✓ | — | — |
| Handoff accept | ✓ | — | — | ✓ | — |
| Production create/launch | ✓ | ✓ | — | ✓ | — |
| Signed docs view | ✓ | ✓ | ✓ deal | ✓ | read |
| AI controls (regenerate) | ✓ | ✓ | ✓ | — | — |
| Automation edit | ✓ | ✓ | — | — | — |
| Integrations | ✓ | — | — | — | — |
| Audit export | ✓ | ✓ limited | — | — | — |

**Irreversible:** delete legal artifact, purge audit (forbidden for non-admin), `production.launch` (compensate via new corrective order not delete).

**Always logged:** stage changes, contract/signature, payment confirm, file lock, readiness override, permission elevation.

---

## SECTION 10 — AI LAYER

| Capability | Inputs | Outputs | UI placement | Auto? | Override | Audit |
|------------|--------|---------|--------------|-------|----------|-------|
| Lead classification | lead fields + first message | type, confidence | Lead sidebar | suggest | user edit | log prompt hash |
| Lead scoring | history | 0–100 | Lead | suggest | manager weight | ✓ |
| Thread summary | messages | bullets | Messages + sidebar | manual refresh | regen | ✓ |
| Missing info | CRM + thread | questions | Qualification | suggest | — | ✓ |
| Qualification guidance | checklist state | next questions | Qualification | suggest | — | ✓ |
| Next best action | state graph | action | Sidebar | optional auto pin | user dismiss | ✓ |
| Proposal draft | measurement + notes | draft sections | Proposal | suggest | edit | ✓ |
| Contract variable suggest | proposal + deal | values | Contract | suggest | approve each | ✓ |
| Pre-sign risk | contract JSON | flags | Contract | suggest | legal ignore w log | ✓ |
| Readiness gaps | rules engine | list | Sidebar | auto | — | ✓ |
| Production delay risk | historical orders | score | Production | suggest | — | ✓ |
| Overdue detection | tasks/events | escalate | Notifications | auto | — | ✓ |
| File categorization | file metadata + OCR | category | Inbox queue | suggest | user confirm | ✓ |
| Duplicate assist | hash + fuzzy | candidates | Modals | suggest | user merge | ✓ |

**Confidence:** never auto-execute legal/signature/payment; cap auto-actions to **notifications** and **draft suggestions**.

---

## SECTION 11 — GLOBAL UX RULES

### Principles

- One **unified workspace** per deal for the main journey.  
- **High density, low noise:** progressive disclosure; advanced behind “Деталі”.  
- **Side nav + workspace + right panel + sticky actions.**  
- **Stage + blockers** always visible.  
- **Activity** explains the past; **AI** explains recommendations.  
- **Minimal modals**; drawers for secondary flows.  
- **Inline edit** only for non-legal fields.  
- **Files visible** at every critical step via widget.  
- **Destructive** actions: type-to-confirm for contract cancel / production rollback request.

### Top 15 UX mistakes to avoid

1. Hiding production blockers behind settings.  
2. Silent automation without Activity entry.  
3. Multiple competing “status” labels without legend.  
4. Forcing users to Deals list after each save.  
5. Modal chains >2 depth.  
6. Losing file context when switching tabs.  
7. No “why disabled?” on primary CTA.  
8. Mixing client-facing and internal notes visually.  
9. Showing raw JSON errors to sales users.  
10. No mobile fallback for signatures.  
11. Editable contract after send.  
12. Orphan files without review queue.  
13. Permissions errors as 403 page instead of inline.  
14. AI text without “suggested” label.  
15. Calendar events not linked back to deal.

### Top 10 file UX mistakes

1. Single flat list without categories.  
2. No version indicator.  
3. Allow delete of signed PDF.  
4. No virus scan status.  
5. Upload without linking entity.  
6. No preview for PDF.  
7. Hiding required missing files.  
8. No source badge (client vs system).  
9. Concurrent replace without locking.  
10. No checksum for handoff manifest.

### Top 10 contract/signature mistakes

1. Treating PDF as source of truth.  
2. No approval before Diia.  
3. No expiry handling.  
4. Losing webhook retries.  
5. Allowing edit during signature.  
6. No supersession chain.  
7. Missing audit of signer identity metadata.  
8. Confusing client vs company signer UI.  
9. No offline/error recovery messaging.  
10. Storing keys in frontend.

### Top 10 handoff/production mistakes

1. Launch without handoff accept.  
2. Mutable files after handoff freeze.  
3. No manifest hash verification.  
4. Ops cannot reject with structured reasons.  
5. Production launch without payment policy check.  
6. No link between CRM order and MES id.  
7. Allowing sales to override without audit.  
8. Hiding which drawing version is active.  
9. No notification on rejection.  
10. Concurrent launch double-click.

---

## SECTION 12 — IMPLEMENTATION PRIORITIES

### A. Final ideal end-to-end flow

**Lead → Qualify → Convert (Deal) → Measure → Proposal → Internal approve → Contract generate → Internal approve → Diia sign → Payment confirm → Handoff submit → Handoff accept → Readiness green → Production launch** — with AI assistance, files at every step, full audit.

### B. Final unified workspace screen map

`Deal Workspace` = Header + Stage bar + Tabs (Overview, Messages, Qualification, Measurement, Proposal, Contract, Payment, Files, Handoff, Production, Activity) + Right sidebar + Sticky actions + Drawers (preview, approvals).

### C. Final file architecture

`file_asset` / `file_version` / `file_entity_links` + taxonomy + lifecycle + ingestion queue + versioning + required rules + permissions + automation hooks.

### D. Final contract & signature architecture

Structured `contract_version` + template engine + approvals + `signature_requests` + Diia webhooks/polling + immutable signed artifacts + supersession chain.

### E. Final database core tables

`users`, `roles`, `clients`, `contacts`, `leads`, `deals`, `pipelines`, `stages`, `conversations`, `messages`, `tasks`, `file_*`, `measurements`, `proposal_versions`, `contracts`, `contract_versions`, `signature_*`, `payment_milestones`, `handoff_*`, `production_orders`, `activity_logs`, `automation_*`, `readiness_*`, `ai_*`.

### F. Final top 25 workflows

As listed in Section 7.E (extend to 40+ during build-out).

### G. Final permissions summary

RBAC matrix Section 9 + fine-grained keys for contract/signature/file/production; overrides audited.

### H. Top 15 screens to design first

1. Deal Workspace (Overview)  
2. Stage bar + header  
3. Messages + composer  
4. Files tab (grouped + missing required)  
5. Contract split editor + validation  
6. Signature status panel  
7. Payment milestones  
8. Handoff submit/accept  
9. Production readiness + launch  
10. Activity log  
11. Right sidebar AI + blockers  
12. Sticky action bar states  
13. Inbox file linking queue  
14. Lead convert drawer  
15. Admin automation rule builder (simplified)

### I. Top 15 backend modules first

1. AuthZ / permissions middleware  
2. Deal + pipeline CRUD + stage history  
3. Activity log service  
4. File storage + virus scan + metadata  
5. Contract version + render job  
6. Signature orchestration + webhooks  
7. Readiness evaluator  
8. Payment milestones  
9. Handoff package + manifest  
10. Production order bridge  
11. Workflow engine MVP (triggers + actions)  
12. Notification outbox  
13. AI gateway + prompt registry  
14. Search (deal/contact)  
15. Reporting snapshots

### J. Top 15 highest-risk areas if implemented poorly

1. Signature webhook idempotency  
2. Contract versioning + edits mid-flight  
3. File quarantine + XSS in preview  
4. Permission leaks on file URLs  
5. Readiness false positives → wrong launch  
6. Automation infinite loops  
7. PII in AI logs  
8. Diia session phishing UX  
9. Concurrent contract edits  
10. Orphan files eating storage  
11. SLA timers wrong timezone  
12. Duplicate deals/clients merge  
13. Lost messages not linked to deals  
14. Broken handoff manifest integrity  
15. MES sync creating duplicate orders  

---

## APPENDIX A — CORE TABLE FIELD LISTS (IMPLEMENTATION STUBS)

*Детальна модель документів, контрактів і підпису — у [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md) (таблиці `document`, `document_version`, `signature_session`, тощо). Нижче — узгоджені з PRODUCT_SPEC чернетки полів.*

*Нотація: PK, FK, UQ, IX, CK — для міграцій Prisma / SQL.*

### `deals`

- `id` PK, `title`, `description`, `status` (OPEN/WON/LOST/ON_HOLD), `pipeline_id` FK, `stage_id` FK, `client_id` FK, `owner_id` FK, `lead_id` FK nullable, `value`, `currency`, `expected_close_at`, `priority`, `health` (ok/at_risk/blocked), `workspace_meta` JSONB *legacy / кеш*, `row_version` int, `created_at`, `updated_at`, `deleted_at`  
- IX: `(owner_id, updated_at DESC)`, `(pipeline_id, stage_id)`, `(client_id)`

### `file_assets` / `file_versions` / `file_entity_links`

- `file_assets`: `id`, `logical_key` UQ nullable (для дедупу за домовленістю), `created_at`  
- `file_versions`: `id`, `file_asset_id` FK, `storage_key`, `bucket`, `original_name`, `mime_type`, `size_bytes`, `sha256` IX, `uploaded_by_id` FK, `source` enum, `is_active` bool, `preview_status`, `ocr_status`, `legal_hold`, `production_critical`, `created_at`  
- `file_entity_links`: `id`, `file_asset_id` FK, `entity_type`, `entity_id`, `role`, `linked_at_stage_id` nullable, `required_rule_id` nullable, `needs_review` bool, UQ partial за `(file_asset_id, entity_type, entity_id, role)` де потрібно

### `contract_versions` (розширення до поточної моделі)

- `id`, `contract_id` FK, `version` int, `status` enum (як у Section 4), `content_json` JSONB, `rendered_pdf_file_version_id` FK nullable, `content_hash`, `supersedes_version_id` FK nullable, `submitted_for_approval_at`, `approved_internal_at`, `sent_for_signature_at`, `fully_signed_at`, `created_by_id`, `created_at`  
- CK: `version` унікальний в межах `contract_id`

### `signature_requests`

- `id`, `contract_version_id` FK, `provider` (DIIA), `provider_request_id` UQ, `sequence_policy`, `status`, `expires_at`, `initiated_by_id`, `created_at`, `updated_at`  
- `signature_signers`: `id`, `request_id` FK, `role` (CLIENT/COMPANY/BACKUP), `user_id` FK nullable, `external_identity` JSONB, `status`, `viewed_at`, `signed_at`

### `readiness_evaluations`

- `id`, `deal_id` FK, `evaluated_at`, `outcome` enum, `checks_json` JSONB (масив `{rule_id, ok, reason}`), `blocked_production` bool, `blocked_handoff` bool, `computed_by` (system/user), `trigger_event_id` nullable

### `automation_rules` / `automation_runs`

- `automation_rules`: `id`, `name`, `enabled`, `trigger_type`, `trigger_filter` JSONB, `graph` JSONB (nodes: condition/action), `version`, `created_by`, `updated_at`  
- `automation_runs`: `id`, `rule_id` FK, `trigger_event_id`, `status`, `started_at`, `finished_at`, `error`, `idempotency_key` UQ

---

**END OF SPECIFICATION**
