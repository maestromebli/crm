# Realtime Rollout Policy (CORE CRM ENGINE ENVER V2)

## Phase policy

- Phase 1: polling-first refresh, no websocket dependency.
- Phase 2: optional websocket channel behind feature flag.
- Rollback: disable websocket flag and remain on polling with no UX break.

## Polling windows

- Lead timeline: 15s.
- Deal activity tab: 20s.
- Allowed system range: 10s to 30s.

## Feature flag

- `NEXT_PUBLIC_ENABLE_REALTIME_WS=1` or `ENABLE_REALTIME_WS=1` enables websocket path.
- Default is disabled to preserve stable behavior.
