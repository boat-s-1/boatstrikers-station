const stadiums = [
  "桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖",
  "蒲郡", "常滑", "津", "三国", "びわこ", "住之江",
  "尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山",
  "下関", "若松", "芦屋", "福岡", "唐津", "大村",
];

export default function StadiumsPage() {
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
          <p>
            全国24場の特徴・イン有利度・荒れやすさをまとめて学べる攻略本です。
          </p>
        </div>
      </section>

      <section className="librarySection">
        <h2>📖 この本で学べること</h2>

        <div className="tocGrid">
          <div>🚤 各場の水面特徴</div>
          <div>🌪 風・うねりの影響</div>
          <div>📊 イン有利度</div>
          <div>💰 荒れやすい場の見分け方</div>
        </div>
      </section>

      <section className="librarySection">
        <h2>🗾 全国24場一覧</h2>

        <div className="stadiumGrid">
          {stadiums.map((name, index) => (
            <a
              href={`/library/stadiums/${index + 1}`}
              className="stadiumCard"
              key={name}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{name}</strong>
              <b>攻略を見る ›</b>
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
