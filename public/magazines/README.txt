BoatStrikers Magazine Viewer / Premium版

■ 仕様
- 各号 1〜4ページ: 無料
- 5ページ目: Premiumロック画面
- パスワード認証成功後: 5ページ目以降を横スワイプで閲覧
- 認証はサーバー側で実施し、HttpOnly Cookieを31日間保存
- Premium画像は public ではなく private/magazines 配下から認証API経由で配信

■ Vercelで必ず設定する環境変数
BOATSTRIKERS_MAGAZINE_PASSWORD
  例: YouTubeメンバー限定投稿で毎月案内するパスワード

BOATSTRIKERS_MAGAZINE_AUTH_SECRET
  長いランダム文字列を推奨。Cookie署名に使います。
  未設定時は上のパスワードを署名キーとして使用します。

設定場所:
Vercel > Project > Settings > Environment Variables
設定後は再デプロイしてください。

■ 画像の置き場所
無料ページ:
public/magazines/{ichika|hatsune|kiina}/001/page-01.png 〜 page-04.png

Premiumページ:
private/magazines/{ichika|hatsune|kiina}/001/page-05.png 〜 page-08.png

■ 創刊号
3誌ともサンプル8ページを同梱しています。
1〜4ページは無料、5〜8ページはPremiumです。

■ 本番画像への差し替え
同じファイル名で画像を上書きすれば、そのままビューアに反映できます。
