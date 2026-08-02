import Image from "next/image";
import Parser from "rss-parser";
import { supabase } from "./bsc2/lib/supabaseClient";
import MemberSlider from "./MemberSlider";
import LatestInfoSlider from "./LatestInfoSlider";
import HomeBroadcastPanel from "./components/HomeBroadcastPanel";
import { getPublicScheduleSupabase } from "../lib/scheduleSupabase";


export const dynamic = "force-dynamic";
export const revalidate = 0;



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
   今月の予想実績を取得
========================= */

async function getMonthlyForecastResults() {
  const emptyMember = (name, label) => ({
    name, label, raceCount: 0, hitCount: 0, hitRate: 0,
    invest: 0, payout: 0, returnRate: 0, maxPayout: 0,
  });

  const empty = {
    raceCount: 0, hitCount: 0, hitRate: 0, invest: 0, payout: 0,
    returnRate: 0, maxPayout: 0,
    members: [
      emptyMember("ichika", "一果"),
      emptyMember("hatsune", "初音"),
      emptyMember("kiina", "キイナ"),
    ],
  };

  if (!supabase) return empty;

  try {
    const { monthStart, nextMonthStart } = getCurrentMonthRange();
    const { data, error } = await supabase
      .from("bsc_results")
      .select("category, invest, payout, hit")
      .gte("race_date", monthStart)
      .lt("race_date", nextMonthStart)
      .in("category", ["一果", "初音", "キイナ"]);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];

    const summarize = (items) => {
      const raceCount = items.length;
      const hitCount = items.filter((r) => Boolean(r.hit) || Number(r.payout || 0) > 0).length;
      const invest = items.reduce((sum, r) => sum + Number(r.invest || 0), 0);
      const payout = items.reduce((sum, r) => sum + Number(r.payout || 0), 0);
      const maxPayout = items.reduce((max, r) => Math.max(max, Number(r.payout || 0)), 0);
      return {
        raceCount, hitCount, invest, payout, maxPayout,
        hitRate: raceCount ? Math.round((hitCount / raceCount) * 1000) / 10 : 0,
        returnRate: invest ? Math.round((payout / invest) * 1000) / 10 : 0,
      };
    };

    const total = summarize(rows);
    const memberDefs = [
      ["ichika", "一果"], ["hatsune", "初音"], ["kiina", "キイナ"],
    ];

    return {
      ...total,
      members: memberDefs.map(([name, label]) => ({
        name, label, ...summarize(rows.filter((r) => r.category === label)),
      })),
    };
  } catch (error) {
    console.error("トップページ成績取得エラー:", error);
    return empty;
  }
}

async function getTodayNewspapers() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const targets = [
    {
      name: "一果新聞 前日版",
      keyword: "【一果前日版】",
      tag: "イン逃げ",
      href: "/ichika",
      fallback: "/ichika-banner.jpg",
    },
    {
      name: "初音新聞 女子戦版",
      keyword: "【初音前日版】",
      tag: "女子戦",
      href: "/hatsune",
      fallback: "/hatsune-banner.jpg",
    },
    {
      name: "キイナ新聞 5アタマ版",
      keyword: "【キイナ前日版】",
      tag: "穴狙い",
      href: "/kiina",
      fallback: "/kiina-banner.jpg",
    },
  ];

  return targets.map((t) => {
    const item = feed.items.find((feedItem) =>
      feedItem.title.includes(t.keyword)
    );

    const image =
      item?.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || t.fallback;

    return {
      title: item ? item.title : t.name,
      date: item ? item.pubDate : "",
      link: item ? item.link : t.href,
      tag: t.tag,
      image: image,
    };
  });
}

async function getLatestInfo() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items.slice(0, 5).map((item) => {
    let category = "note";

    if (item.title.includes("【一果前日版】")) category = "一果新聞";
    if (item.title.includes("【初音前日版】")) category = "初音新聞";
    if (item.title.includes("【キイナ前日版】")) category = "キイナ新聞";
    if (item.title.includes("【一果ゼミ")) category = "一果ゼミ";
    if (item.title.includes("【初音ゼミ")) category = "初音ゼミ";
    if (item.title.includes("【キイナゼミ")) category = "キイナゼミ";
    if (item.title.includes("場攻略】")) category = "24場攻略";

    return {
      title: item.title,
      link: item.link,
      date: item.pubDate,
      category,
    };
  });
}


async function getHomeCmsData() {
  const client = getPublicScheduleSupabase();
  if (!client) return { tickerItems: [], scheduleItems: [] };
  try {
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const [ticker, schedule] = await Promise.all([
      client.from("home_ticker_items").select("*").eq("is_active", true).order("sort_order"),
      client.from("weekly_schedule_items").select("*").eq("event_date", today).eq("status", "published").order("start_time")
    ]);
    return { tickerItems: ticker.data || [], scheduleItems: schedule.data || [] };
  } catch (error) {
    console.error("CMS表示取得エラー:", error);
    return { tickerItems: [], scheduleItems: [] };
  }
}

export default async function Home() {
  const [
    news,
    latestInfo,
    results,
    cms,
  ] = await Promise.all([
    getTodayNewspapers(),
    getLatestInfo(),
    getMonthlyForecastResults(),
    getHomeCmsData(),
  ]);

  return (
    <main className="page">
      <header className="header">
        <div className="logo">BOAT<br /><span>STRIKERS</span></div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">LINE登録</a>
      </header>

      <section className="hero">
        <Image
          src="/hero.jpg"
          alt="BoatStrikers"
          width={1536}
          height={864}
          priority
          className="heroImage"
        />

      </section>

      <HomeBroadcastPanel tickerItems={cms.tickerItems} scheduleItems={cms.scheduleItems} />

      

        <section className="homeSectionCard pink">
  <img
  src="/IMG_6118.jpeg"
  alt="新聞"
  className="homeTitleImage"
/>

  <div className="todayNewsGrid">
    {news.map((n) => (
      <a
        className="todayNewsCard"
        key={n.title}
        href={n.link}
        target={n.link.startsWith("http") ? "_blank" : "_self"}
        rel="noopener noreferrer"
      >
        <img src={n.image} alt={n.title} />
        <div className="todayNewsBody">
          <span>{n.tag}</span>
          <h3>{n.title}</h3>
          <p>
            {n.date
              ? new Date(n.date).toLocaleDateString("ja-JP")
              : "最新号をチェック"}
          </p>
          <b>読む ›</b>
        </div>
      </a>
    ))}
  </div>
</section>   

      <section className="homeSectionCard purple">
  <img
  src="/IMG_6117.jpeg"
  alt="メンバー紹介"
  className="homeTitleImage"
/>

  <MemberSlider />
</section>

<section className="homeSection bscSection">

<a href="/bsc2">

     <img
  src="/88D8F192-324A-4FD9-8F3A-A2AF27E35C9F.png"
  alt="トップ"
  className="homeTitleImage"
/>

</a>


</section>

    

      <section className="homeSectionCard yellow">

  <a href="/library" className="bannerLink">
    <Image
      src="/1C1FAE76-929A-4DEE-9D2D-816BBC47FA04.png"
      alt="一果図書館"
      width={1536}
      height={864}
      className="bannerImage"
    />
  </a>
</section>

   <section className="homeSectionCard yellow compactResultsSection">
  <img
    src="/IMG_6116.jpeg"
    alt="今月の予想実績"
    className="homeTitleImage compactResultsTitle"
  />

  {results.raceCount === 0 ? (
    <div className="resultsCollecting">
      <strong>今月の予想実績は集計中です</strong>
      <p>実績が登録されると、的中率・回収率・最高払戻を表示します。</p>
    </div>
  ) : (
    <>
      <div className="resultsSummaryGrid">
        <div><span>予想レース数</span><strong>{results.raceCount}<small>R</small></strong></div>
        <div><span>的中率</span><strong>{results.hitRate}<small>%</small></strong></div>
        <div><span>回収率</span><strong>{results.returnRate}<small>%</small></strong></div>
        <div><span>最高払戻</span><strong>{results.maxPayout.toLocaleString()}<small>円</small></strong></div>
      </div>

      <div className="memberResultMiniGrid">
        {results.members.map((member) => (
          <a href={`/${member.name}`} className={`memberResultMini ${member.name}`} key={member.name}>
            <b>{member.label}</b>
            <span>{member.raceCount}R／的中 {member.hitCount}R</span>
            <small>回収率 {member.returnRate}%</small>
          </a>
        ))}
      </div>
    </>
  )}

  <a className="resultsDetailLink" href="/results">
    詳しい予想実績を見る <span>→</span>
  </a>
</section>

    <section className="homeSectionCard blue">

  <a href="/radio" className="bannerLink">
    <Image
      src="/6EDF5261-8C7D-49F6-9C79-F22A3AA172C1.png"
      alt="BoatStrikers Radio"
      className="bannerImage"
    />
  </a>
</section>

      <section className="homeSectionCard green">
  <h2 className="homeSectionTitle">💚 LINE限定情報</h2>
  <p className="homeSectionLead">前日版・直前版を最速配信中！</p>

  <a href="https://lin.ee/Pf3FEEQ" className="bannerLink">
    <img
      src="/EED67E49-6856-4A73-BFF4-60583A6B2835.png"
      alt="公式LINE登録"
      className="bannerImage"
    />
  </a>
</section>

    </main>
  );
}
