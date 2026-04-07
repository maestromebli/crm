# Повний бекап

## Запуск

З кореня проєкту:

```bash
pnpm backup:full
```

Створюється каталог `backups/<мітка ISO>/` з файлами:

| Файл | Опис |
|------|------|
| `database.sql` | Логічний дамп PostgreSQL (`pg_dump`, plain SQL) |
| `source.tar.gz` | Архів коду без `node_modules`, `.next`, вкладених `backups` |
| `manifest.json` | Чи вдалося зняти БД і код, зауваження |

## Вимоги

- У `.env.local` або `.env` заданий `DATABASE_URL`.
- У PATH або в `C:\Program Files\PostgreSQL\<версія>\bin\` доступний `pg_dump`.
- Команда `tar` (є в Windows 10+) для архіву.

## Відновлення БД

```bash
psql "postgresql://USER:PASS@HOST:PORT/DBNAME" -f backups/<мітка>/database.sql
```

Або через `pgAdmin` / інший клієнт: виконати вміст `database.sql` на потрібній базі.

## Відновлення коду

```bash
tar -xzf backups/<мітка>/source.tar.gz
cd crm   # якщо архівували з кореня — файли в поточній теці
pnpm install
pnpm db:push   # за потреби
```

Паролі та секрети з `.env.local` у архів **потрапляють**, якщо файл лежить у проєкті. Перед передачею бекапу стороннім видаліть або замініть секрети в архіві.

## Бекап без секретів для ChatGPT

- [BACKUP_FOR_CHATGPT.md](./BACKUP_FOR_CHATGPT.md) — `pnpm backup:gpt` → один **.tar.gz** для завантаження в чат.

## Див. також

- [DATABASE.md](./DATABASE.md) — підключення PostgreSQL, типові помилки, таблиці воркспейсу.
- [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md) — цільова архітектура документів і контрактів (після відновлення коду орієнтуйтесь на роадмап).
- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) — епіки імплементації.
