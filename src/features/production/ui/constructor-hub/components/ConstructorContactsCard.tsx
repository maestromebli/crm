"use client";

import { SendHorizonal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConstructorContact, ConstructorMessage } from "../constructor-hub.types";

export function ConstructorContactsCard({
  contacts,
  messages,
  onSendMessage,
}: {
  contacts: ConstructorContact[];
  messages: ConstructorMessage[];
  onSendMessage?: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const payload = text.trim();
    if (!payload) return;
    onSendMessage?.(payload);
    setText("");
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Контакти проєкту</h3>
      <ul className="mt-2 space-y-1.5 text-xs">
        {contacts.map((contact) => (
          <li key={contact.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="text-slate-600">{contact.roleLabel}</span>
            <span className="text-right font-medium text-slate-800">{contact.name}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Комунікація</h4>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
          {messages.length === 0 ? <li className="text-slate-500">Повідомлень поки немає.</li> : null}
          {messages.map((msg) => (
            <li key={msg.id} className="rounded-md bg-white px-2 py-1.5">
              <p className="text-[11px] text-slate-500">
                {msg.authorName} · {msg.authorRole}
              </p>
              <p className="text-slate-700">{msg.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Написати повідомлення…"
          />
          <Button size="sm" className="gap-1" onClick={submit}>
            <SendHorizonal className="h-3.5 w-3.5" />
            Надісл.
          </Button>
        </div>
      </div>
    </section>
  );
}
