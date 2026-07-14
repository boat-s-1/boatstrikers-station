import Image from "next/image";
import Parser from "rss-parser";
import BookCard from "./BookCard";
import LibraryPoint from "./LibraryPoint";

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

async function getLibraryNews() {
  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .slice(0, 20)
    .map((item) => {
      let category = "";

      if (item.title.includes("【一果ゼミ")) category = "🌸 一果ゼミ";
      if (item.title.includes("【初音ゼミ")) category = "💜 初音ゼミ";
      if (item.title.includes("【キイナゼミ")) category = "⚡ キイナゼミ";

      if (item.title.includes("場攻略】")) {
        const match = item.title.match(/【(.+?)場攻略】/);
        category = match ? `📘 ${match[1]}攻略` : "📘 24場攻略";
      }

      if (item.title.includes("【一果前日版】")) category = "🌸 一果新聞";
      if (item.title.includes("【初音前日版】")) category = "💜 初音新聞";
      if (item.title.includes("【キイナ前日版】")) category = "⚡ キイナ新聞";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        category,
      };
    })
    .filter((item) => item.category !== "")
    .slice(0, 5);
}

const sections = [
  {
    title: "週刊誌コーナー",
    lead: "3人のゼミをまとめてチェック！",
    titleImage: "/IMG_6091.jpeg",
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
    title: "攻略本コーナー",
    titleImage: "/IMG_6094.jpeg",
    books: [
      {
        title: "24場攻略ノート",
        icon: "📘",
        text: "場別攻略",
        href: "/library/stadiums",
        className: "blueBook",
        cover: "/9DB363E3-DA3D-44BE-BC88-26F3B23C6B3E.png",
        inside: "/B40F322B-2661-475E-8F36-519CD91A4F52.png",
      },
    ],
  },
  {
    title: "バックナンバー",
    titleImage: "/IMG_6095.jpeg",
    books: [
      {
        title: "一果予想新聞",
        icon: "🌸",
        text: "イン逃げ新聞",
        href: "/library/news/ichika",
        className: "greenBook",
        cover: "/C53B3EAC-3CBA-411D-BCFF-4C67354CC424.png",
        inside: "/50A928E2-55B4-4FEC-BE0E-6B890A37C4A4.png",
      },
      {
        title: "初音予想新聞",
        icon: "💜",
        text: "女子戦新聞",
        href: "/library/news/hatsune",
        className: "purpleBook",
        cover: "/796A2BB9-A731-4038-9A83-D00FF5F80DFD.png",
        inside: "/A8A98454-7463-489D-AF73-D23E8C3D9E98.png",
      },
      {
        title: "キイナ予想新聞",
        icon: "⚡",
        text: "5アタマ新聞",
        href: "/library/news/kiina",
        className: "yellowBook",
        cover: "/736ED09D-025E-4BF8-8215-81C0C0B9EA18.png",
        inside: "/CF5B266A-CA11-44D0-8DF1-31D4341D5928.png",
      },
    ],
  },
  {
    title: "🎙 視聴覚コーナー",
    titleImage: "/IMG_6424.jpeg",
    lead: "Boat Strikers Radioを聴く！",
    books: [
      {
        title: "Radio",
        icon: "🎙",
        text: "ラジオ一覧",
        href: "/radio",
        className: "redBook",
        cover: "/F49CB336-9539-4E68-B14F-460BB467597E.png",
        inside: "/433B2F45-DD7A-4503-A09E-309840D7E591.png",
      },
    ],
  },
  {
    title: "📊 資料室",
    titleImage: "/IMG_6425.jpeg",
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
  const news = await getLibraryNews();

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

      <section className="libraryHeroImageBox">
        <img
          src="/IMG_6098.jpeg"
          alt="一果図書館"
          className="libraryHeroImage"
        />
      </section>

      <section className="libraryNotice">
        <div className="libraryNoticeTitle">
          <img
          src="IMG_6319.jpeg"
            alt="新刊"
              className="libraryHeroImage"
              />
          
        </div>

        <div className="libraryNoticeList">
          {news.map((n) => (
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="libraryNoticeItem"
              key={n.link}
            >
              <span>
                {new Date(n.date).toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                })}
              </span>

              <strong>{n.category}</strong>

              <b>更新</b>
            </a>
          ))}
        </div>
      </section>

      <LibraryPoint />

      {sections.map((section) => (
        <section className="libraryShelfSection" key={section.title}>
          {section.titleImage ? (
            <img
              src={section.titleImage}
              alt={section.title}
              className="shelfTitleImage"
            />
          ) : (
            <>
              <h2>{section.title}</h2>
              <p>{section.lead}</p>
            </>
          )}

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
