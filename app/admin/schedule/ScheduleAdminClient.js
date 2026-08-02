"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./scheduleAdmin.module.css";

const EMPTY = {
  id: null,
  event_date: "",
  start_time: "08:00",
  content_type: "note",
  title: "",
  episode: "",
  host: "一果",
  description: "",
  link_url: "",
  status: "draft",
  is_featured: false,
};

const TYPE_LABELS = {
  radio: "ラジオ",
  short: "ショート動画",
  note: "note",
  live: "生放送",
  comic: "コミック",
  other: "その他",
};

function mondayOf(dateValue) {
  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function ScheduleAdminClient() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/schedule/items", {
      cache: "no-store",
    });
    if (response.status === 401) {
      location.href = "/admin/schedule/login";
      return;
    }
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "取得できませんでした。");
      return;
    }
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weekItems = useMemo(() => {
    const end = addDays(weekStart, 7);
    return items.filter(
      (item) => item.event_date >= weekStart && item.event_date < end
    );
  }, [items, weekStart]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startNew(date = weekStart) {
    setForm({ ...EMPTY, event_date: date });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function edit(item) {
    setForm({
      ...item,
      start_time: String(item.start_time || "").slice(0, 5),
      link_url: item.link_url || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const endpoint = form.id
      ? `/api/admin/schedule/items/${form.id}`
      : "/api/admin/schedule/items";
    const response = await fetch(endpoint, {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "保存に失敗しました。");
      setBusy(false);
      return;
    }

    setMessage("番組を保存しました。");
    setForm({ ...EMPTY, event_date: form.event_date });
    await load();
    setBusy(false);
  }

  async function remove() {
    if (!form.id || !confirm("この番組を削除しますか？")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/schedule/items/${form.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "削除に失敗しました。");
      setBusy(false);
      return;
    }
    setForm(EMPTY);
    setMessage("番組を削除しました。");
    await load();
    setBusy(false);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>BOATSTRIKERS WEEKLY PROGRAM</p>
          <h1>週間番組表 管理画面</h1>
        </div>
        <div className={styles.headerButtons}>
          <a href="/schedule" target="_blank" rel="noreferrer">
            公開ページを見る
          </a>
          <form action="/api/admin/schedule/logout" method="post">
            <button type="submit">ログアウト</button>
          </form>
        </div>
      </header>

      {message && <div className={styles.notice}>{message}</div>}

      <form className={styles.editor} onSubmit={save}>
        <div className={styles.editorTitle}>
          <h2>{form.id ? "番組を編集" : "番組を登録"}</h2>
          <button type="button" onClick={() => startNew()}>
            新規入力
          </button>
        </div>

        <div className={styles.grid2}>
          <label>
            配信日
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => update("event_date", e.target.value)}
              required
            />
          </label>
          <label>
            開始時刻
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => update("start_time", e.target.value)}
              required
            />
          </label>
        </div>

        <div className={styles.grid2}>
          <label>
            種類
            <select
              value={form.content_type}
              onChange={(e) => update("content_type", e.target.value)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            担当
            <select
              value={form.host}
              onChange={(e) => update("host", e.target.value)}
            >
              {['一果', '初音', 'キイナ', '3人', 'BoatStrikers'].map((host) => (
                <option value={host} key={host}>{host}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          番組タイトル
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="一果のイン逃げゼミ"
            required
          />
        </label>

        <label>
          回数・補足
          <input
            value={form.episode}
            onChange={(e) => update("episode", e.target.value)}
            placeholder="第12回／SGスペシャル など"
          />
        </label>

        <label>
          説明
          <textarea
            rows="3"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="今回の内容を短く入力します。"
          />
        </label>

        <label>
          配信・記事URL
          <input
            type="url"
            value={form.link_url}
            onChange={(e) => update("link_url", e.target.value)}
            placeholder="https://..."
          />
        </label>

        <div className={styles.grid2}>
          <label>
            公開状態
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="draft">下書き</option>
              <option value="published">公開</option>
            </select>
          </label>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => update("is_featured", e.target.checked)}
            />
            今週の注目番組にする
          </label>
        </div>

        <div className={styles.actions}>
          {form.id && (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={remove}
              disabled={busy}
            >
              削除
            </button>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "保存中…" : "保存する"}
          </button>
        </div>
      </form>

      <section className={styles.listPanel}>
        <div className={styles.weekControls}>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>← 前の週</button>
          <label>
            表示する週
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(mondayOf(e.target.value))}
            />
          </label>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>次の週 →</button>
        </div>

        <h2>{weekStart}からの登録番組</h2>
        <div className={styles.itemList}>
          {weekItems.length === 0 && <p>この週の登録はありません。</p>}
          {weekItems.map((item) => (
            <button
              type="button"
              className={styles.itemRow}
              key={item.id}
              onClick={() => edit(item)}
            >
              <span>{item.event_date}<br />{String(item.start_time).slice(0, 5)}</span>
              <span className={styles.typeBadge} data-type={item.content_type}>
                {TYPE_LABELS[item.content_type] || "その他"}
              </span>
              <strong>{item.title} {item.episode}</strong>
              <small>{item.host}／{item.status === "published" ? "公開" : "下書き"}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
