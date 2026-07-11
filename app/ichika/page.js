import Image from "next/image";
import Parser from "rss-parser";
import HitGallery from "../components/HitGallery";
import { supabase } from "../bsc2/lib/supabaseClient";

/* ページを常に最新状態で表示 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================
   初期成績
========================= */

const emptyIchikaResult = {
  raceCount: 0,
  hitCount: 0,
  hitRate: 0,
  returnRate: 0,
  profit: 0,
  bestHit: 0,
  updated: "",
  hits: [],
  errorMessage: "",
};

/* =========================
   日本時間基準の今月範囲
========================= */

function getCurrentMonthRange() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  });

  const parts = formatter.formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  const monthStart =
    `${year}-${String(month).padStart(2, "0")}-01`;

  let nextYear = year;
  let nextMonth = month + 1;

  if (nextMonth === 13) {
    nextYear += 1;
    nextMonth = 1;
  }

  const nextMonthStart =
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return {
    monthStart,
    nextMonthStart,
  };
}

/* =========================
   日付表示
========================= */

function formatRaceDate(dateString) {
  if (!dateString) {
    return "";
  }

  return dateString.replaceAll("-", "/");
}

/* =========================
   一果の今月成績を取得
========================= */

async function getIchikaResults() {
  if (!supabase) {
    console.error(
      "Supabaseクライアントが作成されていません"
    );

    return {
      ...emptyIchikaResult,
      errorMessage: "Supabase未接続です",
    };
  }

  try {
    const { monthStart, nextMonthStart } =
      getCurrentMonthRange();

    const { data, error } = await supabase
      .from("bsc_results")
      .select(`
        id,
        race_date,
        place,
        race_no,
        category,
        bet_text,
        invest,
        payout,
        hit,
        memo,
        hit_image_url,
        hit_title,
        hit_note,
        created_at
      `)
      .eq("category", "一果")
      .gte("race_date", monthStart)
      .lt("race_date", nextMonthStart)
      .order("race_date", {
        ascending: false,
      })
      .order("race_no", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "一果成績取得エラー:",
        error
      );

      return {
        ...emptyIchikaResult,
        errorMessage:
          `${error.message} / ` +
          `${error.code || "コードなし"}`,
      };
    }

    const rows = Array.isArray(data)
      ? data
      : [];

    const raceCount = rows.length;

    const hitRows = rows.filter((row) => {
      return (
        row.hit === true ||
        Number(row.payout || 0) > 0
      );
    });

    const hitCount = hitRows.length;

    const totalInvest = rows.reduce(
      (sum, row) => {
        return (
          sum +
          Number(row.invest || 0)
        );
      },
      0
    );

    const totalPayout = rows.reduce(
      (sum, row) => {
        return (
          sum +
          Number(row.payout || 0)
        );
      },
      0
    );

    const bestHit = rows.reduce(
      (maximum, row) => {
        return Math.max(
          maximum,
          Number(row.payout || 0)
        );
      },
      0
    );

    const hitRate =
      raceCount > 0
        ? Math.round(
            (hitCount / raceCount) * 100
          )
        : 0;

    const returnRate =
      totalInvest > 0
        ? Math.round(
            (totalPayout /
              totalInvest) *
              100
          )
        : 0;

    const profit =
      totalPayout - totalInvest;

    const newestRow = rows[0];

    const updated =
      newestRow?.race_date
        ? formatRaceDate(
            newestRow.race_date
          )
        : "";

    /*
     * 画像が登録されている的中レースのみ表示
     * 最大6件
     */
    const hits = hitRows
      .filter((row) => {
        return Boolean(
          row.hit_image_url
        );
      })
      .slice(0, 6)
      .map((row) => {
        const payout = Number(
          row.payout || 0
        );

        return {
          image: row.hit_image_url,

          title:
            row.hit_title ||
            `${row.place}${row.race_no}R 的中`,

          race:
            `${formatRaceDate(
              row.race_date
            )} ` +
            `${row.place}${row.race_no}R`,

          note:
            row.hit_note ||
            row.memo ||
            `払戻 ${payout.toLocaleString()}円`,
        };
      });

    return {
      raceCount,
      hitCount,
      hitRate,
      returnRate,
      profit,
      bestHit,
      updated,
      hits,
      errorMessage: "",
    };
  } catch (error) {
    console.error(
      "一果成績の予期しないエラー:",
      error
    );

    return {
      ...emptyIchikaResult,
      errorMessage:
        error?.message ||
        "不明な取得エラー",
    };
  }
}

/* =========================
   RSS内の最初の画像を取得
========================= */

function getRssImage(
  item,
  fallbackImage
) {
  return (
    item?.content?.match(
      /<img[^>]+src="([^">]+)"/
    )?.[1] || fallbackImage
  );
}

/* =========================
   一果新聞
========================= */

async function getIchikaNewspaper() {
  try {
    const parser = new Parser();

    const feed =
      await parser.parseURL(
        "https://note.com/boat_strikers/rss"
      );

    const item = feed.items.find(
      (feedItem) =>
        feedItem.title?.includes(
          "【一果前日版】"
        )
    );

    if (!item) {
      return null;
    }

    return {
      title:
        item.title ||
        "一果前日版",
      link: item.link || "",
      date: item.pubDate || "",
      image: getRssImage(
        item,
        "/ichika-banner.jpg"
      ),
    };
  } catch (error) {
    console.error(
      "一果新聞取得エラー:",
      error
    );

    return null;
  }
}

/* =========================
   一果ゼミ記事
========================= */

async function getIchikaArticles() {
  try {
    const parser = new Parser();

    const feed =
      await parser.parseURL(
        "https://note.com/boat_strikers/rss"
      );

    return feed.items
      .filter((item) =>
        item.title?.includes(
          "【一果ゼミ"
        )
      )
      .slice(0, 6)
      .map((item) => ({
        title:
          item.title ||
          "一果ゼミ",
        link: item.link || "",
        date: item.pubDate || "",
        image: getRssImage(
          item,
          "/ichika-banner.jpg"
        ),
      }));
  } catch (error) {
    console.error(
      "一果ゼミ取得エラー:",
      error
    );

    return [];
  }
}

/* =========================
   一果ページ
========================= */

export default async function IchikaPage() {
  const [
    articles,
    newspaper,
    result,
  ] = await Promise.all([
    getIchikaArticles(),
    getIchikaNewspaper(),
    getIchikaResults(),
  ]);

  return (
    <main className="page ichikaPage">
      {/* ヘッダー */}

      <header className="header">
        <div className="logo">
          BOAT
          <br />
          <span>STRIKERS</span>
        </div>

        <a
          className="lineMini"
          href="https://lin.ee/Pf3FEEQ"
          target="_blank"
          rel="noopener noreferrer"
        >
          LINE登録
        </a>
      </header>

      {/* ヒーロー */}

      <section className="hero">
        <Image
          src="/7562660D-EB9C-4981-A1D1-789E6211DACA.png"
          alt="一果"
          width={1536}
          height={2048}
          className="heroImage"
          priority
        />
      </section>

      {/* 一果新聞 */}

      <section className="sectionCard pinkCard">
        <img
          src="/IMG_6130.jpeg"
          alt="一果新聞"
          className="homeTitleImage"
        />

        {newspaper ? (
          <a
            href={newspaper.link}
            target="_blank"
            rel="noopener noreferrer"
            className="newsFeature"
          >
            <img
              src={newspaper.image}
              alt={newspaper.title}
              className="featureImg"
            />

            <div>
              <h3>
                {newspaper.title}
              </h3>

              <p>
                {newspaper.date
                  ? new Date(
                      newspaper.date
                    ).toLocaleDateString(
                      "ja-JP"
                    )
                  : ""}
              </p>

              <span className="pinkBtn">
                📖 新聞を読む
              </span>
            </div>
          </a>
        ) : (
          <p>
            今日の一果新聞は
            まだありません。
          </p>
        )}
      </section>

      {/* イン逃げツール */}

      <section className="sectionCard">
        <h2>
          一果のイン逃げツール
          （β版）
        </h2>

        <a
          href="https://www.boat-strike.com/ichika"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/F7854611-D2F7-4CF6-B549-FDB9F581F530.png"
            alt="一果鬼絞り判定所"
            width={1536}
            height={864}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "20px",
            }}
          />
        </a>
      </section>

      {/* 今日の一言 */}

      <section className="sectionCard todayCommentCard">
        <div className="todayCommentIcon">
          🌸
        </div>

        <div>
          <span>今日の一言</span>

          <p>
            今日はイン逃げ信頼度
            高めの日だよ♪
          </p>
        </div>
      </section>

      {/* 今月の成績 */}

      <section className="sectionCard pinkCard">
        <img
          src="/IMG_6131.jpeg"
          alt="一果成績"
          className="homeTitleImage"
        />

        <p className="recordLead">
          最終更新：
          {result.updated ||
            "まだ登録がありません"}
        </p>

        {result.errorMessage && (
          <p
            className="recordLead"
            style={{
              color: "#d93025",
              wordBreak: "break-word",
            }}
          >
            成績取得エラー：
            {result.errorMessage}
          </p>
        )}

        <div className="recordGrid">
          <div className="recordCard">
            <span>
              予想レース数
            </span>

            <strong>
              {result.raceCount}R
            </strong>

            <p>今月の予想数</p>
          </div>

          <div className="recordCard">
            <span>的中率</span>

            <strong>
              {result.hitRate}%
            </strong>

            <p>
              {result.hitCount}R的中
            </p>
          </div>

          <div className="recordCard">
            <span>回収率</span>

            <strong>
              {result.returnRate}%
            </strong>

            <p>
              収支
              {result.profit > 0
                ? "+"
                : ""}
              {result.profit.toLocaleString()}
              円
            </p>
          </div>

          <div className="recordCard">
            <span>最高配当</span>

            <strong>
              {result.bestHit.toLocaleString()}
              円
            </strong>

            <p>今月最高払戻</p>
          </div>
        </div>

        {/* 的中画像 */}

        {result.hits.length > 0 ? (
          <HitGallery
            hits={result.hits}
          />
        ) : (
          <p className="recordLead">
            的中画像は
            まだ登録されていません。
          </p>
        )}
      </section>

      {/* 一果ラボ */}

      <section className="sectionCard pinkCard">
        <div className="sectionTitleRow">
          <img
            src="/IMG_6135.jpeg"
            alt="一果ラボ"
            className="homeTitleImage"
          />

          <a
            href="https://note.com/boat_strikers"
            target="_blank"
            rel="noopener noreferrer"
          >
            noteで見る ›
          </a>
        </div>

        {articles.length > 0 ? (
          <div className="labList">
            {articles.map(
              (article) => (
                <a
                  key={article.link}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="labItem"
                >
                  <img
                    src={
                      article.image ||
                      "/ichika-banner.jpg"
                    }
                    alt={article.title}
                  />

                  <div>
                    <h3>
                      {article.title}
                    </h3>

                    <small>
                      {article.date
                        ? new Date(
                            article.date
                          ).toLocaleDateString(
                            "ja-JP"
                          )
                        : ""}
                    </small>
                  </div>
                </a>
              )
            )}
          </div>
        ) : (
          <p>
            一果ラボの記事は
            まだありません。
          </p>
        )}
      </section>

      {/* ラジオ */}

      <section className="sectionCard pinkCard">
        <div className="sectionTitleRow">
          <img
            src="/IMG_6133.jpeg"
            alt="一果ラジオ"
            className="homeTitleImage"
          />
        </div>

        <p className="radioLead">
          一果・初音・キイナがお届けする
          競艇ラジオ♪
          イン飛び研究や女子戦考察、
          穴党反省会を配信中！
        </p>

        <div className="radioPlayer">
          <iframe
            width="100%"
            height="240"
            src="https://www.youtube.com/embed/videoseries?list=プレイリストID"
            title="Boat Strikers Radio"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <a
          href="https://www.youtube.com/@boatstrikers_official"
          target="_blank"
          rel="noopener noreferrer"
          className="pinkBtn fullBtn"
        >
          🎙 ラジオ一覧を見る
        </a>
      </section>

      {/* LINE登録 */}

      <section className="sectionCard lineBannerCard">
        <a
          href="https://lin.ee/Pf3FEEQ"
          target="_blank"
          rel="noopener noreferrer"
          className="lineBannerLink"
        >
          <img
            src="/1946131E-2FFC-48F9-B850-AB6164F6220C.png"
            alt="公式LINE登録"
            className="lineBannerImage"
          />
        </a>
      </section>

      {/* 下部メニュー */}

      <nav className="bottomNav">
        <a href="/">ホーム</a>
        <a href="/ichika">一果</a>
        <a href="/hatsune">
          初音
        </a>
        <a href="/kiina">
          キイナ
        </a>
        <a href="/library">
          図書館
        </a>
      </nav>
    </main>
  );
}
