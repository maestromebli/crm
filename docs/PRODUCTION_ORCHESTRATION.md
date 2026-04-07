# Production OS (оркестрація виробництва)

**Принцип:** існуючий цеховий `ProductionOrder` (канбан, етапи різання/збірки) **не змінюється**. Життєвий цикл «від прийняття handoff до монтажу» веде окрема сутність **`ProductionOrchestration`**.

## Схема БД (Prisma)

- `ProductionOrchestration` — один запис на угоду (`dealId` unique), номер `ENVER-YYYY-…`, статуси з ТЗ (`PENDING_ACCEPTANCE` … `CLOSED`), підпотоки (`designStatus`, `procurementStatus`, `giblabStatus`, …), поля GIBLAB, Telegram, блокування пакету дизайну (`approvedDesignSnapshotJson`, `designLockedAt`).
- `ProductionHandoffClarification` — запит уточнень до менеджера (без створення активної виробничої ланки).
- `ProductionOpenQuestion`, `ProductionChangeRequest`, `ProductionCommunicationInsight` — для AI / питань / змін (заповнюються наступними фазами).
- Нові `ActivityType` та `ActivityEntityType.PRODUCTION_ORCHESTRATION` для аудиту.
- Права: `PRODUCTION_ORCHESTRATION_VIEW`, `PRODUCTION_ORCHESTRATION_MANAGE` (+ legacy alias у `permissions.ts`).

Після змін у `schema.prisma`: `npx prisma migrate dev` (або `db push` у dev).

## API

- `GET /api/deals/[dealId]/production-orchestration` — зріз оркестрації + останні clarification.
- `POST .../accept` — прийняття (створює `ProductionOrchestration` у статусі `ACCEPTED`).
- `POST .../clarify` — тіло `{ issues: string[], messageToManager? }`.
- `POST .../reject` — тіло `{ reason }` (handoff → `REJECTED`).
- `GET .../constructor-candidates` — список користувачів для внутрішнього конструктора (`PRODUCTION_ORCHESTRATION_MANAGE`).
- `POST .../assign-constructor` — тіло `{ type: "INTERNAL" | "OUTSOURCED", constructorUserId?, constructorExternalName?, constructorExternalPhone?, constructorExternalEmail?, dueDate?, productionNotes?, regenerateToken? }`. Для `OUTSOURCED` генерується `externalWorkspaceToken` (64 hex), посилання: `/crm/external/constructor/[token]`.

## UI

- Вкладка **Передача у виробництво** угоди: блок **Production OS** (`ProductionOrchestrationHandoffPanel`).

## Зовнішній конструктор

- Маршрут: `/crm/external/constructor/[token]` (публічно, без сесії CRM — див. `middleware.ts`).
- За замовчуванням токен з’являється після призначення зовнішнього конструктора (наступна фаза: `externalWorkspaceToken` + API призначення).

## Наступні фази (з ТЗ)

1. Призначення конструктора (internal/outsourced) + генерація токена.
2. Telegram + AI insight entities (заповнення `ProductionCommunicationInsight`, `ProductionOpenQuestion`).
3. Рев’ю пакету / ревізії / блокування версії.
4. Авто-закупівлі з `source = production_approved_package`.
5. Адаптер GIBLAB (`giblabExportStatus`, job id, webhook).
6. Штаб: `/crm/production-control` (дашборд).
