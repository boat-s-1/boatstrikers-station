import Image from "next/image";
import Parser from "rss-parser";
import BookCard from "./BookCard";

async function getLibraryItems() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items.slice(0, 8).map((item) => {
    const image =
      item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
      "/library-banner.jpg";

    return {
      title: item.title,
      link: item.link,
      date: item.pubDate,
      image,
    };
  });
}

const books = [
  {
  title: "無料新聞",
  icon: "📰",
  text: "前日版を毎日更新！",
  href: "/library/free",
  className: "greenBook",
  cover: "/free-book-cover.jpg",
},
  {
    title: "有料新聞",
    icon: "💎",
    text: "前日版・直前版はこちら",
    href: "#premium",
    className: "blueBook",
  },
  {
    title: "一果ゼミ",
    icon: "🔬",
    text: "イン逃げ研究はこちら",
    href: "#seminar",
    className: "purpleBook",
  },
  {
    title: "Radio",
    icon: "🎙",
    text: "過去ラジオを聴く",
    href: "/radio",
    className: "redBook",
  },
  {
    title: "成績・データ",
    icon: "📊",
    text: "的中実績をチェック",
    href: "#results",
    className: "brownBook",
  },
  {
    title: "特典資料",
    icon: "🎁",
    text: "PDF・チェックリスト",
    href: "#bonus",
    className: "tealBook",
  },
];

export default async function LibraryPage() {
  const items = await getLibraryItems();

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

      <section className="libraryHero">
        <div>
          <h1>📚 一果図書館</h1>
          <p>過去の新聞や研究記事をチェックしよう！</p>
          <span>知識があなたの勝率を変える</span>
        </div>
        <Image
          src="/ichika-icon.png"
          alt="一果図書館"
          width={300}
          height={300}
          className="libraryHeroChar"
        />
      </section>

     <section className="woodShelfWrap">
  <div className="woodShelfTitle">📚 本棚から選んでね</div>

  <div className="woodShelf">
    {books.map((book) => (
      <BookCard key={book.title} book={book} />
    ))}
  </div>

  <div className="shelfBoard"></div>
</section>

      <section className="librarySection" id="free">
        <div className="libraryTitleRow">
          <h2>📖 最新追加</h2>
          <a href="https://note.com/boat_strikers" target="_blank">
            もっと見る ›
          </a>
        </div>

        <div className="latestBooks">
          {items.map((item) => (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="latestBookCard"
              key={item.link}
            >
              <img src={item.image} alt={item.title} />
              <h3>{item.title}</h3>
              <p>{new Date(item.date).toLocaleDateString("ja-JP")}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="librarySection">
        <h2>👑 人気ランキング</h2>

        <div className="rankingList">
          <a href="/ichika" className="rankingItem">
            <span>🥇</span>
            <div>
              <strong>一果ゼミ 第1回</strong>
              <p>イン逃げの基本を完全解説！</p>
            </div>
          </a>

          <a href="/hatsune" className="rankingItem">
            <span>🥈</span>
            <div>
              <strong>初音ゼミ 第3回</strong>
              <p>女子戦の狙い方を徹底解説！</p>
            </div>
          </a>

          <a href="/kiina" className="rankingItem">
            <span>🥉</span>
            <div>
              <strong>キイナゼミ 第5回</strong>
              <p>5アタマで高配当を狙う条件</p>
            </div>
          </a>
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
