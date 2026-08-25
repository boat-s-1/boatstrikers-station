"use client";

import { useMemo, useState } from "react";
import styles from "./video.module.css";

function datePart(value) {
  return value ? new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }) : "—";
}

function typeLabel(type) {
  return type === "weekly_news" ? "週間ヴィーナスNEWS" : "今日のショート";
}

export default function VideoStudio({ articles, videos: initialVideos, today, weekStart }) {
  const [mode, setMode] = useState("daily_short");
  const [targetDate, setTargetDate] = useState(today);
  const [periodStart, setPeriodStart] = useState(weekStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [durationSeconds, setDurationSeconds] = useState(45);
  const [selected, setSelected] = useState([]);
  const [videos, setVideos] = useState(initialVideos || []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState(null);

  const visibleArticles = useMemo(() => {
    return (articles || []).filter((item) => {
      const d = String(item.published_at || "").slice(0, 10);
      if (mode === "daily_short") return d === targetDate;
      return d >= periodStart && d <= periodEnd;
    });
  }, [articles, mode, targetDate, periodStart, periodEnd]);

  function toggle(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function selectRecommended() {
    const max = mode === "daily_short" ? 3 : 6;
    setSelected(visibleArticles.slice(0, max).map((x) => x.id));
  }

  async function generate() {
    if (!selected.length) return setMessage("元ニュースを1件以上選択してください。");
    setBusy(true);
    setMessage("");
    setGenerated(null);
    try {
      const response = await fetch("/api/admin/hatsune-news/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoType: mode, articleIds: selected, targetDate, periodStart, periodEnd, durationSeconds }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "生成に失敗しました。");
      setGenerated(payload.item);
      setVideos((prev) => [payload.item, ...prev]);
      setMessage("AI台本を生成してDBへ保存しました。");
    } catch (error) {
      setMessage(`エラー：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={styles.modeTabs}>
        <button className={mode === "daily_short" ? styles.activeTab : ""} onClick={() => { setMode("daily_short"); setSelected([]); }}>今日のショート</button>
        <button className={mode === "weekly_news" ? styles.activeTab : ""} onClick={() => { setMode("weekly_news"); setSelected([]); }}>週間ヴィーナスNEWS</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><span>STEP 1</span><h2>対象期間とニュースを選ぶ</h2></div>
          <button className={styles.smallButton} onClick={selectRecommended}>上からおすすめ選択</button>
        </div>

        <div className={styles.controls}>
          {mode === "daily_short" ? (
            <>
              <label><span>対象日</span><input type="date" value={targetDate} onChange={(e) => { setTargetDate(e.target.value); setSelected([]); }} /></label>
              <label><span>動画尺</span><select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))}><option value={30}>30秒</option><option value={45}>45秒</option><option value={60}>60秒</option></select></label>
            </>
          ) : (
            <>
              <label><span>期間開始</span><input type="date" value={periodStart} onChange={(e) => { setPeriodStart(e.target.value); setSelected([]); }} /></label>
              <label><span>期間終了</span><input type="date" value={periodEnd} onChange={(e) => { setPeriodEnd(e.target.value); setSelected([]); }} /></label>
            </>
          )}
        </div>

        <div className={styles.articleList}>
          {visibleArticles.length === 0 ? <div className={styles.empty}>この期間の初音NEWSはありません。</div> : visibleArticles.map((item) => (
            <label key={item.id} className={`${styles.articleCard} ${selected.includes(item.id) ? styles.selected : ""}`}>
              <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
              <div>
                <div className={styles.articleMeta}><span>{datePart(item.published_at)}</span><span>{item.category}</span><span>{item.place || "—"}</span><span>{item.article_body_source === "ai" ? "AI記事" : "記事"}</span></div>
                <strong>{item.title}</strong>
                <p>{item.summary || "要約なし"}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.generateBox}>
        <div><strong>{selected.length}件選択中</strong><span>{mode === "daily_short" ? `${durationSeconds}秒ショート` : "3〜5分の週間NEWS"}</span></div>
        <button disabled={busy || !selected.length} onClick={generate}>{busy ? "AI生成中…" : "AI台本生成 → DB保存"}</button>
      </section>
      {message && <div className={message.startsWith("エラー") ? styles.error : styles.success}>{message}</div>}

      {generated && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><span>GENERATED</span><h2>{generated.title}</h2></div><span className={styles.status}>{generated.status}</span></div>
          <div className={styles.outputGrid}>
            <article><h3>読み上げ台本</h3><pre>{generated.script}</pre></article>
            <article><h3>YouTubeタイトル</h3><p>{generated.youtube_title}</p><h3>概要欄</h3><pre>{generated.youtube_description}</pre><h3>X投稿文</h3><p>{generated.x_text}</p></article>
          </div>
          <div className={styles.captionBox}><h3>字幕</h3><div>{(generated.caption_json || []).map((x, i) => <span key={i}>{x.text}</span>)}</div></div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span>HISTORY</span><h2>保存済み動画台本</h2></div><small>直近20件</small></div>
        <div className={styles.history}>
          {videos.length === 0 ? <div className={styles.empty}>まだ動画台本はありません。</div> : videos.map((video) => (
            <article key={video.id}><div><strong>{video.title}</strong><span>{typeLabel(video.video_type)} ・ {video.target_date || `${video.period_start}〜${video.period_end}`}</span></div><span className={styles.status}>{video.status}</span></article>
          ))}
        </div>
      </section>
    </>
  );
}
