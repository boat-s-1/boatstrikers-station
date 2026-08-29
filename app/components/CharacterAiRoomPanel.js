"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import styles from "./CharacterAiRoomPanel.module.css";

const STADIUMS = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

const CHARACTER_META = {
  ichika: {
    name: "一果",
    title: "一果AI 今日のイン逃げ注目",
    subtitle: "前日データからイン逃げ期待度の高いレースを抽出",
    selector: ".ichikaPage .hero",
    pageSelector: ".ichikaPage",
    tone: "ichika",
    legacyNeedle: "一果のイン逃げツール",
    researchTitle: "一果のイン逃げ研究ツール（β）",
    researchText: "自分で条件を見ながらイン逃げを研究したい方向けの補助ツールです。",
    researchHref: "https://www.boat-strike.com/ichika",
  },
  hatsune: {
    name: "初音",
    title: "初音AI 今日の女子戦注目",
    subtitle: "女子戦からイン優勢とイン不安の両方をチェック",
    selector: ".hatsunePage .hero",
    pageSelector: ".hatsunePage",
    tone: "hatsune",
    legacyNeedle: "女子戦データツール",
    researchTitle: "初音の女子戦データ研究ツール（β）",
    researchText: "女子戦データを自分で比較・確認したい方向けの研究用ツールです。",
    researchHref: "https://www.boat-strike.com/hastune",
  },
  kiina: {
    name: "キイナ",
    title: "キイナAI 今日の5アタマ注目",
    subtitle: "前日データから5号艇1着の期待レースを抽出",
    selector: ".kiinaPage .hero",
    pageSelector: ".kiinaPage",
    tone: "kiina",
    legacyNeedle: "5アタマ予想ツール",
    researchTitle: "キイナの5アタマ研究ツール（β）",
    researchText: "5号艇を自分で掘り下げて研究したい方向けの補助ツールです。",
    researchHref: "https://www.boat-strike.com/kiina5.html",
  },
};

const TYPE_META = {
  ichika_escape_best10: { label: "イン逃げ期待", statLabel: "イン逃げ予想" },
  hatsune_dominant_best3: { label: "イン優勢", statLabel: "イン優勢予想" },
  hatsune_risky_best3: { label: "イン不安", statLabel: "イン不安予想" },
  kiina_boat5_best5: { label: "5アタマ期待", statLabel: "5アタマ予想" },
};

function getCharacter(pathname) {
  const first = String(pathname || "").split("/").filter(Boolean)[0];
  return CHARACTER_META[first] ? first : null;
}

function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).replaceAll("-", "/");
}

export default function CharacterAiRoomPanel() {
  const pathname = usePathname();
  const character = useMemo(() => getCharacter(pathname), [pathname]);
  const [mount, setMount] = useState(null);
  const [performanceMount, setPerformanceMount] = useState(null);
  const [researchMount, setResearchMount] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!character) {
      setMount(null);
      setPerformanceMount(null);
      setResearchMount(null);
      setData(null);
      return undefined;
    }

    const meta = CHARACTER_META[character];
    const target = document.querySelector(meta.selector);
    const page = document.querySelector(meta.pageSelector);
    if (!target || !page) return undefined;

    let ichikaBannerStyle = null;
    if (character === "ichika") {
      ichikaBannerStyle = document.createElement("style");
      ichikaBannerStyle.dataset.ichikaFullWidthTitles = "true";
      ichikaBannerStyle.textContent = `
        .ichikaPage .sectionCard > .homeTitleImage,
        .ichikaPage .sectionCard .sectionTitleRow .homeTitleImage {
          display: block !important;
          width: calc(100% + 36px) !important;
          max-width: none !important;
          height: auto !important;
          margin-left: -18px !important;
          margin-right: -18px !important;
          margin-top: -18px !important;
          margin-bottom: 18px !important;
          border-radius: 22px 22px 14px 14px !important;
          object-fit: cover !important;
        }
        .ichikaPage .sectionCard .sectionTitleRow:has(.homeTitleImage) {
          display: block !important;
          width: 100% !important;
        }
        section[aria-label="一果 AI予想"] > div:first-child {
          width: calc(100% + 36px) !important;
          margin: -18px -18px 18px !important;
          border-radius: 18px 18px 14px 14px !important;
          overflow: hidden !important;
        }
        section[aria-label="一果 AI予想"] > div:first-child img {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
        }
        @media (max-width: 760px) {
          .ichikaPage .sectionCard > .homeTitleImage,
          .ichikaPage .sectionCard .sectionTitleRow .homeTitleImage {
            width: calc(100% + 36px) !important;
            margin-left: -18px !important;
            margin-right: -18px !important;
          }
          section[aria-label="一果 AI予想"] > div:first-child {
            width: calc(100% + 28px) !important;
            margin: -14px -14px 16px !important;
          }
        }
      `;
      document.head.appendChild(ichikaBannerStyle);
    }

    const node = document.createElement("div");
    node.className = styles.portalMount;
    target.insertAdjacentElement("afterend", node);
    setMount(node);

    let performanceNode = null;
    if (character === "hatsune") {
      const newsSection = Array.from(page.querySelectorAll("section")).find((section) =>
        String(section.textContent || "").includes("女子ボートNEWS")
      );
      if (newsSection) {
        performanceNode = document.createElement("div");
        performanceNode.className = styles.performanceMount;
        newsSection.insertAdjacentElement("afterend", performanceNode);
        setPerformanceMount(performanceNode);
      }
    }

    const oldToolSection = Array.from(page.querySelectorAll("section.sectionCard")).find((section) =>
      String(section.textContent || "").includes(meta.legacyNeedle)
    );
    const previousDisplay = oldToolSection?.style.display || "";
    if (oldToolSection) oldToolSection.style.display = "none";

    const ichikaTodayComment = character === "ichika"
      ? page.querySelector("section.todayCommentCard")
      : null;
    const ichikaBottomNav = character === "ichika"
      ? page.querySelector("nav.bottomNav")
      : null;
    const previousTodayDisplay = ichikaTodayComment?.style.display || "";
    const previousBottomNavDisplay = ichikaBottomNav?.style.display || "";
    if (ichikaTodayComment) ichikaTodayComment.style.display = "none";
    if (ichikaBottomNav) ichikaBottomNav.style.display = "none";

    const researchNode = document.createElement("div");
    researchNode.className = styles.researchMount;
    page.appendChild(researchNode);
    setResearchMount(researchNode);

    let cancelled = false;
    setLoading(true);
    setData(null);

    fetch(`/api/ai-v2/character-panel?character=${encodeURIComponent(character)}`, {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("AI panel fetch failed");
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ picks: [], stats: [], yesterdayStats: [], error: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (oldToolSection) oldToolSection.style.display = previousDisplay;
      if (ichikaTodayComment) ichikaTodayComment.style.display = previousTodayDisplay;
      if (ichikaBottomNav) ichikaBottomNav.style.display = previousBottomNavDisplay;
      ichikaBannerStyle?.remove();
      node.remove();
      performanceNode?.remove();
      researchNode.remove();
      setMount(null);
      setPerformanceMount(null);
      setResearchMount(null);
    };
  }, [character]);

  if (!character) return null;

  const meta = CHARACTER_META[character];
  const picks = Array.isArray(data?.picks) ? data.picks : [];
  const stats = Array.isArray(data?.stats) ? data.stats : [];
  const yesterdayStats = Array.isArray(data?.yesterdayStats) ? data.yesterdayStats : [];

  const performance = (
    <div className={`${styles.recordArea} ${character === "hatsune" ? styles.hatsunePerformance : ""}`}>
      <div className={styles.recordHeading}>
        <div>
          <span>AI PERFORMANCE</span>
          <h3>過去のAI予想 的中率</h3>
        </div>
        {character !== "ichika" ? <small>結果確定分のみ</small> : null}
      </div>

      {character === "ichika" ? (() => {
        const typeKey = "ichika_escape_best10";
        const allStat = stats.find((item) => item.rankingType === typeKey);
        const yesterdayStat = yesterdayStats.find((item) => item.rankingType === typeKey);
        const allPredictions = Number(allStat?.predictions || 0);
        const allHits = Number(allStat?.hits || 0);
        const yesterdayPredictions = Number(yesterdayStat?.predictions || 0);
        const yesterdayHits = Number(yesterdayStat?.hits || 0);

        const cards = [
          {
            label: "昨日",
            predictions: yesterdayPredictions,
            hits: yesterdayHits,
            hitRate: yesterdayStat?.hitRate,
          },
          {
            label: "全期間",
            predictions: allPredictions,
            hits: allHits,
            hitRate: allStat?.hitRate,
          },
        ];

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {cards.map((card) => (
              <div
                key={card.label}
                className={styles.statCard}
                style={{ textAlign: "center", padding: "15px 10px" }}
              >
                <span style={{ fontSize: 13 }}>{card.label}</span>
                <strong style={{ fontSize: 28 }}>
                  {card.predictions > 0 && card.hitRate != null
                    ? `${Number(card.hitRate).toFixed(1)}%`
                    : "—%"}
                </strong>
                <small>
                  {card.predictions > 0
                    ? `${card.hits} / ${card.predictions}R 的中`
                    : "結果データなし"}
                </small>
              </div>
            ))}
          </div>
        );
      })() : (
        <div className={styles.statGrid}>
          {(character === "hatsune"
            ? ["hatsune_dominant_best3", "hatsune_risky_best3"]
            : ["kiina_boat5_best5"]
          ).map((typeKey) => {
            const stat = stats.find((item) => item.rankingType === typeKey);
            const type = TYPE_META[typeKey];
            const predictions = Number(stat?.predictions || 0);
            const hits = Number(stat?.hits || 0);
            return (
              <div className={styles.statCard} key={typeKey}>
                <span>{type.statLabel}</span>
                <strong>{predictions > 0 && stat?.hitRate != null ? `${Number(stat.hitRate).toFixed(1)}%` : "—%"}</strong>
                <small>{predictions > 0 ? `${hits} / ${predictions}R 的中` : "結果データ蓄積中"}</small>
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.note}>
        AI v2集計開始：{formatDate(data?.startDate)} ／ 前日版AIランキングと確定結果を集計しています。
      </p>
    </div>
  );

  const panel = mount ? (
    <section
      className={`${styles.panel} ${styles[meta.tone]} ${character === "hatsune" ? styles.hatsuneCompact : ""}`}
      aria-label={`${meta.name} AI予想`}
    >
      {character === "ichika" ? (
        <div className={styles.ichikaBannerHeading}>
          <img
            src="/top/IMG_7683.jpeg?v=20260829-1555"
            alt="今日の注目！ 一果AI イン逃げ予想"
            className={styles.ichikaBannerImage}
          />
          <span className={styles.ichikaBannerDate}>{formatDate(data?.date)}</span>
        </div>
      ) : (
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>BOATSTRIKERS AI V2</span>
            <h2>🤖 {meta.title}</h2>
            <p>{meta.subtitle}</p>
          </div>
          <div className={styles.headingActions}>
            {character === "hatsune" ? <a href="/races">もっと見る →</a> : null}
            <span className={styles.dateBadge}>{formatDate(data?.date)}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>AI予想を読み込み中...</div>
      ) : picks.length > 0 ? (
        <>
          <div className={styles.pickGrid}>
            {picks.map((pick) => {
              const type = TYPE_META[pick.rankingType] || { label: "AI注目" };
              return (
                <article className={styles.pickCard} key={`${pick.rankingType}-${pick.rankNo}-${pick.courseCode}-${pick.raceNo}`}>
                  <div className={styles.pickTop}>
                    <span>{type.label}</span>
                    <strong>{percent(pick.probability)}</strong>
                  </div>
                  <div className={styles.raceLine}>
                    <b>{STADIUMS[pick.courseCode] || `${pick.courseCode}場`}</b>
                    <span>{pick.raceNo}R</span>
                  </div>
                  <small>AIランク #{pick.rankNo}</small>
                </article>
              );
            })}
          </div>
          {character !== "hatsune" ? (
            <div
              className={styles.moreRow}
              style={{ justifyContent: "center", marginTop: 12, marginBottom: 6 }}
            >
              <a
                href="/races"
                style={{
                  minWidth: 180,
                  justifyContent: "center",
                  padding: "10px 22px",
                  border: "2px solid #0f4c81",
                  borderRadius: 999,
                  background: "#fff",
                  boxShadow: "0 4px 12px rgba(15,76,129,.10)",
                  fontSize: 14,
                }}
              >
                出走表を見る
              </a>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.empty}>本日のAI予想は準備中です。</div>
      )}

      {character !== "hatsune" ? performance : null}
    </section>
  ) : null;

  const research = researchMount ? (
    <section className={`${styles.researchSection} ${styles[meta.tone]}`} aria-label={`${meta.name} 研究ツール`}>
      <details>
        <summary>
          <span>🔬 自分で調べたい人向け</span>
          <strong>{meta.researchTitle}</strong>
        </summary>
        <div className={styles.researchBody}>
          <p>{meta.researchText}</p>
          <a href={meta.researchHref} target="_blank" rel="noopener noreferrer">研究ツールを開く →</a>
        </div>
      </details>
    </section>
  ) : null;

  return (
    <>
      {mount ? createPortal(panel, mount) : null}
      {performanceMount && character === "hatsune" ? createPortal(performance, performanceMount) : null}
      {researchMount ? createPortal(research, researchMount) : null}
    </>
  );
}
