## 開発① 前日出走表の照合と保存計画の接続

更新: 2026-11-19 JST。Draft PR #306 HEAD d5795382ac3ab0d16fe5d449d86b3c193014703d。

独立の公式開催・6艇一覧と対象レースの公式HTMLを prepareSiteOfficialProgram で照合した後、同じ一覧を planPreviousDayProgramSave に渡す純粋関数 planVerifiedSitePreviousDayIngest を追加。ページが別場・別レース、登録番号違い、公式一覧が5艇、既存行が衝突する時は保存行を返さない。完全な再実行は追加行0。

模擬入力で関連12件成功。ローカルの全Node 162件成功・失敗／スキップ0、差分検査PASS。新規コードは外部API、DB、Cronに接続しない。実際の公式一覧の取得元と取得条件、全場網羅、SQLを設置した隔離Supabase、実トリガー、前日全件反映と展示10分前到達は未検証。今回判明した初期DDL不足が隔離再生の関門。本番DB・Cron・Vercelは変更していない。
