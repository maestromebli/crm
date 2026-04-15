"use client";

import { Pin, Plus, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { QUESTION_CATEGORY_LABEL, QUESTION_STATUS_LABEL, QUESTION_TARGET_LABEL } from "../constructor-hub.labels";
import type { ConstructorQuestion, ConstructorQuestionCategory, ConstructorQuestionStatus } from "../constructor-hub.types";

type Props = {
  questions: ConstructorQuestion[];
  onCreateQuestion?: (payload: {
    text: string;
    category: ConstructorQuestionCategory;
    status: ConstructorQuestionStatus;
  }) => void;
};

export function ConstructorQuestionsPanel({ questions, onCreateQuestion }: Props) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | ConstructorQuestionStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ConstructorQuestionCategory>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ConstructorQuestionCategory>("SIZES");

  const hasCriticalOpen = questions.some((q) => q.priority === "CRITICAL" && q.status !== "CLOSED");
  const filtered = useMemo(
    () =>
      questions.filter((q) => {
        const okStatus = statusFilter === "ALL" || q.status === statusFilter;
        const okCat = categoryFilter === "ALL" || q.category === categoryFilter;
        return okStatus && okCat;
      }),
    [questions, statusFilter, categoryFilter],
  );

  const handleCreate = () => {
    const payload = text.trim();
    if (!payload) return;
    onCreateQuestion?.({ text: payload, category, status: "OPEN" });
    setText("");
    setCategory("SIZES");
    setShowModal(false);
  };

  return (
    <section id="questions" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Відкриті питання</h3>
        <Button variant="outline" className="gap-1.5" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Нове питання
        </Button>
      </div>

      {hasCriticalOpen ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" />
            Не можна передавати у виробництво: є незакриті критичні питання.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | ConstructorQuestionStatus)}
          className="rounded-lg border border-slate-200 px-2 py-1.5"
        >
          <option value="ALL">Усі статуси</option>
          <option value="OPEN">Відкрито</option>
          <option value="IN_PROGRESS">У роботі</option>
          <option value="CLOSED">Закрито</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as "ALL" | ConstructorQuestionCategory)}
          className="rounded-lg border border-slate-200 px-2 py-1.5"
        >
          <option value="ALL">Усі категорії</option>
          {Object.entries(QUESTION_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
            Немає питань за поточним фільтром.
          </li>
        ) : null}
        {filtered.map((question) => (
          <li key={question.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{question.text}</p>
              {question.pinned ? <Pin className="h-4 w-4 text-amber-600" /> : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
              <Chip>{QUESTION_CATEGORY_LABEL[question.category]}</Chip>
              <Chip>{QUESTION_TARGET_LABEL[question.addressedTo]}</Chip>
              <Chip>{QUESTION_STATUS_LABEL[question.status]}</Chip>
              <Chip>{question.priority}</Chip>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {question.authorName} · {new Date(question.createdAt).toLocaleString("uk-UA")}
            </p>
            {question.answerPreview ? (
              <p className="mt-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                Відповідь: {question.answerPreview}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <h4 className="text-base font-semibold text-slate-900">Створити питання</h4>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Опишіть питання якомога конкретніше…"
            />
            <div className="mt-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ConstructorQuestionCategory)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {Object.entries(QUESTION_CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Скасувати
              </Button>
              <Button onClick={handleCreate}>Створити</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-2 py-0.5">{children}</span>;
}
