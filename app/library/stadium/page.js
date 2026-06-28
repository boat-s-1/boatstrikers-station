import Parser from "rss-parser";

export default async function StadiumPage({ searchParams }) {
  const place = searchParams?.place || "住之江";

  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const articles = feed.items
    .filter((item) => item.title.includes(place))
    .slice(0, 20)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        "/book-24-stadiums.jpg";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });

  return (
    <main className="libraryPage">
      <header className="header">
        <div className="logo">
          BOAT<br />
          <span>STRIKERS</span>
        </div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className="librarySection">
        <h2>📘 {place}攻略ノート</h2>
        <p className="stadiumLead">
          note内の「{place}」を含む攻略記事をまとめています。
        </p>
      </section>

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>📖 最新記事</h2>
          <a href="/library/stadiums">24場本棚へ戻る ›</a>
        </div>

        <div className="stadiumArticleList">
          {articles.map((article) => (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="stadiumArticleCard"
              key={article.link}
            >
              <img src={article.image} alt={article.title} />

              <div>
                <span>{place}</span>
                <h3>{article.title}</h3>
                <p>{new Date(article.date).toLocaleDateString("ja-JP")}</p>
                <b>noteで読む ›</b>
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
