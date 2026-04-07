"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Eye, X } from "lucide-react";
import { Button } from "../ui/button";

type Target = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export function ImpersonationSwitcher() {
  const { data: session, status, update } = useSession();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSuperAdmin = session?.user?.realRole === "SUPER_ADMIN";
  const impersonating = Boolean(session?.user?.impersonatorId);

  const loadTargets = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/impersonation-targets");
      const j = (await r.json()) as { users?: Target[] };
      if (r.ok && j.users) setTargets(j.users);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const onSelectUser = async (userId: string) => {
    if (!userId || userId === session?.user?.id) return;
    setBusy(true);
    try {
      await update({ impersonateUserId: userId });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await update({ impersonateUserId: null });
    } finally {
      setBusy(false);
    }
  };

  if (status !== "authenticated" || !isSuperAdmin) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {impersonating ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-950">
            <Eye className="h-3 w-3 shrink-0" />
            Перегляд як: {session.user.email} ({session.user.role})
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={busy}
            onClick={() => void stop()}
          >
            <X className="h-3 w-3" />
            Повернутись
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            Імпersonація
          </span>
          <select
            disabled={busy || loading}
            className="h-8 max-w-[240px] rounded-md border border-input bg-background px-2 text-xs"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              e.target.value = "";
              if (v) void onSelectUser(v);
            }}
          >
            <option value="">
              {loading ? "Завантаження…" : "Обрати користувача"}
            </option>
            {targets.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name ?? u.email) + ` · ${u.role}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
