import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export type Assignee = { id: string; name: string | null; email: string };
export type DesignerOption = { id: string; name: string | null; email: string };
export type ReferralType = "DESIGNER" | "CONSTRUCTION_COMPANY" | "PERSON";
export type CompanyContactDraft = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  category: string;
};

function formatAssignee(a: Assignee): string {
  return a.name?.trim() || a.email;
}

type QuickLeadFormProps = {
  inputClass: string;
  customerType: "PERSON" | "COMPANY";
  onCustomerTypeChange: (v: "PERSON" | "COMPANY") => void;
  companyName: string;
  onCompanyNameChange: (v: string) => void;
  contactName: string;
  onContactNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  orderNumber: string;
  onOrderNumberChange: (v: string) => void;
  companyContacts: CompanyContactDraft[];
  onCompanyContactChange: (
    id: string,
    field: "fullName" | "phone" | "email" | "category",
    value: string,
  ) => void;
  onAddCompanyContact: () => void;
  onRemoveCompanyContact: (id: string) => void;
  contactCategoryOptions: Array<{ value: string; label: string }>;
  duplicateSlot: ReactNode;
  source: string;
  onSourceChange: (v: string) => void;
  sourceOptions: Array<{ value: string; label: string }>;
  designerSourceValue: string;
  designersLoading: boolean;
  designers: DesignerOption[];
  designerId: string;
  onDesignerIdChange: (v: string) => void;
  referralType: ReferralType;
  onReferralTypeChange: (v: ReferralType) => void;
  referralName: string;
  onReferralNameChange: (v: string) => void;
  referralPhone: string;
  onReferralPhoneChange: (v: string) => void;
  referralEmail: string;
  onReferralEmailChange: (v: string) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  assigneesLoading: boolean;
  assignees: Assignee[];
  ownerId: string;
  onOwnerIdChange: (v: string) => void;
  sessionNameOrEmail: string | null | undefined;
};

export function QuickLeadForm({
  inputClass,
  customerType,
  onCustomerTypeChange,
  companyName,
  onCompanyNameChange,
  contactName,
  onContactNameChange,
  phone,
  onPhoneChange,
  orderNumber,
  onOrderNumberChange,
  companyContacts,
  onCompanyContactChange,
  onAddCompanyContact,
  onRemoveCompanyContact,
  contactCategoryOptions,
  duplicateSlot,
  source,
  onSourceChange,
  sourceOptions,
  designerSourceValue,
  designersLoading,
  designers,
  designerId,
  onDesignerIdChange,
  referralType,
  onReferralTypeChange,
  referralName,
  onReferralNameChange,
  referralPhone,
  onReferralPhoneChange,
  referralEmail,
  onReferralEmailChange,
  comment,
  onCommentChange,
  assigneesLoading,
  assignees,
  ownerId,
  onOwnerIdChange,
  sessionNameOrEmail,
}: QuickLeadFormProps) {
  const showReferralDetails =
    source === "Рекомендація" || source === designerSourceValue;

  return (
    <>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Швидке створення
        </p>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">
            Тип замовника
          </span>
          <select
            className={inputClass}
            value={customerType}
            onChange={(e) =>
              onCustomerTypeChange(e.target.value as "PERSON" | "COMPANY")
            }
          >
            <option value="PERSON">Фізична особа</option>
            <option value="COMPANY">Компанія</option>
          </select>
        </label>
        {customerType === "COMPANY" ? (
          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-slate-700">
              Назва компанії<span className="text-rose-500">*</span>
            </span>
            <input
              className={inputClass}
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="ТОВ/ФОП/студія…"
            />
          </label>
        ) : null}
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">Імʼя</span>
          <input
            className={inputClass}
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
            autoComplete="name"
            placeholder="Як звертатись"
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">
            Телефон
          </span>
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            autoComplete="tel"
            placeholder="+380…"
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">
            Номер замовлення<span className="text-rose-500">*</span>
          </span>
          <input
            className={inputClass}
            value={orderNumber}
            onChange={(e) => onOrderNumberChange(e.target.value)}
            placeholder="ЕМ-1"
          />
        </label>
        <p className="text-[10px] text-slate-500">
          Формат: ЕМ-1 ... ЕМ-200.
        </p>
        {duplicateSlot}
        <p className="text-[10px] text-slate-500">
          Потрібно хоча б імʼя або телефон.
        </p>
        {customerType === "COMPANY" ? (
          <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-white/70 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-700">
                Контактні особи компанії
              </p>
              <button
                type="button"
                onClick={onAddCompanyContact}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
              >
                Додати контакт
              </button>
            </div>
            {companyContacts.map((contact, idx) => (
              <div
                key={contact.id}
                className="space-y-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-slate-500">
                    Контакт #{idx + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemoveCompanyContact(contact.id)}
                    className="text-[10px] text-rose-600 hover:text-rose-700"
                  >
                    Видалити
                  </button>
                </div>
                <input
                  className={inputClass}
                  value={contact.fullName}
                  onChange={(e) =>
                    onCompanyContactChange(contact.id, "fullName", e.target.value)
                  }
                  placeholder="ПІБ / роль"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    value={contact.phone}
                    onChange={(e) =>
                      onCompanyContactChange(contact.id, "phone", e.target.value)
                    }
                    placeholder="Телефон"
                  />
                  <input
                    className={inputClass}
                    value={contact.email}
                    onChange={(e) =>
                      onCompanyContactChange(contact.id, "email", e.target.value)
                    }
                    placeholder="Е-пошта"
                  />
                </div>
                <select
                  className={inputClass}
                  value={contact.category}
                  onChange={(e) =>
                    onCompanyContactChange(contact.id, "category", e.target.value)
                  }
                >
                  {contactCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="text-[10px] text-slate-500">
              Перший контакт вважається основним для ліда.
            </p>
          </div>
        ) : null}
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">
            Джерело<span className="text-rose-500">*</span>
          </span>
          <select
            className={inputClass}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            <option value="">Оберіть джерело…</option>
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {source === designerSourceValue ? (
          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-slate-700">
              Дизайнер<span className="text-rose-500">*</span>
            </span>
            {designersLoading ? (
              <p className="text-[11px] text-slate-500">Завантаження списку…</p>
            ) : (
              <select
                className={inputClass}
                value={designerId}
                onChange={(e) => onDesignerIdChange(e.target.value)}
              >
                <option value="">Оберіть дизайнера…</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatAssignee(d)}
                  </option>
                ))}
              </select>
            )}
          </label>
        ) : null}
        {showReferralDetails ? (
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white/80 p-2">
            <p className="text-[11px] font-medium text-slate-700">
              Хто привів замовника
            </p>
            <select
              className={inputClass}
              value={referralType}
              onChange={(e) =>
                onReferralTypeChange(e.target.value as ReferralType)
              }
            >
              <option value="DESIGNER">Дизайнер</option>
              <option value="CONSTRUCTION_COMPANY">Будівельна компанія</option>
              <option value="PERSON">Людина</option>
            </select>
            <input
              className={inputClass}
              value={referralName}
              onChange={(e) => onReferralNameChange(e.target.value)}
              placeholder="Імʼя / назва компанії"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                value={referralPhone}
                onChange={(e) => onReferralPhoneChange(e.target.value)}
                placeholder="Телефон (опційно)"
              />
              <input
                className={inputClass}
                value={referralEmail}
                onChange={(e) => onReferralEmailChange(e.target.value)}
                placeholder="Е-пошта (опційно)"
              />
            </div>
          </div>
        ) : null}
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-600">
            Коментар
          </span>
          <textarea
            className={cn(inputClass, "min-h-[64px] resize-y")}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Коротко: що потрібно клієнту"
          />
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Відповідальний
        </p>
        {assigneesLoading ? (
          <p className="text-[11px] text-slate-500">Завантаження…</p>
        ) : assignees.length <= 1 ? (
          <p className="text-[11px] text-slate-700">
            {assignees[0]
              ? formatAssignee(assignees[0])
              : sessionNameOrEmail ?? "—"}
          </p>
        ) : (
          <select
            className={inputClass}
            value={ownerId}
            onChange={(e) => onOwnerIdChange(e.target.value)}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAssignee(a)}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  );
}
