"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupplierItem } from "../core/supplierTypes";
import { useSupplierSearch } from "../hooks/useSupplierSearch";
import { SupplierItemCard } from "./SupplierItemCard";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: SupplierItem) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function SupplierSearchDropdown({
  value,
  onChange,
  onSelect,
  disabled,
  className,
  placeholder = "Пошук матеріалу за назвою…",
}: Props) {
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { items, isFetching } = useSupplierSearch({ query: value, limit: 12, enabled: focused });
  const showDropdown = focused && value.trim().length >= 2;
  const showItems = showDropdown && items.length > 0;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as Node;
      if (wrapRef.current?.contains(el)) return;
      setFocused(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!showItems) {
      const timer = window.setTimeout(() => setActiveIdx(-1), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setActiveIdx(0), 0);
    return () => window.clearTimeout(timer);
  }, [showItems, value]);

  const emptyState = useMemo(
    () => showDropdown && !isFetching && value.trim().length >= 2 && items.length === 0,
    [showDropdown, isFetching, value, items.length],
  );

  return (
    <div ref={wrapRef} className={`relative w-full ${className ?? ""}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[12px] shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setFocused(false);
            return;
          }
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(items.length - 1, i + 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(0, i - 1));
            return;
          }
          if (e.key === "Enter" && activeIdx >= 0) {
            e.preventDefault();
            const item = items[activeIdx];
            if (item) {
              onSelect(item);
              setFocused(false);
            }
          }
        }}
      />
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {isFetching ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Пошук постачальників…
            </div>
          ) : null}
          {showItems
            ? items.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(item);
                    setFocused(false);
                  }}
                  className={`mb-1 block w-full rounded-md px-1 py-1 text-left ${
                    idx === activeIdx ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"
                  }`}
                >
                  <SupplierItemCard item={item} compact />
                </button>
              ))
            : null}
          {emptyState ? (
            <p className="px-2 py-2 text-xs text-slate-500">
              Нічого не знайдено. Спробуйте частину назви (`egger 18`).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
