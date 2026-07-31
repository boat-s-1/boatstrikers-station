"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../radioBlogAdmin.module.css";

export default function RadioBlogLoginClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/admin/radio-blog/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "ログインできませんでした。");
      setBusy(false);
      return;
    }

    router.replace("/admin/radio-blog");
    router.refresh();
  }

  return (
    <main className={styles.loginPage}>
      <form className={styles.loginCard} onSubmit={submit}>
        <p className={styles.eyebrow}>BOAT NIGHT NIPPON</p>
        <h1>放送ブログ管理</h1>
        <label>
          管理パスワード
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "確認中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
