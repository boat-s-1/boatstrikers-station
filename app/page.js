import Image from "next/image";
import Parser from "rss-parser";


async function getResults() {
  const res = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXTDYLkLLIXFG8zuoonKBfMOEEan5zlthcP0GXXbRj85e9JHcbZMZzIjEAXxjwEgS-lQTEOsqNbDdp/pub?output=cs",
    { next: { revalidate: 300 } }
  );

  const text = await res.text();

  const rows = text.trim().split("\n").slice(1);

  return rows.map((row) => {
    const [
      name,
      raceCount,
      hitRate,
      returnRate,
      profit,
      bestHit,
      updated,
    ] = row.split(",");

    return {
      name,
      raceCount,
      hitRate,
      returnRate,
      profit,
      bestHit,
      updated,
    };
  });
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

export default async function Home() {
  const news = await getTodayNewspapers();
  const latestInfo = await getLatestInfo();
  const results = await getResults();

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
        <div className="heroText">
          <p>一果・初音・キイナの競艇放送局</p>
          <h1>3人の力で<br />一緒に勝ちにいこう！</h1>
          <a href="https://lin.ee/Pf3FEEQ" className="mainBtn">
            LINEで最新情報を受け取る
          </a>
        </div>
      </section>

            <section className="homeLatestInfo">
  <div className="homeLatestInfoTitle">
    <h2>🆕 最新情報</h2>
    <span>UPDATE</span>
  </div>

  <div className="homeLatestInfoList">
    {latestInfo.map((item) => (
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="homeLatestInfoItem"
        key={item.link}
      >
        <span>
          {new Date(item.date).toLocaleDateString("ja-JP", {
            month: "numeric",
            day: "numeric",
          })}
        </span>

        <strong>{item.category}</strong>

        <b>更新</b>
      </a>
    ))}
  </div>
</section>

      

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

  <a href="/ichika" className="bannerLink">
    <Image src="/ichika-banner.jpg" alt="一果の部屋" width={1536} height={1080} className="bannerImage" />
  </a>

  <a href="/hatsune" className="bannerLink">
    <Image src="/hatsune-banner.jpg" alt="初音の部屋" width={1536} height={1080} className="bannerImage" />
  </a>

  <a href="/kiina" className="bannerLink">
    <Image src="/kiina-banner.jpg" alt="キイナの部屋" width={1536} height={1080} className="bannerImage" />
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

   <section className="homeSectionCard yellow">
  <img
    src="/IMG_6116.jpeg"
    alt="今月の予想数"
    className="homeTitleImage"
  />

  <div className="forecastMemberList">
    {results.map((r) => {
      const names = {
        ichika: "一果",
        hatsune: "初音",
        kiina: "キイナ",
      };

      const roles = {
        ichika: "イン逃げ担当",
        hatsune: "女子戦担当",
        kiina: "5アタマ担当",
      };

      const classes = {
        ichika: "ichikaMember",
        hatsune: "hatsuneMember",
        kiina: "kiinaMember",
      };

      return (
        <a
          href={`/${r.name}`}
          className={`forecastMemberCard ${classes[r.name]}`}
          key={r.name}
        >
          <div>
            <span>{names[r.name]}</span>
            <strong>{r.raceCount}R</strong>
            <p>{roles[r.name]}</p>
            <b>成績を見る ›</b>
          </div>
        </a>
      );
    })}
  </div>
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

      <nav className="bottomNav">
        <a href="/">ホーム</a>
        <a href="/ichika">一果</a>
        <a href="/hatsune">初音</a>
        <a href="/kiina">キイナ</a>
        <a href="/library">図書館</a>
      </nav>
    </main>
  );
}
