# BRDB private trial HOLD_SELECT — provider inquiry draft (not sent)

Updated: 2026-11-27 JST. This is a draft for the account owner to review. Do not include the account ID, password, response body, queue IDs, or raw CSV in public GitHub material.

## Observed

- GitHub Actions [run 45860078766](https://github.com/boat-s-1/boatstrikers-station/actions/runs/45860078766), approved protected Environment, one-off request for 2026-11-21 Tamagawa (05) 2R.
- Exactly one HTTPS POST `prccd=select` to the documented BRDB endpoint. HTTP 200 with JSON decoding succeeded; application returned nonzero or missing `ret` (old code collapsed both). Classified `HOLD_SELECT`. No state/getcsv requests, no retry, DB write or display.
- The two bounded SELECTs target RACEMST and RACEDTL with `SOPDT >= '20261111'`, `OPDT = '20261121'`, `RCOURSECD = 5`, `RNO = 2`; projected columns are in the published schema. Do not paste credentials or raw response to GitHub.
- Provider docs describe `ret`, `ret1/ret2`, and `msg` separately. This run did not record the return code or messages, so no root cause is established.
- Provider limit describes one terminal per licence. Ask whether an ephemeral GitHub-hosted runner counts as an unauthorized additional terminal and whether a fixed cloud runtime is allowed.

## Proposed question to provider (Japanese, review before sending)

> BRDB-API契約者です。事前にご回答いただいた非公開・少数テストの範囲で、GitHub Actionsの一時的なLinux実行環境から、2026年11月21日・多摩川2RのRACEMST/RACEDTLを対象に、SOPDTを10日前から指定したselectを1回だけPOSTしました。HTTP 200でしたが、APIの全体retが成功として認識できず、後続のstate/getcsvは実行していません。認証情報・応答本文はこの文面に含めていません。
>
> 1ライセンス1台の端末制限について、一時的なGitHub-hosted runnerからのアクセスは許容されますか。許容されない場合、Windowsを使わない固定クラウド実行環境で利用するための条件（端末・IP登録、契約変更の要否など）を教えてください。また、こちらから安全に共有すべき診断項目（ret数値、msgの一部、時刻など）と、メール以外の安全な提出方法があればご指定ください。ご回答まで追加のアクセスは行いません。

## Next gate

- New Draft code logs only a strict bounded numeric `ret` code on a future separately approved run. It does not log `msg`, credentials, SQL, queue IDs, or CSV.
- Wait for provider guidance before proposing another live request; do not rerun this failed Action.
- This trial does not implement storage, private real-data display, or daily cloud ingestion.
