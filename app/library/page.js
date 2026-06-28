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

const sections = [
  {
    title: "📰 週刊誌コーナー",
    lead: "3人のゼミをまとめてチェック！",
    books: [
      {
        title: "一果ゼミ",
        icon: "🌸",
        text: "イン逃げ研究",
        href: "/library/ichika-seminar",
        className: "greenBook",
        cover: "/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png",
        inside: "/0624D4E1-6C05-4F40-9439-2A093A1B0F0D.png",
      },
      {
        title: "初音ゼミ",
        icon: "💜",
        text: "女子戦研究",
        href: "/library/hatsune-seminar",
        className: "purpleBook",
        cover: "/D5E40BCC-AA6E-4347-B86B-9D0FE4BF4833.png",
        inside: "/2906B318-96E8-4CE9-AA58-2591BC5F6007.png",
      },
      {
        title: "キイナゼミ",
        icon: "⚡",
        text: "穴党研究",
        href: "/library/kiina-seminar",
        className: "yellowBook",
        cover: "/6716D6BF-80F0-415A-BC81-0270FB704655.png",
        inside: "/4A1DFE79-8D3F-4D28-BFCA-E97C36B752D2.png",
      },
    ],
  },
  {
    title: "📘 攻略本コーナー",
    lead: "全国24場の特徴を学ぼう！",
    books: [
      {
        title: "24場攻略ノート",
        icon: "📘",
        text: "場別攻略",
        href: "/library/stadiums",
        className: "blueBook",
        cover: "/book-24-stadiums.jpg",
      },
    ],
  },
  {
    title: "🗞 バックナンバー",
    lead: "過去の予想新聞はこちら！",
    books: [
      {
        title: "一果予想新聞",
        icon: "🌸",
        text: "イン逃げ新聞",
        href: "/library/ichika-news",
        className: "greenBook",
        cover: "/C53B3EAC-3CBA-411D-BCFF-4C67354CC424.png",
      },
      {
        title: "初音予想新聞",
        icon: "💜",
        text: "女子戦新聞",
        href: "/library/hatsune-news",
        className: "purpleBook",
        cover: "/CEC84877-EB43-475D-91B3-191609F7E0FF.png",
      },
      {
        title: "キイナ予想新聞",
        icon: "⚡",
        text: "5アタマ新聞",
        href: "/library/kiina-news",
        className: "yellowBook",
        cover: "/1EFC4DE6-E17F-40BE-96CE-24C5C640DE24.png",
      },
    ],
  },
  {
    title: "🎙 視聴覚コーナー",
    lead: "Boat Strikers Radioを聴く！",
    books: [
      {
        title: "Radio",
        icon: "🎙",
        text: "ラジオ一覧",
        href: "/radio",
        className: "redBook",
        cover: "/book-radio.jpg",
      },
    ],
  },
  {
    title: "📊 資料室",
    lead: "成績・データ・特典資料はこちら！",
    books: [
      {
        title: "成績データ",
        icon: "📊",
        text: "的中実績",
        href: "/library/results",
        className: "brownBook",
        cover: "/book-results.jpg",
      },
      {
        title: "特典資料",
        icon: "🎁",
        text: "PDF資料",
        href: "/library/bonus",
        className: "tealBook",
        cover: "/book-bonus.jpg",
      },
    ],
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
          <p>新聞・ゼミ・攻略本を本棚から探そう！</p>
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

      {sections.map((section) => (
        <section className="libraryShelfSection" key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.lead}</p>

          <div className="woodShelf">
            {section.books.map((book) => (
              <BookCard key={book.title} book={book} />
            ))}
          </div>

          <div className="shelfBoard"></div>
        </section>
      ))}

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>📖 最新追加</h2>
          <a
            href="https://note.com/boat_strikers"
            target="_blank"
            rel="noopener noreferrer"
          >
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
