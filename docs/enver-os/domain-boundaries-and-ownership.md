# ENVER OS Domain Boundaries and Ownership

## Purpose
This document defines bounded contexts, module ownership, and dependency rules for incremental ENVER OS evolution without breaking current production flows.

## Bounded Contexts

| Context | Main Scope | Primary Paths | Owner |
|---|---|---|---|
| LeadManagement | lead intake, qualification, communication, conversion | `src/app/api/leads`, `src/lib/leads`, `src/modules/leads`, `src/features/leads` | Sales Platform Team |
| DealWorkspace | deal lifecycle, workspace state, stage transitions | `src/app/api/deals`, `src/lib/deals`, `src/lib/deal-api`, `src/components/deal-workspace` | Deal Operations Team |
| ProductionOps | production launch, orchestration, workshop flow | `src/app/api/crm/production`, `src/lib/production`, `src/lib/production-orchestration`, `src/modules/production` | Production Systems Team |
| ProcurementOps | requests, suppliers, warehouse flow | `src/app/api/crm/procurement`, `src/features/procurement`, `src/app/crm/(hub)/procurement` | Procurement Systems Team |
| FinanceOps | invoices, payments, journal, dashboards | `src/app/api/crm/finance`, `src/lib/finance`, `src/features/finance` | Finance Systems Team |
| PlatformCore | authz, workflow, events, audit, API contracts | `src/lib/authz`, `src/lib/events`, `src/lib/workflow`, `src/lib/api` | Platform Core Team |
| AIEnablement | AI operations, prompts, extraction, assistants | `src/app/api/ai`, `src/lib/ai`, `src/features/ai*` | AI Enablement Team |

## Cross-Context Rules

1. All business logic must live in `src/lib/**` or `src/features/**`; route handlers orchestrate only.
2. `src/app/api/**` must not import from `src/components/**` or `src/modules/**`.
3. `src/lib/**` must not import from `src/app/**`.
4. Event publication must use shared contracts in `src/lib/events/**`.
5. Auth checks in APIs must use `src/lib/authz/**` (no ad-hoc role checks in routes).

## Allowed Dependency Flow

`app/api -> features -> lib -> prisma`

`app/ui -> modules/components -> features -> lib`

Direct reverse dependencies are forbidden (for example `lib -> app`).

## Non-Breaking Rollout Guardrails

- New checks are report-only by default (`pnpm arch:boundaries`).
- CI can switch to strict mode later via `BOUNDARY_STRICT=1`.
- Existing violations should be fixed incrementally by context owner.
