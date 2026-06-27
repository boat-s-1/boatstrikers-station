import Image from "next/image";
import Parser from "rss-parser";

async function getHatsuneNewspaper() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const item = feed.items.find((item) =>
    item.title.includes("【初音前日版】")
  );

  if (!item) return null;

  const image =
    item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
    "/hatsune-banner.jpg";

  return {
    title: item.title,
    link: item.link,
    date: item.pubDate,
    image,
  };
}

async function getHatsuneArticles() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【初音ゼミ"))
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

export default async function HatsunePage() {
  const articles = await getHatsuneArticles();
  const newspaper = await getHatsuneNewspaper();

  return (
    <main className="page hatsunePage">
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
          src="8A7A7A27-B954-4A3F-9DC3-52DB3DCE80AB.png"
          alt="初音"
          width={1536}
          height={864}
          className="heroImage"
          priority
        />
      </section>

      <section className="sectionCard purpleCard">
        <h2>📰 今日の初音新聞（前日版）</h2>

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
              <span className="purpleBtn">📖 新聞を読む</span>
            </div>
          </a>
        ) : (
          <p>今日の初音新聞はまだありません。</p>
        )}
      </section>

      <section className="sectionCard">
        <h2>初音の女子戦データツール（β版）</h2>
        <a
          href="https://www.boat-strike.com/hastune"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/hatsune-tool-banner.png"
            alt="初音女子戦データツール"
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

      <section className="sectionCard purpleCard">
        <h2>🏆 今月の成績</h2>
        <p className="recordLead purpleLead">
          データが証明する、初音の女子戦分析力！
        </p>

        <div className="recordGrid">
          <div className="recordCard">
            <span>予想レース数</span>
            <strong>38R</strong>
            <p>今月の予想数</p>
          </div>

          <div className="recordCard">
            <span>的中率</span>
            <strong>68%</strong>
            <p>的中レース数 26R</p>
          </div>

          <div className="recordCard">
            <span>回収率</span>
            <strong>119%</strong>
            <p>収支 +31,800円</p>
          </div>

          <div className="recordCard">
            <span>最高配当</span>
            <strong>21,560円</strong>
            <p>6/24 戸田8R</p>
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
              <img src="/hatsune-hit-0624.jpg" alt="6/24 戸田8R 的中" />
              <div>
                <span>6/24 戸田8R</span>
                <b>2-1-4</b>
                <strong>21,560円</strong>
              </div>
            </a>

            <a
              href="https://x.com/boatstrikers_official"
              target="_blank"
              rel="noopener noreferrer"
              className="hitImageCard"
            >
              <img src="/hatsune-hit-0621.jpg" alt="6/21 尼崎5R 的中" />
              <div>
                <span>6/21 尼崎5R</span>
                <b>1-3-5</b>
                <strong>12,940円</strong>
              </div>
            </a>

            <a
              href="https://x.com/boatstrikers_official"
              target="_blank"
              rel="noopener noreferrer"
              className="hitImageCard"
            >
              <img src="/hatsune-hit-0618.jpg" alt="6/18 多摩川6R 的中" />
              <div>
                <span>6/18 多摩川6R</span>
                <b>3-1-2</b>
                <strong>9,860円</strong>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="sectionCard purpleCard">
        <div className="sectionTitleRow">
          <h2>🔬 女子戦研究ラボ</h2>
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
                src={article.image || "/hatsune-banner.jpg"}
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

      <section className="sectionCard purpleCard">
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
          初音が女子戦の流れやデータの見方をやさしく解説♪
          一果・キイナとの掛け合いも配信中！
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
          className="purpleBtn fullBtn"
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
            src="90F7EE0F-5EE8-4E71-BF86-D254BB00750D.png"
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
