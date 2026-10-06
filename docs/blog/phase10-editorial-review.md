# BLOG PHASE 10 — 試験記事の編集・出典確認

公開前のレビュー用。feature/blog-media-platform で作業を継続。本番DBへの書き込み・Migration適用は行わない。

## 試験記事と元教材

| 記事 | 元教材 | 再編集の狙い |
|---|---|---|
| 出走表の数字、何から読む？ | /guide/race-card、/guide/course-entry、/guide/exhibition | 3人が異なる視点から、情報の対象と確認順を整理 |
| イン逃げは1号艇だけでは決まらない | /guide/inside-course、/guide/start-exhibition、/guide/course-entry | いちまるの項目確認 → 一果のイン逃げ考察 |
| 女子戦の数字を、そのまま混合戦に使っていい？ | /data-lab/women-vs-mixed、/guide/race-card、/guide/series-performance | はつころの比較条件整理 → 初音の選手・今節を見る視点 |
| 5アタマを考える前に、4号艇を見る | /data-lab/boat5-win、/guide/average-st、/guide/exhibition、/guide/odds-payout | きいもこの項目確認 → キイナの相手と展開を見る視点 |

## 事実と表現の扱い

- 元教材は`1d578e0587cded138ea804314cb685bd74bdd576` 時点の実ファイルで確認し、最新mainとの比較では教材本文に差がないことを確認。キャラページの差分はPHASE 9のBLOG導線のみ。
- 既存段落の貼り付けはせず、問い・確認順・会話・説明を新しく構成。
- 実測勝率、回収率、平均STの値、買い目、選手名、レース結果を追加しない。新しい集計を済ませたかのように書かない。
- DATA CHECKは実測表ではなく確認項目の整理。各AI MATEの発言でも明示。
- 人間側は編集キャラクターとして考察し、AI MATEに最終予想や購入をさせない。
- 著者・出典・まとめ・既存教材への関連記事・今日のレースCTAを設置。初心者記事はDATA CHECKを使わず、各記事に全種類のボックスを強制しない。
- 公開日・更新日は未設定。キャラクター画像は既存registryの実ファイルのみ。

## 検証と隔離

- /blog/preview/trials と /blog/preview/trials/[slug] のみから、環境ゲート通過後に試験記事データを読み込む。
- 本番では404。全Previewにnoindex、既存X-Robots-Tagを適用。構造化データを出さない。
- Supabaseへの登録なし。公開reader・検索・Sitemap・ランキング・関連記事取得へ組み込まない。
- 試験記事同士のリンクは専用のPreview欄に表示し、公開関連記事カードに混ぜない。
- tests/blog/trialArticles.test.mjs: スキーマ、4本限定、出典文言・ハッシュ照合、既存段落非コピー、実画像、役割、import境界。
- tests/blog/trialsHttp.test.mjs: 一覧・各詳細、構造化会話・出典・CTA、公開側混入防止、本番404。

次工程へは進まず、iPhone確認後の指示を待つ。
