"use client";

import { CheckCircle2, MessageSquarePlus, Save as Зберегти, SendHorizonal, Download as Вивантажити } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onNextStep: () => void;
  onAskQuestion: () => void;
  onUploadFiles: () => void;
  onSubmitForReview: () => void;
  onSaveDraft: () => void;
};

export function ConstructorActionBar(props: Props) {
  return (
    <section className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="gap-2" onClick={props.onNextStep}>
          <CheckCircle2 className="h-4 w-4" />
          Наступний крок
        </Button>
        <Button variant="outline" className="gap-2" onClick={props.onAskQuestion}>
          <MessageSquarePlus className="h-4 w-4" />
          Поставити питання
        </Button>
        <Button variant="outline" className="gap-2" onClick={props.onUploadFiles}>
          <Вивантажити className="h-4 w-4" />
          Завантажити файли
        </Button>
        <Button variant="outline" className="gap-2" onClick={props.onSubmitForReview}>
          <SendHorizonal className="h-4 w-4" />
          Надіслати на перевірку
        </Button>
        <Button variant="ghost" className="gap-2" onClick={props.onSaveDraft}>
          <Зберегти className="h-4 w-4" />
          Зберегти чернетку
        </Button>
      </div>
    </section>
  );
}
