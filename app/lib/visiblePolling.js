// Use only for read-only dashboards, never notification/sound delivery loops.
export function startVisiblePolling(task, intervalMs) {
  let stopped = false, inFlight = false, lastStartedAt = -Infinity;
  async function tick() {
    if (stopped || document.hidden || inFlight || Date.now() - lastStartedAt < intervalMs) return;
    inFlight = true;
    lastStartedAt = Date.now();
    try { await task(); }
    catch { /* Callers own error UI. Retry only at the normal interval. */ }
    finally { inFlight = false; }
  }
  void tick();
  const timer = window.setInterval(tick, intervalMs);
  const onVisibility = () => { if (!document.hidden) void tick(); };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
