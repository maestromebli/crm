# Бекап для аналізу в ChatGPT

Те саме, що коротко в корені: **[FOR_CHATGPT_UA.md](../FOR_CHATGPT_UA.md)**. Після аналізу в ChatGPT оновлюйте **[GPT_ANALYSIS_AND_ACTIONS.md](./GPT_ANALYSIS_AND_ACTIONS.md)**.

## Швидка команда

З кореня репозиторію:

```bash
pnpm backup:gpt
```

У каталозі `backups/gpt-analysis-<дата-час>/` з’являться:

| Файл | Призначення |
|------|-------------|
| **crm-for-chatgpt-analysis.tar.gz** | Архів коду + `docs/` + Prisma + конфіги — **без** `node_modules`, `.git`, `.env*` |
| **README_FOR_CHATGPT.md** | Коротка інструкція (українською) поруч із архівом |

Завантажте **tar.gz** у чат GPT (або розпакуйте локально й прикріпіть потрібні папки).

## Що не потрапляє в архів

- Секрети: `.env`, `.env.local` тощо  
- Залежності: `node_modules`  
- Збірка: `.next`  
- Історія git: `.git`  
- Попередні бекапи: `backups/`

## Повний бекап з базою

Якщо потрібен ще SQL-дамп: [BACKUP.md](./BACKUP.md) → `pnpm backup:full`. **Не надсилайте** такий архів третім особам без видалення `.env` з `source.tar.gz`.

## Див. також

- [IMPLEMENTATION_STACK_MAP.md](./IMPLEMENTATION_STACK_MAP.md) — карта API та модулів для контексту аналізу.
- [site-restoration/README.md](./site-restoration/README.md) — **скріншоти всіх пунктів меню** (`pnpm screenshots:site`) для відновлення UI.
