export default function RadioPage() {
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

      <section className="radioHero">
        <img
          src="/radio-banner.jpg"
          alt="Boat Strikers Radio"
          className="radioHeroImage"
        />

        <div className="radioHeroText">
          <span>視聴覚コーナー</span>
          <h1>Boat Strikers Radio</h1>
          <p>
            一果・初音・キイナが競艇の考え方や反省会をゆるく配信中！
          </p>
        </div>
      </section>

      <section className="librarySection">
        <h2>🎧 最新ラジオを聴く</h2>

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
          className="radioYoutubeBtn"
        >
          YouTubeでラジオ一覧を見る ›
        </a>
      </section>

  

      <section className="librarySection">
        <h2>📚 関連コンテンツ</h2>

        <div className="relatedBookList">
          <a href="/library/ichika-seminar">🌸 一果ゼミを見る ›</a>
          <a href="/library/hatsune-seminar">💜 初音ゼミを見る ›</a>
          <a href="/library/kiina-seminar">⚡ キイナゼミを見る ›</a>
          <a href="/library">📚 図書館へ戻る ›</a>
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
