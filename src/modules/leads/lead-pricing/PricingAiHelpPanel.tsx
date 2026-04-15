"use client";

/**
 * Динамічна панель AI-допомоги по сметі (швидкі промпти + підказки + запуск).
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Loader2,
  Sparkle,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../../../lib/utils";

const QUICK_PROMPTS: { label: string; text: string }[] = [
  {
    label: "Фурнітура Blum",
    text: "Додай петлі Blum, навіси, тандеми для висувних ящиків; орієнтовні ціни за поточним ринком.",
  },
  {
    label: "Підсвітка LED",
    text: "Додай LED-підсвітку робочої зони та підсвітку всередині шаф; орієнтовні ціни.",
  },
  {
    label: "Доставка + монтаж",
    text: "Додай окремі рядки доставки та монтажу з орієнтовними сумами.",
  },
  {
    label: "Фасади",
    text: "Додай фасади фарбовані або плівка ПВХ з орієнтовними цінами за м².",
  },
  {
    label: "Оновити ціни",
    text: "Переглянь поточні назви позицій і підстав орієнтовні ціни там, де вони нульові або занижені.",
  },
];

type Props = {
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  onRun: () => void;
  aiBusy: boolean;
  canUpdate: boolean;
  /** true якщо можна викликати AI (є рядки або текст промпту) */
  canRunAi: boolean;
  /** Миттєві підказки з поточного стану смети */
  smartHints: string[];
  /** Примітки з останнього відповіді AI */
  apiHints: string[];
  /** Каталог зараз підтягує ціни у фоні */
  materialLookupBusy?: boolean;
  onFileDrop: (file: File) => void;
  fileBusy?: boolean;
};

export function PricingAiHelpPanel({
  aiPrompt,
  onAiPromptChange,
  onRun,
  aiBusy,
  canUpdate,
  canRunAi,
  smartHints,
  apiHints,
  materialLookupBusy,
  onFileDrop,
  fileBusy,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <motion.section
      id="lead-pricing-ai-anchor"
      layout
      initial={{ opacity: 0.96, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "scroll-mt-28 overflow-hidden rounded-2xl border shadow-md",
        materialLookupBusy
          ? "border-violet-300 ring-2 ring-violet-200/60"
          : "border-violet-200/90",
        "bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/40",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-violet-100/30"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-violet-950">
              AI-допомога з розрахунком
            </span>
            <span className="mt-0.5 block text-[11px] text-violet-800/85">
              Швидкі сценарії + ваш текст. Підставляє орієнтовні ціни та нові
              рядки до поточної смети.
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-violet-600 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="border-t border-violet-200/60"
          >
            <div className="space-y-3 px-4 pb-4 pt-2">
              {smartHints.length > 0 ? (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900/90">
                    <Zap className="h-3.5 w-3.5 text-amber-600" />
                    Зараз у фокусі
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-snug text-amber-950/90">
                    {smartHints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {apiHints.length > 0 ? (
                <div className="rounded-xl border border-violet-200/70 bg-white/80 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                    Остання відповідь AI
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-violet-950/90">
                    {apiHints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 text-[10px] font-medium text-violet-800/80">
                  Швидкий старт — натисніть, щоб підставити текст (можна
                  відредагувати):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      disabled={!canUpdate}
                      onClick={() => {
                        onAiPromptChange(
                          aiPrompt.trim()
                            ? `${aiPrompt.trim()}\n\n${q.text}`
                            : q.text,
                        );
                      }}
                      className="rounded-full border border-violet-200 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-violet-900 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] font-medium text-violet-900">
                  Ваш запит
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.pdf,.txt,.doc,.docx,image/*"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    onFileDrop(f);
                    e.currentTarget.value = "";
                  }}
                />
                <textarea
                  value={aiPrompt}
                  onChange={(e) => onAiPromptChange(e.target.value)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (!f) return;
                    onFileDrop(f);
                  }}
                  rows={3}
                  disabled={!canUpdate}
                  placeholder="Напр.: фасади МДФ фарба RAL, петлі з доводчиком, зона бару з підсвіткою…"
                  className={cn(
                    "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-violet-950 shadow-inner placeholder:text-violet-400/80 focus:outline-none focus:ring-2",
                    dragOver
                      ? "border-violet-500 ring-violet-300"
                      : "border-violet-200/90 focus:border-violet-400 focus:ring-violet-200",
                  )}
                />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-violet-700/80">
                  <span>Можна перетягнути файл у це поле (Excel/PDF/зображення).</span>
                  <button
                    type="button"
                    disabled={!canUpdate || fileBusy}
                    className="rounded-md border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {fileBusy ? "Розпізнавання…" : "Завантажити файл"}
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <motion.button
                  type="button"
                  onClick={() => void onRun()}
                  disabled={!canUpdate || aiBusy || !canRunAi}
                  whileTap={{ scale: canUpdate && !aiBusy && canRunAi ? 0.98 : 1 }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-black shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-black">
                    {aiBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                  </span>
                  <span className="flex flex-col leading-tight text-black">
                    <span className="text-xs font-semibold !text-black">AI: додати/оновити позиції</span>
                    <span className="text-[10px] text-black">у поточній сметі</span>
                  </span>
                  {!aiBusy ? (
                    <Sparkle className="h-3.5 w-3.5 text-black opacity-80" />
                  ) : null}
                </motion.button>
                <span className="text-[10px] text-black">
                  Додає нові або оновлює поточні рядки за вашим запитом.
                </span>
                {!canRunAi && canUpdate ? (
                  <span className="text-[10px] text-violet-700/80">
                    Додайте рядки в таблицю або введіть запит вище.
                  </span>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
