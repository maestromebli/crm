"use client";

import { ImagePlus, Trash2, Download as Вивантажити, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

type Props = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  title: string;
  items: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
  }>;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onAddFiles: (files: File[]) => void;
  onReplaceFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClear: () => void;
};

function collectImageFiles(list: DataTransferItemList | FileList): File[] {
  const out: File[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if ("kind" in item) {
      if (item.kind !== "file") continue;
      const f = item.getAsFile();
      if (f && f.type.startsWith("image/")) out.push(f);
      continue;
    }
    if (item.type.startsWith("image/")) out.push(item);
  }
  return out;
}

export function ObjectPhotoDropWindow({
  open,
  containerRef,
  title,
  items,
  busy = false,
  error = null,
  onClose,
  onAddFiles,
  onReplaceFiles,
  onRemoveFile,
  onClear,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const lastNormalRectRef = useRef({
    x: 24,
    y: 24,
    width: 760,
    height: 520,
  });
  const [maximized, setMaximized] = useState(false);
  const [windowRect, setWindowRect] = useState({
    x: 24,
    y: 24,
    width: 760,
    height: 520,
  });
  const dragStateRef = useRef<{
    mode: "move" | "resize" | null;
    edge?:
      | "right"
      | "left"
      | "top"
      | "bottom"
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right";
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const previews = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.fileName || "Зображення",
        size: item.fileSize ?? 0,
        url: item.fileUrl,
      })),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const c = containerRef.current;
    if (!c) return;
    const cRect = c.getBoundingClientRect();
    const nextWidth = Math.min(760, Math.max(420, cRect.width - 32));
    const nextHeight = Math.min(560, Math.max(320, cRect.height - 32));
    setWindowRect((prev) => ({
      ...prev,
      x: Math.max(8, Math.min(prev.x, cRect.width - nextWidth - 8)),
      y: Math.max(8, Math.min(prev.y, cRect.height - nextHeight - 8)),
      width: nextWidth,
      height: nextHeight,
    }));
    if (maximized) {
      setWindowRect({
        x: 0,
        y: 0,
        width: cRect.width,
        height: cRect.height,
      });
    }
  }, [open, containerRef, maximized]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = collectImageFiles(items);
      if (imageFiles.length > 0) {
        e.preventDefault();
        onAddFiles(imageFiles);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
  }, [open, onAddFiles, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      const c = containerRef.current;
      if (!state || !c) return;
      const cRect = c.getBoundingClientRect();
      if (state.mode === "move") {
        const nextX = state.startLeft + (e.clientX - state.startX);
        const nextY = state.startTop + (e.clientY - state.startY);
        const clampedX = Math.max(0, Math.min(nextX, cRect.width - windowRect.width));
        const clampedY = Math.max(0, Math.min(nextY, cRect.height - windowRect.height));
        setWindowRect((prev) => ({ ...prev, x: clampedX, y: clampedY }));
      } else if (state.mode === "resize") {
        const minW = 420;
        const minH = 320;
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        let nextLeft = state.startLeft;
        let nextTop = state.startTop;
        let nextWidth = state.startWidth;
        let nextHeight = state.startHeight;

        const edge = state.edge ?? "bottom-right";
        if (edge.includes("right")) {
          nextWidth = state.startWidth + dx;
        }
        if (edge.includes("left")) {
          const proposedLeft = state.startLeft + dx;
          const maxLeft = state.startLeft + state.startWidth - minW;
          nextLeft = Math.max(0, Math.min(proposedLeft, maxLeft));
          nextWidth = state.startWidth - (nextLeft - state.startLeft);
        }
        if (edge.includes("bottom")) {
          nextHeight = state.startHeight + dy;
        }
        if (edge.includes("top")) {
          const proposedTop = state.startTop + dy;
          const maxTop = state.startTop + state.startHeight - minH;
          nextTop = Math.max(0, Math.min(proposedTop, maxTop));
          nextHeight = state.startHeight - (nextTop - state.startTop);
        }

        if (nextLeft + nextWidth > cRect.width) {
          nextWidth = cRect.width - nextLeft;
        }
        if (nextTop + nextHeight > cRect.height) {
          nextHeight = cRect.height - nextTop;
        }

        nextWidth = Math.max(minW, nextWidth);
        nextHeight = Math.max(minH, nextHeight);
        setWindowRect({
          x: nextLeft,
          y: nextTop,
          width: nextWidth,
          height: nextHeight,
        });
      }
    };
    const onMouseUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [open, containerRef, windowRect.width, windowRect.height]);

  const toggleMaximize = () => {
    const c = containerRef.current;
    if (!c) return;
    const cRect = c.getBoundingClientRect();
    if (!maximized) {
      lastNormalRectRef.current = windowRect;
      setWindowRect({
        x: 0,
        y: 0,
        width: cRect.width,
        height: cRect.height,
      });
      setMaximized(true);
      return;
    }
    const prev = lastNormalRectRef.current;
    setWindowRect({
      x: Math.max(0, Math.min(prev.x, Math.max(0, cRect.width - prev.width))),
      y: Math.max(0, Math.min(prev.y, Math.max(0, cRect.height - prev.height))),
      width: Math.min(prev.width, cRect.width),
      height: Math.min(prev.height, cRect.height),
    });
    setMaximized(false);
  };

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[90] pointer-events-none"
      aria-label="Плаваюче вікно фото об'єкта"
    >
      <div
        className="pointer-events-auto absolute rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{
          left: `${windowRect.x}px`,
          top: `${windowRect.y}px`,
          width: `${windowRect.width}px`,
          height: `${windowRect.height}px`,
        }}
      >
        <div
          className="flex cursor-move items-center justify-between border-b border-slate-200 px-4 py-3"
          onMouseDown={(e) => {
            if (maximized) return;
            dragStateRef.current = {
              mode: "move",
              startX: e.clientX,
              startY: e.clientY,
              startLeft: windowRect.x,
              startTop: windowRect.y,
              startWidth: windowRect.width,
              startHeight: windowRect.height,
            };
          }}
          onDoubleClick={toggleMaximize}
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">Фото об&apos;єкта</p>
            <p className="text-xs text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(100%-57px)] overflow-y-auto space-y-3 px-4 py-4">
          <div className="sticky top-0 z-10 -mx-1 rounded-lg border border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <Вивантажити className="h-3.5 w-3.5" />
                Додати фото
              </button>
              {previews.length > 0 ? (
                <button
                  type="button"
                  onClick={() => replaceInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  Замінити всі
                </button>
              ) : null}
              {previews.length > 0 ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3 w-3" />
                  Очистити список
                </button>
              ) : null}
            </div>
          </div>
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const dropped = collectImageFiles(e.dataTransfer.files);
              if (dropped.length > 0) onAddFiles(dropped);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragActive
                ? "border-sky-500 bg-sky-50"
                : "border-slate-300 bg-slate-50/80"
            }`}
          >
            <ImagePlus className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-2 text-sm font-medium text-slate-800">
              Перетягніть фото сюди або вставте Ctrl+V
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Підтримується вставка з буфера, drag&drop і вибір файлу
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
            >
              <Вивантажити className="h-3.5 w-3.5" />
              {busy ? "Завантаження..." : "Обрати фото"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files ? Array.from(e.target.files) : [];
                const onlyImages = selected.filter((f) => f.type.startsWith("image/"));
                if (onlyImages.length > 0) onAddFiles(onlyImages);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files ? Array.from(e.target.files) : [];
                const onlyImages = selected.filter((f) => f.type.startsWith("image/"));
                if (onlyImages.length > 0) onReplaceFiles(onlyImages);
                e.currentTarget.value = "";
              }}
            />
          </div>
          {error ? (
            <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
              {error}
            </p>
          ) : null}

          {previews.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700">
                  Завантажено на сервер: {previews.length}
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Фото збережені у вкладці «Файли» ліда (категорія «Фото об&apos;єкта»).
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {previews.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="aspect-[4/3] bg-slate-100">
                      {/* Uploaded/remote file preview inside floating tool window. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-2 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.size > 0
                            ? `${(item.size / 1024 / 1024).toFixed(2)} MB`
                            : "Розмір невідомий"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveFile(idx)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Фото ще немає. Можна вставити знімок прямо з буфера або перетягнути файл.
            </p>
          )}
        </div>
        <button
          type="button"
          className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm border border-slate-300 bg-slate-100"
          disabled={maximized}
          onMouseDown={(e) => {
            e.stopPropagation();
            dragStateRef.current = {
              mode: "resize",
              edge: "bottom-right",
              startX: e.clientX,
              startY: e.clientY,
              startLeft: windowRect.x,
              startTop: windowRect.y,
              startWidth: windowRect.width,
              startHeight: windowRect.height,
            };
          }}
        />
        {!maximized ? (
          <>
            <button
              type="button"
              aria-label="Resize left edge"
              className="absolute bottom-4 left-0 top-4 w-1.5 cursor-ew-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "left",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
            <button
              type="button"
              aria-label="Resize right edge"
              className="absolute bottom-4 right-0 top-4 w-1.5 cursor-ew-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "right",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
            <button
              type="button"
              aria-label="Resize top edge"
              className="absolute left-4 right-4 top-0 h-1.5 cursor-ns-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "top",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
            <button
              type="button"
              aria-label="Resize bottom edge"
              className="absolute bottom-0 left-4 right-4 h-1.5 cursor-ns-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "bottom",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
            <button
              type="button"
              aria-label="Resize top left corner"
              className="absolute left-0 top-0 h-3 w-3 cursor-nwse-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "top-left",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
            <button
              type="button"
              aria-label="Resize top right corner"
              className="absolute right-0 top-0 h-3 w-3 cursor-nesw-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "top-right",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
            <button
              type="button"
              aria-label="Resize bottom left corner"
              className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize bg-transparent"
              onMouseDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: "resize",
                  edge: "bottom-left",
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: windowRect.x,
                  startTop: windowRect.y,
                  startWidth: windowRect.width,
                  startHeight: windowRect.height,
                };
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
