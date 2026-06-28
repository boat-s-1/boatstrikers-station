import Parser from "rss-parser";

const members = {
  ichika: {
    name: "一果",
    title: "一果予想新聞",
    keyword: "【一果前日版】",
    colorClass: "ichikaNews",
    fallbackImage: "/C53B3EAC-3CBA-411D-BCFF-4C67354CC424.png",
  },
  hatsune: {
    name: "初音",
    title: "初音予想新聞",
    keyword: "【初音前日版】",
    colorClass: "hatsuneNews",
    fallbackImage: "/CEC84877-EB43-475D-91B3-191609F7E0FF.png",
  },
  kiina: {
    name: "キイナ",
    title: "キイナ予想新聞",
    keyword: "【キイナ前日版】",
    colorClass: "kiinaNews",
    fallbackImage: "/1EFC4DE6-E17F-40BE-96CE-24C5C640DE24.png",
  },
};

export default async function NewsBackNumberPage({ params }) {
  const memberKey = params.member;
  const member = members[memberKey] || members.ichika;

  const parser = new Parser();
  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const articles = feed.items
    .filter((item) => item.title.includes(member.keyword))
    .slice(0, 30)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
        member.fallbackImage;

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });

  const latest = articles[0];
  const backNumbers = articles.slice(1);

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

      <section className={`newsBackHero ${member.colorClass}`}>
        <img src={member.fallbackImage} alt={member.title} />

        <div>
          <span>バックナンバー</span>
          <h1>{member.title}</h1>
          <p>{member.name}の過去新聞をまとめてチェックできます。</p>
        </div>
      </section>

      {latest && (
        <section className="librarySection">
          <h2>🆕 最新号</h2>

          <a
            href={latest.link}
            target="_blank"
            rel="noopener noreferrer"
            className="latestIssueCard"
          >
            <img src={latest.image} alt={latest.title} />

            <div>
              <span>NEW</span>
              <h3>{latest.title}</h3>
              <p>{new Date(latest.date).toLocaleDateString("ja-JP")}</p>
              <b>最新号を読む ›</b>
            </div>
          </a>
        </section>
      )}

      <section className="librarySection">
        <div className="libraryTitleRow">
          <h2>🗞 バックナンバー</h2>
          <a href="/library">図書館へ戻る ›</a>
        </div>

        <div className="newsBackGrid">
          {backNumbers.length > 0 ? (
            backNumbers.map((article) => (
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="newsBackCard"
                key={article.link}
              >
                <img src={article.image} alt={article.title} />
                <h3>{article.title}</h3>
                <p>{new Date(article.date).toLocaleDateString("ja-JP")}</p>
                <b>読む ›</b>
              </a>
            ))
          ) : (
            <p className="stadiumLead">まだバックナンバーはありません。</p>
          )}
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
