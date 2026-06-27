import Image from "next/image";
import Parser from "rss-parser";

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

export default async function Home() {
  const news = await getTodayNewspapers();

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

      <section className="homeSectionCard blue">
  <h2 className="homeSectionTitle">🎙 BNN</h2>
  <p className="homeSectionLead">3人がお届けする競艇ラジオ♪</p>

  <a href="/radio" className="bannerLink">
    <Image
      src="/radio-banner.jpg"
      alt="BoatStrikers Radio"
      width={1536}
      height={864}
      className="bannerImage"
    />
  </a>
</section>

        <section className="homeSectionCard pink">
  <h2 className="homeSectionTitle">📰 今日の新聞</h2>
  <p className="homeSectionLead">最新の前日版をチェック！</p>

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
  <h2 className="homeSectionTitle">👧 メンバー紹介</h2>
  <p className="homeSectionLead">あなたに合った担当を見つけよう♪</p>

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
  <h2 className="homeSectionTitle">📚 一果図書館</h2>
  <p className="homeSectionLead">過去新聞をチェック！</p>

  <a href="/library" className="bannerLink">
    <Image
      src="/library-banner.jpg"
      alt="一果図書館"
      width={1536}
      height={864}
      className="bannerImage"
    />
  </a>
</section>

      <section className="homeSectionCard yellow">
  <h2 className="homeSectionTitle">🏆 今月の予想数</h2>
  <p className="homeSectionLead">
    今月も3人が予想を更新中！
  </p>

  <div className="forecastGrid">

    <a href="/ichika" className="forecastCard ichikaCard">
      <span>🌸 一果</span>
      <strong>42R</strong>
      <small>イン逃げ担当</small>
    </a>

    <a href="/hatsune" className="forecastCard hatsuneCard">
      <span>💜 初音</span>
      <strong>38R</strong>
      <small>女子戦担当</small>
    </a>

    <a href="/kiina" className="forecastCard kiinaCard">
      <span>⚡ キイナ</span>
      <strong>35R</strong>
      <small>5アタマ担当</small>
    </a>

  </div>
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
