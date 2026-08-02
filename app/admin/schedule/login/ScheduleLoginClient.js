"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../scheduleAdmin.module.css";

export default function ScheduleLoginClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/schedule/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `ログインに失敗しました（${response.status}）`);
      }

      router.replace("/admin/schedule");
      router.refresh();
    } catch (err) {
      setError(err.message || "ログインに失敗しました。");
      setBusy(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <form className={styles.loginCard} onSubmit={handleSubmit}>
        <div className={styles.loginLogo}>BS</div>
        <p className={styles.eyebrow}>WEEKLY PROGRAM</p>
        <h1>週間番組表 管理画面</h1>
        <p>管理パスワードを入力してください。</p>

        {error && <div className={styles.error}>{error}</div>}

        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="管理パスワード"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />

        <button type="submit" disabled={busy}>
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
