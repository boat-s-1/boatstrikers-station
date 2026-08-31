import Link from "next/link";
import { getPublicScheduleSupabase } from "../../lib/scheduleSupabase";
import HatsuneNewsPreview from "../hatsune/HatsuneNewsPreview";
import HatsuneSchedulePreview from "../hatsune/HatsuneSchedulePreview";
import HatsuneMediaPreview from "../hatsune/HatsuneMediaPreview";
import { getHatsuneNews } from "../hatsune/newsData";
import IchikaEscapeSurgePanel from "./IchikaEscapeSurgePanel";
import IchikaAlertPanel from "./IchikaAlertPanel";
import HatsuneAlertPanel from "./HatsuneAlertPanel";
import KiinaAlertPanel from "./KiinaAlertPanel";
import styles from "./RealtimeUpdates.module.css";

const KIND_META = {
  prediction: { icon: "🎯", label: "予想" },
  hit: { icon: "🎉", label: "的中" },
  update: { icon: "📰", label: "更新" },
  radio: { icon: "🎙️", label: "ラジオ" },
  video: { icon: "▶️", label: "動画" },
  notice: { icon: "📢", label: "お知らせ" },
};

const CHARACTER_META = {
  ichika: { label: "一果", className: styles.ichika },
  hatsune: { label: "初音", className: styles.hatsune },
  kiina: { label: "キイナ", className: styles.kiina },
  all: { label: "BoatStrikers", className: styles.all },
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

async function getItems(target, limit) {
  const client = getPublicScheduleSupabase();
  if (!client) return [];
  const targetColumn = {
    home: "show_home",
    races: "show_races",
    ichika: "show_ichika",
    hatsune: "show_hatsune",
    kiina: "show_kiina",
  }[target] || "show_home";

  const { data, error } = await client
    .from("realtime_updates")
    .select("id,kind,character,title,body,link_url,image_url,published_at,created_at")
    .eq("is_active", true)
    .eq(targetColumn, true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("リアルタイム更新取得エラー:", error.message);
    return [];
  }
  return data || [];
}

export default async function RealtimeUpdates({ target = "home", limit = 5, compact = false }) {
  if (target === "ichika") {
    return (
      <>
        <IchikaEscapeSurgePanel />
        <IchikaAlertPanel />
      </>
    );
  }

  if (target === "hatsune") {
    const hatsuneNews = await getHatsuneNews({ limit: 3 });
    return (
      <>
        <HatsuneSchedulePreview />
        <HatsuneNewsPreview news={hatsuneNews} />
        <HatsuneMediaPreview />
        <HatsuneAlertPanel />
      </>
    );
  }

  const items = await getItems(target, limit);
  const isCompact = compact || target === "races";
  const visibleItems = isCompact ? items.slice(0, 1) : items;

  const realtimeSection = (
    <section className={`${styles.section} ${isCompact ? styles.compact : ""}`}>
      <div className={styles.heading}>
        <div>
          <span>REALTIME UPDATE</span>
          <h2>リアルタイム予想・更新情報</h2>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_BOATSTRIKERS_X_URL || "https://x.com"}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.xButton}
        >
          Xを見る ↗
        </a>
      </div>

      {visibleItems.length ? (
        <div className={styles.list}>
          {visibleItems.map((item) => {
            const kind = KIND_META[item.kind] || KIND_META.notice;
            const chara = CHARACTER_META[item.character] || CHARACTER_META.all;
            const inner = (
              <>
                <div className={styles.cardTop}>
                  <div className={styles.badges}>
                    <span className={styles.kind}>{kind.icon} {kind.label}</span>
                    <span className={`${styles.character} ${chara.className}`}>{chara.label}</span>
                  </div>
                  <time>{formatDate(item.published_at || item.created_at)}</time>
                </div>
                <h3>{item.title}</h3>
                {!isCompact && item.body ? <p>{item.body}</p> : null}
                {item.image_url ? (
                  <div className={styles.imageWrap}>
                    <img src={item.image_url} alt={item.title || "更新画像"} className={styles.image} />
                  </div>
                ) : null}
                {item.link_url ? <span className={styles.cta}>詳しく見る →</span> : null}
              </>
            );
            if (item.link_url) {
              const external = /^https?:\/\//.test(item.link_url);
              return external ? (
                <a key={item.id} href={item.link_url} target="_blank" rel="noopener noreferrer" className={styles.card}>{inner}</a>
              ) : (
                <Link key={item.id} href={item.link_url} className={styles.card}>{inner}</Link>
              );
            }
            return <article key={item.id} className={styles.card}>{inner}</article>;
          })}
        </div>
      ) : (
        <div className={styles.empty}>現在、新しいリアルタイム更新はありません。</div>
      )}
    </section>
  );

  if (target === "kiina") {
    return (
      <>
        <KiinaAlertPanel />
        {realtimeSection}
      </>
    );
  }

  return realtimeSection;
}
