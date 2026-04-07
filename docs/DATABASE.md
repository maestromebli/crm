# PostgreSQL для ENVER CRM

**Пов’язані документи:** [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md) (модель файлів і міграція схеми), [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) (епіки), [ERD_CORE.md](./ERD_CORE.md), [BACKUP.md](./BACKUP.md).

---

## Останні зміни схеми (щоб не губитися між сесіями)

| Дата | Що зроблено | Де в коді |
|------|-------------|-----------|
| 2026-04-08 | **SaaS foundation:** моделі `Workspace`, `WorkspaceMember`; enum `WorkspaceRole`; канонічні enum для аналітики (`LeadStage`, `DealStage`, `StandardEventType`, `CrmFileCategory`, `CrmMessageChannel`, `ClientPaymentStatus`); у `User` — зв’язок `workspaceMembers`. | `prisma/schema.prisma` (блок коментаря `SaaS foundation`) |
| 2026-04-08 | Міграція PostgreSQL для таблиць і enum. | `prisma/migrations/20260408120000_workspace_saas_foundation/migration.sql` |
| 2026-04-08 | Seed: workspace з `slug=enver`, учасники admin / demo / vera (OWNER / ADMIN). | `prisma/seed.mjs` — `ensureDefaultWorkspace` |
| 2026-04-10 | **Production OS:** таблиці `ProductionOrchestration*` + enum; міграція `20260410120000_production_orchestration`; API assign-constructor + candidates; токен зовнішнього конструктора. | `prisma/migrations/20260410120000_production_orchestration/migration.sql` |

**Примітка:** довгий текст з проєктування БД (архітектура SaaS, кроки 1–7) з сесії в чаті **не дублювався** в окремий файл — якщо потрібен експорт у `docs/`, попросіть явно.

**Чому не видно diff у Cursor:** у корені `D:\crm` часто **немає Git** — тоді немає панелі «Source Control». Варіанти: `git init` + коміти після змін; або **Timeline / Local History** для окремого файлу.

---

## Що означає помилка «Не вдається підключитися»

1. **Сервер PostgreSQL не запущений** (найчастіше на Windows).
2. **Невірний `DATABASE_URL`** у `.env.local` (хост, порт, пароль, назва БД).
3. **Порт 5432 зайнятий іншим процесом** — тоді змініть порт у Docker або в інсталяції PostgreSQL і оновіть URL.

Перевірка порту (PowerShell):

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5432
```

Якщо `TcpTestSucceeded : False` — на `127.0.0.1:5432` ніхто не слухає.

---

## Варіант A: Docker (рекомендовано, якщо встановлено Docker Desktop)

У корені проєкту:

```powershell
cd D:\crm
pnpm db:up
```

Або: `docker compose up -d`

У `.env.local` має підходити рядок (як у `.env.example`):

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
```

Далі:

```powershell
pnpm db:push
pnpm db:seed
```

Зупинити контейнер: `pnpm db:down` або `docker compose down`.

---

## Варіант B: Локальна установка PostgreSQL (Windows)

1. Завантажте інсталятор з [postgresql.org](https://www.postgresql.org/download/windows/) або встановіть через winget (за наявності).
2. Запам’ятайте порт (за замовчуванням **5432**), користувача та пароль.
3. Створіть базу (наприклад `postgres` або окрему `enver_crm`) у pgAdmin або `createdb`.
4. У `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/DBNAME"
```

5. Переконайтеся, що служба **postgresql** запущена (Служби Windows).

6. Виконайте `pnpm db:push` та `pnpm db:seed`.

---

## Варіант C: Хмарна БД (Neon, Supabase, RDS тощо)

Скопіюйте connection string провайдера в `DATABASE_URL` (часто потрібні `?sslmode=require`). Потім `pnpm db:push` та `pnpm db:seed`.

---

## Типові помилки

| Помилка | Що зробити |
|--------|------------|
| `P1001` Can't reach server | Запустіть PostgreSQL або Docker-контейнер. |
| `password authentication failed` | Виправте пароль у `DATABASE_URL`. |
| `database "X" does not exist` | Створіть БД або змініть ім’я в URL. |
| Порт зайнятий | Змініть мапінг у `docker-compose.yml` (наприклад `5433:5432`) і URL на `...@127.0.0.1:5433/...`. |

---

## Додаткові таблиці (воркспейс угоди)

Після `pnpm db:push` з актуальною `schema.prisma` зʼявляються:

| Модель | Призначення |
|--------|-------------|
| `ReadinessEvaluation` | Історія знімків готовності до виробництва (`checksJson`, `outcome`). |
| `DealHandoff` | Один запис на угоду: статус передачі, нотатки, `manifestJson`. |
| `FileAsset` | Логічний файл у межах угоди; версії — рядки `Attachment` з `version` / `isCurrentVersion`. |
| `AutomationRule` / `AutomationRun` | Заготовка правил і журнал запусків (поки без виконання графа). |

Подальший розвиток домену файлів (document / document_version, requirement sets, підпис) описано в [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md).
