// UI-independent autosave engine. Saves only via blog_save_draft, never release.
export function createAutosave({ version, savedAt = null, save, backup = async () => {}, delay = 900, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let sequence = 0, savedSequence = 0, latest = null, timer = null, running = null, blocked = false, disposed = false;
  let state = { status: "saved", version, savedAt, dirty: false, error: null };
  const listeners = new Set();
  function emit(patch) { state = { ...state, ...patch }; if (!disposed) listeners.forEach(fn => fn(state)); }
  function queue() { if (timer) clearTimer(timer); timer = setTimer(() => { timer = null; flush(); }, delay); }
  async function flush() {
    if (timer) { clearTimer(timer); timer = null; }
    if (disposed || blocked || sequence === savedSequence || !latest) return state;
    if (running) { await running; return state.status === "error" || blocked ? state : flush(); }
    const sentSequence = sequence, document = latest;
    emit({ status: "saving", dirty: true, error: null });
    running = (async () => {
      try {
        const result = await save(document, state.version);
        savedSequence = sentSequence;
        emit({ status: sequence === savedSequence ? "saved" : "dirty", version: result.version, savedAt: result.saved_at,
          dirty: sequence !== savedSequence, error: null });
        // Persist the latest snapshot, including edits that arrived while the request was running.
        await backup({ document: latest, version: result.version, dirty: sequence !== savedSequence }).catch(() => {});
      } catch (error) {
        blocked = error.status === 409;
        emit({ status: blocked ? "conflict" : "error", dirty: true, error: error.message || "保存に失敗しました。" });
      } finally { running = null; }
      if (!blocked && sequence !== savedSequence && state.status !== "error") queue();
    })();
    await running;
    return state;
  }
  return {
    getState: () => state,
    subscribe(fn) { disposed = false; listeners.add(fn); return () => listeners.delete(fn); },
    change(document) {
      latest = structuredClone(document); sequence++;
      emit({ status: blocked ? "conflict" : "dirty", dirty: true });
      backup({ document: latest, version: state.version, dirty: true }).catch(() => {});
      if (!blocked) queue();
    },
    flush,
    retry: flush,
    // Conflict needs an explicit reload/merge; automatic retries must not overwrite newer content.
    dispose() { disposed = true; if (timer) clearTimer(timer); listeners.clear(); },
  };
}

export function saveStatusLabel(state) {
  if (state.status === "saving") return "保存中";
  if (state.status === "conflict") return "競合：未保存変更あり・最新版との確認が必要です";
  if (state.status === "error") return "保存失敗：未保存変更があります";
  if (state.dirty) return "未保存変更あり";
  if (!state.savedAt) return "保存済み";
  return `保存済み ${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(state.savedAt))}`;
}
