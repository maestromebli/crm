# RBAC Role Action Matrix

This document defines the business behavior for each role across four dimensions:

- View: what modules/pages are visible
- Actions: what business operations are allowed
- Scope: what data slice is visible/editable
- Assign: who can be assigned to leads/projects/tasks

## Scope Models

- `global`: all company data
- `team`: own team based on `headManagerId` hierarchy
- `own`: only own leads/deals/tasks
- `assigned_measurements`: only leads linked via assigned measurement events
- `operations_global`: cross-deal visibility for operations roles

## Role Matrix

| Role | View | Actions | Scope | Assign |
|---|---|---|---|---|
| `SUPER_ADMIN` | all modules/settings | full CRUD, impersonation, role matrix | `global` | all roles |
| `ADMIN` | all modules/settings | all CRUD except changing role matrix policy | `global` | manager + operations roles |
| `DIRECTOR` | all modules/settings | strategic + operational full control | `global` | all except `SUPER_ADMIN` |
| `DIRECTOR_PRODUCTION` | production, constructor, warehouse, deals, tasks | orchestration + production control | `global` | production roles |
| `HEAD_MANAGER` | dashboard, leads, deals, contacts, inbox, calendar, tasks, files, reports | lead/deal/messaging + assignment | `team` | sales manager line (`SALES_MANAGER`, legacy `MANAGER/USER`) |
| `TEAM_LEAD` | same as head manager | same as head manager | `team` | sales manager line |
| `SALES_MANAGER` | sales modules + inbox + files | lead/deal/task flow, estimates/contracts | `own` | self or team when explicit assign permission is present |
| `MEASURER` | dashboard, calendar, tasks, assigned leads | measurement updates | `assigned_measurements` | none |
| `ACCOUNTANT` | finance, deals, reports, dashboard | financial operations and reporting | `operations_global` | none |
| `PROCUREMENT_MANAGER` | procurement, warehouse, production, deals | PO/supplier/stock workflows | `operations_global` | none |
| `PRODUCTION_WORKER` | production workspace, tasks, files | stage task progress and uploads | `operations_global` | none |
| `CUTTING` | production, tasks, files | cutting stage execution | `operations_global` | none |
| `EDGING` | production, tasks, files | edging stage execution | `operations_global` | none |
| `DRILLING` | production, tasks, files | drilling stage execution | `operations_global` | none |
| `ASSEMBLY` | production, tasks, files, handoff | assembly execution + handoff accept | `operations_global` | none |
| `CONSTRUCTOR` | constructor, production, workspace, files | constructor workspace + orchestration | `operations_global` | none |
| legacy `MANAGER` | alias of `HEAD_MANAGER` | alias of `HEAD_MANAGER` | `team` | sales manager line |
| legacy `USER` | alias of `SALES_MANAGER` | alias of `SALES_MANAGER` | `own` | self or team with explicit permission |

## Notes

- Permissions remain technical keys (`PermissionKey`) while this matrix is business-facing.
- Personal overrides are supported through `PermissionOnUser` and `menuAccess`.
- API enforcement remains the source of truth; UI must only reflect server-enforced access.
