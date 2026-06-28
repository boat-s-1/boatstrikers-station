import Parser from "rss-parser";

const stadiums = [
  "桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖",
  "蒲郡", "常滑", "津", "三国", "びわこ", "住之江",
  "尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山",
  "下関", "若松", "芦屋", "福岡", "唐津", "大村",
];

async function getLatestStadiumArticles() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) =>
      stadiums.some((place) => item.title.includes(`【${place}場攻略】`))
    )
    .slice(0, 5)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        "/book-24-stadiums.jpg";

      const place =
        stadiums.find((s) => item.title.includes(`【${s}場攻略】`)) ||
        "攻略";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
        place,
      };
    });
}

export default async function StadiumsPage() {
  const latest = await getLatestStadiumArticles();

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

      <section className="magazineHero">
        <img
          src="/book-24-stadiums.jpg"
          alt="24場攻略ノート"
          className="magazineHeroCover"
        />

        <div className="magazineInfo">
          <span>攻略本コーナー</span>
          <h1>24場攻略ノート</h1>
          <p>全国24場の特徴・水面・荒れやすさを学べる攻略本棚です。</p>
        </div>
      </section>

      <section className="librarySection">
        <h2>🆕 最新攻略記事</h2>

        <div className="stadiumLatestScroll">
          {latest.map((article) => (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="stadiumLatestCard"
              key={article.link}
            >
              <img src={article.image} alt={article.title} />
              <span>{article.place}</span>
              <h3>{article.title}</h3>
              <p>{new Date(article.date).toLocaleDateString("ja-JP")}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="libraryShelfSection">
        <h2>📚 全国24場 本棚</h2>
        <p>気になる場の攻略ノートを開こう！</p>

        <div className="stadiumSpineShelf">
          {stadiums.map((name, index) => (
            <a
              href={`/library/stadium/${encodeURIComponent(name)}`}
              className="stadiumSpineBook"
              key={name}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{name}</strong>
            </a>
          ))}
        </div>

        <div className="shelfBoard"></div>
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
