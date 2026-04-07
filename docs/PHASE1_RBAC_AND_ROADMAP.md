# Етап 1 ENVER CRM — RBAC, моделі, дорожня карта

Документ доповнює реалізацію в коді (`src/lib/authz/*`, `prisma/schema.prisma`, `src/config/navigation.ts`).

## Швидкі команди після оновлення схеми

```bash
pnpm db:push
pnpm db:seed
# або лише ролі:
pnpm db:migrate-roles
```

---

## 1. Audit RBAC / Navigation (короткий підсумок)

| Область | Було | Зараз |
|--------|------|--------|
| Ключі в nav | `dashboard.view` (не збігалися з БД) | `P.DASHBOARD_VIEW` = Prisma `PermissionKey` |
| `PermissionGate` | Пропускав усіх автентифікованих | Перевіряє `permission`, якщо задано |
| `AppSidebar` | Показував усі розділи | Фільтр `hasPermission(keys, section.permission)` |
| API угод | Лише 401 | `requireSessionUser` + `forbidUnlessDealAccess` / `forbidUnlessPermission` |
| Ролі Prisma | ADMIN / MANAGER / USER | + DIRECTOR, HEAD_MANAGER, SALES_MANAGER; legacy мапінг у `normalizeRole()` |
| JWT | Старі `permissionKeys` до перелогіну | Після `db:seed` / призначення прав — перелогін |

**Конфлікти, що зняті:** формат ключів; декоративний gate; розрив UI/API для PATCH deal, stage, contract, attachments, workspace-meta, leads POST, calendar, handoff.

**Залишкові ризики:** `/api/ai/summary` без RBAC; інші розділи без окремого `requirePermissionForPage` (лише `/dashboard/*` + сесія в `(dashboard)` layout).

**Додано:** `GET|POST /api/tasks`, `PATCH /api/tasks/[taskId]`; `GET|POST /api/deals/[dealId]/estimates`, `GET|PATCH .../estimates/[estimateId]`; вкладки Deal Workspace «Смета» / «Задачі»; UI `/tasks` (мої / прострочені / сьогодні / команда); RSC-захист `(dashboard)/layout` + `DASHBOARD_VIEW` для `app/(dashboard)/dashboard/layout.tsx`.

---

## 2. Мапінг ролей (без втрати користувачів)

- `ADMIN` → `DIRECTOR` (автоматично в `prisma/seed.mjs` → `migrateLegacyRoles`)
- `MANAGER` → `HEAD_MANAGER`
- `USER` → `SALES_MANAGER`

Сирі значення enum у БД залишаються сумісними; JWT нормалізується в `normalizeRole()` для scope.

---

## 3. Моделі Task / Estimate (Prisma)

Додано: `Task`, `Estimate`, `EstimateLineItem` + відповідні enum. Далі: `pnpm db:push`, route handlers `/api/tasks`, `/api/deals/[dealId]/estimates`, UI вкладки.

---

## 4. Backlog (узгоджено з вашим порядком)

- **P1:** Task API + списки + workspace tab; Estimate API + tab + totals/margin UI; server guards на нові routes.
- **P2:** Дашборди за `normalizeRole()` + запити до Prisma; звіти + приховування COST/MARGIN для SALES_MANAGER.
- **P3:** Audit log UI, нагадування `reminderAt`, експорт звітів.

---

## 5. Acceptance (етап 1 RBAC)

- [x] Nav використовує UPPER_SNAKE і збігається з `PermissionKey`.
- [x] Sidebar ховає розділи без прав (включно з production/handoff без `PRODUCTION_LAUNCH` / `HANDOFF_SUBMIT`).
- [x] Критичні deal/lead/calendar маршрути перевіряють право + scope власника угоди де потрібно.
- [ ] Усі сторінки під `getServerSession` + redirect (наступний крок).
- [ ] Повне покриття Task/Estimate (після P1).
