# PHASE 9 承認後の最終実測報告

検証日: 2026-10-31 JST（04:14〜04:19頃）。判定: **完全自動収集 HOLD**。
この報告は承認前の「通信診断未実施」を更新する。元の58 PASS / 0 FAILはローカル単体・回帰テストの結果であり、以下の公式一覧HTTP失敗を含む実通信成績とは別。

## 結果と判断
| 項目 | 判定・実測 |
|---|---|
| Protected Previewでの管理認証 | PASS: 保護通過＋API認証で診断200、API認証なしで401 |
| BOAT RACE DNS/TLS | PASS: iad1でIPv4解決52ms、TLS1.3接続13ms |
| BOAT RACE HTTP取得 | FAIL: TLS後のHTTP応答待ちで4006ms診断timeout。通常の一覧fetchも8秒calendar_timeout |
| 蒲郡公式接続 | PASS: 同じiad1からTLS1.2、HTTP200/589ms |
| 既存第三者OpenAPI接続 | PASS: HTTP200/73ms |
| 2025-08-09 蒲郡1R | PASS: 200 skipped_existing、upstream_attempts=0 |
| DB根拠による開催判定 | PASS（過去日）: 10/30はdb_historical_results、公式一覧取得なしで保存済み完了 |
| 小規模バックフィル | PASS（部分成功を正しく返す）: 10/09の最大3R、4R・10R各6艇保存、9Rはinvalid_chartで拒否。HTTP207 |
| 直後の再実行 | PASS: 200、results=[]。成功済みRをスキップし失敗Rの待機時間を尊重 |
| 待機後の再試行 | PASS: 9Rだけ再取得しinvalid_chart。attempts/upstream_attemptsは1→2、4R・10Rは1のまま |
| 情報不明時の停止 | PASS: 10/11は公式一覧fallbackがtimeout、503 calendar_unknown、results=[]、保存0 |
| 同時実行防止 | PASS: 同じ既存Rをほぼ同時に実行し200 skipped_existingと409 collector_busy |
| 監視API | PASS: 当日付11R/66艇、missing_due_races=1、partial_races=0、全体198R/1188艇 |
| 公式HTML独立照合 | PASS（保存2R）: Python HTMLParserで12艇の評価・矢印がDB全値一致 |
| 9R不完全データの拒否 | PASS: 独立HTMLParserでもチャート内マーカーは6号艇1件だけ。DB保存0 |
| データ保全 | PASS: 196R/1176艇→198R/1188艇。元1176艇全行ハッシュ一致、重複0、部分R0 |
| キー失効 | PASS: 失効API成功・有効0件。旧キーでのアクセスは302のVercel認証画面へ戻る |

## 通信原因の切り分け
実行場所はVercel Preview iad1。BOAT RACEのDNSと証明書検証付きTLS接続は成功したため、今回のVercelの問題をDNS解決失敗やTLS接続失敗とは判断しない。IPv4固定の診断でもHTTPの応答ヘッダーが期限内に返らない。
同時刻・同じリージョンの蒲郡公式とGitHub Pagesは成功し、公式チャート本体も取得・保存できた。Vercel全体の外部通信障害ではなく、BOAT RACE一覧側のHTTP処理/当該CDN経路に絞れた。
**WAF判定、宛先CDNのサーバー処理、経路ごとの応答差のどれが原因かまでは未確定。403/429は未観測で、アクセス禁止と断定しない。** 単にtimeoutを延長する変更は行っていない。

第三者OpenAPIの接続200はデータ鮮度を保証しない。freshなDB証拠がある場合の一覧依存回避が実装方針であり、BOAT RACEネットワークそのものが修復したとは報告しない。

## 保存・欠損・再実行
追加したのは2026-10-09の4Rと10Rだけ。各6艇を一括INSERT、既存行のUPDATE/DELETEなし。
9Rの「欠損1R」と、保存済みレース内の「部分保存0R」を区別する。9Rは公式HTMLそのものにマーカーが1艇分しかないため保存できず、監視に欠損として残る。2回目も拒否し次回待機へ移行している。今後は既存の最大6予約/レースで抑制される。

全行ハッシュはrace_date/race_no/boat_no順のrow_to_json文字列連結に対するMD5。
- 前: 90007bfa6db5c1ff495b2bfce5b6df4b（1176艇）
- 後: c22b73061091abe02167d6b0f22ae238（1188艇）
- 後から今回追加した2Rを除外: 90007bfa6db5c1ff495b2bfce5b6df4b（前と一致）
- 重複レコード0、6艇未満/超過・号艇重複の保存済みR 0。

保存2Rの公式HTML SHA256と12艇の照合値、9Rの1艇という実体は下記JSONに収録。独立照合ではアプリの正規表現パーサーを使っていない。
公式へのチャートアクセスはAPI初回3件＋9R再試行1件＋独立照合3件。大量バックフィルは行っていない。

## 契約と運用
前報の実画面確認済みPro、候補Cron UTC `*/5 5-13 * * *`（JST14:00〜22:59、最大108起動/日）を継承。契約変更・Cron登録はしていない。月額実費と長期使用量は未測定。
最大3R/回、1.5秒以上間隔、共有38秒予算、60秒maxDuration、グローバルリースを維持。
当日のfreshイベント＋全6艇プレビュー＋成功live_allが10分以内であることは、過去日の開催証明とは別条件。今回は午前4時台で当日公開前のため、当日プレビューによる自動判定の実運用成功をPASSにしていない。

## 承認・保護・変更範囲
再発行1件の明示承認に基づき一時キーを使用し、04:19:25 JSTに失効。値を証跡・コード・ログへ出力していない。Deployment Protectionは維持。
既存API認証情報はPRブランチPreviewだけ更新。本番環境変数は変更していない。
REST deployment APIのpreview指定は400となり、staging指定は対象環境が承認範囲外として自動承認審査が拒否したため実施していない。より限定された既存のPRブランチ自動Previewで検証した。共有stagingへのデプロイはない。

検証コミット43c761e977cb6b9a8ed76482f118e03f8d262155は文書追加だけで、実装は3b1eee6f663c1de854a10c1571980ab6db4f7e9cと同一。
検証Preview: dpl_dutpf9hEZ9q41ECp1oB7YJHJD5gZ / boatstrikers-station-c98sebu3k-boat-s-1s-projects.vercel.app、READY。
今回の追加コード変更0、追加スキーマ変更0。専用進捗表と新規チャート12艇だけがAPIにより書き込まれた。TRINITY・ニュース・予想システムは未変更。

## 残るHOLD条件
- 当日の実開催時間に、手動キャッシュなしでfresh DB→対象R選択→公開直後のチャート取得を確認する。
- 中止実例と、既存中止同期の失敗/反映遅延を照合する。NULLや全体200を中止なし保証にしない。
- 公式一覧へのHTTP応答停止は残存。DBも根拠不足の場合は安全停止するため、完全自動収集の可用性保証には未到達。
- 本番での外部取得は未実施。本番マージ・デプロイ・Cron有効化は引き続きユーザー承認待ち。
過去日のDB根拠からの自動バックフィル経路は実測成功、全自動運用の最終判定はHOLD。

## 機械可読証跡（秘密値なし）
```json
{
  "verified_at_jst": "2026-10-31 04:19",
  "tested_commit": "43c761e977cb6b9a8ed76482f118e03f8d262155",
  "code_commit": "3b1eee6f663c1de854a10c1571980ab6db4f7e9c",
  "deployment": "dpl_dutpf9hEZ9q41ECp1oB7YJHJD5gZ",
  "before": [
    {
      "boats": 1176,
      "races": 196,
      "digest": "90007bfa6db5c1ff495b2bfce5b6df4b"
    }
  ],
  "after": [
    {
      "boats": 1188,
      "races": 198,
      "digest": "c22b73061091abe02167d6b0f22ae238",
      "original_digest": "90007bfa6db5c1ff495b2bfce5b6df4b",
      "duplicates": 0,
      "partial": 0
    }
  ],
  "final_tasks": [
    {
      "race_no": 4,
      "status": "complete",
      "attempts": 1,
      "upstream_attempts": 1,
      "next_attempt_at": null,
      "last_reason": "saved"
    },
    {
      "race_no": 9,
      "status": "pending",
      "attempts": 2,
      "upstream_attempts": 2,
      "next_attempt_at": "2026-10-30 19:20:26.732+00",
      "last_reason": "invalid_chart"
    },
    {
      "race_no": 10,
      "status": "complete",
      "attempts": 1,
      "upstream_attempts": 1,
      "next_attempt_at": null,
      "last_reason": "saved"
    }
  ],
  "http": [
    {
      "path": "/api/admin/gamagori-network-diagnostic",
      "status": 200,
      "elapsed_ms": 11586,
      "request_id": "cle1::iad1::lvgqg-1793387683557-96ba7574d905",
      "body": {
        "region": "iad1",
        "environment": "preview",
        "results": [
          {
            "host": "www.boatrace.jp",
            "dns": {
              "addresses": [
                {
                  "address": "23.1.63.111",
                  "family": 4
                }
              ],
              "ms": 52
            },
            "tls4": {
              "ok": true,
              "protocol": "TLSv1.3",
              "ms": 13
            },
            "https4": {
              "code": "HTTP_TIMEOUT",
              "ms": 4006
            }
          },
          {
            "host": "www.gamagori-kyotei.com",
            "dns": {
              "addresses": [
                {
                  "address": "54.250.208.226",
                  "family": 4
                },
                {
                  "address": "35.74.203.17",
                  "family": 4
                }
              ],
              "ms": 196
            },
            "tls4": {
              "ok": true,
              "protocol": "TLSv1.2",
              "ms": 436
            },
            "https4": {
              "status": 200,
              "ms": 589
            }
          },
          {
            "host": "boatraceopenapi.github.io",
            "dns": {
              "addresses": [
                {
                  "address": "185.199.110.153",
                  "family": 4
                },
                {
                  "address": "185.199.111.153",
                  "family": 4
                },
                {
                  "address": "185.199.108.153",
                  "family": 4
                },
                {
                  "address": "185.199.109.153",
                  "family": 4
                },
                {
                  "address": "2606:50c0:8001::153",
                  "family": 6
                },
                {
                  "address": "2606:50c0:8002::153",
                  "family": 6
                },
                {
                  "address": "2606:50c0:8003::153",
                  "family": 6
                },
                {
                  "address": "2606:50c0:8000::153",
                  "family": 6
                }
              ],
              "ms": 3
            },
            "tls4": {
              "ok": true,
              "protocol": "TLSv1.3",
              "ms": 6
            },
            "https4": {
              "status": 200,
              "ms": 73
            }
          }
        ]
      }
    },
    {
      "path": "/api/admin/gamagori-chart-monitor?date=2026-10-30",
      "status": 401,
      "elapsed_ms": 4731,
      "request_id": "cle1::iad1::cvsv5-1793387713386-c18433ac0f21",
      "body": {
        "error": "unauthorized"
      }
    },
    {
      "path": "/api/cron/gamagori-chart-collect?date=2025-08-09&race=1&limit=1",
      "status": 200,
      "elapsed_ms": 7760,
      "request_id": "cle1::iad1::f9ngj-1793387719291-bab6464ec2f3",
      "body": {
        "date": "2025-08-09",
        "results": [
          {
            "race": 1,
            "status": "skipped_existing",
            "upstream_attempts": 0
          }
        ],
        "nextRace": 2
      }
    },
    {
      "path": "/api/cron/gamagori-chart-orchestrate?date=2026-10-30",
      "status": 200,
      "elapsed_ms": 8060,
      "request_id": "cle1::iad1::brbvg-1793387737910-a1dedb048883",
      "body": {
        "date": "2026-10-30",
        "run": "b961a701-b1d4-4529-bdc6-1a98902882b5",
        "outcome": "waiting_or_complete",
        "meeting_source": "db_historical_results",
        "results": []
      }
    },
    {
      "path": "/api/cron/gamagori-chart-orchestrate?date=2026-10-09",
      "status": 207,
      "elapsed_ms": 18938,
      "request_id": "cle1::iad1::h68jw-1793387767714-1e1ebff9b888",
      "body": {
        "date": "2026-10-09",
        "run": "4735729b-e23e-4d5d-b0d8-992a6b88decb",
        "outcome": "collected",
        "meeting_source": "db_historical_results",
        "results": [
          {
            "race": 4,
            "status": "saved",
            "inserted": 6,
            "upstream_attempts": 1
          },
          {
            "race": 9,
            "status": "failed",
            "reason": "invalid_chart",
            "upstream_attempts": 1
          },
          {
            "race": 10,
            "status": "saved",
            "inserted": 6,
            "upstream_attempts": 1
          }
        ]
      }
    },
    {
      "path": "/api/cron/gamagori-chart-orchestrate?date=2026-10-09",
      "status": 200,
      "elapsed_ms": 9355,
      "request_id": "cle1::iad1::86ksn-1793387808385-336b39c3091e",
      "body": {
        "date": "2026-10-09",
        "run": "56a7b575-db7b-4c95-a7f4-8961c0790a7e",
        "outcome": "waiting_or_complete",
        "meeting_source": "db_historical_results",
        "results": []
      }
    },
    {
      "path": "/api/cron/gamagori-chart-orchestrate?date=2026-10-11",
      "status": 503,
      "elapsed_ms": 14875,
      "request_id": "cle1::iad1::b98kr-1793387820210-6c7d81d1d946",
      "body": {
        "date": "2026-10-11",
        "run": "a908f43d-ea6e-4d01-bd2a-126bc1695d31",
        "outcome": "calendar_unknown",
        "meeting_source": "official_html",
        "results": [],
        "calendar_error": "calendar_timeout"
      }
    },
    {
      "path": "/api/admin/gamagori-chart-monitor?date=2026-10-09",
      "status": 200,
      "elapsed_ms": 7780,
      "request_id": "cle1::iad1::9cs4j-1793387851751-15a41fff78cc",
      "body": {
        "tasks": [
          {
            "status": "complete",
            "race_no": 1,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 2,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 3,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 4,
            "attempts": 1,
            "race_date": "2026-10-09",
            "last_reason": "saved",
            "last_attempt_at": "2026-10-30T19:16:09.053517+00:00",
            "next_attempt_at": null,
            "upstream_attempts": 1
          },
          {
            "status": "complete",
            "race_no": 5,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 6,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 7,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 8,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "pending",
            "race_no": 9,
            "attempts": 1,
            "race_date": "2026-10-09",
            "last_reason": "invalid_chart",
            "last_attempt_at": "2026-10-30T19:16:13.716718+00:00",
            "next_attempt_at": "2026-10-30T19:18:15.053+00:00",
            "upstream_attempts": 1
          },
          {
            "status": "complete",
            "race_no": 10,
            "attempts": 1,
            "race_date": "2026-10-09",
            "last_reason": "saved",
            "last_attempt_at": "2026-10-30T19:16:16.884181+00:00",
            "next_attempt_at": null,
            "upstream_attempts": 1
          },
          {
            "status": "complete",
            "race_no": 11,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          },
          {
            "status": "complete",
            "race_no": 12,
            "attempts": 0,
            "race_date": "2026-10-09",
            "last_reason": null,
            "last_attempt_at": null,
            "next_attempt_at": null,
            "upstream_attempts": 0
          }
        ],
        "calendar": {
          "race_date": "2026-10-09",
          "checked_at": "2026-10-30T19:16:50.433+00:00",
          "blocked_until": null,
          "calendar_status": "held",
          "evidence_source": "db_historical_results",
          "evidence_expires_at": "2026-10-31T01:16:50.433+00:00"
        },
        "race_date": "2026-10-09",
        "recent_runs": [
          {
            "id": "56a7b575-db7b-4c95-a7f4-8961c0790a7e",
            "status": "completed",
            "outcome": "waiting_or_complete",
            "results": [],
            "race_date": "2026-10-09",
            "started_at": "2026-10-30T19:16:49.606216+00:00",
            "finished_at": "2026-10-30T19:16:50.714+00:00"
          },
          {
            "id": "4735729b-e23e-4d5d-b0d8-992a6b88decb",
            "status": "completed",
            "outcome": "collected",
            "results": [
              {
                "race": 4,
                "status": "saved",
                "inserted": 6,
                "upstream_attempts": 1
              },
              {
                "race": 9,
                "reason": "invalid_chart",
                "status": "failed",
                "upstream_attempts": 1
              },
              {
                "race": 10,
                "status": "saved",
                "inserted": 6,
                "upstream_attempts": 1
              }
            ],
            "race_date": "2026-10-09",
            "started_at": "2026-10-30T19:16:08.230871+00:00",
            "finished_at": "2026-10-30T19:16:20.504+00:00"
          }
        ],
        "saved_boats": 66,
        "flagged_races": 0,
        "partial_races": 0,
        "complete_races": 11,
        "expected_races": 12,
        "last_captured_at": "2026-10-30T19:16:18.609612+00:00",
        "missing_due_races": 1,
        "global_saved_boats": 1188,
        "global_saved_races": 198,
        "stale_running_runs": 0,
        "scheduled_races_in_db": 12,
        "unknown_deadline_races": 0,
        "last_captured_at_global": "2026-10-30T19:16:18.609612+00:00"
      }
    },
    {
      "path": "/api/cron/gamagori-chart-orchestrate?date=2026-10-09",
      "status": 207,
      "elapsed_ms": 12039,
      "request_id": "cle1::iad1::59wfq-1793387902771-af9d4b3e3f3b",
      "body": {
        "date": "2026-10-09",
        "run": "08d39036-d81f-4117-bc97-fafc3d8d2227",
        "outcome": "collected",
        "meeting_source": "db_historical_results",
        "results": [
          {
            "race": 9,
            "status": "failed",
            "reason": "invalid_chart",
            "upstream_attempts": 1
          }
        ]
      }
    },
    {
      "path": "/api/cron/gamagori-chart-collect?date=2025-08-09&race=1&limit=1",
      "status": 409,
      "elapsed_ms": 5076,
      "request_id": "cle1::iad1::9jc8m-1793387929513-6a8478898312",
      "body": {
        "error": "collector_busy"
      }
    },
    {
      "path": "/api/cron/gamagori-chart-collect?date=2025-08-09&race=1&limit=1",
      "status": 200,
      "elapsed_ms": 5210,
      "request_id": "cle1::iad1::9jc8m-1793387928856-b32868fcd382",
      "body": {
        "date": "2025-08-09",
        "results": [
          {
            "race": 1,
            "status": "skipped_existing",
            "upstream_attempts": 0
          }
        ],
        "nextRace": 2
      }
    }
  ],
  "independent_chart_comparison": [
    {
      "race": 4,
      "rows": 5,
      "row_cells": [
        5,
        5,
        5,
        5,
        5
      ],
      "markers": 6,
      "valid": true,
      "actual": [
        {
          "boat_no": 1,
          "slit_rating": 4,
          "turn_rating": 3,
          "arrow_direction": "none"
        },
        {
          "boat_no": 2,
          "slit_rating": 3,
          "turn_rating": 3,
          "arrow_direction": "up"
        },
        {
          "boat_no": 3,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "none"
        },
        {
          "boat_no": 4,
          "slit_rating": 4,
          "turn_rating": 3,
          "arrow_direction": "down"
        },
        {
          "boat_no": 5,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "none"
        },
        {
          "boat_no": 6,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "up"
        }
      ],
      "matches_database": true,
      "html_sha256": "c79315f284ab40757971ec2d4d29d9df7150a78cf7b76ca5c41671da3e34a8e7"
    },
    {
      "race": 9,
      "rows": 5,
      "row_cells": [
        5,
        5,
        5,
        5,
        5
      ],
      "markers": 1,
      "valid": false,
      "actual": [
        {
          "boat_no": 6,
          "slit_rating": 4,
          "turn_rating": 3,
          "arrow_direction": "none"
        }
      ],
      "matches_database": false,
      "html_sha256": "c7e836801321f2a8d49e4cf185b4dcbe8a37ceb83b15449fab6e3e721a0baf52"
    },
    {
      "race": 10,
      "rows": 5,
      "row_cells": [
        5,
        5,
        5,
        5,
        5
      ],
      "markers": 6,
      "valid": true,
      "actual": [
        {
          "boat_no": 1,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "none"
        },
        {
          "boat_no": 2,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "none"
        },
        {
          "boat_no": 3,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "up"
        },
        {
          "boat_no": 4,
          "slit_rating": 4,
          "turn_rating": 4,
          "arrow_direction": "none"
        },
        {
          "boat_no": 5,
          "slit_rating": 4,
          "turn_rating": 5,
          "arrow_direction": "none"
        },
        {
          "boat_no": 6,
          "slit_rating": 3,
          "turn_rating": 3,
          "arrow_direction": "down"
        }
      ],
      "matches_database": true,
      "html_sha256": "f950608bb7cbbd746bd43aaf41bb389428223cc5e28b33d36d250a154e9b217d"
    }
  ],
  "bypass_revocation": {
    "success": true,
    "remaining": 0,
    "at": "2026-10-30T19:19:25.708Z"
  },
  "revoked_key_request": {
    "status": 302,
    "path": "/api/admin/gamagori-chart-monitor?date=2026-10-09",
    "request_id": "cle1::x26w5-1793387971476-dd7e828c3ef2",
    "elapsed_ms": 5622,
    "protectionPage": true
  }
}
```
