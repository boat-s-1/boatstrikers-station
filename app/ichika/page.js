import Image from "next/image";
import Parser from "rss-parser";
import HitGallery from "../components/HitGallery";

async function getResults() {
  const res = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXTDYLkLLIXFG8zuoonKBfMOEEan5zlthcP0GXXbRj85e9JHcbZMZzIjEAXxjwEgS-lQTEOsqNbDdp/pub?output=csv",
    { next: { revalidate: 300 } }
  );

  const text = await res.text();
  const rows = text.trim().split(/\r?\n/).slice(1);

  return rows
    .map((row) => {
      const cols = row
        .split(",")
        .map((v) => v.trim().replace(/^"|"$/g, ""));

      return {
        name: cols[0],
        raceCount: cols[1],
        hitRate: cols[2],
        returnRate: cols[3],
        profit: cols[4],
        bestHit: cols[5],
        updated: cols[6],

        hits: [
          {
            image: cols[7],
            title: cols[8],
            race: cols[9],
            note: cols[10],
          },
          {
            image: cols[11],
            title: cols[12],
            race: cols[13],
            note: cols[14],
          },
          {
            image: cols[15],
            title: cols[16],
            race: cols[17],
            note: cols[18],
          },
        ].filter((h) => h.image),
      };
    })
    .filter((r) => ["ichika", "hatsune", "kiina"].includes(r.name));
}

async function getIchikaNewspaper() {
  const parser = new Parser();

  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const item = feed.items.find((item) =>
    item.title.includes("【一果前日版】")
  );

  if (!item) return null;

  const image =
    item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || "/ichika-banner.jpg";

  return {
    title: item.title,
    link: item.link,
    date: item.pubDate,
    image,
  };
}

const articles = await getIchikaArticles();
const newspaper = await getIchikaNewspaper();

async function getIchikaArticles() {
  const parser = new Parser();

  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【一果ゼミ"))
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

export default async function IchikaPage() {
  const articles = await getIchikaArticles();
  const results = await getResults();
const result = results.find((r) => r.name === "ichika");

  return (
    <main className="page ichikaPage">
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
          src="/7562660D-EB9C-4981-A1D1-789E6211DACA.png"
          alt="一果"
          width={1536}
          height={2048}
          className="heroImage"
          priority
        />
      </section>


            
     <section className="sectionCard pinkCard">
            
   <img
  src="/IMG_6130.jpeg"
  alt="一果新聞"
  className="homeTitleImage"
/>

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
        <span className="pinkBtn">📖 新聞を読む</span>
      </div>
    </a>
  ) : (
    <p>今日の一果新聞はまだありません。</p>
  )}
</section>

<section className="sectionCard">
    <h2>一果のイン逃げツール（β版）</h2>
  <a
    href="https://www.boat-strike.com/ichika"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src="/F7854611-D2F7-4CF6-B549-FDB9F581F530.png"
      alt="一果鬼絞り判定所"
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
    
   <section className="sectionCard pinkCard">
   <img
  src="/IMG_6131.jpeg"
  alt="一果成績"
  className="homeTitleImage"
/>

  {result && (
    <>
      <p className="recordLead">
        最終更新：{result.updated}
      </p>

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
    </>
  )}
    <HitGallery hits={result.hits} />
</section>

 <section className="sectionCard pinkCard">
  <div className="sectionTitleRow">
    <h2>🔬 イン飛び研究ラボ</h2>
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
          src={article.image || "/ichika-banner.jpg"}
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

    <section className="sectionCard pinkCard">
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
    一果・初音・キイナがお届けする競艇ラジオ♪
    イン飛び研究や女子戦考察、穴党反省会を配信中！
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
    className="pinkBtn fullBtn"
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
      src="1946131E-2FFC-48F9-B850-AB6164F6220C.png"
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
