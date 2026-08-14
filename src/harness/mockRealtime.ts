// Harness-only stand-in for '../lib/realtime', swapped in by vite.harness.config.ts.
// The real module opens a reconnecting WebSocket to the deployed backend; in the harness that just
// produces a retry loop in the console. Returns the same disconnect handle so callers' cleanup runs.
export type { RealtimeEvent } from '../lib/realtime';

export function connectCollectiveRealtime(): () => void {
  return () => {};
}
