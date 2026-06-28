import Parser from "rss-parser";

async function getHatsuneSeminarArticles() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【初音ゼミ"))
    .slice(0, 12)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        "/D5E40BCC-AA6E-4347-B86B-9D0FE4BF4833.png";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });
}

export default async function HatsuneSeminarPage() {
  const articles = await getHatsuneSeminarArticles();

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

      <section className="magazineHero hatsuneMagazineHero">
        <img
          src="/D5E40BCC-AA6E-4347-B86B-9D0FE4BF4833.png"
          alt="初音ゼミ"
          className="magazineHeroCover"
        />

        <div className="magazineInfo">
          <span>週刊誌コーナー</span>
          <h1>初音ゼミ</h1>
          <p>
            女子戦のデータ・展開・狙い目を、初音がわかりやすく解説する研究マガジンです。
          </p>
        </div>
      </section>

      <section className="librarySection">
        <h2>📖 この本で学べること</h2>

        <div className="tocGrid">
          <div>💜 女子戦の基本</div>
          <div>🚤 女子レーサーの傾向</div>
          <div>📊 展示・モーター分析</div>
          <div>🎯 狙い目レースの見つけ方</div>
        </div>
      </section>

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>📑 初音ゼミ バックナンバー</h2>
          <a href="/library">図書館へ戻る ›</a>
        </div>

        <div className="seminarArticleList">
          {articles.map((article) => (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="seminarArticleCard hatsuneArticleCard"
              key={article.link}
            >
              <img src={article.image} alt={article.title} />

              <div>
                <span>初音ゼミ</span>
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
