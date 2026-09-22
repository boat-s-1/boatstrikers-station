import Image from "next/image";
import RealtimeUpdates from "../components/RealtimeUpdates";
import Parser from "rss-parser";
import HitGallery from "../components/HitGallery";
import { supabase } from "../bsc2/lib/supabaseClient";
import { getPublishedNewspapers } from "../../lib/newspapers";
import IchikaBookshelf from "./IchikaBookshelf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "一果｜イン逃げ・1号艇分析・ボートレース攻略",
  description: "BoatStrikers一果の専門ページ。イン逃げ、1号艇、進入、スタート、展示、相手関係の見方を解説し、新聞・研究記事・成績とあわせて確認できます。",
  alternates: { canonical: "/ichika" },
  openGraph: {
    title: "一果｜イン逃げ・1号艇分析｜BoatStrikers",
    description: "イン逃げを艇番だけで決めず、進入・スタート・展示・相手関係まで重ねて見るBoatStrikers一果の専門ページです。",
    url: "/ichika",
    type: "website",
  },
};

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

function getCurrentMonthRange() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth === 13) {
    nextYear += 1;
    nextMonth = 1;
  }
  return {
    monthStart,
    nextMonthStart: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

function formatRaceDate(dateString) {
  return dateString ? dateString.replaceAll("-", "/") : "";
}

async function getIchikaResults() {
  if (!supabase) {
    return { ...emptyIchikaResult, errorMessage: "Supabase未接続です" };
  }

  try {
    const { monthStart, nextMonthStart } = getCurrentMonthRange();
    const { data, error } = await supabase
      .from("bsc_results")
      .select("id,race_date,place,race_no,category,bet_text,invest,payout,hit,memo,hit_image_url,hit_title,hit_note,created_at")
      .eq("category", "一果")
      .gte("race_date", monthStart)
      .lt("race_date", nextMonthStart)
      .order("race_date", { ascending: false })
      .order("race_no", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return {
        ...emptyIchikaResult,
        errorMessage: `${error.message} / ${error.code || "コードなし"}`,
      };
    }

    const rows = Array.isArray(data) ? data : [];
    const hitRows = rows.filter((row) => row.hit === true || Number(row.payout || 0) > 0);
    const totalInvest = rows.reduce((sum, row) => sum + Number(row.invest || 0), 0);
    const totalPayout = rows.reduce((sum, row) => sum + Number(row.payout || 0), 0);
    const bestHit = rows.reduce((max, row) => Math.max(max, Number(row.payout || 0)), 0);
    const hits = hitRows
      .filter((row) => Boolean(row.hit_image_url))
      .slice(0, 6)
      .map((row) => {
        const payout = Number(row.payout || 0);
        return {
          image: row.hit_image_url,
          title: row.hit_title || `${row.place}${row.race_no}R 的中`,
          race: `${formatRaceDate(row.race_date)} ${row.place}${row.race_no}R`,
          note: row.hit_note || row.memo || `払戻 ${payout.toLocaleString()}円`,
        };
      });

    return {
      raceCount: rows.length,
      hitCount: hitRows.length,
      hitRate: rows.length ? Math.round((hitRows.length / rows.length) * 100) : 0,
      returnRate: totalInvest > 0 ? Math.round((totalPayout / totalInvest) * 100) : 0,
      profit: totalPayout - totalInvest,
      bestHit,
      updated: rows[0]?.race_date ? formatRaceDate(rows[0].race_date) : "",
      hits,
      errorMessage: "",
    };
  } catch (error) {
    return { ...emptyIchikaResult, errorMessage: error?.message || "不明な取得エラー" };
  }
}

function getRssImage(item, fallbackImage) {
  return item?.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || fallbackImage;
}

async function getIchikaNewspaper() {
  try {
    const siteItems = await getPublishedNewspapers({ character: "ichika", limit: 3 });
    if (siteItems.length) return siteItems.map((siteItem) => ({ title: siteItem.title, link: `/newspapers/${siteItem.slug}`, date: siteItem.race_date, image: siteItem.image_url || "/ichika-banner.jpg", edition: siteItem.edition, course: siteItem.course_name, raceNo: siteItem.race_no }));
    const parser = new Parser();
    const feed = await parser.parseURL("https://note.com/boat_strikers/rss");
    const item = feed.items.find((feedItem) => feedItem.title?.includes("【一果前日版】"));
    if (!item) return [];
    return [{
      title: item.title || "一果前日版",
      link: item.link || "",
      date: item.pubDate || "",
      image: getRssImage(item, "/ichika-banner.jpg"),
    }];
  } catch (error) {
    console.error("一果新聞取得エラー:", error);
    return [];
  }
}

async function getIchikaArticles() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL("https://note.com/boat_strikers/rss");
    return feed.items
      .filter((item) => item.title?.includes("【一果ゼミ"))
      .slice(0, 6)
      .map((item) => ({
        title: item.title || "一果ゼミ",
        link: item.link || "",
        date: item.pubDate || "",
        image: getRssImage(item, "/ichika-banner.jpg"),
      }));
  } catch (error) {
    console.error("一果ゼミ取得エラー:", error);
    return [];
  }
}

export default async function IchikaPage() {
  const [articles, newspapers, result] = await Promise.all([
    getIchikaArticles(),
    getIchikaNewspaper(),
    getIchikaResults(),
  ]);

  return (
    <main className="page ichikaPage">
      <header className="header">
        <div className="logo">BOAT<br /><span>STRIKERS</span></div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer">LINE登録</a>
      </header>

      <section className="hero">
        <Image src="/7562660D-EB9C-4981-A1D1-789E6211DACA.png" alt="一果" width={1536} height={2048} className="heroImage" priority />
      </section>

      <section className="sectionCard pinkCard">
        <h1>一果のイン逃げ研究室</h1>
        <p>一果は「1号艇だから買う」ではなく、1コースに入れるか、スタートで外に先行されないか、展示で足落ちがないか、2〜4コースに強い攻め艇がいないかを順番に確認します。イン逃げは1号艇単体ではなく、相手との比較で見ます。</p>
        <h2>イン逃げを見る5つのポイント</h2>
        <ol>
          <li><strong>進入：</strong>1号艇が1コースを確保できるか、前付けで深くならないか。</li>
          <li><strong>スタート：</strong>平均ST・今節ST・スタート展示を隣接艇と比較する。</li>
          <li><strong>展示：</strong>展示タイムだけでなく、ターン出口や直線の気配も確認する。</li>
          <li><strong>攻め艇：</strong>2〜4コースに先に仕掛けそうな艇がいないかを見る。</li>
          <li><strong>水面：</strong>風・波・場ごとの傾向で、通常のイン信頼度を上書きする。</li>
        </ol>
        <p>判断材料が揃わないレースは見送ることも含めて考えます。過去データは将来の結果を保証するものではなく、当日の公式情報と直前展示を優先します。</p>
        <div className="sectionTitleRow">
          <a className="pinkBtn" href="/guide/inside-course">1号艇とイン逃げの基本</a>
          <a className="pinkBtn" href="/guide/course-entry">進入・前付けを学ぶ</a>
          <a className="pinkBtn" href="/data-lab">DATA LABで検証を見る</a>
        </div>
      </section>

      <RealtimeUpdates target="ichika" limit={5} />

      <section className="sectionCard pinkCard">
        <img src="/IMG_6130.jpeg" alt="一果新聞" className="homeTitleImage" />
        {newspapers?.length ? (
          <div className="labList">
            {newspapers.map((newspaper) => (
              <a href={newspaper.link} className="newsFeature" key={newspaper.link}>
                <img src={newspaper.image} alt={newspaper.title} className="featureImg" />
                <div>
                  <small>{newspaper.edition === "just_before" ? "直前版" : "前日版"}{newspaper.course ? `・${newspaper.course}${newspaper.raceNo}R` : ""}</small>
                  <h3>{newspaper.title}</h3>
                  <p>{newspaper.date ? new Date(newspaper.date).toLocaleDateString("ja-JP") : ""}</p>
                  <span className="pinkBtn">📖 新聞を読む</span>
                </div>
              </a>
            ))}
          </div>
        ) : <p>今日の一果新聞はまだありません。</p>}
      </section>

      <IchikaBookshelf />

      <section className="sectionCard pinkCard">
        <img src="/IMG_6131.jpeg" alt="一果成績" className="homeTitleImage" />
        <p className="recordLead">最終更新：{result.updated || "まだ登録がありません"}</p>
        {result.errorMessage && <p className="recordLead" style={{ color: "#d93025", wordBreak: "break-word" }}>成績取得エラー：{result.errorMessage}</p>}
        <div className="recordGrid">
          <div className="recordCard"><span>予想レース数</span><strong>{result.raceCount}R</strong><p>今月の予想数</p></div>
          <div className="recordCard"><span>的中率</span><strong>{result.hitRate}%</strong><p>{result.hitCount}R的中</p></div>
          <div className="recordCard"><span>回収率</span><strong>{result.returnRate}%</strong><p>収支{result.profit > 0 ? "+" : ""}{result.profit.toLocaleString()}円</p></div>
          <div className="recordCard"><span>最高配当</span><strong>{result.bestHit.toLocaleString()}円</strong><p>今月最高払戻</p></div>
        </div>
        {result.hits.length > 0 ? <HitGallery hits={result.hits} /> : null}
      </section>

      <section className="sectionCard pinkCard">
        <div className="sectionTitleRow"><img src="/IMG_6135.jpeg" alt="一果ラボ" className="homeTitleImage" /></div>
        {articles.length > 0 ? (
          <div className="labList">
            {articles.map((article) => (
              <a key={article.link} href={article.link} target="_blank" rel="noopener noreferrer" className="labItem">
                <img src={article.image || "/ichika-banner.jpg"} alt={article.title} />
                <div><h3>{article.title}</h3><small>{article.date ? new Date(article.date).toLocaleDateString("ja-JP") : ""}</small></div>
              </a>
            ))}
          </div>
        ) : <p>一果ラボの記事はまだありません。</p>}
      </section>

      <section className="sectionCard pinkCard">
        <div className="sectionTitleRow"><img src="/IMG_6133.jpeg" alt="一果ラジオ" className="homeTitleImage" /></div>
        <p className="radioLead">一果・初音・キイナがお届けする競艇ラジオ♪ イン飛び研究や女子戦考察、穴党反省会を配信中！</p>
        <a href="https://www.youtube.com/@boatstrikers_official" target="_blank" rel="noopener noreferrer" className="pinkBtn fullBtn">🎙 ラジオ一覧を見る</a>
      </section>

      <section className="sectionCard lineBannerCard">
        <a href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer" className="lineBannerLink">
          <img src="/1946131E-2FFC-48F9-B850-AB6164F6220C.png" alt="公式LINE登録" className="lineBannerImage" />
        </a>
      </section>
    </main>
  );
}
