# Роадмап імплементації

## Опорні документи

| Документ | Роль |
|----------|------|
| [PRODUCT_SPEC_AI_CRM_MANUFACTURING.md](./PRODUCT_SPEC_AI_CRM_MANUFACTURING.md) | Продуктовий flow end-to-end, ролі, AI, воронки. |
| [**CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md**](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md) | **Критичне ядро:** файли, контракт, Diia, версії, readiness, автоматизації, ризики. |
| [**DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md**](./DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md) | Рев’ю **поточної** Prisma-схеми + цільова архітектура з **міграційним планом** (10 секцій). |
| [**IMPLEMENTATION_STACK_MAP.md**](./IMPLEMENTATION_STACK_MAP.md) | **Єдиний стек:** PostgreSQL + Prisma + Nest (ціль) + **Next API** ендпоінти + компоненти UI + чеклист задач. |
| [**ARCHITECTURE_IMPLEMENTATION_MAP.md**](./ARCHITECTURE_IMPLEMENTATION_MAP.md) | Детальні SQL-фрагменти Prisma-моделей і міграційні нотатки. |
| [**CRM_PRODUCTION_ARCHITECTURE_FULL.md**](./CRM_PRODUCTION_ARCHITECTURE_FULL.md) | **Повна** архітектура (секції 1–11): схема, файли, контракт, Diia, readiness, БД, n8n-стиль, права, воркспейс, міграція, валідація + A–E. |
| [**ARCHITECTURE_REDESIGN_IMPLEMENTATION_STATUS.md**](./ARCHITECTURE_REDESIGN_IMPLEMENTATION_STATUS.md) | **Статус імплементації:** що вже в `schema.prisma`, SQL partial unique, db push vs migrate, наступні кроки коду. |
| [**DESIGN_AUDIT_AND_FIXES.md**](./DESIGN_AUDIT_AND_FIXES.md) | **Самоаудит v1.2:** NULL/uniques, overrides, milestones, outbox, soft-delete, permissions. |
| [ERD_CORE.md](./ERD_CORE.md) | Поточний Mermaid ERD (оновлювати після міграцій домену документів). |
| [USER_STORIES_WORKSPACE.md](./USER_STORIES_WORKSPACE.md) | User stories воркспейсу угоди. |

---

## Зроблено (поточний репозиторій)

- Єдиний воркспейс угоди: мета JSON, договір, файли, вкладки, активність.
- Розрахунок готовності до виробництва + **знімки** в `ReadinessEvaluation` після релевантних змін.
- API: `GET /api/deals/[dealId]/readiness-history`, `GET|PATCH /api/deals/[dealId]/handoff`.
- Логічні файли **`FileAsset`** та версії **`Attachment`** (`fileAssetId`, `version`, `isCurrentVersion`).
- Заглушка **`AutomationRule` / `AutomationRun`** + `dispatchDealAutomationTrigger`.
- Створення лідів через **`POST /api/leads`** + форма в `LeadCreateSheet`.
- Повний бекап: `pnpm backup:full` → [BACKUP.md](./BACKUP.md).

---

## Епіки: домен документів і контрактів

*Нумерація — логічний порядок; у спринтах можна паралелити після E1.*

### E1 — Категорії та вимоги (foundation)

**З:** [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md §1A, §1G](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md)  
**Результат:**

- Таблиця **`file_category`** (key, allowed entities, readiness_impact, default_required).
- Міграція / мапінг з поточного `AttachmentCategory` → `file_category`.
- **`document_requirement_set`** (або еквівалент) + правила по pipeline/stage/шаблону договору.
- API читання вимог для deal + прапорці **missing** для UI (без повного сховища ще можна stub).

**Критерій готовності:** воркспейс може показати «обовʼязкові слоти» з БД, readiness evaluator читає ті самі правила.

---

### E2 — Логічний файл + версії + звʼязки (replace Attachment-моделі)

**З:** §1B, §1F  
**Результат:**

- **`document`**, **`document_version`**, **`document_link`** (поліморфні якорі DEAL / CONTRACT_VERSION / …).
- Інваріант: максимум одна **`is_current`** на document; signed-версії помічені **`is_signed`**.
- Міграція даних: `FileAsset` + `Attachment` → нова модель (скрипт + dual-write період за потреби).

**Критерій готовності:** upload у воркспейсі створює document + version + link; список версій з API.

---

### E3 — Обʼєктне сховище та обробка файлів

**З:** §1D, §5 (corrupted, virus)  
**Результат:**

- Завантаження через **presigned URL** (S3-compatible), не лише зовнішній URL.
- Поля **`content_hash`**, **`virus_scan_status`**, **`processing_status`**; черга на скан/превью.
- Політика дедупу за hash (підказка користувачу).

**Критерій готовності:** файл у БД має `storage_key`; помилка скану блокує «валідацію» та показується у UI.

---

### E4 — UI файлів у Deal Workspace

**З:** §1E, §6  
**Результат:**

- Секції за **категорією** + блок **Required / Missing**.
- Бейджі: active, signed, outdated, required; drawer версій + превью PDF/зображень.
- Drag-and-drop з **примусовим вибором категорії**, якщо неочевидно.

**Критерій готовності:** користувач завжди бачить активну версію та що блокує наступний крок.

---

### E5 — Контракт як структурований обʼєкт + версії контенту

**З:** §2  
**Результат:**

- Розширення поточного **`DealContract`**: **`contract_version`** з **`content_snapshot`**, immutable після `sent_for_signature`.
- **`contract_template`**, змінні, бібліотека клауз (мінімум — JSON + адмінка пізніше).
- Рендер PDF → **`document_version`** категорії `contracts` / `signed_contracts`.

**Критерій готовності:** зміна чернетки не змінює стару версію; історія версій відкривається з воркспейсу.

---

### E6 — Підпис (Diia) і аудит

**З:** §3  
**Результат:**

- **`signature_session`**, **`signature_event`** (append-only); webhook + ідемпотентність.
- UX: панель статусу підписантів, retry, expiry/decline, повернення в CRM.
- Підписаний PDF → окремий канонічний документ / версія з **`is_signed`**, чернетки read-only.

**Критерій готовності:** повний audit export або екран історії подій підпису.

---

### E7 — Події документів + автоматизація

**З:** §1I, §2E, §4, фінальний список з CORE doc  
**Результат:**

- Події: `document.*`, `contract.*`, `signature.*` у шину/лог.
- **`AutomationRule`**: інтерпретація `graphJson` (хоча б умова + одна дія: task / notify).
- Звʼязок з readiness: підпис / payment proof / required files → перерахунок або блок.

**Критерій готовності:** мінімум 3 production-правила з реальними діями (наприклад missing file → task).

---

### E8 — Handoff, виробництво, інтеграції

**З:** PRODUCT_SPEC + поточний handoff API  
**Результат:**

- Розширення пакета передачі звʼязками на **`document_link`** / handoff package entity.
- Production job (окрема сутність або воронка) + події «файл змінено під час виробництва».

---

## Інші епіки (паралельно або після E4)

| Епік | Опис |
|------|------|
| **Inbox → deal** | Привʼязка файлів з Telegram/chat до угоди (§1D.3). |
| **AI категоризація** | Підказка категорії з порогом впевненості; людина підтверджує. |
| **AI readiness / нотатки** | Підказки з політиками приватності. |
| **Міграції Prisma у prod** | Іменовані міграції замість лише `db:push`. |

---

## Синхронізація схеми БД

```powershell
cd D:\crm
pnpm db:push
pnpm exec prisma generate
```

У продакшені після стабілізації домену документів — перейти на **іменовані міграції** та узгодити з [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md) таблиці §4 «Database tables».
