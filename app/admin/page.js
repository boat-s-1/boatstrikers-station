import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./adminHome.module.css";

export const dynamic = "force-dynamic";

const GROUPS = [
  {
    key: "today",
    icon: "☀️",
    title: "今日の運営",
    description: "毎日の更新・告知・配信まわり",
    items: [
      { href: "/admin/realtime", icon: "⚡", title: "リアルタイム更新", text: "トップ・出走表・キャラページの速報を一括更新", badge: "よく使う" },
      { href: "/admin/schedule", icon: "📅", title: "番組表・今日の予定", text: "週間番組表と今日の予定を更新", badge: "よく使う" },
      { href: "/admin/ticker", icon: "📢", title: "速報テロップ", text: "トップに流す最新情報を編集" },
      { href: "/admin/radio-blog", icon: "🎙️", title: "ラジオブログ", text: "放送ブログの記事作成・更新" },
      { href: "/admin/note", icon: "📝", title: "note特集管理", text: "トップに掲載するnote特集を管理" },
    ],
  },
  {
    key: "prediction",
    icon: "🎯",
    title: "予想・成績",
    description: "AI予想・実績・結果を確認",
    items: [
      { href: "/admin/exhibition-alerts", icon: "🚨", title: "4号艇ダブル上位アラート", text: "展示タイム・直線タイムが両方2位以内の4号艇を監視・通知・成績追跡", badge: "NEW" },
      { href: "/admin/ichika-hidden-escape", icon: "🏁", title: "一果・隠れイン理論", text: "B1×展示色なし×1周1位の成立履歴・LINE通知・成績を確認", badge: "NEW" },
      { href: "/admin/hatsune-womens-inner-break", icon: "🌸", title: "初音・女子イン崩れ理論", text: "女子戦のイン崩れ条件の成立履歴・LINE通知・成績を確認", badge: "NEW" },
      { href: "/admin/ai-candidates", icon: "✨", title: "AI今日の候補", text: "一果・初音・キイナの候補からホーム・SNS使用レースを選択", badge: "NEW" },
      { href: "/admin/shorts", icon: "🎬", title: "ショート動画生成", text: "一果の前日イン逃げTOP3から台本・投稿素材を作成", badge: "NEW" },
      { href: "/admin/results", icon: "🏆", title: "予想実績管理", text: "予想・投資・払戻・的中画像を登録", badge: "よく使う" },
      { href: "/admin/ai-bet-stats", icon: "📊", title: "AI買い目成績", text: "AI予想の的中率・回収率・収支を確認", badge: "よく使う" },
      { href: "/ai-results", icon: "👀", title: "公開成績を見る", text: "ユーザーに見えているAI成績ページを確認" },
      { href: "/bsc2/admin", icon: "🤖", title: "AI Pipeline", text: "AI処理・生成・CSV登録" },
      { href: "/admin/engine-v3", icon: "🧠", title: "Engine v3", text: "AIエンジンの管理・実行" },
    ],
  },
  {
    key: "content",
    icon: "📚",
    title: "コンテンツ",
    description: "記事・雑誌・24場攻略を管理",
    items: [
      { href: "/admin/seminar-magazines", icon: "📚", title: "攻略マガジン管理", text: "月・水・金の週刊3誌を画像登録・予約公開", badge: "よく使う" },
      { href: "/admin/magazine", icon: "📖", title: "Web雑誌管理", text: "入力だけで雑誌レイアウトを作成" },
      { href: "/admin/newspaper", icon: "📰", title: "新聞・画像作成", text: "一果・初音・キイナ・12R特別紙を作成", badge: "NEW" },
      { href: "/admin/hatsune-news/video", icon: "🎥", title: "初音ヴィーナスNEWS制作", text: "今日のショート・週間ヴィーナスNEWSのAI台本と動画素材を作成", badge: "NEW" },
      { href: "/admin/stadium-ai", icon: "🧭", title: "Stadium AI集計", text: "競艇場データの再集計・確認" },
      { href: "/admin/stadium-ai-v2", icon: "🗺️", title: "Stadium AI v2", text: "24場向けAI分析の管理" },
      { href: "/library/stadium/kiryu?preview=premium", icon: "🚤", title: "24場攻略プレビュー", text: "公開中の攻略ページを確認" },
    ],
  },
  {
    key: "system",
    icon: "⚙️",
    title: "システム",
    description: "同期・データ・会員・稼働状態を確認",
    items: [
      { href: "/admin/members", icon: "👥", title: "会員管理", text: "登録会員・β会員・メール確認・LINE連携を確認", badge: "NEW" },
      { href: "/admin/sync", icon: "🔄", title: "同期管理", text: "AutoSync・結果・展示データの状態を確認", badge: "重要" },
    ],
  },
];

const FAVORITES = [
  { href: "/admin/exhibition-alerts", icon: "🚨", title: "4号艇アラート" },
  { href: "/admin/ichika-hidden-escape", icon: "🏁", title: "一果・隠れイン" },
  { href: "/admin/hatsune-womens-inner-break", icon: "🌸", title: "初音・女子イン崩れ" },
  { href: "/admin/members", icon: "👥", title: "会員管理" },
  { href: "/admin/shorts", icon: "🎬", title: "ショート生成" },
  { href: "/admin/hatsune-news/video", icon: "🎥", title: "初音NEWS制作" },
  { href: "/admin/seminar-magazines", icon: "📚", title: "週刊3誌" },
  { href: "/admin/realtime", icon: "⚡", title: "速報更新" },
  { href: "/admin/schedule", icon: "📅", title: "今日の予定" },
  { href: "/admin/results", icon: "🏆", title: "予想実績" },
  { href: "/admin/ai-bet-stats", icon: "📊", title: "AI成績" },
  { href: "/admin/sync", icon: "🔄", title: "同期状態" },
];

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatJst(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function safeCount(client, table, date, extra = null) {
  if (!client) return null;
  try {
    let query = client.from(table).select("*", { count: "exact", head: true });
    if (date) query = query.eq("race_date", date);
    if (extra) query = extra(query);
    const { count, error } = await query;
    if (error) return null;
    return Number(count || 0);
  } catch { return null; }
}

async function safeRuntime(client) {
  if (!client) return null;
  try {
    const { data, error } = await client.from("bs_sync_runtime")
      .select("state,last_success_at,heartbeat_at,last_status,last_error,current_mode,current_target_date")
      .eq("id", 1).maybeSingle();
    if (error) return null;
    return data || null;
  } catch { return null; }
}

async function loadStatus() {
  const client = getClient();
  const today = jstToday();
  if (!client) return { today, events: null, predictions: null, results: null, hits: null, runtime: null };
  const [events, predictions, results, hits, runtime] = await Promise.all([
    safeCount(client, "bs_race_events", today),
    safeCount(client, "bs_ai_predictions", today),
    safeCount(client, "bs_race_results", today),
    safeCount(client, "bs_ai_bet_results", today, (query) => query.eq("is_hit", true)),
    safeRuntime(client),
  ]);
  return { today, events, predictions, results, hits, runtime };
}

function statusText(runtime) {
  const state = String(runtime?.state || "").toLowerCase();
  if (state === "running") return "実行中";
  if (state === "error" || runtime?.last_error) return "要確認";
  if (state === "idle") return "正常";
  return runtime ? "待機中" : "未取得";
}

function statusTone(runtime) {
  const state = String(runtime?.state || "").toLowerCase();
  if (state === "error" || runtime?.last_error) return "danger";
  if (state === "running") return "running";
  if (state === "idle") return "good";
  return "neutral";
}

function buildAlerts(status) {
  const alerts = [];
  if (status.runtime?.last_error) alerts.push({ tone: "danger", icon: "⚠️", title: "AutoSyncでエラーを検出", text: String(status.runtime.last_error).slice(0, 100), href: "/admin/sync" });
  if (Number.isFinite(status.events) && status.events > 0 && Number.isFinite(status.predictions) && status.predictions === 0) alerts.push({ tone: "warning", icon: "⚠️", title: "本日のAI予想がまだありません", text: `${status.events}Rの開催データに対してAI予想0件です。`, href: "/admin/sync" });
  if (Number.isFinite(status.events) && Number.isFinite(status.results) && status.events > 0 && status.results > status.events) alerts.push({ tone: "warning", icon: "⚠️", title: "結果件数を確認してください", text: `開催${status.events}Rに対して結果${status.results}Rです。`, href: "/admin/sync" });
  if (alerts.length === 0) alerts.push({ tone: "good", icon: "✅", title: "大きな要対応はありません", text: "管理画面から必要な更新作業を選んでください。", href: null });
  return alerts;
}

export default async function AdminHome() {
  const status = await loadStatus();
  const alerts = buildAlerts(status);
  const tone = statusTone(status.runtime);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS CMS</span>
            <h1>運営ダッシュボード</h1>
            <p>今日の状態を確認して、必要な管理機能へすぐ移動できます。</p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/" className={styles.secondaryButton}>サイトを見る</Link>
            <Link href="/ai-results" className={styles.primaryButton}>公開成績を見る</Link>
          </div>
        </header>

        <section className={styles.todayPanel}>
          <div className={styles.panelHeading}>
            <div><span>TODAY STATUS</span><h2>本日の運営状況</h2></div>
            <div className={`${styles.syncPill} ${styles[tone]}`}><span className={styles.statusDot} />AutoSync {statusText(status.runtime)}</div>
          </div>
          <div className={styles.statusGrid}>
            <article className={styles.statusCard}><span>🚤 開催</span><strong>{status.events === null ? "—" : `${status.events}R`}</strong><small>{status.today}</small></article>
            <article className={styles.statusCard}><span>🤖 AI予想</span><strong>{status.predictions === null ? "—" : `${status.predictions}件`}</strong><small>保存済み予想</small></article>
            <article className={styles.statusCard}><span>🏁 結果同期</span><strong>{status.results === null ? "—" : `${status.results}R`}</strong><small>{status.events ? `${status.results || 0} / ${status.events}R` : "本日分"}</small></article>
            <article className={styles.statusCard}><span>🎯 的中速報</span><strong>{status.hits === null ? "—" : `${status.hits}件`}</strong><small>AI的中データ</small></article>
          </div>
          <div className={styles.syncMeta}>
            <span>最終成功：<strong>{formatJst(status.runtime?.last_success_at)}</strong></span>
            <span>Heartbeat：<strong>{formatJst(status.runtime?.heartbeat_at)}</strong></span>
            {status.runtime?.current_mode && <span>実行中：<strong>{status.runtime.current_mode}</strong></span>}
          </div>
        </section>

        <section className={styles.alertSection}>
          <div className={styles.panelHeading}><div><span>NEEDS ATTENTION</span><h2>要対応</h2></div></div>
          <div className={styles.alertList}>
            {alerts.map((alert, index) => {
              const content = <><b>{alert.icon}</b><div><strong>{alert.title}</strong><span>{alert.text}</span></div>{alert.href && <i>›</i>}</>;
              return alert.href ? <Link href={alert.href} key={`${alert.title}-${index}`} className={`${styles.alertItem} ${styles[alert.tone]}`}>{content}</Link> : <div key={`${alert.title}-${index}`} className={`${styles.alertItem} ${styles[alert.tone]}`}>{content}</div>;
            })}
          </div>
        </section>

        <section className={styles.favoriteSection}>
          <div className={styles.panelHeading}><div><span>QUICK ACCESS</span><h2>よく使う</h2></div></div>
          <div className={styles.favoriteGrid}>
            {FAVORITES.map((item) => <Link href={item.href} className={styles.favoriteCard} key={item.href}><b>{item.icon}</b><span>{item.title}</span></Link>)}
          </div>
        </section>

        <div className={styles.groups}>
          {GROUPS.map((group) => (
            <section className={styles.group} key={group.key}>
              <div className={styles.groupTitle}><b>{group.icon}</b><div><h2>{group.title}</h2><p>{group.description}</p></div></div>
              <div className={styles.menuGrid}>
                {group.items.map((item) => (
                  <Link href={item.href} key={item.href} className={styles.menuCard}>
                    <b className={styles.menuIcon}>{item.icon}</b>
                    <div className={styles.menuText}><div className={styles.menuName}><h3>{item.title}</h3>{item.badge && <span>{item.badge}</span>}</div><p>{item.text}</p></div>
                    <i>›</i>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className={styles.footer}><Link href="/">← BoatStrikersトップへ</Link><span>BOATSTRIKERS CMS</span></footer>
      </div>
    </main>
  );
}