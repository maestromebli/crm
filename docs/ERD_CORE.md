# ERD: ядро угоди та воркспейс

Спрощена схема сутностей, пов’язаних з **Deal workspace**, готовністю до виробництва та файлами. Детальні поля — у `prisma/schema.prisma` та [PRODUCT_SPEC_AI_CRM_MANUFACTURING.md](./PRODUCT_SPEC_AI_CRM_MANUFACTURING.md).

```mermaid
erDiagram
  User ||--o{ Deal : "owner"
  Client ||--o{ Deal : "has"
  Pipeline ||--o{ Deal : "in"
  PipelineStage ||--o{ Deal : "current"
  Deal ||--o| DealContract : "has"
  Deal ||--o{ ReadinessEvaluation : "snapshots"
  Deal ||--o| DealHandoff : "handoff"
  Deal ||--o{ FileAsset : "logical_files"
  Deal ||--o{ Order : "orders"
  FileAsset ||--o{ Attachment : "versions"
  User ||--o{ Attachment : "uploaded"
  AutomationRule ||--o{ AutomationRun : "runs"
  User ||--o{ AutomationRun : "startedBy_optional"

  Deal {
    string id PK
    string title
    json workspaceMeta
  }

  DealContract {
    string id PK
    string dealId UK
    enum status
  }

  ReadinessEvaluation {
    string id PK
    string dealId FK
    enum outcome
    boolean allMet
    json checksJson
    datetime evaluatedAt
  }

  DealHandoff {
    string id PK
    string dealId UK
    enum status
    json manifestJson
  }

  FileAsset {
    string id PK
    string dealId FK
    enum category
  }

  Attachment {
    string id PK
    string fileAssetId FK "optional legacy"
    int version
    boolean isCurrentVersion
  }
```

## Потоки даних (коротко)

- **Готовність:** розрахунок у коді (`evaluateReadiness`) за `workspaceMeta`, `DealContract.status` та категоріями `Attachment`. Після змін мети, договору або файлів викликається `persistReadinessSnapshot` → новий рядок `ReadinessEvaluation`.
- **Файли:** нове завантаження створює `FileAsset` і перший `Attachment`; повтор з тим самим `fileAssetId` додає версію (`version++`, попередні `isCurrentVersion = false`).
- **Передача:** `DealHandoff` тримає статус життєвого циклу; прапорець `handoffPackageReady` лишається в `workspaceMeta` для readiness-чекліста.
