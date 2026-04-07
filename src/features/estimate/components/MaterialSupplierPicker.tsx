"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { defaultMaterialCatalogProvider } from "../services/mock-material-catalog";
import type { CatalogItemRecord } from "../services/material-provider-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CatalogItemRecord) => void;
  favorites?: string[];
  recent?: string[];
};

export function MaterialSupplierPicker({
  open,
  onOpenChange,
  onSelect,
  favorites = [],
  recent = [],
}: Props) {
  const [q, setQ] = useState("");
  const [byCode, setByCode] = useState(false);
  const [rows, setRows] = useState<CatalogItemRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const provider = useMemo(() => defaultMaterialCatalogProvider, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await provider.search({ text: q, byCode });
      setRows(res);
    } finally {
      setLoading(false);
    }
  }, [provider, q, byCode]);

  useEffect(() => {
    if (!open) return;
    void runSearch();
  }, [open, runSearch]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] flex max-h-[min(560px,90vh)] w-[min(520px,100%-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-lg outline-none">
          <Dialog.Title className="text-[18px] font-medium text-[#111111]">
            Матеріали та постачальники
          </Dialog.Title>
          <p className="text-[12px] text-[#6B7280]">
            Пошук по демо-каталозу. Підключення зовнішніх API — через провайдер
            без зміни UI.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={byCode ? "Код…" : "Назва або код…"}
              className="flex-1 rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
            <label className="flex items-center gap-1 text-[12px] text-[#6B7280]">
              <input
                type="checkbox"
                checked={byCode}
                onChange={(e) => setByCode(e.target.checked)}
              />
              За кодом
            </label>
          </div>
          {recent.length > 0 ? (
            <p className="mt-2 text-[11px] text-[#6B7280]">
              Нещодавні: {recent.slice(0, 5).join(", ")}
            </p>
          ) : null}
          <div className="mt-3 flex-1 overflow-auto">
            {loading ? (
              <p className="text-[14px] text-[#6B7280]">Пошук…</p>
            ) : (
              <ul className="space-y-1">
                {rows.map((r) => (
                  <li key={`${r.supplierId}-${r.itemCode}`}>
                    <button
                      type="button"
                      className="w-full rounded-[12px] border border-transparent px-2 py-2 text-left text-[14px] hover:border-[#E5E7EB] hover:bg-[#FAFAFA]"
                      onClick={() => {
                        onSelect(r);
                        onOpenChange(false);
                      }}
                    >
                      <span className="font-medium">{r.itemName}</span>
                      <span className="ml-2 text-[12px] text-[#6B7280]">
                        {r.itemCode} · {r.supplierName}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[#2563EB]">
                        {r.unitPrice.toLocaleString("uk-UA")} {r.currency} /{" "}
                        {r.unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {favorites.length > 0 ? (
            <p className="mt-2 text-[11px] text-[#6B7280]">
              Обране: {favorites.slice(0, 8).join(", ")}
            </p>
          ) : null}
          <Dialog.Close className="mt-3 rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px]">
            Закрити
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
