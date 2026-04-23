"use client";

import { useCallback, useState } from "react";

/** Тіло JSON для `POST /api/leads` (як у route handler). */
export type LeadCreateJsonBody = {
  title?: string;
  contactName?: string;
  phone?: string;
  orderNumber?: string | null;
  email?: string | null;
  source?: string;
  note?: string | null;
  priority?: "low" | "normal" | "high";
  ownerId?: string;
};

export type LeadCreateOk = {
  ok: true;
  id: string;
  uploadErrors?: string[];
};

export type LeadCreateFail = {
  ok: false;
  error: string;
  status: number;
};

export type LeadCreateResult = LeadCreateOk | LeadCreateFail;

export function useLeadCreate() {
  const [loading, setLoading] = useState(false);

  const createLead = useCallback(
    async (data: LeadCreateJsonBody): Promise<LeadCreateResult> => {
      setLoading(true);
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          id?: string;
          uploadErrors?: string[];
        };
        if (!res.ok) {
          return {
            ok: false,
            error: json.error ?? "Не вдалося створити лід",
            status: res.status,
          };
        }
        if (!json.id) {
          return {
            ok: false,
            error: "Некоректна відповідь сервера",
            status: res.status,
          };
        }
        return {
          ok: true,
          id: json.id,
          ...(json.uploadErrors?.length
            ? { uploadErrors: json.uploadErrors }
            : {}),
        };
      } catch {
        return {
          ok: false,
          error: "Мережа або сервер недоступні",
          status: 0,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** `multipart/form-data` (файли + поля згідно з `POST /api/leads`). */
  const createLeadFormData = useCallback(
    async (formData: FormData): Promise<LeadCreateResult> => {
      setLoading(true);
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          body: formData,
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          id?: string;
          uploadErrors?: string[];
        };
        if (!res.ok) {
          return {
            ok: false,
            error: json.error ?? "Не вдалося створити лід",
            status: res.status,
          };
        }
        if (!json.id) {
          return {
            ok: false,
            error: "Некоректна відповідь сервера",
            status: res.status,
          };
        }
        return {
          ok: true,
          id: json.id,
          ...(json.uploadErrors?.length
            ? { uploadErrors: json.uploadErrors }
            : {}),
        };
      } catch {
        return {
          ok: false,
          error: "Мережа або сервер недоступні",
          status: 0,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { createLead, createLeadFormData, loading };
}
