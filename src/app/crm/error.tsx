"use client";

import { CrmErrorPanel } from "../../components/shared/CrmErrorPanel";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Глобальна межа помилок для маршрутів `/crm/*` (окрім власних `error.tsx` у вкладених сегментах). */
export default function CrmError({ error, reset }: Props) {
  return (
    <CrmErrorPanel
      title="Помилка в CRM"
      description="Щось пішло не так під час завантаження. Спробуйте ще раз або перейдіть до головної сторінки модуля."
      error={error}
      logPrefix="[crm]"
      reset={reset}
      links={[
        { href: "/crm/finance", label: "Фінанси" },
        { href: "/crm/procurement", label: "Закупки" },
      ]}
    />
  );
}
