import Image from "next/image";
import Parser from "rss-parser";

async function getResults() {
  const res = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXTDYLkLLIXFG8zuoonKBfMOEEan5zlthcP0GXXbRj85e9JHcbZMZzIjEAXxjwEgS-lQTEOsqNbDdp/pub?output=csv",
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

async function getKiinaNewspaper() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const item = feed.items.find((item) =>
    item.title.includes("【キイナ前日版】")
  );

  if (!item) return null;

  const image =
    item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
    "/kiina-banner.jpg";

  return {
    title: item.title,
    link: item.link,
    date: item.pubDate,
    image,
  };
}

async function getKiinaArticles() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【キイナゼミ"))
    .slice(0, 6)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || "";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });
}

export default async function KiinaPage() {
  const articles = await getKiinaArticles();
  const newspaper = await getKiinaNewspaper();
  const results = await getResults();
const result = results.find((r) => r.name === "kiina");

  return (
    <main className="page kiinaPage">
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

      <section className="hero">
        <Image
          src="6D4CA65A-8CA7-403B-AF8D-C4A6581C423F.png"
          alt="キイナ"
          width={1536}
          height={864}
          className="heroImage"
          priority
        />
      </section>

      <section className="sectionCard yellowCard">
        <h2>📰 今日のキイナ新聞（前日版）</h2>

        {newspaper ? (
          <a
            href={newspaper.link}
            target="_blank"
            rel="noopener noreferrer"
            className="newsFeature"
          >
            <img
              src={newspaper.image}
              alt={newspaper.title}
              className="featureImg"
            />

            <div>
              <h3>{newspaper.title}</h3>
              <p>{new Date(newspaper.date).toLocaleDateString("ja-JP")}</p>
              <span className="yellowBtn">📖 新聞を読む</span>
            </div>
          </a>
        ) : (
          <p>今日のキイナ新聞はまだありません。</p>
        )}
      </section>

      <section className="sectionCard">
        <h2>キイナの5アタマ予想ツール（β版）</h2>
        <a
          href="https://www.boat-strike.com/kiina5.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="A81A852F-2EF6-4045-B5B9-EFBDB078636D.png"
            alt="キイナ5アタマ予想ツール"
            width={1536}
            height={864}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "20px",
            }}
          />
        </a>
      </section>

      {result && (
  <section className="sectionCard purpleCard">
    <h2>🏆 今月の成績</h2>

    <div className="recordGrid">
      <div className="recordCard">
        <span>予想レース数</span>
        <strong>{result.raceCount}R</strong>
        <p>今月の予想数</p>
      </div>

      <div className="recordCard">
        <span>的中率</span>
        <strong>{result.hitRate}%</strong>
        <p>的中データ</p>
      </div>

      <div className="recordCard">
        <span>回収率</span>
        <strong>{result.returnRate}%</strong>
        <p>回収データ</p>
      </div>

      <div className="recordCard">
        <span>最高配当</span>
        <strong>{result.bestHit}</strong>
        <p>今月最高配当</p>
      </div>
    </div>
  </section>
)}

      <section className="sectionCard yellowCard">
        <div className="sectionTitleRow">
          <h2>🔬 穴党ラボ</h2>
          <a
            href="https://note.com/boat_strikers"
            target="_blank"
            rel="noopener noreferrer"
          >
            noteで見る ›
          </a>
        </div>

        <div className="labList">
          {articles.map((article) => (
            <a
              key={article.link}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="labItem"
            >
              <img
                src={article.image || "/kiina-banner.jpg"}
                alt={article.title}
              />

              <div>
                <h3>{article.title}</h3>
                <small>
                  {new Date(article.date).toLocaleDateString("ja-JP")}
                </small>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="sectionCard yellowCard">
        <div className="sectionTitleRow">
          <h2>🎙 Boat Strikers Radio</h2>

          <a
            href="https://www.youtube.com/@boatstrikers_official"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTubeへ ›
          </a>
        </div>

        <p className="radioLead">
          キイナが高配当狙い・5アタマの考え方・穴党反省会を配信中！
        </p>

        <div className="radioPlayer">
          <iframe
            width="100%"
            height="240"
            src="https://www.youtube.com/embed/videoseries?list=プレイリストID"
            title="Boat Strikers Radio"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <a
          href="https://www.youtube.com/@boatstrikers_official"
          target="_blank"
          rel="noopener noreferrer"
          className="yellowBtn fullBtn"
        >
          🎙 ラジオ一覧を見る
        </a>
      </section>

      <section className="sectionCard lineBannerCard">
        <a
          href="https://lin.ee/Pf3FEEQ"
          target="_blank"
          rel="noopener noreferrer"
          className="lineBannerLink"
        >
          <img
            src="C5AD4F38-3CAF-4C4D-9A4A-8313644E05BB.png"
            alt="公式LINE登録"
            className="lineBannerImage"
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
