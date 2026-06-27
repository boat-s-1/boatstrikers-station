import Image from "next/image";
import Parser from "rss-parser";

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
            src="/kiina-tool-banner.png"
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

      <section className="sectionCard yellowCard">
        <h2>🏆 今月の成績</h2>
        <p className="recordLead yellowLead">
          高配当をぶち抜く、キイナの穴党戦績！
        </p>

        <div className="recordGrid">
          <div className="recordCard">
            <span>予想レース数</span>
            <strong>35R</strong>
            <p>今月の予想数</p>
          </div>

          <div className="recordCard">
            <span>的中率</span>
            <strong>42%</strong>
            <p>的中レース数 15R</p>
          </div>

          <div className="recordCard">
            <span>回収率</span>
            <strong>148%</strong>
            <p>収支 +68,900円</p>
          </div>

          <div className="recordCard">
            <span>最高配当</span>
            <strong>52,300円</strong>
            <p>6/23 若松11R</p>
          </div>
        </div>

        <div className="hitRaceBox">
          <div className="sectionTitleRow">
            <h3>🎯 今月の主な的中</h3>
            <a
              href="https://x.com/boatstrikers_official"
              target="_blank"
              rel="noopener noreferrer"
            >
              Xで見る ›
            </a>
          </div>

          <div className="hitImageList">
            <a
              href="https://x.com/boatstrikers_official"
              target="_blank"
              rel="noopener noreferrer"
              className="hitImageCard"
            >
              <img src="/kiina-hit-0623.jpg" alt="6/23 若松11R 的中" />
              <div>
                <span>6/23 若松11R</span>
                <b>5-1-3</b>
                <strong>52,300円</strong>
              </div>
            </a>

            <a
              href="https://x.com/boatstrikers_official"
              target="_blank"
              rel="noopener noreferrer"
              className="hitImageCard"
            >
              <img src="/kiina-hit-0619.jpg" alt="6/19 桐生10R 的中" />
              <div>
                <span>6/19 桐生10R</span>
                <b>5-2-1</b>
                <strong>24,380円</strong>
              </div>
            </a>

            <a
              href="https://x.com/boatstrikers_official"
              target="_blank"
              rel="noopener noreferrer"
              className="hitImageCard"
            >
              <img src="/kiina-hit-0615.jpg" alt="6/15 津9R 的中" />
              <div>
                <span>6/15 津9R</span>
                <b>5-3-2</b>
                <strong>18,650円</strong>
              </div>
            </a>
          </div>
        </div>
      </section>

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
            src="/line-banner.jpg"
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
