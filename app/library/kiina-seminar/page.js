import Parser from "rss-parser";

async function getKiinaSeminarArticles() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【キイナゼミ"))
    .slice(0, 12)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        "/6716D6BF-80F0-415A-BC81-0270FB704655.png";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });
}

export default async function KiinaSeminarPage() {
  const articles = await getKiinaSeminarArticles();

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

      <section className="magazineHero kiinaMagazineHero">
        <img
          src="/6716D6BF-80F0-415A-BC81-0270FB704655.png"
          alt="キイナゼミ"
          className="magazineHeroCover"
        />

        <div className="magazineInfo">
          <span>週刊誌コーナー</span>

          <h1>キイナゼミ</h1>

          <p>
            5アタマ・穴狙い・高配当レースを
            キイナがわかりやすく解説する攻略マガジンです。
          </p>
        </div>
      </section>

      <section className="librarySection">
        <h2>📖 この本で学べること</h2>

        <div className="tocGrid">
          <div>⚡ 5アタマ攻略</div>
          <div>💰 高配当レースの探し方</div>
          <div>📊 穴データ分析</div>
          <div>🎯 狙い目レース厳選</div>
        </div>
      </section>

      <section className="librarySection">

        <div className="libraryTitleRow">
          <h2>📑 キイナゼミ バックナンバー</h2>

          <a href="/library">
            図書館へ戻る ›
          </a>
        </div>

        <div className="seminarArticleList">

          {articles.map((article) => (

            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="seminarArticleCard kiinaArticleCard"
              key={article.link}
            >

              <img
                src={article.image}
                alt={article.title}
              />

              <div>

                <span>キイナゼミ</span>

                <h3>{article.title}</h3>

                <p>
                  {new Date(article.date).toLocaleDateString("ja-JP")}
                </p>

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
