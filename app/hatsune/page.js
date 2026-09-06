import Image from "next/image";
import RealtimeUpdates from "../components/RealtimeUpdates";
import Parser from "rss-parser";
import HitGallery from "../components/HitGallery";
import { supabase } from "../bsc2/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const emptyHatsuneResult = {
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
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth === 13) { nextYear += 1; nextMonth = 1; }
  return { monthStart, nextMonthStart: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` };
}

function formatRaceDate(dateString) {
  return dateString ? dateString.replaceAll("-", "/") : "";
}

async function getHatsuneResults() {
  if (!supabase) return { ...emptyHatsuneResult, errorMessage: "Supabase未接続です" };
  try {
    const { monthStart, nextMonthStart } = getCurrentMonthRange();
    const { data, error } = await supabase
      .from("bsc_results")
      .select("id,race_date,place,race_no,category,bet_text,invest,payout,hit,memo,hit_image_url,hit_title,hit_note,created_at")
      .eq("category", "初音")
      .gte("race_date", monthStart)
      .lt("race_date", nextMonthStart)
      .order("race_date", { ascending: false })
      .order("race_no", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return { ...emptyHatsuneResult, errorMessage: `${error.message} / ${error.code || "コードなし"}` };
    const rows = Array.isArray(data) ? data : [];
    const hitRows = rows.filter((row) => row.hit === true || Number(row.payout || 0) > 0);
    const totalInvest = rows.reduce((sum, row) => sum + Number(row.invest || 0), 0);
    const totalPayout = rows.reduce((sum, row) => sum + Number(row.payout || 0), 0);
    const bestHit = rows.reduce((max, row) => Math.max(max, Number(row.payout || 0)), 0);
    const hits = rows
      .filter((row) => Boolean(row.hit_image_url))
      .slice(0, 6)
      .map((row) => {
        const payout = Number(row.payout || 0);
        return {
          image: row.hit_image_url,
          title: row.hit_title || `${row.place}${row.race_no}R`,
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
    return { ...emptyHatsuneResult, errorMessage: error?.message || "不明な取得エラー" };
  }
}

function getRssImage(item, fallbackImage) {
  return item?.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || fallbackImage;
}

async function getHatsuneNewspaper() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL("https://note.com/boat_strikers/rss");
    const item = feed.items.find((feedItem) => feedItem.title?.includes("【初音前日版】"));
    if (!item) return null;
    return { title: item.title || "初音前日版", link: item.link || "", date: item.pubDate || "", image: getRssImage(item, "/hatsune-banner.jpg") };
  } catch (error) {
    console.error("初音新聞取得エラー:", error);
    return null;
  }
}

async function getHatsuneArticles() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL("https://note.com/boat_strikers/rss");
    return feed.items
      .filter((item) => item.title?.includes("【初音ゼミ"))
      .slice(0, 6)
      .map((item) => ({ title: item.title || "初音ゼミ", link: item.link || "", date: item.pubDate || "", image: getRssImage(item, "/hatsune-banner.jpg") }));
  } catch (error) {
    console.error("初音ゼミ取得エラー:", error);
    return [];
  }
}

export default async function HatsunePage() {
  const [articles, newspaper, result] = await Promise.all([getHatsuneArticles(), getHatsuneNewspaper(), getHatsuneResults()]);

  return (
    <main className="page hatsunePage">
      <header className="header">
        <div className="logo">BOAT<br /><span>STRIKERS</span></div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer">LINE登録</a>
      </header>

      <section className="hero">
        <Image src="/8A7A7A27-B954-4A3F-9DC3-52DB3DCE80AB.png" alt="初音" width={1536} height={864} className="heroImage" priority />
      </section>

      {/* AI予想はCharacterAiRoomPanelがヒーロー直下に表示。ここから女子戦情報・理論アラート。 */}
      <RealtimeUpdates target="hatsune" limit={5} />

      {/* 新聞 */}
      <section className="sectionCard purpleCard">
        <img src="/top/IMG_7884.jpeg?v=20260901-0532" alt="初音新聞" className="homeTitleImage" />
        {newspaper ? (
          <a href={newspaper.link} target="_blank" rel="noopener noreferrer" className="newsFeature">
            <img src={newspaper.image} alt={newspaper.title} className="featureImg" />
            <div>
              <h3>{newspaper.title}</h3>
              <p>{newspaper.date ? new Date(newspaper.date).toLocaleDateString("ja-JP") : ""}</p>
              <span className="purpleBtn">📖 新聞を読む</span>
            </div>
          </a>
        ) : <p>今日の初音新聞はまだありません。</p>}
      </section>

      {/* 成績 */}
      <section className="sectionCard purpleCard">
        <img src="/top/IMG_7883.jpeg?v=20260901-0532" alt="初音成績" className="homeTitleImage" />
        <p className="recordLead">最終更新：{result.updated || "まだ登録がありません"}</p>
        {result.errorMessage && <p className="recordLead" style={{ color: "#d93025", wordBreak: "break-word" }}>成績取得エラー：{result.errorMessage}</p>}
        <div className="recordGrid">
          <div className="recordCard"><span>予想レース数</span><strong>{result.raceCount}R</strong><p>今月の予想数</p></div>
          <div className="recordCard"><span>的中率</span><strong>{result.hitRate}%</strong><p>{result.hitCount}R的中</p></div>
          <div className="recordCard"><span>回収率</span><strong>{result.returnRate}%</strong><p>収支{result.profit > 0 ? "+" : ""}{result.profit.toLocaleString()}円</p></div>
          <div className="recordCard"><span>最高配当</span><strong>{result.bestHit.toLocaleString()}円</strong><p>今月最高払戻</p></div>
        </div>
        {result.hits.length > 0 ? <HitGallery hits={result.hits} /> : <p className="recordLead">的中画像はまだ登録されていません。</p>}
      </section>

      {/* 研究・記事 */}
      <section className="sectionCard purpleCard">
        <div className="sectionTitleRow"><img src="/top/IMG_7960.jpeg?v=20260904-0315" alt="初音ラボ" className="homeTitleImage" /></div>
        {articles.length > 0 ? (
          <div className="labList">
            {articles.map((article) => (
              <a key={article.link} href={article.link} target="_blank" rel="noopener noreferrer" className="labItem">
                <img src={article.image || "/hatsune-banner.jpg"} alt={article.title} />
                <div><h3>{article.title}</h3><small>{article.date ? new Date(article.date).toLocaleDateString("ja-JP") : ""}</small></div>
              </a>
            ))}
          </div>
        ) : <p>初音ラボの記事はまだありません。</p>}
      </section>

      <section className="sectionCard">
        <h2>女子戦データツール（β版）</h2>
        <a href="https://www.boat-strike.com/hastune" target="_blank" rel="noopener noreferrer">
          <Image src="/A3494785-9903-43D3-9FDB-048D521B3008.png" alt="初音女子戦データツール" width={1536} height={864} style={{ width: "100%", height: "auto", borderRadius: "20px" }} />
        </a>
      </section>

      {/* 動画・ラジオ */}
      <section className="sectionCard purpleCard">
        <div className="sectionTitleRow"><img src="/top/IMG_7954.jpeg?v=20260904-0315" alt="初音ラジオ" className="homeTitleImage" /></div>
        <p className="radioLead">初音が女子戦の流れやデータの見方をやさしく解説♪ 一果・キイナとの掛け合いも配信中！</p>
        <div className="radioPlayer">
          <iframe width="100%" height="240" src="https://www.youtube.com/embed/videoseries?list=プレイリストID" title="Boat Strikers Radio" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <a href="https://www.youtube.com/@boatstrikers_official" target="_blank" rel="noopener noreferrer" className="purpleBtn fullBtn">🎙 ラジオ一覧を見る</a>
      </section>

      <section className="sectionCard lineBannerCard">
        <a href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer" className="lineBannerLink">
          <img src="/90F7EE0F-5EE8-4E71-BF86-D254BB00750D.png" alt="公式LINE登録" className="lineBannerImage" />
        </a>
      </section>
    </main>
  );
}
