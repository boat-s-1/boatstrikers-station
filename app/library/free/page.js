import Parser from "rss-parser";

async function getFreeNewspapers() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) =>
      item.title.includes("【一果前日版】") ||
      item.title.includes("【初音前日版】") ||
      item.title.includes("【キイナ前日版】")
    )
    .slice(0, 30)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        "/library-banner.jpg";

      let tag = "新聞";
      if (item.title.includes("一果")) tag = "🌸 一果";
      if (item.title.includes("初音")) tag = "💜 初音";
      if (item.title.includes("キイナ")) tag = "⚡ キイナ";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
        tag,
      };
    });
}

export default async function FreeLibraryPage() {
  const newspapers = await getFreeNewspapers();

  return (
    <main className="libraryPage">
      <header className="header">
        <div className="logo">
          BOAT
          <br />
          <span>STRIKERS</span>
        </div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className="libraryHero">
        <div>
          <h1>📰 無料新聞</h1>
          <p>一果・初音・キイナの前日版をまとめてチェック！</p>
          <span>毎日更新中</span>
        </div>
        <img
          src="/library-banner.jpg"
          alt="無料新聞"
          className="libraryHeroChar"
        />
      </section>

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>📖 最新の無料新聞</h2>
          <a href="/library">図書館へ戻る ›</a>
        </div>

        <div className="freeNewsList">
          {newspapers.map((item) => (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="freeNewsCard"
              key={item.link}
            >
              <img src={item.image} alt={item.title} />

              <div>
                <span>{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{new Date(item.date).toLocaleDateString("ja-JP")}</p>
                <b>読む ›</b>
              </div>
            </a>
          ))}
        </div>
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
