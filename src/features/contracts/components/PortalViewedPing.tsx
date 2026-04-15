"use client";

import { useEffect, useRef } from "react";

export function PortalViewedPing({ token }: { token: string }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void fetch(`/api/portal/contracts/${token}/viewed`, { method: "POST" });
  }, [token]);
  return null;
}
