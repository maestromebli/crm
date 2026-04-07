# Jira Import Pack (CRM Roadmap)

В проекте подготовлены 4 CSV-варианта для разных ограничений Jira-импорта.

## Какие файлы использовать

- `jira_import_crm_roadmap_project_template.csv`
  - Лучший вариант, если в Jira корректно маппятся поля проекта.
  - Содержит: `Project Key`, `Component/s`, `Sprint`, `Fix Version`, связи `Epic Link` и `Parent`.
  - Используй, когда хочешь получить почти готовую иерархию сразу после импорта.

- `jira_import_crm_roadmap.csv`
  - Базовый полный вариант с иерархией (`Epic`/`Story`/`Sub-task`) и без project-специфики.
  - Подходит, если не нужны спринты/компоненты/версии на этапе импорта.

- `jira_import_crm_roadmap_flat.csv`
  - Плоский вариант для Jira, где плохо работают `Epic Link`/`Parent`.
  - Связи сохранены через `Roadmap Group` и `Parent Summary`.
  - После импорта удобно массово досвязать задачи фильтрами.

- `jira_import_crm_roadmap_minimal.csv`
  - Ультра-совместимый вариант: только `Issue Type`, `Summary`, `Description`, `Priority`.
  - Используй, если импорт постоянно падает на дополнительных полях.

- `jira_import_crm_roadmap_epics_stories.csv`
  - Только `Epic` + `Story` (без `Sub-task`).
  - Самый чистый и простой старт для ручной декомпозиции после импорта.

## Рекомендуемый порядок попыток

1. Сначала попробуй `jira_import_crm_roadmap_project_template.csv`.
2. Если не взлетело по связям, попробуй `jira_import_crm_roadmap.csv`.
3. Если Jira всё равно ломает иерархию, используй `jira_import_crm_roadmap_flat.csv`.
4. В самом строгом случае используй `jira_import_crm_roadmap_minimal.csv`.
5. Если нужен простой старт без сабтасков — `jira_import_crm_roadmap_epics_stories.csv`.

## Быстрый чек перед импортом

- Проверь `Project Key` (в шаблоне сейчас `CRM`).
- Проверь точные имена `Sprint` (должны совпадать 1:1 с Jira).
- Проверь существование `Component/s` и `Fix Version`.
- Убедись, что в проекте разрешены нужные типы задач (`Epic`, `Story`, `Sub-task`).

## Маппинг полей (для CSV Import)

- `Issue Type` -> Issue Type
- `Summary` -> Summary
- `Description` -> Description
- `Priority` -> Priority
- `Labels` -> Labels
- `Story Points` -> Story Points
- `Project Key` -> Project
- `Component/s` -> Components
- `Sprint` -> Sprint
- `Fix Version` -> Fix Version/s
- `Epic Name` -> Epic Name
- `Epic Link` -> Epic Link
- `Parent` -> Parent

Если часть полей отсутствует в выбранном CSV, просто пропусти их в маппинге.
