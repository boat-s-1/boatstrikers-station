# 全Route Handler・取得・再実行候補一覧

基準コミット: `469e71ff93ce5abeb04394ea6978277487f87b47`。静的解析結果。authSignals は認証実施の保証ではなく要確認の検出語。呼び出し元なしは未使用を意味しない。外部ジョブ、動的URL、ブラウザ直アクセスは補足監査が必要。GET既定値は固定ロックファイルがないため、検証環境のNext 16を基準とする。

| API / ファイル | メソッド | 呼び出し元 | dynamic/static | 頻度要因 | キャッシュ可否 | 認証依存・確認語 |
|---|---|---|---|---|---|---|
| /api/admin/amagasaki-original-html-diagnostic (`app/api/admin/amagasaki-original-html-diagnostic/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/data-lab-social-image (`app/api/admin/data-lab-social-image/route.js`) | GET | app/admin/data-lab-social/page.js:111 | runtime = "edge" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, required |
| /api/admin/discord-character-replies (`app/api/admin/discord-character-replies/route.js`) | GET/POST | app/admin/discord-replies/page.js:34<br>app/admin/discord-replies/page.js:42<br>app/admin/discord-replies/page.js:55 | dynamic="force-dynamic"; runtime="nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireAdmin, authorization, getUser, ADMIN_USER_IDS |
| /api/admin/engine-v3/refresh (`app/api/admin/engine-v3/refresh/route.js`) | GET/POST | app/admin/engine-v3/EngineV3AdminClient.js:28<br>app/admin/engine-v3/EngineV3AdminClient.js:41 | dynamic = 'force-dynamic' | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/admin/exhibition-alerts (`app/api/admin/exhibition-alerts/route.js`) | GET/POST | app/admin/exhibition-alerts/page.js:76<br>app/admin/exhibition-alerts/page.js:109 | dynamic = "force-dynamic"; runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/admin/exhibition-backfill (`app/api/admin/exhibition-backfill/route.js`) | POST | app/admin/exhibition-data-status/BackfillButton.js:19 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/admin/exhibition-source-diagnostic (`app/api/admin/exhibition-source-diagnostic/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE |
| /api/admin/hatsune-news/generate-ai (`app/api/admin/hatsune-news/generate-ai/route.js`) | POST | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | ADMIN_SECRET, CRON_SECRET, authorization |
| /api/admin/hatsune-news/video/render-manifest (`app/api/admin/hatsune-news/video/render-manifest/route.js`) | GET | app/admin/hatsune-news/video/VideoStudio.js:41 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, ADMIN_SECRET, CRON_SECRET, authorization, required |
| /api/admin/hatsune-news/video/rendered (`app/api/admin/hatsune-news/video/rendered/route.js`) | POST | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | SERVICE_ROLE, ADMIN_SECRET, CRON_SECRET, authorization, required |
| /api/admin/hatsune-news/video (`app/api/admin/hatsune-news/video/route.js`) | POST | app/admin/hatsune-news/video/VideoStudio.js:84 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/hatsune-womens-inner-break (`app/api/admin/hatsune-womens-inner-break/route.js`) | GET/POST | app/admin/hatsune-womens-inner-break/page.js:10<br>app/admin/hatsune-womens-inner-break/page.js:12 | dynamic="force-dynamic"; runtime="nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/admin/historical-exhibition-check (`app/api/admin/historical-exhibition-check/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime='nodejs'; dynamic='force-dynamic' | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/ichika-hidden-escape (`app/api/admin/ichika-hidden-escape/route.js`) | GET/POST | app/admin/ichika-hidden-escape/page.js:76<br>app/admin/ichika-hidden-escape/page.js:109 | dynamic = "force-dynamic"; runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/admin/magazine/issues/[id] (`app/api/admin/magazine/issues/[id]/route.js`) | PUT/DELETE | app/admin/magazine/MagazineAdminClient.js:46<br>app/admin/magazine/MagazineAdminClient.js:47 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/magazine/issues (`app/api/admin/magazine/issues/route.js`) | GET/POST | app/admin/magazine/MagazineAdminClient.js:34<br>app/admin/magazine/MagazineAdminClient.js:46 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/magazine/upload (`app/api/admin/magazine/upload/route.js`) | POST | app/admin/magazine/MagazineAdminClient.js:45 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/miyajima-original-html-diagnostic (`app/api/admin/miyajima-original-html-diagnostic/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/note-features (`app/api/admin/note-features/route.js`) | GET/POST/DELETE | app/admin/note/NoteFeatureAdmin.js:32<br>app/admin/note/NoteFeatureAdmin.js:48<br>app/admin/note/NoteFeatureAdmin.js:66 | non-GET executes per request; GET defaults per installed Next version | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | SERVICE_ROLE, required |
| /api/admin/official-exhibition-probe (`app/api/admin/official-exhibition-probe/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = 'nodejs'; dynamic = 'force-dynamic' | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/radio-blog/login (`app/api/admin/radio-blog/login/route.js`) | POST | app/admin/radio-blog/login/RadioBlogLoginClient.js:18 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | ADMIN_PASSWORD |
| /api/admin/radio-blog/logout (`app/api/admin/radio-blog/logout/route.js`) | POST | app/admin/radio-blog/RadioBlogAdminClient.js:235 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/radio-blog/posts/[id] (`app/api/admin/radio-blog/posts/[id]/route.js`) | PUT/DELETE | app/admin/radio-blog/RadioBlogAdminClient.js:185<br>app/admin/radio-blog/RadioBlogAdminClient.js:217 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/radio-blog/posts (`app/api/admin/radio-blog/posts/route.js`) | GET/POST | app/admin/radio-blog/RadioBlogAdminClient.js:66<br>app/admin/radio-blog/RadioBlogAdminClient.js:186 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/radio-blog/upload (`app/api/admin/radio-blog/upload/route.js`) | POST | app/admin/radio-blog/RadioBlogAdminClient.js:162 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/realtime/items/[id] (`app/api/admin/realtime/items/[id]/route.js`) | PUT/DELETE | app/admin/realtime/RealtimeAdminClient.js:17<br>app/admin/realtime/RealtimeAdminClient.js:19 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/realtime/items (`app/api/admin/realtime/items/route.js`) | GET/POST | app/admin/realtime/RealtimeAdminClient.js:12<br>app/admin/realtime/RealtimeAdminClient.js:17 | dynamic="force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/realtime/upload (`app/api/admin/realtime/upload/route.js`) | POST | app/admin/realtime/RealtimeAdminClient.js:16 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/results/[id] (`app/api/admin/results/[id]/route.js`) | PATCH/DELETE | 静的参照なし。外部呼び出しを確認 | non-GET executes per request; GET defaults per installed Next version | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/results (`app/api/admin/results/route.js`) | GET/POST | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/results/upload (`app/api/admin/results/upload/route.js`) | POST | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/schedule/items/[id] (`app/api/admin/schedule/items/[id]/route.js`) | PUT/DELETE | app/admin/schedule/ScheduleAdminClient.js:182<br>app/admin/schedule/ScheduleAdminClient.js:206 | dynamic = "force-dynamic"; runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/schedule/items (`app/api/admin/schedule/items/route.js`) | GET/POST | app/admin/schedule/ScheduleAdminClient.js:54<br>app/admin/schedule/ScheduleAdminClient.js:183 | dynamic = "force-dynamic"; runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/schedule/login (`app/api/admin/schedule/login/route.js`) | GET/POST/OPTIONS | app/admin/realtime/login/RealtimeLoginClient.js:5<br>app/admin/schedule/login/ScheduleLoginClient.js:19 | dynamic = "force-dynamic"; runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | ADMIN_PASSWORD, ADMIN_DASHBOARD_PASSWORD |
| /api/admin/schedule/logout (`app/api/admin/schedule/logout/route.js`) | GET/POST | app/admin/schedule/ScheduleAdminClient.js:232 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/seminar-magazines/issues/[id] (`app/api/admin/seminar-magazines/issues/[id]/route.js`) | PUT/DELETE | app/admin/seminar-magazines/SeminarMagazineAdminClient.js:40<br>app/admin/seminar-magazines/SeminarMagazineAdminClient.js:41 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/seminar-magazines/issues (`app/api/admin/seminar-magazines/issues/route.js`) | GET/POST | app/admin/seminar-magazines/SeminarMagazineAdminClient.js:30<br>app/admin/seminar-magazines/SeminarMagazineAdminClient.js:40 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/seminar-magazines/upload (`app/api/admin/seminar-magazines/upload/route.js`) | POST | app/admin/seminar-magazines/SeminarMagazineAdminClient.js:38 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/stadium-ai-v2/refresh (`app/api/admin/stadium-ai-v2/refresh/route.js`) | POST | app/admin/stadium-ai-v2/StadiumAiV2AdminClient.js:4 | dynamic='force-dynamic' | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/admin/stadium-ai/refresh (`app/api/admin/stadium-ai/refresh/route.js`) | POST | app/admin/stadium-ai/StadiumAiAdminClient.js:6 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | requireRadioBlogAdmin |
| /api/admin/sync/command (`app/api/admin/sync/command/route.js`) | POST | app/admin/sync/SyncDashboardClient.js:18 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/sync/login (`app/api/admin/sync/login/route.js`) | POST | app/admin/sync/login/page.js:4 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | ADMIN_DASHBOARD_PASSWORD |
| /api/admin/sync/logout (`app/api/admin/sync/logout/route.js`) | POST | app/admin/sync/SyncDashboardClient.js:22 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/sync/status (`app/api/admin/sync/status/route.js`) | GET | app/admin/sync/SyncDashboardClient.js:16 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/ticker/items/[id] (`app/api/admin/ticker/items/[id]/route.js`) | PUT/DELETE | app/admin/ticker/TickerAdminClient.js:5<br>app/admin/ticker/TickerAdminClient.js:5 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/ticker/items (`app/api/admin/ticker/items/route.js`) | GET/POST | app/admin/ticker/TickerAdminClient.js:5<br>app/admin/ticker/TickerAdminClient.js:5 | dynamic="force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/admin/toda-original-html-diagnostic (`app/api/admin/toda-original-html-diagnostic/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/tsu-original-html-diagnostic (`app/api/admin/tsu-original-html-diagnostic/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/tsu-original-tenji-test (`app/api/admin/tsu-original-tenji-test/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/tsu-source-diagnostic (`app/api/admin/tsu-source-diagnostic/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/admin/verified-exhibition-check (`app/api/admin/verified-exhibition-check/route.js`) | GET | lib/exhibitionStatusCatalog.js:11 | runtime = 'nodejs'; dynamic = 'force-dynamic' | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/ai-v2/character-panel (`app/api/ai-v2/character-panel/route.js`) | GET | app/components/CharacterAiRoomPanel.js:179 | dynamic = "force-dynamic"; runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE |
| /api/ai-v2/settle-bets (`app/api/ai-v2/settle-bets/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE |
| /api/ai/generate-predictions (`app/api/ai/generate-predictions/route.js`) | GET/POST | app/api/cron/ai-previous-day-health/route.js:57 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/boatstrikers-health (`app/api/boatstrikers-health/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/bsc2/ai-control/actions (`app/api/bsc2/ai-control/actions/route.js`) | POST | app/bsc2/admin/page.js:158 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdmin |
| /api/bsc2/ai-control/finalize-upload (`app/api/bsc2/ai-control/finalize-upload/route.js`) | POST | app/bsc2/admin/page.js:96 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdmin |
| /api/bsc2/ai-control/jobs (`app/api/bsc2/ai-control/jobs/route.js`) | GET | app/bsc2/admin/page.js:145 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAiAdmin |
| /api/bsc2/ai-control/status (`app/api/bsc2/ai-control/status/route.js`) | GET | app/bsc2/admin/page.js:146 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAiAdmin |
| /api/bsc2/ai-control/upload-url (`app/api/bsc2/ai-control/upload-url/route.js`) | POST | app/bsc2/admin/page.js:86 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdmin |
| /api/bsc2/ai-dashboard (`app/api/bsc2/ai-dashboard/route.js`) | GET | app/bsc2/admin/ai-dashboard/page.js:427 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, assertAdmin, ADMIN_KEY |
| /api/bsc2/ai-factory/actions (`app/api/bsc2/ai-factory/actions/route.js`) | POST | app/bsc2/admin/ai-factory/page.js:64 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAdmin |
| /api/bsc2/ai-factory/jobs (`app/api/bsc2/ai-factory/jobs/route.js`) | GET/POST | app/bsc2/admin/ai-factory/page.js:42<br>app/bsc2/admin/ai-factory/page.js:56 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAdmin |
| /api/bsc2/ai-factory/models (`app/api/bsc2/ai-factory/models/route.js`) | GET | app/bsc2/admin/ai-factory/page.js:41 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAdmin |
| /api/bsc2/ai-factory/status (`app/api/bsc2/ai-factory/status/route.js`) | GET | app/bsc2/admin/ai-factory/page.js:43 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAdmin |
| /api/bsc2/ai-v6/dashboard (`app/api/bsc2/ai-v6/dashboard/route.js`) | GET | app/bsc2/admin/ai-v6/page.js:41 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAiAdminRequest |
| /api/bsc2/ai-v6/jobs (`app/api/bsc2/ai-v6/jobs/route.js`) | POST | app/bsc2/admin/ai-v6/page.js:62 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/bsc2/ai-v8/dashboard (`app/api/bsc2/ai-v8/dashboard/route.js`) | GET | app/bsc2/admin/ai-v8/page.js:28 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAiAdminRequest |
| /api/bsc2/ai-v8/jobs (`app/api/bsc2/ai-v8/jobs/route.js`) | POST | app/bsc2/admin/ai-v8/page.js:36 | non-GET executes per request; GET defaults per installed Next version | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/bsc2/ai/dashboard (`app/api/bsc2/ai/dashboard/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | assertAiAdminRequest |
| /api/bsc2/ai/health (`app/api/bsc2/ai/health/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | assertAiAdminRequest |
| /api/bsc2/ai/jobs (`app/api/bsc2/ai/jobs/route.js`) | GET/POST | app/bsc2/admin/ai/page.js:141 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/bsc2/ai/live-result (`app/api/bsc2/ai/live-result/route.js`) | POST | app/bsc2/admin/ai/page.js:182 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/bsc2/ai/retry-job (`app/api/bsc2/ai/retry-job/route.js`) | POST | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/bsc2/ai/upload (`app/api/bsc2/ai/upload/route.js`) | POST | app/bsc2/admin/ai/page.js:164 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | assertAiAdminRequest |
| /api/bsc2/ai/v5-dashboard (`app/api/bsc2/ai/v5-dashboard/route.js`) | GET | app/bsc2/admin/ai/page.js:100 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | assertAiAdminRequest |
| /api/cron/ai-previous-day-health (`app/api/cron/ai-previous-day-health/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization, SERVICE_ROLE, ADMIN_KEY |
| /api/cron/daily-result-digest (`app/api/cron/daily-result-digest/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 10 14 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/data-lab-social (`app/api/cron/data-lab-social/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 20 21 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/discord-alerts (`app/api/cron/discord-alerts/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic="force-dynamic"; runtime="nodejs" | Cron */2 22,0-13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/discord-community-poll (`app/api/cron/discord-community-poll/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic="force-dynamic"; runtime="nodejs" | Cron 0 0 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/discord-community-setup (`app/api/cron/discord-community-setup/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic="force-dynamic"; runtime="nodejs" | Cron */5 * * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/discord-membership-sync (`app/api/cron/discord-membership-sync/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic="force-dynamic"; runtime="nodejs" | Cron 0 * * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/discord-race-threads (`app/api/cron/discord-race-threads/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic="force-dynamic"; runtime="nodejs" | Cron */5 22-23,0-13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/elimination-odds-snapshots (`app/api/cron/elimination-odds-snapshots/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron */10 22,0-13 * * * | Auth signals: do not share until authorization/data reviewed | requiredEnv, SERVICE_ROLE, CRON_SECRET, authorization |
| /api/cron/exhibition-alert-lines (`app/api/cron/exhibition-alert-lines/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, CRON_SECRET, authorization, Authorization |
| /api/cron/exhibition-alerts (`app/api/cron/exhibition-alerts/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, CRON_SECRET, authorization, Authorization, required |
| /api/cron/hatsune-news-ai (`app/api/cron/hatsune-news-ai/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/hatsune-news-pipeline (`app/api/cron/hatsune-news-pipeline/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, CRON_SECRET, authorization |
| /api/cron/hatsune-womens-inner-break (`app/api/cron/hatsune-womens-inner-break/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic="force-dynamic"; runtime="nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, CRON_SECRET, authorization, Authorization |
| /api/cron/ichika-escape-surge (`app/api/cron/ichika-escape-surge/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, CRON_SECRET, authorization, Authorization |
| /api/cron/ichika-hidden-escape (`app/api/cron/ichika-hidden-escape/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic"; runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, CRON_SECRET, authorization, Authorization |
| /api/cron/media-editorials (`app/api/cron/media-editorials/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 10 3,6,9,13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/news-editorials (`app/api/cron/news-editorials/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 20 3,6,9,14 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/news-morning-collect (`app/api/cron/news-morning-collect/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 55 20 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/news-short-draft (`app/api/cron/news-short-draft/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 50 13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/news-verify (`app/api/cron/news-verify/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 10 3,6,9,14,21 * * *, 40 13 * * * | Auth signals: do not share until authorization/data reviewed | verifyPendingNewsCandidates, CRON_SECRET, authorization |
| /api/cron/news-x-drafts (`app/api/cron/news-x-drafts/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 15 3,6,9,14,21 * * *, 45 13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/race-cancellations (`app/api/cron/race-cancellations/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 5 3,6,9,12 * * *, 0 14 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/x-night-candidates (`app/api/cron/x-night-candidates/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 30 13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/cron/x-night-posts (`app/api/cron/x-night-posts/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | Cron 35 13 * * * | Auth signals: do not share until authorization/data reviewed | CRON_SECRET, authorization |
| /api/discord/avatar/[character] (`app/api/discord/avatar/[character]/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/home-performance (`app/api/home-performance/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE |
| /api/home/realtime (`app/api/home/realtime/route.js`) | GET | app/components/HomeCompactRealtime.js:31 | dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/line/webhook (`app/api/line/webhook/route.js`) | POST | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | SERVICE_ROLE, verifySignature, Authorization |
| /api/live/openapi-preview (`app/api/live/openapi-preview/route.js`) | GET/POST | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | SERVICE_ROLE |
| /api/magazine-auth (`app/api/magazine-auth/route.js`) | GET/POST/DELETE | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | verifyMagazineToken |
| /api/magazine-page (`app/api/magazine-page/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | verifyMagazineToken |
| /api/magazine-premium-page (`app/api/magazine-premium-page/route.js`) | GET | app/library/components/MagazineSwipeViewer.js:38 | runtime="nodejs"; dynamic="force-dynamic" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | Required |
| /api/magazine-unlock (`app/api/magazine-unlock/route.js`) | POST | 静的参照なし。外部呼び出しを確認 | runtime = "nodejs"; dynamic = "force-dynamic" | 操作・外部ジョブ。実測ログ照合が必要 | Mutations: no shared response cache | 検出語なし（認証不要の保証ではない） |
| /api/members/delete (`app/api/members/delete/route.js`) | POST | app/members/page.js:146 | runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE, authorization, getUser |
| /api/members/discord/callback (`app/api/members/discord/callback/route.js`) | GET | 静的参照なし。外部呼び出しを確認 | runtime="nodejs" | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | authorization, Authorization |
| /api/members/discord/preferences (`app/api/members/discord/preferences/route.js`) | GET/POST | app/members/discord/page.js:32<br>app/members/discord/page.js:77 | runtime="nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | authorization, getUser |
| /api/members/discord/start (`app/api/members/discord/start/route.js`) | POST | app/members/discord/page.js:65 | runtime="nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | authorization, getUser |
| /api/members/discord/status (`app/api/members/discord/status/route.js`) | GET | app/members/discord/page.js:40 | runtime="nodejs" | UIマウント・操作。下記再実行候補参照 | Auth signals: do not share until authorization/data reviewed | authorization, getUser |
| /api/members/discord/unlink (`app/api/members/discord/unlink/route.js`) | POST | app/members/discord/page.js:94 | runtime="nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | authorization, getUser |
| /api/members/entitlement (`app/api/members/entitlement/route.js`) | GET | app/library/components/MagazineSwipeViewer.js:53 | runtime="nodejs"; dynamic="force-dynamic" | UIマウント・操作。下記再実行候補参照 | Public candidate: verify query, freshness and side effects | 検出語なし（認証不要の保証ではない） |
| /api/members/ichika-consult (`app/api/members/ichika-consult/route.js`) | GET/POST/PATCH | app/members/ichika-consult/page.js:33<br>app/members/ichika-consult/page.js:54<br>app/members/ichika-consult/page.js:71 | runtime = "nodejs"; dynamic = "force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | authorization, getUser, admin_status, admin_reply, admin_replied_at |
| /api/members/line-link-code (`app/api/members/line-link-code/route.js`) | POST | app/members/page.js:124 | runtime = "nodejs" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | SERVICE_ROLE, authorization, getUser |
| /api/members/session (`app/api/members/session/route.js`) | POST/DELETE | app/lib/memberSessionSync.js:70<br>app/lib/memberSessionSync.js:101<br>app/library/components/MagazineSwipeViewer.js:50 | runtime="nodejs"; dynamic="force-dynamic" | UIマウント・操作。下記再実行候補参照 | Mutations: no shared response cache | authorization |
| /api/members/stadium-premium/[place] (`app/api/members/stadium-premium/[place]/route.js`) | GET | app/library/stadium/[place]/StadiumPremiumMemberArea.js:55 | dynamic = 'force-dynamic'; revalidate = 0 | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE, authorization, getUser |
| /api/stadium/today/[place] (`app/api/stadium/today/[place]/route.js`) | GET | app/library/stadium/[place]/TodayRacePremium.js:20 | dynamic = 'force-dynamic'; revalidate = 0 | 操作・外部ジョブ。実測ログ照合が必要 | Auth signals: do not share until authorization/data reviewed | SERVICE_ROLE |

## 全fetch()

| ファイル:行 | コード |
|---|---|
| app/admin/alerts/exhibition/page.js:17 | `fetch('${venue.endpoint}?course=${venue.code}&date=${date}&race=${race}',{cache:'no-store',signal:controller.current.signal})` |
| app/admin/discord-replies/page.js:34 | `fetch('/api/admin/discord-character-replies?mode=threads',{headers:{Authorization:'Bearer ${token}'},cache:"no-store"})` |
| app/admin/discord-replies/page.js:42 | `fetch('/api/admin/discord-character-replies?character=${character}',{headers:{Authorization:'Bearer ${token}'},cache:"no-store"})` |
| app/admin/discord-replies/page.js:55 | `fetch("/api/admin/discord-character-replies",{method:"POST",headers:{Authorization:'Bearer ${token}',"Content-Type":"application/json"},body:JSON.stringify(payload)})` |
| app/admin/engine-v3/EngineV3AdminClient.js:28 | `fetch('/api/admin/engine-v3/refresh', { cache: 'no-store' })` |
| app/admin/engine-v3/EngineV3AdminClient.js:41 | `fetch('/api/admin/engine-v3/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, courseCode, asOf }), })` |
| app/admin/exhibition-alerts/page.js:76 | `fetch('/api/admin/exhibition-alerts?${qs.toString()}', { cache: "no-store" })` |
| app/admin/exhibition-alerts/page.js:109 | `fetch("/api/admin/exhibition-alerts", { method: "POST" })` |
| app/admin/exhibition-data-status/BackfillButton.js:19 | `fetch("/api/admin/exhibition-backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, cursor, batchSize: 18 }), })` |
| app/admin/hatsune-news/video/VideoStudio.js:84 | `fetch("/api/admin/hatsune-news/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoType: mode, articleIds: selected, targetDate, periodStart, periodEnd, durationSeconds }), })` |
| app/admin/hatsune-womens-inner-break/page.js:10 | `fetch('/api/admin/hatsune-womens-inner-break?date=${date}&mode=day',{cache:"no-store"})` |
| app/admin/hatsune-womens-inner-break/page.js:12 | `fetch("/api/admin/hatsune-womens-inner-break",{method:"POST"})` |
| app/admin/ichika-hidden-escape/page.js:76 | `fetch('/api/admin/ichika-hidden-escape?${qs.toString()}', { cache: "no-store" })` |
| app/admin/ichika-hidden-escape/page.js:109 | `fetch("/api/admin/ichika-hidden-escape", { method: "POST" })` |
| app/admin/magazine/MagazineAdminClient.js:34 | `fetch('/api/admin/magazine/issues',{cache:'no-store'})` |
| app/admin/magazine/MagazineAdminClient.js:45 | `fetch('/api/admin/magazine/upload',{method:'POST',body:f})` |
| app/admin/magazine/MagazineAdminClient.js:46 | `fetch(endpoint,{method:issue.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(nextIssue))})` |
| app/admin/magazine/MagazineAdminClient.js:47 | `fetch('/api/admin/magazine/issues/${issue.id}',{method:'DELETE'})` |
| app/admin/note/NoteFeatureAdmin.js:32 | `fetch('/api/admin/note-features?date=${date}', { cache: "no-store" })` |
| app/admin/note/NoteFeatureAdmin.js:48 | `fetch("/api/admin/note-features", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form), })` |
| app/admin/note/NoteFeatureAdmin.js:66 | `fetch('/api/admin/note-features?id=${id}', { method: "DELETE" })` |
| app/admin/radio-blog/RadioBlogAdminClient.js:66 | `fetch("/api/admin/radio-blog/posts", { cache: "no-store", })` |
| app/admin/radio-blog/RadioBlogAdminClient.js:162 | `fetch("/api/admin/radio-blog/upload", { method: "POST", body: formData, })` |
| app/admin/radio-blog/RadioBlogAdminClient.js:188 | `fetch(endpoint, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApiPost(post)), })` |
| app/admin/radio-blog/RadioBlogAdminClient.js:216 | `fetch( '/api/admin/radio-blog/posts/${post.id}', { method: "DELETE" } )` |
| app/admin/radio-blog/RadioBlogAdminClient.js:235 | `fetch("/api/admin/radio-blog/logout", { method: "POST" })` |
| app/admin/radio-blog/login/RadioBlogLoginClient.js:18 | `fetch("/api/admin/radio-blog/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), })` |
| app/admin/realtime/RealtimeAdminClient.js:12 | `fetch("/api/admin/realtime/items",{cache:"no-store"})` |
| app/admin/realtime/RealtimeAdminClient.js:16 | `fetch("/api/admin/realtime/upload",{method:"POST",body:data})` |
| app/admin/realtime/RealtimeAdminClient.js:17 | `fetch(url,{method:editId?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)})` |
| app/admin/realtime/RealtimeAdminClient.js:19 | `fetch('/api/admin/realtime/items/${id}',{method:"DELETE"})` |
| app/admin/realtime/login/RealtimeLoginClient.js:5 | `fetch("/api/admin/schedule/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password}),cache:"no-store"})` |
| app/admin/schedule/ScheduleAdminClient.js:54 | `fetch("/api/admin/schedule/items", { cache: "no-store", })` |
| app/admin/schedule/ScheduleAdminClient.js:184 | `fetch(endpoint, { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form), })` |
| app/admin/schedule/ScheduleAdminClient.js:206 | `fetch('/api/admin/schedule/items/${form.id}', { method: "DELETE", })` |
| app/admin/schedule/login/ScheduleLoginClient.js:19 | `fetch("/api/admin/schedule/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), cache: "no-store", })` |
| app/admin/seminar-magazines/SeminarMagazineAdminClient.js:30 | `fetch('/api/admin/seminar-magazines/issues',{cache:'no-store'})` |
| app/admin/seminar-magazines/SeminarMagazineAdminClient.js:38 | `fetch('/api/admin/seminar-magazines/upload',{method:'POST',body:f})` |
| app/admin/seminar-magazines/SeminarMagazineAdminClient.js:40 | `fetch(endpoint,{method:issue.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})` |
| app/admin/seminar-magazines/SeminarMagazineAdminClient.js:41 | `fetch('/api/admin/seminar-magazines/issues/${issue.id}',{method:'DELETE'})` |
| app/admin/stadium-ai-v2/StadiumAiV2AdminClient.js:4 | `fetch('/api/admin/stadium-ai-v2/refresh',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({courseCode,asOf})})` |
| app/admin/stadium-ai/StadiumAiAdminClient.js:6 | `fetch('/api/admin/stadium-ai/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_code:1,as_of:date})})` |
| app/admin/sync/SyncDashboardClient.js:16 | `fetch("/api/admin/sync/status",{cache:"no-store"})` |
| app/admin/sync/SyncDashboardClient.js:18 | `fetch("/api/admin/sync/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({commandType:type,targetDate:data?.today})})` |
| app/admin/ticker/TickerAdminClient.js:5 | `fetch("/api/admin/ticker/items",{cache:"no-store"})` |
| app/admin/ticker/TickerAdminClient.js:5 | `fetch(url,{method:form.id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)})` |
| app/admin/ticker/TickerAdminClient.js:5 | `fetch('/api/admin/ticker/items/${form.id}',{method:"DELETE"})` |
| app/api/admin/amagasaki-original-html-diagnostic/route.js:14 | `fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/javascript,text/javascript,application/json,application/xml,text/xml,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", ...(init.headers \|\| {}), }, ...init, })` |
| app/api/admin/discord-character-replies/route.js:54 | `fetch('https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}',{ method:"PATCH",headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:spec.webhookName\|\|'BSC ${spec.name}',avatar}),cache:"no-store", })` |
| app/api/admin/discord-character-replies/route.js:129 | `fetch('https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true&thread_id=${encodeURIComponent(threadId)}',{ method:"POST",headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:spec.name,content,allowed_mentions:{parse:[]}}),cache:"no-store", })` |
| app/api/admin/discord-character-replies/route.js:144 | `fetch('https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true',{ method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store", })` |
| app/api/admin/miyajima-original-html-diagnostic/route.js:21 | `fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/javascript,text/javascript,application/json,application/xml,text/xml,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", ...(init.headers \|\| {}), }, ...init, })` |
| app/api/admin/official-exhibition-probe/route.js:67 | `fetch(url, { redirect: 'manual', cache: 'no-store', signal: controller.signal, headers: { 'User-Agent': 'BoatStrikers-ExhibitionDiagnostic/1.0', 'X-Requested-With': 'XMLHttpRequest', Referer: new URL('/', url).href } })` |
| app/api/admin/toda-original-html-diagnostic/route.js:21 | `fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/javascript,text/javascript,application/xml,text/xml,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", }, })` |
| app/api/admin/tsu-original-html-diagnostic/route.js:65 | `fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/javascript,text/javascript,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", }, })` |
| app/api/admin/tsu-source-diagnostic/route.js:22 | `fetch(url, { cache: "no-store", redirect: "follow", signal: t.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/javascript,text/javascript,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", }, })` |
| app/api/cron/ai-previous-day-health/route.js:58 | `fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-bsc-ai-key": key }, body: JSON.stringify({ date: raceDate }), cache: "no-store", })` |
| app/api/cron/discord-alerts/route.js:127 | `fetch('https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true',{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username:spec.name, content:String(bodyContent).slice(0,2000), allowed_mentions:roleId?{parse:[],roles:[roleId]}:{parse:[]}, }), cache:"no-store", })` |
| app/api/cron/discord-race-threads/route.js:89 | `fetch('https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}',{ method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:spec.webhookName,avatar}), cache:"no-store", })` |
| app/api/cron/discord-race-threads/route.js:108 | `fetch('https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true&thread_id=${threadId}',{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username:spec.name, content:String(content).slice(0,2000), allowed_mentions:{parse:[]}, }), cache:"no-store", })` |
| app/api/cron/exhibition-alert-lines/route.js:64 | `fetch("https://api.line.me/v2/bot/message/multicast",{ method:"POST", headers:{Authorization:'Bearer ${token}',"Content-Type":"application/json"}, body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false}), })` |
| app/api/cron/exhibition-alerts/route.js:87 | `fetch("https://api.line.me/v2/bot/message/multicast",{method:"POST",headers:{Authorization:'Bearer ${accessToken}',"Content-Type":"application/json"},body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false})})` |
| app/api/cron/hatsune-womens-inner-break/route.js:13 | `fetch("https://api.line.me/v2/bot/message/multicast",{method:"POST",headers:{Authorization:'Bearer ${token}',"Content-Type":"application/json"},body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false})})` |
| app/api/cron/ichika-escape-surge/route.js:101 | `fetch("https://api.line.me/v2/bot/message/multicast", { method: "POST", headers: { Authorization: 'Bearer ${accessToken}', "Content-Type": "application/json", }, body: JSON.stringify({ to, messages: [{ type: "text", text }], notificationDisabled: false, }), })` |
| app/api/cron/ichika-hidden-escape/route.js:31 | `fetch("https://api.line.me/v2/bot/message/multicast",{method:"POST",headers:{Authorization:'Bearer ${accessToken}',"Content-Type":"application/json"},body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false})})` |
| app/api/line/webhook/route.js:29 | `fetch('https://api.line.me/v2/bot/message/${path}',{ method:"POST", headers:{Authorization:'Bearer ${accessToken}',"Content-Type":"application/json"}, body:JSON.stringify(payload), })` |
| app/api/live/openapi-preview/route.js:121 | `fetch(endpoint, { cache: "no-store", headers: { "user-agent": "BoatStrikers/1.0" }, })` |
| app/api/members/discord/callback/route.js:30 | `fetch("https://discord.com/api/v10/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:tokenBody,cache:"no-store"})` |
| app/api/members/discord/callback/route.js:35 | `fetch("https://discord.com/api/v10/users/@me",{headers:{Authorization:'Bearer ${tokenData.access_token}'},cache:"no-store"})` |
| app/bsc2/admin/ai-dashboard/page.js:426 | `fetch( '/api/bsc2/ai-dashboard?date=${encodeURIComponent(date)}', { headers: { "x-bsc-ai-key": key, }, cache: "no-store", }, )` |
| app/bsc2/admin/ai-factory/page.js:41 | `fetch('/api/bsc2/ai-factory/models?${qs}',{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"})` |
| app/bsc2/admin/ai-factory/page.js:42 | `fetch("/api/bsc2/ai-factory/jobs",{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"})` |
| app/bsc2/admin/ai-factory/page.js:43 | `fetch("/api/bsc2/ai-factory/status",{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"})` |
| app/bsc2/admin/ai-factory/page.js:56 | `fetch("/api/bsc2/ai-factory/jobs",{method:"POST",headers:{"Content-Type":"application/json","x-bsc-ai-key":adminKey},body:JSON.stringify({characterCode:character,dataTiming:timing,compareActive:true})})` |
| app/bsc2/admin/ai-factory/page.js:64 | `fetch("/api/bsc2/ai-factory/actions",{method:"POST",headers:{"Content-Type":"application/json","x-bsc-ai-key":adminKey},body:JSON.stringify({action:actionName,...payload})})` |
| app/bsc2/admin/ai-v6/page.js:28 | `fetch(url,{ ...options, headers:{...(options.headers\|\|{}),"x-bsc-ai-key":key}, cache:"no-store", })` |
| app/bsc2/admin/ai-v8/page.js:20 | `fetch(url,{...options,headers:{...(options.headers\|\|{}),"x-bsc-ai-key":key},cache:"no-store"})` |
| app/bsc2/admin/ai/page.js:82 | `fetch(url, { ...options, headers: { ...(options.headers \|\| {}), "x-bsc-ai-key": accessKey, }, cache: "no-store", })` |
| app/bsc2/admin/newspaper/ichika/zenjitsu/page.js:372 | `fetch( '${apiUrl.replace(/\/$/, "")}/generate/ichika/zenjitsu', { method: "POST", headers: { "Content-Type": "application/json", }, body: JSON.stringify(form), } )` |
| app/bsc2/admin/page.js:86 | `fetch("/api/bsc2/ai-control/upload-url", { method: "POST", headers: { "Content-Type": "application/json", "x-bsc-ai-key": adminKey }, body: JSON.stringify({ jobType: type, raceDate: raceDate \|\| null, filename: file.name }), })` |
| app/bsc2/admin/page.js:96 | `fetch("/api/bsc2/ai-control/finalize-upload", { method: "POST", headers: { "Content-Type": "application/json", "x-bsc-ai-key": adminKey }, body: JSON.stringify({ jobType: type, raceDate: raceDate \|\| null, sourceFilename: file.name, storagePath: signed.storagePath, runCalibration, runDiagnosis, runNotification }), })` |
| app/bsc2/admin/page.js:145 | `fetch("/api/bsc2/ai-control/jobs?limit=50", { headers: { "x-bsc-ai-key": adminKey }, cache: "no-store" })` |
| app/bsc2/admin/page.js:146 | `fetch("/api/bsc2/ai-control/status", { headers: { "x-bsc-ai-key": adminKey }, cache: "no-store" })` |
| app/bsc2/admin/page.js:158 | `fetch("/api/bsc2/ai-control/actions", { method: "POST", headers: { "Content-Type": "application/json", "x-bsc-ai-key": adminKey }, body: JSON.stringify({ jobId, action: name }) })` |
| app/components/CharacterAiRoomPanel.js:179 | `fetch('/api/ai-v2/character-panel?character=${encodeURIComponent(character)}', { cache: "no-store", })` |
| app/components/HomeCompactRealtime.js:31 | `fetch("/api/home/realtime", { cache: "no-store" })` |
| app/components/MonthlyPerformanceSlider.js:89 | `fetch('/api/home-performance${query}', { cache: "no-store" })` |
| app/lib/boatstrikersLive.js:16 | `fetch(input,{...init,cache:"no-store"})` |
| app/lib/discordPremium.js:46 | `fetch('https://discord.com/api/v10${path}',{ method, headers:{ Authorization:token\|\|'Bot ${discordConfig().botToken}', ...(body?{"Content-Type":"application/json"}:{}), }, body:body?JSON.stringify(body):undefined, cache:"no-store", })` |
| app/lib/memberSessionSync.js:70 | `fetch("/api/members/session", { method: "POST", headers: { Authorization: 'Bearer ${accessToken}' }, cache: "no-store", })` |
| app/lib/memberSessionSync.js:101 | `fetch("/api/members/session", { method: "DELETE", cache: "no-store" })` |
| app/library/components/MagazineSwipeViewer.js:50 | `fetch("/api/members/session",{method:"POST",headers,cache:"no-store"})` |
| app/library/components/MagazineSwipeViewer.js:53 | `fetch("/api/members/entitlement",{headers,cache:"no-store"})` |
| app/library/stadium/[place]/StadiumPremiumMemberArea.js:55 | `fetch('/api/members/stadium-premium/${encodeURIComponent(place)}', { cache: 'no-store', headers: { Authorization: 'Bearer ${session.access_token}' }, })` |
| app/library/stadium/[place]/TodayRacePremium.js:20 | `fetch('/api/stadium/today/${encodeURIComponent(place)}', { cache: 'no-store' })` |
| app/members/discord/page.js:32 | `fetch("/api/members/discord/preferences",{headers:{Authorization:'Bearer ${nextSession.access_token}'},cache:"no-store"})` |
| app/members/discord/page.js:40 | `fetch("/api/members/discord/status",{headers:{Authorization:'Bearer ${nextSession.access_token}'},cache:"no-store"})` |
| app/members/discord/page.js:65 | `fetch("/api/members/discord/start",{method:"POST",headers:{Authorization:'Bearer ${session.access_token}'}})` |
| app/members/discord/page.js:77 | `fetch("/api/members/discord/preferences",{ method:"POST", headers:{Authorization:'Bearer ${session.access_token}',"Content-Type":"application/json"}, body:JSON.stringify({key,enabled}), })` |
| app/members/discord/page.js:94 | `fetch("/api/members/discord/unlink",{method:"POST",headers:{Authorization:'Bearer ${session.access_token}'}})` |
| app/members/ichika-consult/page.js:33 | `fetch("/api/members/ichika-consult",{headers:{Authorization:'Bearer ${nextSession.access_token}'},cache:"no-store"})` |
| app/members/ichika-consult/page.js:54 | `fetch("/api/members/ichika-consult",{ method:"POST", headers:{Authorization:'Bearer ${session.access_token}',"Content-Type":"application/json"}, body:JSON.stringify({topic,courseCode:course,courseName:selected?.[1]\|\|"",raceNo:raceNo?Number(raceNo):null,question}), })` |
| app/members/ichika-consult/page.js:71 | `fetch("/api/members/ichika-consult",{ method:"PATCH", headers:{Authorization:'Bearer ${session.access_token}',"Content-Type":"application/json"}, body:JSON.stringify({id}), })` |
| app/members/page.js:124 | `fetch("/api/members/line-link-code",{method:"POST",headers:{Authorization:'Bearer ${session.access_token}'}})` |
| app/members/page.js:146 | `fetch("/api/members/delete",{method:"POST",headers:{Authorization:'Bearer ${session.access_token}'}})` |
| lib/amagasakiOfficialOriginalTenji.js:66 | `fetch(url, { cache: "no-store", signal: controller.signal, headers: { "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)", accept: "text/html,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", "x-requested-with": "XMLHttpRequest", referer: "https://www.boatrace-amagasaki.jp/", }, })` |
| lib/boatersOriginalTenji.js:13 | `fetch(url,{cache:"no-store",redirect:"follow",signal:controller.signal,headers:{"user-agent":"Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","accept-language":"ja,en-US;q=0.8,en;q=0.6"}})` |
| lib/boatraceOdds.js:68 | `fetch(url, { cache: "no-store", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "ja,en-US;q=0.8,en;q=0.6", }, })` |
| lib/boatstrikersGeneralNewsSync.js:52 | `fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", "Accept-Language": "ja,en-US;q=0.8,en;q=0.6", Accept: "text/html,application/xhtml+xml", }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), })` |
| lib/boatstrikersLive.js:16 | `fetch(input,{...init,cache:"no-store"})` |
| lib/editorialHeadlineAi.js:37 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions, input, max_output_tokens: 120 }), })` |
| lib/editorialProductionAi.js:18 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions, input, max_output_tokens: maxOutputTokens }) })` |
| lib/fukuokaVerifiedOriginalTenji.js:74 | `fetch(url, { cache:'no-store', redirect:'manual', signal:controller.signal, headers:{ 'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)', referer:'https://www.boatrace-fukuoka.com/modules/yosou/' } })` |
| lib/hamanakoAshiyaVerifiedOriginalTenji.js:100 | `fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal, headers })` |
| lib/hatsuneMediaNewsCollector.js:157 | `fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", "Accept-Language": "ja,en-US;q=0.8,en;q=0.6", Accept: "text/html,application/xhtml+xml", }, cache: "no-store", signal: AbortSignal.timeout(ARTICLE_TIMEOUT_MS), })` |
| lib/hatsuneNewsAi.js:61 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions: "あなたはBoatStrikers NEWSの編集者です。与えられた事実だけを使ってニュースを要約してください。元記事の文章を長く引用せず、自分の言葉で整理します。事実にない選手名、着順、決まり手、数値、コメント、評価、展開を推測・創作してはいけません。出力は必ずJSONのみで、キーは summary と article_body の2つです。summaryは100〜200文字程度で、最初の1文で何が起きたニュースか分かるようにしてください。『記事を確認しました』『元記事を転載せず』『詳しくは出典元へ』のようなサイト運営上の説明はsummaryにもarticle_bodyにも入れないでください。article_` |
| lib/hatsuneNewsCollector.js:143 | `fetch(OFFICIAL_NEWS_URL, { headers: { "User-Agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" }, cache: "no-store", })` |
| lib/hatsuneNewsVideoAi.js:97 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions: '${promptFor(videoType, duration)}\n出力はJSONのみ。キーは title, script, captions, youtube_title, youtube_description, x_text, hashtags。captionsは字幕用の短文文字列配列。hashtagsは#なしの文字列配列。X本文は140文字以内を目安。元情報の出典表現を長く転載しない。', input: JSON.stringify( { video_type: videoType, target_date: targetDate, period_start: periodStart, period` |
| lib/historicalOriginalTenji.js:74 | `fetch(url,{redirect:'manual',cache:'no-store',signal:control.signal,headers:{'User-Agent':'BoatStrikers-ExhibitionDiagnostic/1.0',Referer:new URL('/',url).href,'X-Requested-With':'XMLHttpRequest'}})` |
| lib/kiryuVerifiedOriginalTenji.js:89 | `fetch(url,{cache:'no-store',redirect:'manual',signal:controller.signal,headers:{'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',...extraHeaders}})` |
| lib/marugameVerifiedOriginalTenji.js:66 | `fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)', Referer: 'https://www.marugameboat.jp/' } })` |
| lib/mediaEditorialAi.js:31 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions, input: '公式動画データ:\n${input}', max_output_tokens: 1100 }), })` |
| lib/mikuniVerifiedOriginalTenji.js:50 | `fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "user-agent": "BoatStrikers-ExhibitionDiagnostic/1.0", "x-requested-with": "XMLHttpRequest", referer: "https://www.mikuniks-web.jp/" } })` |
| lib/morningGeminiNewsCollector.js:59 | `fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(55000), body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.15, maxOutputTokens: 5000 }, }), })` |
| lib/narutoKaratsuVerifiedTenji.js:69 | `fetch(url,{redirect:'manual',cache:'no-store',signal:abort.signal,headers:{'User-Agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)','X-Requested-With':'XMLHttpRequest',Referer:new URL('/',url).href}})` |
| lib/nationalBeforeInfoIdentity.js:42 | `fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" } })` |
| lib/newsCandidateVerifier.js:74 | `fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal, headers: { "User-Agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" }, })` |
| lib/newsShortAi.js:108 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions, input: JSON.stringify(input, null, 2), max_output_tokens: 1600 }), })` |
| lib/newsXDraftAi.js:36 | `fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: 'Bearer ${apiKey}' }, body: JSON.stringify({ model, instructions, input, max_output_tokens: 600 }), })` |
| lib/officialOriginalTenji.js:303 | `fetch(url, { cache: "no-store", signal: controller.signal, method: request.method \|\| "GET", body: request.body, headers: { "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)", accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "ja,en-US;q=0.8,en;q=0.6", ...(request.headers \|\| {}), }, })` |
| lib/officialRaceCancellationSync.js:59 | `fetch(url, { cache: "no-store", headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/xhtml+xml", }, signal: AbortSignal.timeout(15000), })` |
| lib/shimonosekiWakamatsuVerifiedOriginalTenji.js:143 | `fetch(url, { cache: 'no-store', redirect: 'manual', signal, headers: { 'user-agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)', referer: new URL('/', url).href, }, })` |
| lib/suminoeOmuraVerifiedOriginalTenji.js:51 | `fetch(url, { cache: 'no-store', redirect: 'manual', signal, headers: { 'user-agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)', referer: new URL('/', url).href, }, })` |
| lib/tamagawaVerifiedTenji.js:59 | `fetch(target,{cache:'no-store',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',Referer:new URL('/',target).href}})` |
| lib/todaVerifiedOriginalTenji.js:12 | `fetch(url,{cache:'no-store',redirect:'manual',signal:c.signal,headers:{'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',referer:'https://www.boatrace-toda.jp/'}})` |
| lib/tokuyamaVerifiedOriginalTenji.js:83 | `fetch(url, { cache: 'no-store', redirect: 'manual', signal, headers: { 'user-agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)', referer: new URL('/', url).href, }, })` |
| lib/tsuOfficialOriginalTenji.js:73 | `fetch(url, { cache: "no-store", redirect, signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)", accept: "text/html,application/xhtml+xml", "accept-language": "ja,en-US;q=0.8,en;q=0.6", "cache-control": "no-cache", pragma: "no-cache", "x-requested-with": "XMLHttpRequest", referer, ...(cookie ? { cookie } : {}), }, })` |
| scripts/render-hatsune-news.mjs:36 | `fetch(url, { ...options, headers })` |
| scripts/render-hatsune-news.mjs:42 | `fetch(url)` |
| scripts/render-hatsune-news.mjs:50 | `fetch('${endpoint}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}', { method: "POST" })` |
| scripts/render-hatsune-news.mjs:58 | `fetch('${endpoint}/synthesis?speaker=${speakerId}', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) })` |
| scripts/render-hatsune-news.mjs:86 | `fetch('${endpoint}/speakers')` |
| scripts/render-short.mjs:78 | `fetch('${endpoint}/audio_query?text=${encodeURIComponent(plan.narration)}&speaker=${speakerId}', { method: "POST" })` |
| scripts/render-short.mjs:87 | `fetch('${endpoint}/synthesis?speaker=${speakerId}', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query), })` |

## dynamic化候補（同名の非Next関数を含む）

| ファイル:行 | コード |
|---|---|
| app/admin/ai-bet-stats/page.js:4 | `export const dynamic = "force-dynamic";` |
| app/admin/ai-bet-stats/page.js:5 | `export const revalidate = 0;` |
| app/admin/ai-candidates/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/alerts/collection/page.js:9 | `export const dynamic = 'force-dynamic';` |
| app/admin/alerts/exhibition/page.js:17 | `const response=await fetch('${venue.endpoint}?course=${venue.code}&date=${date}&race=${race}',{cache:'no-store',signal:controller.current.signal});` |
| app/admin/alerts/page.js:6 | `export const dynamic = 'force-dynamic';` |
| app/admin/condition-research/page.js:4 | `export const dynamic = "force-dynamic";` |
| app/admin/data-lab-social/page.js:10 | `export const dynamic = "force-dynamic";` |
| app/admin/data-lab-social/page.js:11 | `export const revalidate = 0;` |
| app/admin/discord-replies/page.js:34 | `const r=await fetch('/api/admin/discord-character-replies?mode=threads',{headers:{Authorization:'Bearer ${token}'},cache:"no-store"});` |
| app/admin/discord-replies/page.js:42 | `const r=await fetch('/api/admin/discord-character-replies?character=${character}',{headers:{Authorization:'Bearer ${token}'},cache:"no-store"});` |
| app/admin/editorial/daily/hatsune/page.js:7 | `export const dynamic = "force-dynamic";` |
| app/admin/editorial/media/page.js:10 | `export const dynamic = "force-dynamic";` |
| app/admin/editorial/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/editorial/produce/[id]/page.js:9 | `export const dynamic = "force-dynamic";` |
| app/admin/editorial/x/page.js:7 | `export const dynamic = "force-dynamic";` |
| app/admin/engine-v3/EngineV3AdminClient.js:28 | `const response = await fetch('/api/admin/engine-v3/refresh', { cache: 'no-store' });` |
| app/admin/engine-v3/page.js:3 | `export const dynamic = 'force-dynamic';` |
| app/admin/exhibition-alerts/page.js:76 | `const res = await fetch('/api/admin/exhibition-alerts?${qs.toString()}', { cache: "no-store" });` |
| app/admin/exhibition-data-status/backfill/page.js:3 | `export const dynamic = "force-dynamic";` |
| app/admin/exhibition-data-status/page.js:3 | `export const dynamic = "force-dynamic";` |
| app/admin/hatsune-news-status/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/hatsune-news-status/page.js:6 | `export const revalidate = 0;` |
| app/admin/hatsune-news/editor/[id]/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/hatsune-news/editor/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/hatsune-news/video/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/hatsune-womens-inner-break/page.js:10 | `const load=useCallback(async()=>{try{const r=await fetch('/api/admin/hatsune-womens-inner-break?date=${date}&mode=day',{cache:"no-store"});const j=await r.json();if(!r.ok\|\|!j.ok)throw new Error(j.error\|\|"取得失敗");setData(j);setError("");}catch(e){setError(e.message\|\|"取得失敗");}},[date]);` |
| app/admin/ichika-escape-surge/page.js:4 | `export const dynamic = "force-dynamic";` |
| app/admin/ichika-escape-surge/page.js:5 | `export const revalidate = 0;` |
| app/admin/ichika-hidden-escape/page.js:76 | `const res = await fetch('/api/admin/ichika-hidden-escape?${qs.toString()}', { cache: "no-store" });` |
| app/admin/magazine/MagazineAdminClient.js:34 | `const load=useCallback(async()=>{const r=await fetch('/api/admin/magazine/issues',{cache:'no-store'});if(r.status===401){location.href='/admin/radio-blog/login';return}const j=await r.json();if(r.ok)setIssues(j.issues\|\|[]);else setMessage(j.error\|\|'取得できませんでした。')},[]);` |
| app/admin/magazine/page.js:4 | `export const dynamic = 'force-dynamic';` |
| app/admin/members/_lib/membersAdminAuth.js:54 | `const store = await cookies();` |
| app/admin/members/_lib/membersAdminAuth.js:59 | `const store = await cookies();` |
| app/admin/members/_lib/membersAdminAuth.js:70 | `const store = await cookies();` |
| app/admin/members/page.js:12 | `export const dynamic = "force-dynamic";` |
| app/admin/news-shorts/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/note/NoteFeatureAdmin.js:32 | `const response = await fetch('/api/admin/note-features?date=${date}', { cache: "no-store" });` |
| app/admin/note/page.js:6 | `export const dynamic = "force-dynamic";` |
| app/admin/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/radio-blog/RadioBlogAdminClient.js:67 | `cache: "no-store",` |
| app/admin/radio-blog/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/realtime/RealtimeAdminClient.js:12 | `async function load(){const r=await fetch("/api/admin/realtime/items",{cache:"no-store"});const j=await r.json();if(r.ok)setItems(j.items\|\|[]);else setMessage(j.error\|\|"取得失敗");}` |
| app/admin/realtime/login/RealtimeLoginClient.js:5 | `export default function RealtimeLoginClient(){const router=useRouter();const[password,setPassword]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);async function submit(e){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/admin/schedule/login",{method:"POST",headers:{"Content-Type":"appl` |
| app/admin/realtime/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/schedule/ScheduleAdminClient.js:55 | `cache: "no-store",` |
| app/admin/schedule/_lib/scheduleAdminAuth.js:49 | `const store = await cookies();` |
| app/admin/schedule/login/ScheduleLoginClient.js:23 | `cache: "no-store",` |
| app/admin/schedule/login/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/schedule/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/seminar-magazines/SeminarMagazineAdminClient.js:30 | `const load=useCallback(async()=>{ const r=await fetch('/api/admin/seminar-magazines/issues',{cache:'no-store'}); if(r.status===401){location.href='/admin/radio-blog/login';return;} const j=await r.json(); if(r.ok)setIssues(j.issues\|\|[]); else setMessage(j.error\|\|'取得できませんでした。'); },[]);` |
| app/admin/seminar-magazines/page.js:3 | `export const dynamic = "force-dynamic";` |
| app/admin/shorts/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/admin/stadium-ai-v2/page.js:2 | `export const dynamic='force-dynamic';` |
| app/admin/stadium-ai/page.js:3 | `export const dynamic='force-dynamic';` |
| app/admin/sync/SyncDashboardClient.js:16 | `const load = useCallback(async()=>{ const r=await fetch("/api/admin/sync/status",{cache:"no-store"}); if(r.status===401){location.href="/admin/sync/login";return;} setData(await r.json()); },[]);` |
| app/admin/sync/_lib/adminAuth.js:34 | `const store = await cookies();` |
| app/admin/sync/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/admin/ticker/TickerAdminClient.js:5 | `export default function Client(){const[items,setItems]=useState([]),[form,setForm]=useState(EMPTY),[msg,setMsg]=useState("");const load=useCallback(async()=>{const r=await fetch("/api/admin/ticker/items",{cache:"no-store"});if(r.status===401){location.href="/admin/schedule/login";return}const d=await r.json();setItems(d.items\|\|[]);if(!r.ok)setMsg(d` |
| app/admin/ticker/page.js:4 | `export const dynamic="force-dynamic";` |
| app/admin/x-night-posts/page.js:6 | `export const dynamic = "force-dynamic";` |
| app/ai-results-full/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/ai-results/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/admin/amagasaki-original-html-diagnostic/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/amagasaki-original-html-diagnostic/route.js:15 | `cache: "no-store",` |
| app/api/admin/discord-character-replies/route.js:6 | `export const dynamic="force-dynamic";` |
| app/api/admin/discord-character-replies/route.js:56 | `body:JSON.stringify({name:spec.webhookName\|\|'BSC ${spec.name}',avatar}),cache:"no-store",` |
| app/api/admin/discord-character-replies/route.js:131 | `body:JSON.stringify({username:spec.name,content,allowed_mentions:{parse:[]}}),cache:"no-store",` |
| app/api/admin/discord-character-replies/route.js:145 | `method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",` |
| app/api/admin/engine-v3/refresh/route.js:4 | `export const dynamic = 'force-dynamic';` |
| app/api/admin/engine-v3/refresh/route.js:86 | `}, { headers: { 'Cache-Control': 'no-store' } });` |
| app/api/admin/exhibition-alerts/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/admin/exhibition-backfill/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/admin/exhibition-source-diagnostic/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/admin/hatsune-news/generate-ai/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/admin/hatsune-news/video/render-manifest/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/admin/hatsune-news/video/rendered/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/admin/hatsune-news/video/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/admin/hatsune-womens-inner-break/route.js:3 | `export const dynamic="force-dynamic";export const runtime="nodejs";` |
| app/api/admin/historical-exhibition-check/route.js:3 | `export const dynamic='force-dynamic';` |
| app/api/admin/historical-exhibition-check/route.js:9 | `const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});` |
| app/api/admin/ichika-hidden-escape/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/admin/miyajima-original-html-diagnostic/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/miyajima-original-html-diagnostic/route.js:22 | `cache: "no-store",` |
| app/api/admin/official-exhibition-probe/route.js:4 | `export const dynamic = 'force-dynamic';` |
| app/api/admin/official-exhibition-probe/route.js:67 | `const res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: controller.signal,` |
| app/api/admin/official-exhibition-probe/route.js:113 | `const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });` |
| app/api/admin/realtime/items/route.js:4 | `export const dynamic="force-dynamic";` |
| app/api/admin/results/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/admin/results/upload/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/admin/schedule/items/[id]/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/schedule/items/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/schedule/login/route.js:7 | `export const dynamic = "force-dynamic";` |
| app/api/admin/schedule/logout/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/admin/stadium-ai-v2/refresh/route.js:3 | `export const dynamic='force-dynamic';` |
| app/api/admin/sync/status/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/admin/ticker/items/route.js:4 | `export const dynamic="force-dynamic";` |
| app/api/admin/toda-original-html-diagnostic/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/toda-original-html-diagnostic/route.js:22 | `cache: "no-store",` |
| app/api/admin/tsu-original-html-diagnostic/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/tsu-original-html-diagnostic/route.js:66 | `cache: "no-store",` |
| app/api/admin/tsu-original-tenji-test/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/admin/tsu-source-diagnostic/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/admin/tsu-source-diagnostic/route.js:23 | `cache: "no-store",` |
| app/api/admin/verified-exhibition-check/route.js:14 | `export const dynamic = 'force-dynamic';` |
| app/api/admin/verified-exhibition-check/route.js:27 | `const reply = (body, status=200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });` |
| app/api/ai-v2/character-panel/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/ai-v2/settle-bets/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/ai/generate-predictions/route.js:15 | `export const dynamic = "force-dynamic";` |
| app/api/boatstrikers-health/route.js:7 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-control/actions/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-control/finalize-upload/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-control/jobs/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-control/status/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-control/upload-url/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-dashboard/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-factory/actions/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-factory/jobs/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-factory/models/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-factory/status/route.js:3 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-v6/dashboard/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai-v8/dashboard/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai/dashboard/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai/health/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai/jobs/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai/live-result/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai/upload/route.js:9 | `export const dynamic = "force-dynamic";` |
| app/api/bsc2/ai/v5-dashboard/route.js:8 | `export const dynamic = "force-dynamic";` |
| app/api/cron/ai-previous-day-health/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/cron/ai-previous-day-health/route.js:62 | `cache: "no-store",` |
| app/api/cron/daily-result-digest/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/cron/data-lab-social/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/discord-alerts/route.js:7 | `export const dynamic="force-dynamic";` |
| app/api/cron/discord-alerts/route.js:135 | `cache:"no-store",` |
| app/api/cron/discord-community-poll/route.js:4 | `export const dynamic="force-dynamic";` |
| app/api/cron/discord-community-setup/route.js:4 | `export const dynamic="force-dynamic";` |
| app/api/cron/discord-membership-sync/route.js:4 | `export const dynamic="force-dynamic";` |
| app/api/cron/discord-race-threads/route.js:6 | `export const dynamic="force-dynamic";` |
| app/api/cron/discord-race-threads/route.js:93 | `cache:"no-store",` |
| app/api/cron/discord-race-threads/route.js:116 | `cache:"no-store",` |
| app/api/cron/elimination-odds-snapshots/route.js:7 | `export const dynamic = "force-dynamic";` |
| app/api/cron/exhibition-alert-lines/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/exhibition-alerts/route.js:15 | `export const dynamic = "force-dynamic";` |
| app/api/cron/hatsune-news-ai/route.js:6 | `export const dynamic = "force-dynamic";` |
| app/api/cron/hatsune-news-pipeline/route.js:12 | `export const dynamic = "force-dynamic";` |
| app/api/cron/hatsune-womens-inner-break/route.js:4 | `export const dynamic="force-dynamic";export const runtime="nodejs";` |
| app/api/cron/ichika-escape-surge/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/ichika-hidden-escape/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/media-editorials/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/news-editorials/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/news-morning-collect/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/news-short-draft/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/news-verify/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/news-x-drafts/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/race-cancellations/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/x-night-candidates/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/cron/x-night-posts/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/discord/avatar/[character]/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/home-performance/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/home-performance/route.js:204 | `}, { headers: { "Cache-Control": "no-store" } });` |
| app/api/home/realtime/route.js:4 | `export const dynamic = "force-dynamic";` |
| app/api/live/openapi-preview/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/live/openapi-preview/route.js:122 | `cache: "no-store",` |
| app/api/magazine-auth/route.js:54 | `{ headers: { "Cache-Control": "no-store" } }` |
| app/api/magazine-auth/route.js:81 | `response.headers.set("Cache-Control", "no-store");` |
| app/api/magazine-page/route.js:7 | `export const dynamic = "force-dynamic";` |
| app/api/magazine-page/route.js:56 | `"Cache-Control": "private, no-store, max-age=0",` |
| app/api/magazine-premium-page/route.js:9 | `export const dynamic="force-dynamic";` |
| app/api/magazine-premium-page/route.js:15 | `if(!entitlement.plus)return new NextResponse("Membership Required",{status:401,headers:{"Cache-Control":"private, no-store, max-age=0"}});` |
| app/api/magazine-premium-page/route.js:36 | `return new NextResponse(await data.arrayBuffer(),{status:200,headers:{"Content-Type":data.type\|\|"image/jpeg","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});` |
| app/api/magazine-premium-page/route.js:45 | `return new NextResponse(data,{status:200,headers:{"Content-Type":"image/png","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});` |
| app/api/magazine-unlock/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/members/discord/callback/route.js:30 | `const tokenResponse=await fetch("https://discord.com/api/v10/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:tokenBody,cache:"no-store"});` |
| app/api/members/discord/callback/route.js:35 | `const meResponse=await fetch("https://discord.com/api/v10/users/@me",{headers:{Authorization:'Bearer ${tokenData.access_token}'},cache:"no-store"});` |
| app/api/members/entitlement/route.js:5 | `export const dynamic="force-dynamic";` |
| app/api/members/entitlement/route.js:18 | `},{headers:{"Cache-Control":"private, no-store, max-age=0"}});` |
| app/api/members/ichika-consult/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/api/members/session/route.js:5 | `export const dynamic="force-dynamic";` |
| app/api/members/stadium-premium/[place]/route.js:6 | `export const dynamic = 'force-dynamic';` |
| app/api/members/stadium-premium/[place]/route.js:7 | `export const revalidate = 0;` |
| app/api/members/stadium-premium/[place]/route.js:83 | `}, { headers: { 'Cache-Control': 'no-store, max-age=0' } });` |
| app/api/stadium/today/[place]/route.js:12 | `export const dynamic = 'force-dynamic';` |
| app/api/stadium/today/[place]/route.js:13 | `export const revalidate = 0;` |
| app/api/stadium/today/[place]/route.js:46 | `return NextResponse.json({ stadium, raceDate, races, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });` |
| app/bsc2/admin/ai-dashboard/page.js:432 | `cache: "no-store",` |
| app/bsc2/admin/ai-factory/page.js:41 | `fetch('/api/bsc2/ai-factory/models?${qs}',{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"}),` |
| app/bsc2/admin/ai-factory/page.js:42 | `fetch("/api/bsc2/ai-factory/jobs",{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"}),` |
| app/bsc2/admin/ai-factory/page.js:43 | `fetch("/api/bsc2/ai-factory/status",{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"}),` |
| app/bsc2/admin/ai-v6/page.js:31 | `cache:"no-store",` |
| app/bsc2/admin/ai-v8/page.js:20 | `const res=await fetch(url,{...options,headers:{...(options.headers\|\|{}),"x-bsc-ai-key":key},cache:"no-store"});` |
| app/bsc2/admin/ai/page.js:88 | `cache: "no-store",` |
| app/bsc2/admin/page.js:145 | `readJson(await fetch("/api/bsc2/ai-control/jobs?limit=50", { headers: { "x-bsc-ai-key": adminKey }, cache: "no-store" }), "ジョブ取得に失敗しました"),` |
| app/bsc2/admin/page.js:146 | `readJson(await fetch("/api/bsc2/ai-control/status", { headers: { "x-bsc-ai-key": adminKey }, cache: "no-store" }), "状態取得に失敗しました"),` |
| app/comic/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/comic/page.js:6 | `export const revalidate = 0;` |
| app/components/CharacterAiRoomPanel.js:180 | `cache: "no-store",` |
| app/components/HomeCompactRealtime.js:31 | `fetch("/api/home/realtime", { cache: "no-store" })` |
| app/components/MonthlyPerformanceSlider.js:89 | `fetch('/api/home-performance${query}', { cache: "no-store" })` |
| app/discord-assets/hatsune.jpg/route.js:5 | `export const dynamic = "force-dynamic";` |
| app/hatsune/news/[id]/page.js:11 | `export const dynamic = "force-dynamic";` |
| app/hatsune/news/[id]/page.js:12 | `export const revalidate = 0;` |
| app/hatsune/news/page.js:12 | `export const dynamic = "force-dynamic";` |
| app/hatsune/news/page.js:13 | `export const revalidate = 0;` |
| app/hatsune/page.js:7 | `export const dynamic = "force-dynamic";` |
| app/hatsune/page.js:8 | `export const revalidate = 0;` |
| app/hatsune/schedule/page.js:10 | `export const dynamic = "force-dynamic";` |
| app/hatsune/schedule/page.js:11 | `export const revalidate = 0;` |
| app/ichika-sensei/page.js:4 | `export const dynamic = "force-dynamic";` |
| app/ichika-sensei/page.js:5 | `export const revalidate = 0;` |
| app/ichika/page.js:7 | `export const dynamic = "force-dynamic";` |
| app/ichika/page.js:8 | `export const revalidate = 0;` |
| app/kiina/page.js:7 | `export const dynamic = "force-dynamic";` |
| app/kiina/page.js:8 | `export const revalidate = 0;` |
| app/lib/boatstrikersLive.js:16 | `global:{fetch:(input,init={})=>fetch(input,{...init,cache:"no-store"})}` |
| app/lib/discordPremium.js:53 | `cache:"no-store",` |
| app/lib/memberSessionSync.js:73 | `cache: "no-store",` |
| app/lib/memberSessionSync.js:101 | `fetch("/api/members/session", { method: "DELETE", cache: "no-store" });` |
| app/library/components/MagazineSwipeViewer.js:50 | `await fetch("/api/members/session",{method:"POST",headers,cache:"no-store"});` |
| app/library/components/MagazineSwipeViewer.js:53 | `const response=await fetch("/api/members/entitlement",{headers,cache:"no-store"});` |
| app/library/hatsune-seminar/[issue]/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/library/hatsune-seminar/page.js:3 | `export const dynamic = "force-dynamic";` |
| app/library/ichika-seminar/[issue]/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/library/ichika-seminar/page.js:3 | `export const dynamic = "force-dynamic";` |
| app/library/kiina-seminar/[issue]/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/library/kiina-seminar/page.js:3 | `export const dynamic = "force-dynamic";` |
| app/library/stadium/[place]/StadiumPremiumMemberArea.js:56 | `cache: 'no-store',` |
| app/library/stadium/[place]/TodayRacePremium.js:20 | `const response = await fetch('/api/stadium/today/${encodeURIComponent(place)}', { cache: 'no-store' });` |
| app/library/stadium/[place]/page.js:7 | `export const dynamic = 'force-dynamic';` |
| app/library/stadium/shimonoseki/page.js:5 | `export const dynamic = 'force-dynamic';` |
| app/library/weekly/[slug]/page.js:6 | `export const dynamic='force-dynamic';` |
| app/library/weekly/page.js:4 | `export const dynamic='force-dynamic';` |
| app/members/discord/page.js:32 | `const response=await fetch("/api/members/discord/preferences",{headers:{Authorization:'Bearer ${nextSession.access_token}'},cache:"no-store"});` |
| app/members/discord/page.js:40 | `const response=await fetch("/api/members/discord/status",{headers:{Authorization:'Bearer ${nextSession.access_token}'},cache:"no-store"});` |
| app/members/ichika-consult/page.js:33 | `const r=await fetch("/api/members/ichika-consult",{headers:{Authorization:'Bearer ${nextSession.access_token}'},cache:"no-store"});` |
| app/news/[id]/page.js:13 | `export const dynamic = "force-dynamic";` |
| app/news/[id]/page.js:14 | `export const revalidate = 0;` |
| app/news/media/[videoId]/page.js:7 | `export const dynamic = "force-dynamic";` |
| app/news/media/[videoId]/page.js:8 | `export const revalidate = 0;` |
| app/news/media/page.js:6 | `export const dynamic = "force-dynamic";` |
| app/news/media/page.js:7 | `export const revalidate = 0;` |
| app/news/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/news/page.js:6 | `export const revalidate = 0;` |
| app/page.js:14 | `export const dynamic = "force-dynamic";` |
| app/page.js:15 | `export const revalidate = 0;` |
| app/races/[courseCode]/[raceNo]/page.example.js:13 | `export const dynamic = "force-dynamic";` |
| app/races/[courseCode]/[raceNo]/page.js:19 | `export const dynamic = "force-dynamic";` |
| app/races/[courseCode]/[raceNo]/page.js:23 | `const cookieStore=await cookies();` |
| app/races/[courseCode]/info/page.js:9 | `export const dynamic = "force-dynamic";` |
| app/races/[courseCode]/newspaper/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/races/[courseCode]/page.js:15 | `export const dynamic = "force-dynamic";` |
| app/races/page.js:16 | `export const dynamic = "force-dynamic";` |
| app/radio/blog/[slug]/page.supabase-example.js:5 | `export const dynamic = "force-dynamic";` |
| app/results/page.js:5 | `export const dynamic = "force-dynamic";` |
| app/results/page.js:6 | `export const revalidate = 0;` |
| app/schedule/page.js:8 | `export const dynamic = "force-dynamic";` |
| app/tools/elimination/[courseCode]/[raceNo]/page.js:9 | `export const dynamic = "force-dynamic";` |
| app/tools/elimination/[courseCode]/[raceNo]/page.js:13 | `const cookieStore = await cookies();` |
| lib/amagasakiOfficialOriginalTenji.js:67 | `cache: "no-store",` |
| lib/boatersOriginalTenji.js:13 | `async function fetchText(url,timeoutMs){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{cache:"no-store",redirect:"follow",signal:controller.signal,headers:{"user-agent":"Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",accept:"text/ht` |
| lib/boatraceOdds.js:69 | `cache: "no-store",` |
| lib/boatstrikersGeneralNewsSync.js:58 | `cache: "no-store",` |
| lib/boatstrikersLive.js:16 | `global:{fetch:(input,init={})=>fetch(input,{...init,cache:"no-store"})}` |
| lib/fukuokaVerifiedOriginalTenji.js:74 | `const response = await fetch(url, { cache:'no-store', redirect:'manual', signal:controller.signal, headers:{ 'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)', referer:'https://www.boatrace-fukuoka.com/modules/yosou/' } });` |
| lib/hamanakoAshiyaVerifiedOriginalTenji.js:100 | `const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal, headers });` |
| lib/hatsuneMediaNewsCollector.js:163 | `cache: "no-store",` |
| lib/hatsuneNewsCollector.js:145 | `cache: "no-store",` |
| lib/historicalOriginalTenji.js:74 | `const res=await fetch(url,{redirect:'manual',cache:'no-store',signal:control.signal,headers:{'User-Agent':'BoatStrikers-ExhibitionDiagnostic/1.0',Referer:new URL('/',url).href,'X-Requested-With':'XMLHttpRequest'}});` |
| lib/kiryuVerifiedOriginalTenji.js:89 | `const response = await fetch(url,{cache:'no-store',redirect:'manual',signal:controller.signal,headers:{'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',...extraHeaders}});` |
| lib/marugameVerifiedOriginalTenji.js:66 | `const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal,` |
| lib/mikuniVerifiedOriginalTenji.js:50 | `const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "user-agent": "BoatStrikers-ExhibitionDiagnostic/1.0", "x-requested-with": "XMLHttpRequest", referer: "https://www.mikuniks-web.jp/" } });` |
| lib/morningGeminiNewsCollector.js:62 | `cache: "no-store",` |
| lib/narutoKaratsuVerifiedTenji.js:69 | `const res=await fetch(url,{redirect:'manual',cache:'no-store',signal:abort.signal,headers:{'User-Agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)','X-Requested-With':'XMLHttpRequest',Referer:new URL('/',url).href}});` |
| lib/nationalBeforeInfoIdentity.js:19 | `const table = tables.filter((item) => headers(item) === "枠\|写真\|ボートレーサー\|体重\|展示 タイム\|チルト\|プロペラ\|部品交換\|前走成績\|調整重量");` |
| lib/nationalBeforeInfoIdentity.js:42 | `const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" } });` |
| lib/newsCandidateVerifier.js:77 | `cache: "no-store",` |
| lib/officialOriginalTenji.js:304 | `cache: "no-store",` |
| lib/officialRaceCancellationSync.js:60 | `cache: "no-store",` |
| lib/radioBlogAdminAuth.js:47 | `const cookieStore = await cookies();` |
| lib/shimonosekiWakamatsuVerifiedOriginalTenji.js:144 | `cache: 'no-store',` |
| lib/suminoeOmuraVerifiedOriginalTenji.js:52 | `cache: 'no-store', redirect: 'manual', signal,` |
| lib/tamagawaVerifiedTenji.js:23 | `const originalTables=tables(original).filter(t=>headers(t)==='枠\|級別/登録番号 選手名 支部/出身地/年齢\|体重\|調整\|チルト\|展示\|オリジナル展示データ\|一周\|まわり足\|直線');` |
| lib/tamagawaVerifiedTenji.js:24 | `const referenceTables=tables(reference).filter(t=>headers(t)==='枠\|写真\|ボートレーサー\|体重\|展示 タイム\|チルト\|プロペラ\|部品交換\|前走成績\|調整重量');` |
| lib/tamagawaVerifiedTenji.js:59 | `const response=await fetch(target,{cache:'no-store',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',Referer:new URL('/',target).href}});` |
| lib/todaVerifiedOriginalTenji.js:12 | `async function read(url,options={}){const c=new AbortController(),timer=setTimeout(()=>c.abort(),Math.min(18000,Math.max(1000,Number(options.timeoutMs)\|\|15000)));try{const response=await fetch(url,{cache:'no-store',redirect:'manual',signal:c.signal,headers:{'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',referer:'https://www.boat` |
| lib/tokuyamaVerifiedOriginalTenji.js:84 | `cache: 'no-store', redirect: 'manual', signal,` |
| lib/tsuOfficialOriginalTenji.js:74 | `cache: "no-store",` |

## タイマー・認証・イベント・router候補

| ファイル:行 | コード |
|---|---|
| app/PublicSiteHeader.js:126 | `window.addEventListener("scroll", updateScrolled, { passive: true })` |
| app/PublicSiteHeader.js:139 | `window.addEventListener("keydown", onKeyDown)` |
| app/admin/AdminHatsuneNewsShortcut.js:25 | `window.setTimeout(findTarget, 100)` |
| app/admin/ai-candidates/SocialMaterialsPanel.js:197 | `window.setTimeout(() => setter(false), 1600)` |
| app/admin/alerts/collection/CollectionRefresh.js:10 | `setInterval(() => { if (!document.hidden && !pending) startTransition(() => router.refresh()); }, 30000)` |
| app/admin/alerts/collection/CollectionRefresh.js:11 | `router.refresh()` |
| app/admin/alerts/collection/CollectionRefresh.js:15 | `router.refresh()` |
| app/admin/alerts/exhibition/page.js:15 | `setTimeout(()=>controller.current.abort(),25000)` |
| app/admin/data-lab-social/ClientActions.js:13 | `setTimeout(() => setCopied(""), 1600)` |
| app/admin/data-lab-social/ClientActions.js:16 | `setTimeout(() => setCopied(""), 1600)` |
| app/admin/data-lab-social/MinamoComicPromptBuilder.js:130 | `window.setTimeout(() => setCopied(false), 1600)` |
| app/admin/data-lab-social/PromptBuilder.js:118 | `setTimeout(() => setCopiedKey(""), 1600)` |
| app/admin/editorial/produce/[id]/CopyButton.js:12 | `window.setTimeout(() => setCopied(false), 1600)` |
| app/admin/exhibition-alerts/page.js:102 | `setInterval(load, 10000)` |
| app/admin/exhibition-data-status/BackfillButton.js:34 | `setTimeout(() => window.location.reload(), 1200)` |
| app/admin/hatsune-womens-inner-break/page.js:11 | `setInterval(load,10000)` |
| app/admin/ichika-hidden-escape/page.js:102 | `setInterval(load, 10000)` |
| app/admin/newspaper/NewspaperPromptAssistant.js:66 | `window.addEventListener("keydown", onKey)` |
| app/admin/newspaper/NewspaperPromptAssistant.js:82 | `window.setTimeout(() => setCopied(false), 1800)` |
| app/admin/newspaper/NewspaperPromptAssistant.js:91 | `window.setTimeout(() => setCopied(false), 1800)` |
| app/admin/note/NoteFeatureAdmin.js:78 | `setTimeout(() => load(e.target.value), 0)` |
| app/admin/radio-blog/login/RadioBlogLoginClient.js:32 | `router.replace("/admin/radio-blog")` |
| app/admin/radio-blog/login/RadioBlogLoginClient.js:33 | `router.refresh()` |
| app/admin/realtime/login/RealtimeLoginClient.js:5 | `router.replace("/admin/realtime")` |
| app/admin/realtime/login/RealtimeLoginClient.js:5 | `router.refresh()` |
| app/admin/schedule/login/ScheduleLoginClient.js:32 | `router.replace("/admin/schedule")` |
| app/admin/schedule/login/ScheduleLoginClient.js:33 | `router.refresh()` |
| app/admin/sync/SyncDashboardClient.js:17 | `setInterval(load,15000)` |
| app/admin/x-night-posts/CopyPostCard.js:13 | `setTimeout(() => setCopied(false), 1500)` |
| app/api/admin/amagasaki-original-html-diagnostic/route.js:12 | `setTimeout(() => controller.abort(), timeoutMs)` |
| app/api/admin/miyajima-original-html-diagnostic/route.js:19 | `setTimeout(() => controller.abort(), timeoutMs)` |
| app/api/admin/official-exhibition-probe/route.js:64 | `setTimeout(() => controller.abort(), 10000)` |
| app/api/admin/toda-original-html-diagnostic/route.js:19 | `setTimeout(() => controller.abort(), timeoutMs)` |
| app/api/admin/tsu-original-html-diagnostic/route.js:63 | `setTimeout(() => controller.abort(), timeoutMs)` |
| app/api/admin/tsu-source-diagnostic/route.js:15 | `setTimeout(() => controller.abort(), ms)` |
| app/bsc2/admin/ai-factory/page.js:51 | `setInterval(load,5000)` |
| app/bsc2/admin/ai-v6/page.js:49 | `setInterval(load,8000)` |
| app/bsc2/admin/ai-v8/page.js:33 | `setInterval(load,8000)` |
| app/bsc2/admin/ai/page.js:117 | `setInterval(load, 8000)` |
| app/bsc2/admin/newspaper/ichika/zenjitsu/page.js:189 | `window.setTimeout(() => { try { localStorage.setItem( STORAGE_KEY, JSON.stringify(form) ); setSaveMessage("下書きを自動保存しました"); window.setTimeout(() => { setSaveMessage(""); }, 1800); } catch (error) { console.error("自動保存エラー", error); } }, 600)` |
| app/bsc2/admin/newspaper/ichika/zenjitsu/page.js:198 | `window.setTimeout(() => { setSaveMessage(""); }, 1800)` |
| app/bsc2/admin/newspaper/ichika/zenjitsu/page.js:341 | `window.setTimeout(() => { document .getElementById("ichika-preview") ?.scrollIntoView({ behavior: "smooth", block: "start", }); }, 100)` |
| app/bsc2/admin/newspaper/ichika/zenjitsu/page.js:401 | `window.setTimeout(() => { document .getElementById("generated-newspaper") ?.scrollIntoView({ behavior: "smooth", block: "start", }); }, 100)` |
| app/bsc2/admin/page.js:154 | `setInterval(loadData, 5000)` |
| app/bsc2/components/ChapterChatEngine.js:86 | `setTimeout(() => { setMessages((prev) => [...prev, current]); if (current.type === "talk") { setReaction("talk"); setTimeout(goNext, current.delay \|\| 1200); } if (current.type === "quiz") { setReaction("question"); } if (current.type === "clear") { setReaction("clear"); setTimeout(() => setShowResult(true), 1500); } }, 450)` |
| app/bsc2/components/ChapterChatEngine.js:91 | `setTimeout(goNext, current.delay \|\| 1200)` |
| app/bsc2/components/ChapterChatEngine.js:100 | `setTimeout(() => setShowResult(true), 1500)` |
| app/bsc2/components/ChapterChatEngine.js:143 | `setTimeout(() => { setReaction(null); goNext(); }, 1700)` |
| app/bsc2/components/ChapterRpgEngine.js:36 | `setTimeout(() => { nextStep(); }, step.delay \|\| 1000)` |
| app/bsc2/components/ChatEngine.js:117 | `setTimeout(() => { addCharacterMessage(step, index); if (step.autoNext) { timerRef.current = setTimeout(() => { runStep(index + 1); }, step.nextDelay \|\| 900); } else { setShowNext(true); saveProgress(index, messages); } }, step.delay \|\| 500)` |
| app/bsc2/components/ChatEngine.js:121 | `setTimeout(() => { runStep(index + 1); }, step.nextDelay \|\| 900)` |
| app/bsc2/components/ChatEngine.js:134 | `setTimeout(() => { addCharacterMessage(step, index); setChoices(step.choices \|\| []); }, step.delay \|\| 500)` |
| app/bsc2/components/ChatEngine.js:143 | `setTimeout(() => { addCharacterMessage(step, index); timerRef.current = setTimeout(() => { finishStory(); }, step.nextDelay \|\| 900); }, step.delay \|\| 500)` |
| app/bsc2/components/ChatEngine.js:145 | `setTimeout(() => { finishStory(); }, step.nextDelay \|\| 900)` |
| app/bsc2/components/ChatEngine.js:194 | `setTimeout(() => { addCharacterMessage(reaction, stepIndex); if (isCorrect) { timerRef.current = setTimeout(() => { setEffect(step.correctEffect \|\| "GOOD!!"); timerRef.current = setTimeout(() => { setEffect(""); runStep(stepIndex + 1); }, step.effectTime \|\| 900); }, step.reactionDelay \|\| 700); } else { timerRef.current = setTimeout(() => { setChoices(step.choices \|\| []); }, step.retryDelay \|\| 900); } }, 400)` |
| app/bsc2/components/ChatEngine.js:198 | `setTimeout(() => { setEffect(step.correctEffect \|\| "GOOD!!"); timerRef.current = setTimeout(() => { setEffect(""); runStep(stepIndex + 1); }, step.effectTime \|\| 900); }, step.reactionDelay \|\| 700)` |
| app/bsc2/components/ChatEngine.js:201 | `setTimeout(() => { setEffect(""); runStep(stepIndex + 1); }, step.effectTime \|\| 900)` |
| app/bsc2/components/ChatEngine.js:207 | `setTimeout(() => { setChoices(step.choices \|\| []); }, step.retryDelay \|\| 900)` |
| app/bsc2/components/ChatEngine.js:240 | `setTimeout(() => setEffect(""), 900)` |
| app/bsc2/components/DailyVote.js:208 | `setInterval(() => updateCountdown(activeEvent), 1000)` |
| app/bsc2/components/TypeWriter.js:13 | `setInterval(() => { index += 1; setDisplayText(text.slice(0, index)); if (index >= text.length) { clearInterval(timer); } }, speed)` |
| app/bsc2/engine/ChatEngine.js:98 | `setTimeout(() => { addMessage( { type: "talk", character: step.character \|\| "ichika", face: step.face \|\| "normal", text: step.text, }, index ); }, step.delay \|\| 500)` |
| app/bsc2/engine/ChatEngine.js:113 | `setTimeout(() => { addMessage( { type: "talk", character: step.character \|\| "ichika", face: step.face \|\| "thinking", text: step.question, }, index ); setWaitingChoice(step); }, step.delay \|\| 500)` |
| app/bsc2/engine/ChatEngine.js:132 | `setTimeout(() => { setEffect(""); runStep(index + 1); }, step.time \|\| 900)` |
| app/bsc2/engine/ChatEngine.js:140 | `setTimeout(() => { runStep(index + 1); }, step.time \|\| 800)` |
| app/bsc2/engine/ChatEngine.js:182 | `setTimeout(() => { setEffect(""); runStep(stepIndex + 1); }, 900)` |
| app/bsc2/login/page.js:54 | `router.push("/bsc2")` |
| app/bsc2/practice/talk/TypeWriter.js:12 | `setInterval(() => { setDisplay(text.slice(0, i + 1)); i += 1; if (i >= text.length) clearInterval(timer); }, speed)` |
| app/components/HomeBroadcastPanel.js:18 | `setInterval(()=>setNow(new Date()),30000)` |
| app/components/HomeRaceStrip.js:214 | `window.setInterval(() => { setClock(getJstClock()); }, 15 * 1000)` |
| app/components/HomeTopCleanup.js:131 | `button.addEventListener("click", () => { rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: "smooth", }); })` |
| app/components/HomeTopCleanup.js:166 | `rail.addEventListener("scroll", updateDots, { passive: true })` |
| app/components/IchikaBannerFix.js:51 | `window.setInterval(applyFix, 250)` |
| app/components/IchikaBannerFix.js:52 | `window.setTimeout(() => window.clearInterval(timer), 4000)` |
| app/components/IchikaBlobImageFix.js:124 | `window.setInterval(() => { apply(); if ((bgDone && bannerDone) \|\| attempts >= 24) window.clearInterval(timer); }, 250)` |
| app/components/IchikaFixedWallpaperLayer.js:24 | `window.setTimeout(readBackground, 100)` |
| app/components/IchikaNewspaperBannerOverride.js:49 | `button.addEventListener("click", () => { rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: "smooth" }); })` |
| app/components/IchikaNewspaperBannerOverride.js:79 | `rail.addEventListener("scroll", updateDots, { passive: true })` |
| app/components/IchikaNewspaperBannerOverride.js:80 | `window.addEventListener("resize", updateDots)` |
| app/components/IchikaSafeBanner.js:80 | `window.setInterval(() => { apply(); if (attempts >= 20) window.clearInterval(timer); }, 250)` |
| app/components/IchikaStableTheme.js:138 | `window.setInterval(apply, 250)` |
| app/components/IchikaStableTheme.js:139 | `window.setTimeout(() => window.clearInterval(timer), 6000)` |
| app/components/MemberEmailConfirmationHelper.js:44 | `supabase.auth.onAuthStateChange((_event, nextSession) => { if (!alive) return; setSession(nextSession \|\| null); setLoading(false); })` |
| app/components/MemberModeQueryBridge.js:15 | `setInterval(()=>{ tries+=1; const loginButton=[...document.querySelectorAll("main button")].find(btn=>btn.textContent?.trim()==="ログイン"); if(loginButton){ loginButton.click(); clearInterval(timer); }else if(tries>=20){ clearInterval(timer); } },50)` |
| app/components/MemberSessionBridge.js:36 | `supabase.auth.onAuthStateChange((event,session)=>{ if(!alive)return; // Logout must invalidate the member cookie immediately. Login is also // immediate because logout clears the stored sync timestamp; routine // INITIAL_SESSION/TOKEN_REFRESHED events are suppressed by the 40m TTL. if(event==="SIGNED_OUT"){ clearMemberSession().catch(error=>console.error("[MemberSessionBridge]",error)); return; } sync(session\|\|null); })` |
| app/lib/discordPremium.js:43 | `setTimeout(resolve,ms)` |
| app/library/BookCard.js:16 | `setTimeout(() => { router.push(book.href); }, 1200)` |
| app/library/BookCard.js:17 | `router.push(book.href)` |
| app/library/components/MagazineSwipeViewer.js:79 | `window.addEventListener("keydown", onKeyDown)` |
| app/library/stadium/[place]/StadiumPremiumMemberArea.js:68 | `supabase.auth.onAuthStateChange(() => load())` |
| app/library/stadium/[place]/TodayRacePremium.js:40 | `window.setInterval(() => load({ quiet: true }), 60_000)` |
| app/members/SurgeNotificationBridge.js:62 | `setInterval(locate,500)` |
| app/members/discord/page.js:56 | `supabase.auth.onAuthStateChange((_event,next)=>{ if(!alive)return;setSession(next\|\|null);load(next\|\|null); })` |
| app/members/ichika-consult/page.js:45 | `supabase.auth.onAuthStateChange((_e,s)=>{if(!alive)return;setSession(s\|\|null);load(s\|\|null);})` |
| app/members/ichika-escape-surge/page.js:77 | `supabase.auth.onAuthStateChange((_event, nextSession) => { if (!alive) return; setSession(nextSession \|\| null); if (!nextSession) { setProfile(null); setEnabled(false); } })` |
| app/members/ichika-hidden-escape/page.js:77 | `supabase.auth.onAuthStateChange((_event, nextSession) => { if (!alive) return; setSession(nextSession \|\| null); if (!nextSession) { setProfile(null); setEnabled(false); } })` |
| app/members/page.js:57 | `supabase.auth.onAuthStateChange(async(event,nextSession)=>{ if(!alive)return; if(event==="PASSWORD_RECOVERY"){setRecoveryMode(true);setMode("login");setError("");setMessage("新しいパスワードを設定してください。");} setSession(nextSession\|\|null); if(nextSession)await loadProfile(nextSession.user.id);else setProfile(null); })` |
| app/members/page.js:68 | `setInterval(()=>loadProfile(session.user.id),4000)` |
| app/races/XTimeline.js:16 | `window.setTimeout(resolve, ms)` |
| app/races/XTimeline.js:121 | `window.setTimeout(() => { if (cancelled) return; if (!hasTimeline()) { setStatus("failed"); } }, 12000)` |
| app/races/components/AiRaceTheater.js:626 | `window.setTimeout(() => { setPlaying(true); }, 80)` |
| app/races/components/CourseCountdown.js:43 | `window.setInterval(() => { setNow(Date.now()); }, 1000)` |
| app/races/components/CourseCountdown.js:52 | `window.setInterval(() => { router.refresh(); }, 60 * 1000)` |
| app/races/components/CourseCountdown.js:53 | `router.refresh()` |
| app/races/components/ExhibitionAutoRefresh.js:9 | `setInterval(()=>{ const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}); const close=closingTime ? Date.parse(String(closingTime).includes('T') ? closingTime : '${raceDate}T${String(closingTime).slice(0,8)}+09:00') : NaN; if(document.hidden \|\| pending \|\| raceDate!==today \|\| (Number.isFinite(close) && Date.now()>close+120000))return; startTransition(()=>router.refresh()); },15000)` |
| app/races/components/ExhibitionAutoRefresh.js:13 | `router.refresh()` |
| app/races/components/RacePremiumMemberGate.js:48 | `document.addEventListener("click", onClick, true)` |
| app/tools/elimination/[courseCode]/[raceNo]/EliminationLabClient.js:89 | `router.refresh()` |
| lib/amagasakiOfficialOriginalTenji.js:64 | `setTimeout(() => controller.abort(), options.timeoutMs \|\| 7000)` |
| lib/boatersOriginalTenji.js:13 | `setTimeout(()=>controller.abort(),timeoutMs)` |
| lib/boatraceOdds.js:59 | `setTimeout(resolve, ms)` |
| lib/boatraceOdds.js:65 | `setTimeout(() => controller.abort(), timeoutMs)` |
| lib/fukuokaVerifiedOriginalTenji.js:72 | `setTimeout(() => controller.abort(), Math.min(18000, Math.max(1000, Number(options.timeoutMs) \|\| 15000)))` |
| lib/hamanakoAshiyaVerifiedOriginalTenji.js:98 | `setTimeout(() => controller.abort(), Math.min(18000, Math.max(1000, Number(options.timeoutMs) \|\| 15000)))` |
| lib/historicalOriginalTenji.js:72 | `setTimeout(()=>control.abort(),10000)` |
| lib/kiryuVerifiedOriginalTenji.js:87 | `setTimeout(()=>controller.abort(),timeoutMs)` |
| lib/marugameVerifiedOriginalTenji.js:64 | `setTimeout(() => controller.abort(), Math.min(10000, Math.max(1000, Number(options.timeoutMs) \|\| 7000)))` |
| lib/mikuniVerifiedOriginalTenji.js:48 | `setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) \|\| 10000)))` |
| lib/narutoKaratsuVerifiedTenji.js:67 | `setTimeout(()=>abort.abort(),Math.min(10000,Math.max(1000,Number(options.timeoutMs)\|\|7000)))` |
| lib/nationalBeforeInfoIdentity.js:40 | `setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) \|\| 10000)))` |
| lib/newsCandidateVerifier.js:72 | `setTimeout(() => controller.abort(), 9000)` |
| lib/officialOriginalTenji.js:293 | `setTimeout(() => controller.abort(), options.timeoutMs \|\| 7000)` |
| lib/shimonosekiWakamatsuVerifiedOriginalTenji.js:182 | `setTimeout( () => controller.abort(), Math.min(maximumTimeoutMs, Math.max(1000, Number(options.timeoutMs) \|\| defaultTimeoutMs)), )` |
| lib/suminoeOmuraVerifiedOriginalTenji.js:92 | `setTimeout(() => controller.abort(), Math.min(23000, Math.max(3000, Number(options.timeoutMs) \|\| 22000)))` |
| lib/tamagawaVerifiedTenji.js:57 | `setTimeout(()=>controller.abort(),Math.min(12000,Math.max(1000,Number(options.timeoutMs)\|\|10000)))` |
| lib/todaVerifiedOriginalTenji.js:12 | `setTimeout(()=>c.abort(),Math.min(18000,Math.max(1000,Number(options.timeoutMs)\|\|15000)))` |
| lib/tokuyamaVerifiedOriginalTenji.js:116 | `setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) \|\| 10000)))` |
| lib/tsuOfficialOriginalTenji.js:71 | `setTimeout(() => controller.abort(), timeoutMs)` |
