# BATCH1 復元手順

これは新実装の保全であり、失われた旧HEAD c091c2e / c73e02dと同一のコードではありません。
復元後もPush/Actions/デプロイ/公式GET/DB操作はHOLDです。復元だけでは何も公開しません。

## ZIP内容と前提

- batch1.bundle：BATCH1差分commitのGit bundle。前提はmain bfe285759b8f819669e920875495c642039b21a0。
- batch1.patch：同じ基準からの全変更（binary、full-index）。削除/実行bitも含みます。
- changed-files/：変更ファイル現物。Git metadataを失った場合の予備。
- MANIFEST.json / CHANGED-FILES.txt / SHA256SUMS / RECOVERY-VERIFICATION.txt / REPORT.md。
- テストの全ログと本書。

既存mainの画像等520MB超と全履歴は含みません。基準commitがあるローカルrepoなら、復元・検証にネットワークは不要です。
基準commitがない場合に限り、別途GitHubから読み取りcloneしてください。`git clone batch1.bundle`だけでは復元できません。

## 1. 完全性

ZIPを展開し、展開先で `sha256sum -c SHA256SUMS` を実行します。
Windows PowerShellでは各ファイルに `Get-FileHash -Algorithm SHA256 <path>` を使用し、SHA256SUMSと比較してください。
ZIP自体のSHA-256はダウンロード時の報告値/同名.sha256と照合します（ZIP内に自分自身のhashは入れません）。

## 2. Bundleによる復元（推奨）

既存repoはcleanな別checkoutを使用し、mainや他の作業を変更しないでください。
`<ZIP展開先>`は実際の絶対パスへ置き換えます。

```sh
git cat-file -e bfe285759b8f819669e920875495c642039b21a0^{commit}
git bundle verify <ZIP展開先>/batch1.bundle
git fetch <ZIP展開先>/batch1.bundle refs/heads/codex/batch1-reconstructed-20261115:refs/heads/recovered/batch1-20261115
git worktree add ../batch1-recovered recovered/batch1-20261115
git -C ../batch1-recovered rev-parse HEAD
git -C ../batch1-recovered rev-parse HEAD^{tree}
```

HEAD/treeをMANIFEST.jsonと照合。fetch先はローカルbundleで、GitHubへのPushではありません。
branchが既にある場合は強制更新せず、別の未使用ローカルbranch名にしてください。
基準commitがない場合の読み取り取得例：
`git clone --single-branch --branch main https://github.com/boat-s-1/boatstrikers-station.git boatstrikers-base`
clone後も必ず上記の基準SHAが存在することを確認してください。

## 3. Patchによる代替復元

```sh
git worktree add -b recovered/batch1-patch ../batch1-patch bfe285759b8f819669e920875495c642039b21a0
git -C ../batch1-patch apply --check <ZIP展開先>/batch1.patch
git -C ../batch1-patch apply --index --binary <ZIP展開先>/batch1.patch
git -C ../batch1-patch write-tree
```

write-treeをMANIFESTのtreeと照合。patch適用は元commitの著者/時刻を復元しないため、commit SHAの一致を求める場合はbundleを使います。
本書のGit操作はローカルのみです。SQLを実行する手順は含めません。

## 4. オフラインテスト（Node22以上、Node24で検証）

依存installは禁止。repo内のfake loaderだけで実施できます。新しいshellで秘密環境変数を除去してください。
POSIX例：

```sh
env -i PATH="$PATH" NODE_OPTIONS="--require=$PWD/scripts/batch1/deny-network.cjs" node --test --test-reporter=tap --import ./scripts/batch1/register-test-hooks.mjs tests/batch1-*.test.mjs tests/data-lab-prompts.test.mjs tests/news-digest-protection.test.mjs tests/race-incidents.test.mjs tests/winning-technique.test.mjs tests/trinity/shadow.test.mjs scripts/trinity/official-racelist.test.mjs scripts/trinity/dispatch-guard.test.mjs scripts/trinity/shadow-coverage.test.mjs
```

130件合格は再構築時の結果です。復元先では実際の結果を確認してください。
OS隔離CIはLinux専用で、unshare不可なら停止します。普通のネットワークへfallbackしません。
WindowsでOS隔離試験ができなくても合格扱いにしないでください。Next build/生成/Cron/APIは実行しないでください。
