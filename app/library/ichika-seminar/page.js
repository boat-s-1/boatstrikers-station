import Parser from "rss-parser";

async function getIchikaSeminarArticles() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【一果ゼミ"))
    .slice(0, 12)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        "/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });
}

export default async function IchikaSeminarPage() {
  const articles = await getIchikaSeminarArticles();
  const latest = articles[0];
  const backNumbers = articles.slice(1);

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

      <section className="magazineHero">
        <img
          src="/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png"
          alt="一果ゼミ"
          className="magazineHeroCover"
        />

        <div className="magazineInfo">
          <span>週刊誌コーナー</span>
          <h1>一果ゼミ</h1>
          <p>毎週更新。イン逃げ・イン飛びの研究マガジンです。</p>
        </div>
      </section>

      {latest && (
        <section className="librarySection latestIssueBox">
          <h2>🌸 最新号</h2>

          <a
            href={latest.link}
            target="_blank"
            rel="noopener noreferrer"
            className="latestIssueCard"
          >
            <img src={latest.image} alt={latest.title} />

            <div>
              <span>NEW</span>
              <h3>{latest.title}</h3>
              <p>{new Date(latest.date).toLocaleDateString("ja-JP")}</p>
              <b>最新号を読む ›</b>
            </div>
          </a>
        </section>
      )}

      <section className="librarySection">
        <h2>📑 今週の目次</h2>

        <div className="tocGrid">
          <div>🌸 イン逃げ危険度チェック</div>
          <div>🚤 展示タイムの見方</div>
          <div>📊 モーター評価ポイント</div>
          <div>🎯 今週の注目レース</div>
        </div>
      </section>

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>📚 バックナンバー</h2>
          <a href="/library">図書館へ戻る ›</a>
        </div>

        <div className="backNumberScroll">
          {backNumbers.map((article) => (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="backNumberCard"
              key={article.link}
            >
              <img src={article.image} alt={article.title} />
              <h3>{article.title}</h3>
              <p>{new Date(article.date).toLocaleDateString("ja-JP")}</p>
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
