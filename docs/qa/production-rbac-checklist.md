# Production RBAC QA Checklist

Date: 2026-04-07  
Scope: `crm/production` access, workshop Kanban permissions, manage actions by role.

## Test Roles

- `admin` (or `director`)
- `team_lead`
- `production_worker`
- `sales_manager`

## Preconditions

- At least one active flow exists: `<FLOW_ID>`.
- At least one workshop task exists: `<TASK_ID>`.
- Task includes an assembly stage case for assignee/checklist checks.
- You can authenticate each role in a separate browser profile or terminal session.

---

## 1) Page Access Matrix

Check these routes:

- `/crm/production`
- `/crm/production/workshop`
- `/crm/production/workshop/cutting`
- `/crm/production/<FLOW_ID>`

Expected:

- `admin`: allow
- `team_lead`: allow
- `production_worker`: allow (view mode)
- `sales_manager`: deny (`/access-denied`)

---

## 2) Workshop Kanban Interaction

Route: `/crm/production/workshop`

Expected:

- `admin`, `team_lead`:
  - Card is draggable.
  - Drop between columns succeeds.
  - State persists after refresh.
- `production_worker`:
  - Card is not draggable.
  - No drop behavior.
  - No hidden 403 from drag attempt.
- `sales_manager`:
  - Route denied.

---

## 3) Assembly Assignee + Checklist

In assembly column task card:

- Assign/unassign assignee
- Add/remove checklist line
- Toggle checklist progress

Expected:

- `admin`, `team_lead`: all actions allowed.
- `production_worker`:
  - assign/unassign denied
  - add/remove denied
  - progress toggle allowed only if payload is progress-only
- `sales_manager`: route denied.

---

## 4) Order Hub Manage Actions

Route: `/crm/production/<FLOW_ID>`

Check actions available for current step (accept/assign/validate/approve/reject/distribute/create-installation).

Expected:

- `admin`, `team_lead`: manage actions allowed.
- `production_worker`: manage actions denied (or hidden by UI depending on step).
- `sales_manager`: route denied.

---

## 5) API Smoke via cURL

Use one shell per role. Replace placeholders:

- `<BASE_URL>` (example: `http://localhost:3000`)
- `<COOKIE>` (session cookie string, e.g. `next-auth.session-token=...`)
- `<FLOW_ID>`
- `<TASK_ID>`

PowerShell example:

```bash
curl --request GET "<BASE_URL>/api/crm/production/workshop" \
  --header "Cookie: <COOKIE>"
```

### 5.1 GET workshop data

```bash
curl --request GET "<BASE_URL>/api/crm/production/workshop" \
  --header "Cookie: <COOKIE>"
```

Expected:

- `admin`, `team_lead`, `production_worker`: `200`
- `sales_manager`: `403`

### 5.2 Move workshop task (manage)

```bash
curl --request POST "<BASE_URL>/api/crm/production/workshop/tasks/<TASK_ID>/move" \
  --header "Content-Type: application/json" \
  --header "Cookie: <COOKIE>" \
  --data "{\"stageKey\":\"CUTTING\"}"
```

Expected:

- `admin`, `team_lead`: `200`
- `production_worker`, `sales_manager`: `403`

### 5.3 Assign workshop task assignee (manage)

```bash
curl --request PATCH "<BASE_URL>/api/crm/production/workshop/tasks/<TASK_ID>/assign" \
  --header "Content-Type: application/json" \
  --header "Cookie: <COOKIE>" \
  --data "{\"assigneeUserId\":null}"
```

Expected:

- `admin`, `team_lead`: `200`
- `production_worker`, `sales_manager`: `403`

### 5.4 Update workshop materials checklist

1) Read current checklist from API/UI first.  
2) For `production_worker`, send progress-only update (same items, only `done` changed).  

Example payload:

```bash
curl --request PATCH "<BASE_URL>/api/crm/production/workshop/tasks/<TASK_ID>/materials" \
  --header "Content-Type: application/json" \
  --header "Cookie: <COOKIE>" \
  --data "{\"items\":[{\"id\":\"item-1\",\"label\":\"Panel ready\",\"done\":true,\"scope\":\"assembly\"}]}"
```

Expected:

- `admin`, `team_lead`: `200` (structure/progress changes allowed)
- `production_worker`: 
  - `200` only for progress-only updates
  - `403` if structure changes (add/remove/rename/scope mutate)
- `sales_manager`: `403`

### 5.5 Flow page data

```bash
curl --request GET "<BASE_URL>/api/crm/production/flows/<FLOW_ID>" \
  --header "Cookie: <COOKIE>"
```

Expected:

- `admin`, `team_lead`, `production_worker`: `200`
- `sales_manager`: `403`

---

## 6) Result Template

Use this table while testing:

| Role | Page access | Drag/drop | Assignee manage | Checklist structure | Checklist progress | Flow manage actions | Result |
|---|---|---|---|---|---|---|---|
| admin |  |  |  |  |  |  |  |
| team_lead |  |  |  |  |  |  |  |
| production_worker |  |  |  |  |  |  |  |
| sales_manager |  |  |  |  |  |  |  |

Legend:

- `PASS` if behavior matches expected policy.
- `FAIL` with endpoint/route and actual status.
