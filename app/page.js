import Image from "next/image";
import Parser from "rss-parser";
import { supabase } from "./bsc2/lib/supabaseClient";
import MemberSlider from "./MemberSlider";
import LatestInfoSlider from "./LatestInfoSlider";
import HomeBroadcastPanel from "./components/HomeBroadcastPanel";
import HomeRaceStrip from "./components/HomeRaceStrip";
import { getPublicScheduleSupabase } from "../lib/scheduleSupabase";
import { getCoursesByDate } from "../lib/boatstrikersPlatform";


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
   3人の今月の予想数を取得
========================= */

async function getMonthlyForecastStats() {
  const emptyMembers = [
    { name: "ichika", label: "一果", href: "/ichika", role: "イン逃げ担当", icon: "/results/icons/ichika.jpg", raceCount: 0, hitCount: 0, recoveryRate: 0 },
    { name: "hatsune", label: "初音", href: "/hatsune", role: "女子戦担当", icon: "/results/icons/hatsune.jpg", raceCount: 0, hitCount: 0, recoveryRate: 0 },
    { name: "kiina", label: "キイナ", href: "/kiina", role: "5アタマ担当", icon: "/results/icons/kiina.jpg", raceCount: 0, hitCount: 0, recoveryRate: 0 },
  ];

  const empty = {
    totalRace: 0,
    hitRace: 0,
    hitRate: 0,
    invest: 0,
    payout: 0,
    recoveryRate: 0,
    maxPayout: 0,
    members: emptyMembers,
  };

  if (!supabase) {
    console.error("Supabase未接続です");
    return empty;
  }

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
    const totalRace = rows.length;
    const hitRace = rows.filter((row) => Boolean(row.hit) || Number(row.payout || 0) > 0).length;
    const invest = rows.reduce((sum, row) => sum + Number(row.invest || 0), 0);
    const payout = rows.reduce((sum, row) => sum + Number(row.payout || 0), 0);
    const maxPayout = rows.reduce((max, row) => Math.max(max, Number(row.payout || 0)), 0);

    const members = emptyMembers.map((member) => {
      const memberRows = rows.filter((row) => row.category === member.label);
      const memberHits = memberRows.filter((row) => Boolean(row.hit) || Number(row.payout || 0) > 0).length;
      const memberInvest = memberRows.reduce((sum, row) => sum + Number(row.invest || 0), 0);
      const memberPayout = memberRows.reduce((sum, row) => sum + Number(row.payout || 0), 0);

      return {
        ...member,
        raceCount: memberRows.length,
        hitCount: memberHits,
        recoveryRate: memberInvest > 0 ? (memberPayout / memberInvest) * 100 : 0,
      };
    });

    return {
      totalRace,
      hitRace,
      hitRate: totalRace > 0 ? (hitRace / totalRace) * 100 : 0,
      invest,
      payout,
      recoveryRate: invest > 0 ? (payout / invest) * 100 : 0,
      maxPayout,
      members,
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

export const metadata = {
  title: {
    absolute: "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく",
  },
  description:
    "BoatStrikersは、出走表、展示比較、キャラクター予想、初心者講座、漫画、ラジオ、24場攻略を楽しめるボートレース情報サイトです。",
};


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

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function getHomeRaceData() {
  const raceDate = getJstDateString();
  try {
    const courses = await getCoursesByDate(raceDate);
    return { raceDate, courses: Array.isArray(courses) ? courses : [] };
  } catch (error) {
    console.error("トップページ開催場取得エラー:", error);
    return { raceDate, courses: [] };
  }
}

export default async function Home() {
  const [
    news,
    latestInfo,
    results,
    cms,
    raceData,
  ] = await Promise.all([
    getTodayNewspapers(),
    getLatestInfo(),
    getMonthlyForecastStats(),
    getHomeCmsData(),
    getHomeRaceData(),
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

      <HomeRaceStrip courses={raceData.courses} raceDate={raceData.raceDate} />

      

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

   <section className="homeSectionCard yellow resultSummarySection">
  <img
    src="/IMG_6116.jpeg"
    alt="今月の予想実績"
    className="homeTitleImage"
  />

  {results.totalRace === 0 ? (
    <div className="resultEmptyState">
      <span aria-hidden="true">📊</span>
      <strong>今月の予想実績は集計中です</strong>
      <p>予想実績が登録されると、ここに自動で表示されます。</p>
    </div>
  ) : (
    <>
      <div className="resultStatsGrid">
        <div className="resultStatCard">
          <span>予想レース数</span>
          <strong>{results.totalRace}<small>R</small></strong>
        </div>
        <div className="resultStatCard">
          <span>的中率</span>
          <strong>{results.hitRate.toFixed(1)}<small>%</small></strong>
        </div>
        <div className="resultStatCard">
          <span>回収率</span>
          <strong>{results.recoveryRate.toFixed(1)}<small>%</small></strong>
        </div>
        <div className="resultStatCard">
          <span>最高払戻</span>
          <strong>{results.maxPayout.toLocaleString()}<small>円</small></strong>
        </div>
      </div>

      <div className="resultMemberGrid" aria-label="キャラクター別予想実績">
        {results.members.map((member) => (
          <a
            href={member.href}
            className={`resultMemberCard resultMemberCard--${member.name}`}
            key={member.name}
            aria-label={`${member.label}のページを見る`}
          >
            <img
              src={member.icon}
              alt={`${member.label}のアイコン`}
              className="resultMemberIcon"
              width="52"
              height="52"
              style={{
                width: "52px",
                height: "52px",
                minWidth: "52px",
                maxWidth: "52px",
                minHeight: "52px",
                maxHeight: "52px",
                objectFit: "cover",
                borderRadius: "50%",
                flexShrink: 0,
              }}
            />
            <div className="resultMemberContent">
              <div className="resultMemberHeading">
                <div>
                  <span className="resultMemberName">{member.label}</span>
                  <span className="resultMemberRole">{member.role}</span>
                </div>
                <span className="resultMemberArrow" aria-hidden="true">›</span>
              </div>
              <div className="resultMemberNumbers">
                <span><b>{member.raceCount}</b>R</span>
                <span><b>{member.hitCount}</b>的中</span>
                <span>回収率 <b>{member.recoveryRate.toFixed(1)}</b>%</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </>
  )}
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
