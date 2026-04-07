# ENVER Sales OS — продукт, UX, архітектура, API, backlog

**Версія:** 1.0 · **Фокус:** корпусні меблі під замовлення · **Не ERP:** операційна система продажів.

---

## Північна зірка

| Ціль | Реалізація в продукті |
|------|------------------------|
| One-click | Швидке створення ліда, первинні дії без переходів |
| Швидкість | Мало полів, мало кліків, серверні мутації + `router.refresh` |
| Без навчання | Один Lead Hub, один Deal workspace, завжди видно next step |
| Не губити лідів | Дублі, SLA «без відповіді», нагадування, задачі |
| Підказка дії | Next step, readiness, банери ризику |
| Допомагає продавати | Комунікація та конверсія важливі за даних |

**Ланцюг:** `lead → communication → qualification → estimate → deal → contract → payment`

**Ролі (лише):** `SALES_MANAGER` · `HEAD_MANAGER` · `DIRECTOR` / `ADMIN`

---

## Принципи (незмінні)

1. **Lead = дія**, не пасивний запис.  
2. **Lead = тимчасовий хаб** до угоди.  
3. **Deal = основний фінальний workspace.**  
4. **Next step обов’язковий** (хоча б soft-warning + підказка задачі).  
5. **Tasks = двигун** руху по воронці.  
6. Мінімум кліків; **zero-thinking** де можливо.  
7. **Communication > Data.**  
8. Не роздувати в ERP.

---

## 1. UX design (повний каркас)

### 1.1 Модулі в навігації

- Dashboard  
- Leads (+ Lead Hub **всередині** картки ліда)  
- Deals  
- Tasks (`/today` тощо)  
- Reports  
- Settings  

### 1.2 New Lead — workflow, не форма

**Quick Create (default)** — до 5 полів, 10–20 с:

- Телефон (primary)  
- Ім’я (optional)  
- Джерело  
- Коментар (1 рядок)  
- Owner = поточний користувач (HEAD може одразу змінити через assign)

**Expanded** — згорнуто за замовчуванням:

- email, місто, тип меблів / об’єкт, бюджет, терміни, файли  

**Duplicate detection** — debounce ~300 ms по телефону:

- Показати збіги (leads / deals / contacts), прев’ю  
- Дії: відкрити існуюче · продовжити новий · позначити як повторне звернення (link)  

**Кнопки створення:**

- Створити  
- Створити і подзвонити (`tel:` + запис дотику)  
- Створити і задачу (POST lead → POST task / deep link)  
- Створити і в угоду (рідко; лише якщо вже кваліфіковано — не блокувати sales зайвим)

**Post-create:** панель «Що далі?» — Call, Message, Task, Schedule, Lead Hub, Convert.

*Поточний код:* `QuickLeadForm`, `NewLeadModal`, `PostCreateActions`, `POST /api/leads`, `GET /api/leads/check-phone`.

### 1.3 Lead Hub (структура екрану)

| Зона | Зміст |
|------|--------|
| **A. Sticky header** | Ім’я/телефон, джерело, owner, стадія, next step + дата, warnings, Convert |
| **B. Primary actions** | Call, Message, Task, Schedule, Estimate, Upload, Convert |
| **C. Status strip** | Contact · Qualification · Next step · Estimate (opt) · Files (opt) |
| **D. Communication** | Timeline + типи (call / message / note) + last touch |
| **E. Qualification** | Inline поля (JSON на бекенді) |
| **F. Estimates** | Версії, шаблони, clone |
| **G. Files** | Групи за замовчуванням, auto-category |
| **H. Tasks / Activity** | Лінки + короткі списки |

*Поточний код:* `src/modules/leads/lead-hub/LeadHubOverviewClient.tsx`, readiness — `lib/leads/lead-hub-readiness.ts`.

### 1.4 Deal workspace

- Клієнт, value, стадія, next step (meta), estimates, платежі, файли, задачі.  
- Після конверсії з ліда — банер **«Продовження з Lead Hub»** (`?fromLead=1`), щоб не відчувалося «інша система».

*Код:* `DealWorkspaceShell`, `features/deal-workspace/*`.

### 1.5 Глобальні UX-правила

- До **2 кліків** до головної дії на екрані.  
- Проблеми **видимі** (strip, банер, колір).  
- **Next step + owner** — завжди в контексті сутності (лид / угода).

---

## 2. Component architecture

```
modules/leads/
  new-lead/           # QuickLeadForm, NewLeadModal, DuplicateWarning, PostCreateActions
modules/lead-hub/
  LeadHubOverviewClient.tsx   # (розбити P3: Header, Actions, Readiness, Panels)
components/leads/   # список, рядок, вкладки, сумісність з app router
components/deal-workspace/
  DealWorkspaceShell.tsx
features/leads/queries.ts     # getLeadById, list, KPI
features/deal-workspace/*     # payload угоди
lib/leads/                    # qualification, readiness, phone, SLA meta
lib/attachments/suggest-category.ts
```

**Цільова структура (P2/P3):** винести з моноліту Lead Hub підкомпоненти + hooks (нижче).

---

## 3. State logic

| Шар | Підхід |
|-----|--------|
| Сервер | RSC + `getLeadById` / `getDealWorkspacePayload` — джерело правди |
| Мутації | `fetch` → API → `revalidatePath` / `router.refresh()` |
| Клієнт | Локальний state для форм, draft повідомлень, модалок |
| Кеш (опційно P2) | React Query для списків лідів / задач з інвалідацією після мутацій |
| Глобальний UI | Zustand — лише якщо з’явиться справжній cross-route UI (тостер вже може бути в провайдері) |

**Правило:** не дублювати великі об’єкти ліда в Zustand — тримати в URL + server refresh.

---

## 4. API design (REST, узгоджено з кодом)

| Метод | Шлях | Призначення |
|--------|------|-------------|
| POST | `/api/leads` | Quick create (+ optional `ownerId`, multipart files) |
| GET | `/api/leads/check-phone` | Duplicate check |
| PATCH | `/api/leads/[leadId]` | Поля ліда, `nextStep` / `nextStepDate`, `qualification`, `ownerId` (assign) |
| GET/POST | `/api/leads/[leadId]/messages` | Комунікація + `interactionKind` |
| GET/POST | `/api/leads/[leadId]/estimates` | Чернетки на ліду |
| POST | `/api/leads/[leadId]/attachments` | Файли |
| POST | `/api/leads/[leadId]/convert-to-deal` | 1-click + файли + estimates |
| GET | `/api/leads/assignees` | Для HEAD assign |
| … | `/api/tasks`, `/api/deals/...` | Задачі та угода |

**Контракт конверсії:** у відповіді `dealId`, `filesMigrated`, `estimatesMoved`; клієнт редіректить на `/deals/:id/workspace?fromLead=1`.

---

## 5. Data model (спрощено + Prisma)

**Lead:** id, title/contact fields, phone, email, source, ownerId, stageId, pipelineId, nextStep, nextContactAt (= next step date), qualification JSON, lastActivityAt, dealId?, timestamps.

**LeadMessage:** body, channel, interactionKind (CALL | MESSAGE | NOTE | COMMENT).

**Estimate:** `leadId?` | `dealId?`, version, line items, templateKey, totals.

**Deal:** leadId?, clientId, ownerId, stage, value, workspaceMeta (next step UI).

**Task:** entityType (LEAD | DEAL), entityId, dueAt, status, assigneeId.

**Attachment:** entityType + entityId + category (групи в UI мапляться з enum).

---

## 6. Automation logic (легкі правила)

| Тригер | Дія |
|--------|-----|
| Немає next step і не фінал | Warning у списку / hub |
| Немає відповіді / прострочений контакт | Critical / SLA strip |
| Дубль телефону | Warning + вибір дії |
| Застій N днів | Warning «stale» |
| Створено estimate + кваліфікація ОК | Підказка convert (не блокувати) |
| Лід без owner (якщо коли-небудь дозволимо pool) | Critical |

Реалізація: `lead-row-meta`, `lead-hub-readiness`, KPI views; повний «automation engine» — P2.

---

## 7. Dashboards (по ролях)

- **SALES:** мої задачі, мої ліди, без next step  
- **HEAD:** no response, no next step, unassigned, командні ризики  
- **DIRECTOR:** виторг, конверсія, ризики (звітні запити / окремі views)  

*Частково:* dashboard routes + KPI по лідах; розширення — P2.

---

## 8. Hooks (цільовий API, P2)

```ts
// useLeadCreate — обгортка над POST /api/leads + навігація ?fresh=1
// useDuplicateCheck — debounced fetch check-phone
// useNextStep — PATCH lead + локальний optimistic optional
// useTasks — список по entity + create
// useLeadHub — об’єднання messages/estimates refresh після мутацій
```

Доки достатньо явних `fetch` + `router.refresh` у клієнтських компонентах.

---

## 9. Backlog

### P1 (наступний квартал продукту)

- Quick Create: кнопки **Create+Call / Create+Task / Create+Convert** (зараз частково через post-create).  
- Duplicate UI: «link as repeat» + запис зв’язку в даних.  
- Lead estimates: **редактор рядків** (delivery/install/discount) у хабі.  
- Після convert: **опційний перенос / клон відкритих задач** з ліда на угоду.  
- Файли: **drag-and-drop** + модалка швидкої зміни категорії після upload.  
- React Query на списках лідів/задач для меншого «мигання».

### P2

- Єдиний **suggest next step** після подій (message, estimate).  
- Dashboard пакети по ролях (SQL + UI).  
- Автоматизації через чергу / cron (stale lead).  
- `useLeadCreate` / `useDuplicateCheck` як спільні hooks.

### P3

- Розбиття `LeadHubOverviewClient` на підкомпоненти з ТЗ.  
- E2E (Playwright): create → hub → convert.  
- Полірування a11y та мобільної шапки хаба.

---

## 10. Acceptance criteria (звірка)

| Критерій | Статус |
|----------|--------|
| Lead < 20 сек | Так (quick form + API) |
| Duplicate detection | Так (`check-phone`) |
| Post-create actions | Так |
| Lead hub як workspace | Так |
| Estimate на ліду | Так (чернетки + convert) |
| Файли з групами | Так (hub + enum) |
| Convert ≈ 1 клік | Так (+ drawer опційно) |
| Next step скрізь | Частково — посилити в списках/угоді |
| Менеджер не «думає» | Підказки + readiness; ще P1/P2 |

---

## 11. Приклади коду

### PATCH next step + дата

```ts
await fetch(`/api/leads/${leadId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    nextStep: "Зателефонувати з КП",
    nextStepDate: "2026-03-22",
  }),
});
```

### Створення чернетки estimate на ліду

```ts
await fetch(`/api/leads/${leadId}/estimates`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ templateKey: "kitchen" }),
});
```

### Конверсія + перехід у «той самий» досвід

```ts
const res = await fetch(`/api/leads/${leadId}/convert-to-deal`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dealTitle: optionalTitle }),
});
const { dealId } = await res.json();
router.push(`/deals/${dealId}/workspace?fromLead=1`);
```

---

*Документ узгоджений з поточною кодовою базою `D:\crm` (Next.js App Router, Prisma, Tailwind). Оновлювати при зміні модулів Lead Hub / Deals.*
