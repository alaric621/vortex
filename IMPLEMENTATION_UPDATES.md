# Implementation Updates

## 2026-03-19 Client Runtime And UI State
- Implemented real request dispatch in `src/core/client/index.ts` for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `CONNECT`, `TRACE`, `WEBSOCKET`, `SSE`, `EVENTSOURCE`, `SUBSCRIBE`, and `UNSUBSCRIBE`
- Added runtime busy-state tracking so send cannot be triggered repeatedly while a request is active
- Wired stop command visibility and send-button gating through `vortex.client.busy` context keys in `package.json` and `src/extension.ts`
- Optimized request execution flow by saving the current dirty `.vht` document before sending and by resolving variables against the active request document workspace
- Reduced a duplicate `Uri.with(...)` construction in `src/views/explore/fileTreeNode.ts`
- Added runtime-focused tests for protocol dispatch, stop behavior, busy-state locking, command gating, and package contribution conditions

## 2026-03-19 Context Seed Regeneration
- Replaced the old sample requests in `src/core/filesystem/context.ts`
- Regenerated the built-in request dataset so the explorer now contains one example for every supported request method
- Organized the regenerated seed data into `http/core`, `http/advanced`, `streaming/realtime`, and `streaming/pubsub` groups

## 2026-03-19 Public Endpoints And Hook Runtime
- Switched the built-in request seed data in `src/core/filesystem/context.ts` from localhost examples to public online endpoints, primarily `httpbingo.org`, plus Wikimedia EventStreams for an EventSource sample
- Added `src/core/runHook.ts` to resolve template variables and execute pre/post JavaScript hooks against mutable request and response contexts
- Wired the client runtime to run pre-hooks before dispatch and post-hooks after completion or failure
- Added tests covering hook execution and client-level hook integration

## 2026-03-19 Per-Request Concurrency Fix
- Changed client runtime locking from a single global active request to per-request-id tracking
- Same request id is now blocked while running, but different request ids can run concurrently
- Removed global send-button gating and moved duplicate protection into command/runtime checks based on request id
- Updated runtime, command, and contribution tests to reflect the new concurrency model

## 2026-03-19 Hook Ownership Refactor
- Moved pre/post hook orchestration out of `src/core/client/index.ts` and into `sendRequestCommand` in `src/command/explore.ts`
- Kept `src/core/client/index.ts` focused on transport execution and typed response collection
- Reused `src/core/runHook.ts` only for request template resolution and script execution
- Added command-level tests to verify hook order and post-hook access to the returned response
