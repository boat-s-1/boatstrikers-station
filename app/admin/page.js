import Link from "next/link";
import { loadStatus, buildAlerts, statusTone, statusText, formatJst, countText } from "../../lib/adminDashboardStatus";
import styles from "./adminHome.module.css";

export const dynamic = "force-dynamic";

const GROUPS = [
  {
    key: "today",
    icon: "☀️",
    title: "今日の運営",
    description: "毎日の確認・更新・通知をまとめて操作",
    items: [
      { href: "/admin/ai-candidates", icon: "✨", title: "AI今日の候補", text: "一果・初音・キイナの候補からホーム・SNS使用レースを選択" },
      { href: "/admin/realtime", icon: "⚡", title: "リアルタイム更新", text: "トップ・出走表・キャラページの速報を一括更新" },
      { href: "/admin/schedule", icon: "📅", title: "番組表・今日の予定", text: "週間番組表と今日の予定を更新" },
      { href: "/admin/alerts", icon: "🔔", title: "アラート管理", text: "LINE通知・3理論・展示データ対応状況を管理" },
      { href: "/admin/ticker", icon: "📢", title: "速報テロップ", text: "トップに流す最新情報を編集" },
    ],
  },
  {
    key: "content",
    icon: "🎬",
    title: "コンテンツ制作",
    description: "SNS・記事・動画・雑誌・配信素材を作成",
    items: [
      { href: "/admin/x-night-posts", icon: "🌙", title: "今夜のX投稿候補", text: "22:35生成の一果・初音・キイナ・公式・TOP5をコピーして投稿" },
      { href: "/admin/data-lab-social", icon: "📊", title: "DATA LAB SNS", text: "昨日の結果をX・ショート台本・9:16画像へ自動変換" },
      { href: "/admin/ichika-news", icon: "🟢", title: "一果新聞プロンプト", text: "前日版・直前版と一果ちゃんの表情・ポーズを選んで新聞プロンプトを作成" },
      { href: "/admin/kiina-news", icon: "🟡", title: "キイナ新聞プロンプト", text: "穴狙い新聞をAI自動取得・手動編集・表情/ポーズ指定で作成" },
      { href: "/admin/hatsune-news", icon: "🟣", title: "初音新聞プロンプト", text: "女子戦新聞をAI自動取得・手動編集・表情/ポーズ指定で作成" },
      { href: "/admin/data-lab-social#minamo-comic", icon: "🏫", title: "みなも学園4コマ", text: "前日の結果・ニュースから4コマ生成プロンプトを作成" },
      { href: "/admin/editorial", icon: "🗞️", title: "AI編集部", text: "Geminiが集めたニュース候補を採用・不採用に仕分け" },
      { href: "/admin/shorts", icon: "🎬", title: "ショート動画生成", text: "前日予想などから台本・投稿素材を作成" },
      { href: "/admin/seminar-magazines", icon: "📚", title: "攻略マガジン管理", text: "月・水・金の週刊3誌を画像登録・予約公開" },
      { href: "/admin/newspaper", icon: "📰", title: "新聞・画像作成", text: "一果・初音・キイナ・12R特別紙を作成" },
      { href: "/admin/radio-blog", icon: "🎙️", title: "ラジオブログ", text: "放送ブログの記事作成・更新" },
      { href: "/admin/note", icon: "📝", title: "note特集管理", text: "トップに掲載するnote特集を管理" },
      { href: "/admin/hatsune-news/video", icon: "🎥", title: "初音ヴィーナスNEWS制作", text: "今日のショート・週間ヴィーナスNEWSの素材を作成" },
      { href: "/admin/magazine", icon: "📖", title: "Web雑誌管理", text: "入力だけで雑誌レイアウトを作成" },
    ],
  },
  {
    key: "analysis",
    icon: "🧪",
    title: "分析・研究",
    description: "AI成績・回収率・競艇場データを検証",
    items: [
      { href: "/admin/ai-bet-stats", icon: "📈", title: "AI買い目成績", text: "AI予想の的中率・回収率・収支を確認" },
      { href: "/admin/ichika-ai-lab", icon: "🟢", title: "一果AI 改善パネル", text: "1アタマ実績を条件別に比較し、買い・注意・見送り候補を確認" },
      { href: "/admin/hatsune-ai-lab", icon: "🟣", title: "初音AI 改善パネル", text: "女子戦AIの公開成績を条件別に比較し、得意・苦手条件を確認" },
      { href: "/admin/kiina-ai-lab", icon: "🟡", title: "キイナAI 改善パネル", text: "5アタマAIの公開成績を条件別に比較し、狙い・見送り条件を確認" },
      { href: "/admin/condition-research", icon: "🧪", title: "回収率100%条件リサーチ", text: "理論成立履歴を条件別に比較してプラス条件を探す" },
      { href: "/admin/stadium-ai", icon: "🧭", title: "Stadium AI集計", text: "競艇場データの再集計・確認" },
    ],
  },
  {
    key: "system",
    icon: "⚙️",
    title: "管理・システム",
    description: "会員・コミュニティ・同期状態を管理",
    items: [
      { href: "/admin/members", icon: "👥", title: "会員管理", text: "登録会員・β会員・メール確認・LINE連携を確認" },
      { href: "/admin/discord-replies", icon: "💬", title: "Discord運営", text: "キャラ質問への返信・実況スレッドへの投稿を管理" },
      { href: "/admin/sync", icon: "🎂", title: "選手マスタ・誕生日管理", text: "選手プロフィール・生年月日を公式情報から同期してTODAYの誕生日表示を更新" },
      { href: "/admin/sync", icon: "🔄", title: "同期管理", text: "AutoSync・結果・展示データの状態を確認" },
    ],
  },
  {
    key: "development",
    icon: "🛠️",
    title: "その他・開発用",
    description: "内部機能・検証用ページ・公開ページ確認",
    items: [
      { href: "/bsc2/admin", icon: "🤖", title: "AI Pipeline", text: "AI処理・生成・CSV登録" },
      { href: "/admin/engine-v3", icon: "🧠", title: "Engine v3", text: "AIエンジンの管理・実行" },
      { href: "/admin/stadium-ai-v2", icon: "🗺️", title: "Stadium AI v2", text: "24場向けAI分析の管理" },
      { href: "/library/stadium/kiryu?preview=premium", icon: "🚤", title: "24場攻略プレビュー", text: "公開中の攻略ページを確認" },
      { href: "/ai-results", icon: "👀", title: "公開成績を見る", text: "ユーザーに見えているAI成績ページを確認" },
    ],
  },
];

const FAVORITES = [
  { href: "/admin/ai-candidates", icon: "✨", title: "AI今日の候補" },
  { href: "/admin/realtime", icon: "⚡", title: "リアルタイム更新" },
  { href: "/admin/schedule", icon: "📅", title: "今日の予定" },
  { href: "/admin/alerts", icon: "🔔", title: "アラート管理" },
  { href: "/admin/x-night-posts", icon: "🌙", title: "今夜のX投稿候補" },
  { href: "/admin/data-lab-social", icon: "📊", title: "DATA LAB SNS" },
  { href: "/admin/data-lab-social#minamo-comic", icon: "🏫", title: "みなも学園4コマ" },
  { href: "/admin/shorts", icon: "🎬", title: "ショート動画生成" },
];

export default async function AdminHome() {
  const status = await loadStatus();
  const alerts = buildAlerts(status);
  const tone = statusTone(status.runtime);
  const totalAlertsToday = (status.theories || []).reduce((sum, item) => sum + (Number.isFinite(item.today) ? item.today : 0), 0);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS CONTROL ROOM</span>
            <h1>運営ダッシュボード</h1>
            <p>今日の状況を確認して、日常運営に必要な作業へすぐ移動できます。</p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/" className={styles.secondaryButton}>サイトを見る</Link>
            <Link href="/ai-results" className={styles.primaryButton}>公開成績を見る</Link>
          </div>
        </header>

        <section className={styles.todayPanel} id="today">
          <div className={styles.panelHeading}>
            <div><span>TODAY STATUS</span><h2>今日の状況</h2></div>
            <div className={`${styles.syncPill} ${styles[tone]}`}><span className={styles.statusDot} />AutoSync {statusText(status.runtime)}</div>
          </div>
          <div className={styles.statusGrid}>
            <article className={styles.statusCard}><span>🚤 開催</span><strong>{status.events === null ? "—" : `${status.events}R`}</strong><small>{status.today}</small></article>
            <article className={styles.statusCard}><span>🤖 AI予想</span><strong>{countText(status.predictions)}</strong><small>保存済み予想</small></article>
            <article className={styles.statusCard}><span>📣 理論成立</span><strong>{totalAlertsToday}件</strong><small>本日の3理論合計</small></article>
            <article className={styles.statusCard}><span>🏁 結果同期</span><strong>{status.results === null ? "—" : `${status.results}R`}</strong><small>{status.events ? `${status.results || 0} / ${status.events}R` : "本日分"}</small></article>
          </div>
          <div className={styles.syncMeta}>
            <span>最終成功：<strong>{formatJst(status.runtime?.last_success_at)}</strong></span>
            <span>Heartbeat：<strong>{formatJst(status.runtime?.heartbeat_at)}</strong></span>
            <span>AI的中：<strong>{countText(status.hits)}</strong></span>
            {status.runtime?.current_mode && <span>実行中：<strong>{status.runtime.current_mode}</strong></span>}
          </div>
        </section>

        <section className={styles.alertSection} id="attention">
          <div className={styles.panelHeading}><div><span>NEEDS ATTENTION</span><h2>要対応</h2></div></div>
          <div className={styles.alertList}>
            {alerts.map((alert, index) => {
              const content = <><b>{alert.icon}</b><div><strong>{alert.title}</strong><span>{alert.text}</span></div>{alert.href && <i>›</i>}</>;
              return alert.href
                ? <Link href={alert.href} key={`${alert.title}-${index}`} className={`${styles.alertItem} ${styles[alert.tone]}`}>{content}</Link>
                : <div key={`${alert.title}-${index}`} className={`${styles.alertItem} ${styles[alert.tone]}`}>{content}</div>;
            })}
          </div>
        </section>

        <section id="notifications" className={styles.notificationCenter}>
          <div className={styles.panelHeading}>
            <div><span>ALERT MANAGEMENT</span><h2>アラート管理</h2></div>
            <Link href="/admin/alerts" className={styles.primaryButton}>アラート管理を開く →</Link>
          </div>
          <p>LINE通知センター・3理論の管理・24場の展示データ対応状況をまとめました。</p>
        </section>

        <section className={styles.favoriteSection} id="quick">
          <div className={styles.panelHeading}><div><span>QUICK ACCESS</span><h2>今日やること</h2></div></div>
          <div className={styles.favoriteGrid}>
            {FAVORITES.map((item) => <Link href={item.href} className={styles.favoriteCard} key={item.href}><b>{item.icon}</b><span>{item.title}</span></Link>)}
          </div>
        </section>

        <div className={styles.groups} id="all-tools">
          {GROUPS.map((group) => (
            <section className={styles.group} key={group.key}>
              <div className={styles.groupTitle}>
                <b>{group.icon}</b>
                <div><h2>{group.title}</h2><p>{group.description}</p></div>
              </div>
              <div className={styles.menuGrid}>
                {group.items.map((item) => (
                  <Link href={item.href} key={item.href} className={styles.menuCard}>
                    <b className={styles.menuIcon}>{item.icon}</b>
                    <div className={styles.menuText}>
                      <div className={styles.menuName}><h3>{item.title}</h3></div>
                      <p>{item.text}</p>
                    </div>
                    <i>›</i>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className={styles.footer}><Link href="/">← BoatStrikersトップへ</Link><span>BOATSTRIKERS CONTROL ROOM</span></footer>
      </div>
      <nav className={styles.adminDock} aria-label="管理画面クイックメニュー">
        <Link href="/admin#today"><b>🏠</b><span>管理TOP</span></Link>
        <Link href="/admin/alerts"><b>📣</b><span>通知</span></Link>
        <Link href="/admin/editorial"><b>🗞️</b><span>編集部</span></Link>
        <Link href="/admin/shorts"><b>🎬</b><span>制作</span></Link>
        <Link href="/admin/sync"><b>⚙️</b><span>同期</span></Link>
      </nav>
    </main>
  );
}
