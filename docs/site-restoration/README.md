# Відновлення UI / скріншоти сайту

Каталог **`screenshots/`** містить PNG-знімки сторінок і пунктів бічного меню (усі маршрути з `src/config/navigation.ts` + сторінки налаштувань з `src/config/settings.ts`), плюс логін і корінь сайту.

## Як оновити знімки

1. Запустіть PostgreSQL і застосуйте схему: `pnpm db:push` (за потреби `pnpm db:seed`).
2. Встановіть браузер для Playwright (один раз): `pnpm screenshots:install`
3. Запустіть dev-сервер **або** дозвольте тесту підняти його сам:
   ```bash
   pnpm screenshots:site
   ```
4. Результат:
   - `screenshots/*.png` — повносторінкові знімки;
   - `screenshots/manifest.json` — список файлів, підписи (українською), група меню, помилки завантаження.

## Робоче місце угоди (вкладки)

За замовчуванням знімаються лише маршрути з глобального меню. Щоб додати **всі вкладки** воркспейсу угоди:

```bash
set SCREENSHOT_DEAL_ID=ваш_cuid_угоди
pnpm screenshots:site
```

(PowerShell: `$env:SCREENSHOT_DEAL_ID="..."`)

## Змінні середовища

| Змінна | Опис |
|--------|------|
| `SCREENSHOT_EMAIL` | Логін (за замовчуванням `admin@enver.com`) |
| `SCREENSHOT_PASSWORD` | Пароль (за замовчуванням `admin123`) |
| `SCREENSHOT_DEAL_ID` | CUID угоди для `/deals/.../workspace?tab=...` |
| `SCREENSHOT_BASE_URL` | База (за замовчуванням `http://127.0.0.1:3000`) |
| `SCREENSHOT_SKIP_SERVER` | `1` — не запускати `pnpm dev` з Playwright (сервер уже працює) |

## Примітки

- Якщо Prisma-клієнт новіший за базу (`P2022`, «column does not exist»), виконайте **`pnpm db:push`** перед знімками — інакше частина сторінок (наприклад воркспейс угоди) може падати на сервері.
- Якщо сторінка повертає 4xx/5xx або таймаут, у `manifest.json` з’явиться запис у `errors`, файл PNG може бути відсутній або застарілим.
- Для архіву або GPT зручніше також використати `pnpm backup:gpt` (код + доки без секретів).
