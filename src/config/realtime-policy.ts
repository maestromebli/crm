export const REALTIME_POLICY = {
  leadTimelinePollingMs: 15000,
  dealActivityPollingMs: 20000,
  minPollingMs: 10000,
  maxPollingMs: 30000,
  websocketEnabled:
    process.env.NEXT_PUBLIC_ENABLE_REALTIME_WS === "1" ||
    process.env.ENABLE_REALTIME_WS === "1",
} as const;
