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

      <section className="section">
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

          <section className="section todayNewsSection">
  <h2>📰 今日の新聞</h2>
  <p className="todayNewsLead">一果・初音・キイナの最新前日版をチェック！</p>

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

      <section className="section">
        <a href="/ichika" className="bannerLink">
          <Image
            src="/ichika-banner.jpg"
            alt="一果の部屋"
            width={1536}
            height={1080}
            className="bannerImage"
          />
        </a>

        <a href="/hatsune" className="bannerLink">
          <Image
            src="/hatsune-banner.jpg"
            alt="初音の部屋"
            width={1536}
            height={1080}
            className="bannerImage"
          />
        </a>

        <a href="/kiina" className="bannerLink">
          <Image
            src="/kiina-banner.jpg"
            alt="キイナの部屋"
            width={1536}
            height={1080}
            className="bannerImage"
          />
        </a>
      </section>

 

      <section className="section">
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

      <section className="resultBox">
  <h2>🏆 今月の予想数</h2>
  <p>一果・初音・キイナが今月も予想を更新中！</p>

  <div className="forecastCountGrid">
    <a href="/ichika" className="forecastCountCard ichikaCount">
      <span>🌸 一果</span>
      <strong>42R</strong>
      <p>イン逃げ予想</p>
      <b>一果の成績を見る ›</b>
    </a>

    <a href="/hatsune" className="forecastCountCard hatsuneCount">
      <span>💜 初音</span>
      <strong>38R</strong>
      <p>女子戦予想</p>
      <b>初音の成績を見る ›</b>
    </a>

    <a href="/kiina" className="forecastCountCard kiinaCount">
      <span>⚡ キイナ</span>
      <strong>35R</strong>
      <p>5アタマ予想</p>
      <b>キイナの成績を見る ›</b>
    </a>
  </div>
</section>

      <section className="lineBox">
        <h2>LINE登録で<br />限定新聞をGET！</h2>
        <p>前日版・直前版・ラジオ情報を無料でお届けします。</p>
        <a href="https://lin.ee/Pf3FEEQ">LINEで受け取る</a>
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
