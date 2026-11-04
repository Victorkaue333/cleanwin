import { useEffect } from "react";

import * as ipc from "@/services/ipc";
import { useMetricsStore } from "@/stores/metricsStore";

/**
 * Subscribe to the Rust metrics loop. The backend pushes `metrics:update`
 * on every refresh; we only pull once on mount to avoid a blank first paint.
 */
export function useMetricsEvents() {
  const applySnapshot = useMetricsStore((s) => s.applySnapshot);
  const setInfo = useMetricsStore((s) => s.setInfo);
  const setError = useMetricsStore((s) => s.setError);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    ipc
      .onMetricsUpdate((snapshot) => {
        if (!disposed) applySnapshot(snapshot);
      })
      .then((fn) => (disposed ? fn() : unlisteners.push(fn)))
      .catch((err: unknown) => setError(String(err)));

    ipc
      .onMetricsError((message) => {
        if (!disposed) setError(message);
      })
      .then((fn) => (disposed ? fn() : unlisteners.push(fn)))
      .catch(() => undefined);

    ipc
      .getSystemSnapshot()
      .then((snapshot) => {
        if (!disposed && snapshot) applySnapshot(snapshot);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));

    ipc
      .getSystemInfo()
      .then((info) => {
        if (!disposed) setInfo(info);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      for (const fn of unlisteners) fn();
    };
  }, [applySnapshot, setInfo, setError]);
}
