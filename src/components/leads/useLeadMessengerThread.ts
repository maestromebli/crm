"use client";

import { useCallback, useEffect, useState } from "react";
import type { InboxChannel, InboxConversation } from "../../features/inbox/types";
import { postJson } from "../../lib/api/patch-json";

export function useLeadMessengerThread(leadId: string) {
  const [conv, setConv] = useState<InboxConversation | null>(null);
  const [availableChannels, setAvailableChannels] = useState<InboxChannel[]>(
    [],
  );
  const [selectedChannel, setSelectedChannel] =
    useState<InboxChannel>("webchat");
  const [err, setErr] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/messenger-thread`);
      const j = (await r.json()) as {
        conversation?: InboxConversation;
        availableOutboundChannels?: InboxChannel[];
        defaultOutboundChannel?: InboxChannel;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setConv(j.conversation ?? null);
      const channels = j.availableOutboundChannels ?? [];
      setAvailableChannels(channels);
      if (j.defaultOutboundChannel) {
        setSelectedChannel(j.defaultOutboundChannel);
      } else if (channels[0]) {
        setSelectedChannel(channels[0]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setConv(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleNewMessage = useCallback(
    async (text: string) => {
      setSendErr(null);
      try {
        const j = await postJson<{
          error?: string;
          providerError?: string | null;
        }>(`/api/leads/${leadId}/messenger-thread`, {
          text,
          channel: selectedChannel,
        });
        if (j.providerError) {
          setSendErr(
            `Повідомлення збережено в CRM, але канал повернув помилку: ${j.providerError}`,
          );
        }
        await load();
      } catch (e) {
        setSendErr(e instanceof Error ? e.message : "Помилка");
      }
    },
    [leadId, load, selectedChannel],
  );

  return {
    leadId,
    conv,
    availableChannels,
    selectedChannel,
    setSelectedChannel,
    err,
    sendErr,
    loading,
    load,
    handleNewMessage,
  };
}

export type LeadMessengerThreadState = ReturnType<typeof useLeadMessengerThread>;
