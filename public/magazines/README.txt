BoatStrikers 雑誌画像の追加方法

1. 雑誌画像を public/magazines/<character>/<issue>/ に置きます。
   例:
   public/magazines/ichika/002/page-01.jpg
   public/magazines/ichika/002/page-02.jpg

2. lib/seminarMagazines.js の issues に新しい号を追加します。

例:
{
  id: "002",
  number: "第2号",
  title: "タイトル",
  date: "2026-08-31",
  cover: "/magazines/ichika/002/page-01.jpg",
  pages: [
    "/magazines/ichika/002/page-01.jpg",
    "/magazines/ichika/002/page-02.jpg",
    "/magazines/ichika/002/page-03.jpg"
  ],
  premiumFrom: 3
}

※ 現在のロック画面はデザイン確認用です。実際のYouTubeメンバー認証・パスワード認証は別途接続してください。
