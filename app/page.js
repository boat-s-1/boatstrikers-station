import Image from "next/image";
import Parser from "rss-parser";
import { unstable_cache } from "next/cache";
import { supabase } from "./bsc2/lib/supabaseClient";
import MemberSlider from "./MemberSlider";
import LatestInfoSlider from "./LatestInfoSlider";
import HomeBroadcastPanel from "./components/HomeBroadcastPanel";
import HomeRaceInfo from "./components/HomeRaceInfo";
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

const getHomeNoteData = unstable_cache(
  async () => {
    const parser = new Parser();
    const feed = await parser.parseURL("https://note.com/boat_strikers/rss");
    const recentCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const isRecent = (item) => {
      const publishedAt = new Date(item?.pubDate || 0).getTime();
      return Number.isFinite(publishedAt) && publishedAt >= recentCutoff;
    };

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

    const news = targets.map((t) => {
      const item = feed.items.find((feedItem) =>
        feedItem.title.includes(t.keyword) && isRecent(feedItem)
      );

      const image =
        item?.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || t.fallback;

      return {
        title: item ? item.title : t.name,
        date: item ? item.pubDate : "",
        link: item ? item.link : t.href,
        tag: t.tag,
        image,
      };
    });

    const latestInfo = feed.items.slice(0, 5).map((item) => {
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

    return { news, latestInfo };
  },
  ["home-note-rss-v1"],
  { revalidate: 300 },
);

export const metadata = {
  title: {
    absolute: "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく",
  },
  description:
    "BoatStrikersは、出走表、展示比較、キャラクター予想、初心者講座、漫画、ラジオ、24場攻略を楽しめるボートレース情報サイトです。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく",
    description:
      "全国24場攻略、展示データ、選手・女子戦ニュース、初心者講座を発信するボートレース情報メディアです。",
    url: "/",
    type: "website",
  },
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
    noteData,
    results,
    cms,
    raceData,
  ] = await Promise.all([
    getHomeNoteData(),
    getMonthlyForecastStats(),
    getHomeCmsData(),
    getHomeRaceData(),
  ]);

  const { news, latestInfo } = noteData;

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

      <section className="homeMediaIntro" aria-labelledby="home-media-intro-title">
        <span>BOAT RACE INFORMATION MEDIA</span>
        <h1 id="home-media-intro-title">ボートレースを、もっと楽しく、もっと分かりやすく。</h1>
        <p>
          BoatStrikersは、全国24場の水面特徴、展示データ、選手情報、
          女子戦ニュース、初心者向け講座などを発信するボートレース情報メディアです。
          一果・初音・キイナの3人と一緒に、レースの見方やデータの活用方法を分かりやすく紹介します。
        </p>
      </section>

      <HomeBroadcastPanel tickerItems={cms.tickerItems} scheduleItems={cms.scheduleItems} />

      <HomeRaceInfo
        courses={raceData.courses}
        raceDate={raceData.raceDate}
        realtimeLimit={3}
      />

      <section className="homeMediaGuide" aria-labelledby="home-media-guide-title">
        <div className="homeMediaGuideHeading">
          <span>LEARN &amp; DISCOVER</span>
          <h2 id="home-media-guide-title">ニュース・攻略・データを読む</h2>
          <p>予想を見る前に知っておきたい情報を、BoatStrikersが分かりやすくまとめています。</p>
        </div>
        <div className="homeMediaGuideGrid">
          <a href="/news" className="homeMediaGuideCard homeMediaGuideCard--news">
            <span className="homeMediaGuideIcon" aria-hidden="true">📰</span>
            <small>BOATSTRIKERS NEWS</small>
            <h3>最新ニュース</h3>
            <p>女子戦、グレードレース、選手、モーターなどの注目情報。</p>
            <b>ニュースを見る <i>›</i></b>
          </a>
          <a href="/guide" className="homeMediaGuideCard homeMediaGuideCard--beginner">
            <span className="homeMediaGuideIcon" aria-hidden="true">📖</span>
            <small>FOR BEGINNERS</small>
            <h3>はじめての方へ</h3>
            <p>レースの基本や展示の見方を、一果センセーがやさしく解説。</p>
            <b>初心者講座を見る <i>›</i></b>
          </a>
          <a href="/library/stadiums" className="homeMediaGuideCard homeMediaGuideCard--stadiums">
            <span className="homeMediaGuideIcon" aria-hidden="true">🌊</span>
            <small>24 STADIUMS</small>
            <h3>全国24場攻略</h3>
            <p>水面、風、コース別傾向など、全国24場の特徴を場別に紹介。</p>
            <b>24場攻略を見る <i>›</i></b>
          </a>
          <a href="/library" className="homeMediaGuideCard homeMediaGuideCard--research">
            <span className="homeMediaGuideIcon" aria-hidden="true">📊</span>
            <small>DATA &amp; RESEARCH</small>
            <h3>独自研究・データ</h3>
            <p>イン逃げ、女子戦、穴狙いなどの研究記事とバックナンバー。</p>
            <b>研究記事を読む <i>›</i></b>
          </a>
        </div>
      </section>

      

        <section className="homeSectionCard pink homeBannerFlush">
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

      <section className="homeSectionCard purple homeBannerFlush">
  <img
  src="/IMG_6117.jpeg"
  alt="メンバー紹介"
  className="homeTitleImage"
/>

  <MemberSlider />
</section>




  

   <section className="homeSectionCard yellow resultSummarySection homeBannerFlush">
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
      <a href="/library" className="resultEmptyLink">最新の攻略記事・データを見る ›</a>
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



         
 <section className="homeSection bscSection">
         <a href="/library" className="bannerLink">
    <Image
      src="/IMG_6917.jpeg"
      alt="一果図書館"
      className="bannerImage"
    />
  </a>
</section>

         

         <section className="homeSection bscSection">
<a href="/radio" className="bannerLink">
    <Image
      src="/IMG_6916.jpeg"
      alt="BoatStrikers Radio"
      className="bannerImage"
    />
  </a>
</section>

         
<section className="homeSection bscSection">
  <a href="/bsc2">
    <img
      src="/IMG_6915.jpeg"
      alt="BoatStrikers Challenge"
      className="homeTitleImage"
    />
  </a>
</section>

{/* ========================================
    BoatStrikersについて
======================================== */}
<section className="aboutBoatStrikers" aria-labelledby="about-title">
  <div className="aboutBoatStrikersInner">
    <div className="aboutHeading">
      <span className="aboutHeadingEnglish">ABOUT BOATSTRIKERS</span>

      <h2 id="about-title">
        BoatStrikersについて
      </h2>

      <p className="aboutHeadingSub">
        ボートレースを、もっと楽しく、もっと分かりやすく。
      </p>
    </div>

    <div className="aboutDescription">
      <p>
        BoatStrikersは、ボートレースを初心者の方にも
        分かりやすく楽しんでもらうための情報サイトです。
      </p>

      <p>
        一果のイン逃げ予想、初音の女子戦攻略、
        キイナの5号艇・穴狙い情報を中心に、
        出走表、展示情報、予想新聞、全国24場攻略、
        漫画、動画、ラジオなどを配信しています。
      </p>

      <p>
        「なんとなく舟券を買う」から、
        選手・モーター・スタート・展示・水面状況を確認して
        レースを楽しむためのきっかけをお届けします。
      </p>
    </div>

    <div className="aboutFeatureGrid">
      <div className="aboutFeatureCard aboutFeatureCard--pink">
        <span className="aboutFeatureIcon" aria-hidden="true">
          1
        </span>

        <div>
          <h3>予想を楽しむ</h3>
          <p>
            イン逃げ・女子戦・5号艇を、
            3人の担当キャラクターが紹介します。
          </p>
        </div>
      </div>

      <div className="aboutFeatureCard aboutFeatureCard--blue">
        <span className="aboutFeatureIcon" aria-hidden="true">
          📖
        </span>

        <div>
          <h3>ボートレースを学ぶ</h3>
          <p>
            初心者講座や24場攻略を通して、
            レースの見方を分かりやすく解説します。
          </p>
        </div>
      </div>

      <div className="aboutFeatureCard aboutFeatureCard--yellow">
        <span className="aboutFeatureIcon" aria-hidden="true">
          ♪
        </span>

        <div>
          <h3>動画やラジオで楽しむ</h3>
          <p>
            漫画、ショート動画、ラジオなど、
            気軽に楽しめる番組を配信しています。
          </p>
        </div>
      </div>
    </div>
  </div>
</section>

{/* ========================================
    通常フッターサイトマップ
======================================== */}
<footer className="siteFooter">
  <div className="siteFooterInner">
   

    <nav className="footerSitemap" aria-label="フッターサイトマップ">
      <div className="footerLinkGroup">
        <h2>予想を見る</h2>

        <a href="/">ホーム</a>
        <a href="/races">本日の出走表</a>
        <a href="/ichika">一果のイン逃げ予想</a>
        <a href="/hatsune">初音の女子戦攻略</a>
        <a href="/kiina">キイナの5号艇予想</a>
        <a href="/bsc2">BSC</a>
      </div>

      <div className="footerLinkGroup">
        <h2>学ぶ・楽しむ</h2>

        <a href="/library">一果図書館</a>
        <a href="/guide">ボートレース初心者ガイド</a>
        <a href="/library/stadiums">全国24場攻略</a>
        <a href="/ichika-sensei">教えて！一果センセー</a>
        <a href="/comic">ふなけん研究部</a>
        <a href="/radio">ボート・ナイト・ニッポン</a>
        <a href="/schedule">番組表</a>
      </div>

      <div className="footerLinkGroup">
        <h2>サイト案内</h2>

        <a href="/about">BoatStrikersについて</a>
        <a href="/sitemap">サイトマップ</a>
        <a href="/contact">お問い合わせ</a>
        <a href="/privacy">プライバシーポリシー</a>
        <a href="/terms">利用規約</a>
        <a href="/disclaimer">免責事項</a>
      </div>
    </nav>

    <div className="footerNotice">
      <p>
        当サイトに掲載している予想や情報は、
        的中および利益を保証するものではありません。
      </p>

      <p>
        舟券の購入は20歳になってから。
        無理のない範囲でボートレースをお楽しみください。
      </p>
    </div>
  </div>
</footer>

</main>
  );
}
