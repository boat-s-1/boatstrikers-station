"use client";
import { useEffect, useMemo, useState } from "react";
import { createAutosave, saveStatusLabel } from "../../../../lib/blog/autosave.mjs";

const DB_NAME = "boatstrikers-blog-drafts";
async function recoveryTransaction(key, value, write) {
  if (typeof indexedDB === "undefined") return null;
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts", write ? "readwrite" : "readonly");
      const store = transaction.objectStore("drafts");
      const request = write ? store.put(value, key) : store.get(key);
      transaction.oncomplete = () => resolve(request.result ?? null);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export async function readBlogRecovery(postId) {
  try { return await recoveryTransaction(postId, null, false); } catch { return null; }
}

// PHASE 4 wires this hook into the editor/status bar. Recovery is offered to the user, never silently applied.
export function useBlogAutosave({ postId, initialVersion, savedAt }) {
  const coordinator = useMemo(() => {
    let backups = Promise.resolve();
    return createAutosave({ version: initialVersion, savedAt,
      backup(snapshot) {
        backups = backups.catch(() => {}).then(() => recoveryTransaction(postId, snapshot, true));
        return backups;
      },
      async save(document, version) {
        const response = await fetch(`/api/admin/blog/posts/${postId}`, { method: "PUT", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document, version }) });
        const result = await response.json();
        if (!response.ok) throw Object.assign(new Error(result.error || "保存に失敗しました。"), { status: response.status });
        return result;
      },
    });
  }, [postId, initialVersion, savedAt]);
  const [state, setState] = useState(coordinator.getState);
  useEffect(() => {
    setState(coordinator.getState());
    const unsubscribe = coordinator.subscribe(setState);
    const flush = () => { if (document.visibilityState === "hidden") coordinator.flush(); };
    const online = () => coordinator.retry();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("online", online);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("online", online);
      unsubscribe(); coordinator.dispose();
    };
  }, [coordinator]);
  return { ...state, label: saveStatusLabel(state), change: coordinator.change, saveNow: coordinator.flush, retry: coordinator.retry };
}
