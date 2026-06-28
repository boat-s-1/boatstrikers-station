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
          <p>
            イン逃げ・イン飛びの考え方を、一果がわかりやすく解説する研究マガジンです。
          </p>
        </div>
      </section>

      <section className="librarySection">
        <h2>📖 この本で学べること</h2>

        <div className="tocGrid">
          <div>🌸 イン逃げの基本</div>
          <div>🚤 1号艇の信頼度</div>
          <div>📊 展示・モーター分析</div>
          <div>🎯 買い目の組み立て</div>
        </div>
      </section>

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>📑 一果ゼミ バックナンバー</h2>
          <a href="/library">図書館へ戻る ›</a>
        </div>

        <div className="seminarArticleList">
          {articles.map((article) => (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="seminarArticleCard"
              key={article.link}
            >
              <img src={article.image} alt={article.title} />

              <div>
                <span>一果ゼミ</span>
                <h3>{article.title}</h3>
                <p>{new Date(article.date).toLocaleDateString("ja-JP")}</p>
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
