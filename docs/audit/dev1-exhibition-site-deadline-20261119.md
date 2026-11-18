# 開発① 展示のサイト表示到達判定

更新: 2026-11-19 JST。Draft PR #306 HEAD b1fccdc31bb5c316e921bee7b19801ddb5563942。

従来の assessExhibitionDeadline はDBに6艇の展示タイムが保存された時刻だけを判定する。公開サイトに見えるかは別の証拠が必要なため assessExhibitionSiteDeadline を追加。公開画面で観測した6艇それぞれの展示タイムが保存済み値と一致し、観測時刻が保存後・現在以前で、締切10分前以内のときだけ SITE_ON_TIME。保存済みでも画面観測がなければ SITE_UNVERIFIED。表示遅れは SITE_LATE、不一致・重複・未来時刻は INVALID。

これは純粋なオフライン分類器であり、公開サイトの観測自体や通知は未接続。Node全163件成功、失敗・スキップ0、差分検査PASS。実際の締切10分前の表示達成は未検証。本番DB、Cron、Vercelへの変更なし。
