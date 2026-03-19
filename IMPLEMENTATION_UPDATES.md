# Implementation Updates

## 2026-03-19 Client Runtime And UI State
- Implemented real request dispatch in `src/core/client/index.ts` for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `CONNECT`, `TRACE`, `WEBSOCKET`, `SSE`, `EVENTSOURCE`, `SUBSCRIBE`, and `UNSUBSCRIBE`
- Added runtime busy-state tracking so send cannot be triggered repeatedly while a request is active
- Wired stop command visibility and send-button gating through `vortex.client.busy` context keys in `package.json` and `src/extension.ts`
- Optimized request execution flow by saving the current dirty `.vht` document before sending and by resolving variables against the active request document workspace
- Reduced a duplicate `Uri.with(...)` construction in `src/views/explore/fileTreeNode.ts`
- Added runtime-focused tests for protocol dispatch, stop behavior, busy-state locking, command gating, and package contribution conditions
