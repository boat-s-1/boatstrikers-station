# Production schema-only export runbook (2026-11-18)

## Goal

Recover the authoritative production database schema without exporting table rows or member/race data. This is a read-only backup/export operation. Do not restore it, apply it, or use it to modify production.

Project:
- Supabase ref: `rzosrbkyniyedolhkgxo`
- Region: `ap-northeast-1`
- PostgreSQL: `17.6.1.127`
- Status observed: `ACTIVE_HEALTHY`

## Preferred method: Supabase CLI schema dump

Official references:
- CLI: https://supabase.com/docs/reference/cli/supabase-db-dump
- Platform restore/export guide: https://supabase.com/docs/guides/self-hosting/restore-from-platform

The official CLI runs `pg_dump` in a Supabase Postgres container and applies Supabase-specific filtering. The default dump is schema-only: it does not include data or custom roles. It excludes Supabase-managed schemas such as `auth`, `storage`, and extension-managed schemas. Do not use raw `pg_dump` for this task.

### Requirements

- Supabase CLI (or `npx supabase`)
- Docker Desktop running (the CLI uses a Postgres container)
- A database connection string from the Supabase Dashboard > Connect. Prefer the Session pooler connection string. Use the direct connection only if network support permits it.
- Never paste the connection string, database password, access token, or API key into ChatGPT, GitHub issues/PRs, screenshots, or source files.

### Windows PowerShell commands

Run in a new PowerShell window. Paste the connection string only at the hidden prompt; it is not echoed by PowerShell. The password is held in memory only for this process and is not written into the repository.

```powershell
$ErrorActionPreference = "Stop"

# Check Docker is running. If this fails, start Docker Desktop first.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not running. Start Docker Desktop and retry."
}

# Hidden input. Do not paste this value into chat or save it in a file.
$secure = Read-Host "Supabase Session Pooler connection string (hidden)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ($dbUrl -notmatch '^postgres(ql)?://') {
  Remove-Variable dbUrl -ErrorAction SilentlyContinue
  throw "The value does not look like a PostgreSQL connection string."
}

$out = Join-Path $PWD ("boatstrikers-production-schema-only-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".sql")

try {
  # IMPORTANT: intentionally omit --data-only and --role-only.
  npx --yes supabase@latest db dump --db-url $dbUrl -f $out
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI dump failed with exit code $LASTEXITCODE."
  }
  if (!(Test-Path -LiteralPath $out) -or (Get-Item -LiteralPath $out).Length -eq 0) {
    throw "Dump file was not created or is empty."
  }

  Get-Item -LiteralPath $out | Select-Object FullName,Length,LastWriteTime
  Get-FileHash -LiteralPath $out -Algorithm SHA256
} finally {
  Remove-Variable dbUrl,secure,ptr -ErrorAction SilentlyContinue
}
```

The CLI may prompt for Docker image download or first-run confirmation. Review prompts; do not run any restore, migration push, reset, or deploy command.

## Alternative: use an already-linked local Supabase CLI project

If the project is already linked and the user has an authenticated CLI session, the official CLI can use `supabase db dump --linked -f schema.sql`. Do not run `supabase link` or store any credential until the operator is ready; the explicit `--db-url` path above is the clearest one-shot export.

## What to provide after export

1. Upload only the generated `boatstrikers-production-schema-only-*.sql` file to the private ChatGPT conversation or an approved private repository location.
2. Provide the SHA-256 printed by PowerShell.
3. Do not provide the database connection string or password.
4. Keep the original export unchanged. We will make a separate working copy for analysis.

## Safety checks before accepting the dump

- Confirm file is non-empty and hash is recorded.
- Verify it is a schema-only dump. The command above deliberately does not pass `--data-only` or `--role-only`.
- Scan for embedded credentials or hard-coded secrets before sharing. A schema-only dump can include function bodies, comments, and configuration literals; schema-only does not guarantee absence of secrets.
- If any token, password, webhook URL, or private credential is found, do not upload the raw file. Stop and arrange a local redacted copy plus a secure, non-redacted private backup location.
- The CLI excludes Supabase-managed and extension-managed schemas. Record installed extensions separately and reconcile any custom schema objects that depend on them.

## Separate extension inventory

A read-only Supabase tool inventory on 2026-11-18 reported these extensions installed in the project:
- `pgcrypto` in `extensions`
- `supabase_vault` in `vault`
- `http` in `extensions`
- `pg_stat_statements` in `extensions`
- `uuid-ossp` in `extensions`
- `pg_net` in `extensions`
- `pg_cron` in `pg_catalog`
- `plpgsql` in `pg_catalog`

The extension list API also returns many available-but-not-installed extensions. Do not confuse `default_version` with `installed_version`; only the installed list above is treated as active.

## After the file arrives

1. Hash-verify the received file against the user-supplied SHA-256.
2. Parse schema DDL without executing it.
3. Inventory schemas, enums/domains/types, sequences, tables, partitions, constraints, indexes, views/materialized views, functions/procedures, triggers, policies, grants, comments, and dependencies.
4. Compare the dump against the production catalog snapshot and 133 migration records.
5. Produce a source-of-truth baseline candidate in a separate Git branch; do not merge or apply it to production.
6. Recreate it in an isolated database and compare schema fingerprints before any ACL/API test.

## Current gate

No export has been performed yet. The connected Supabase tools can inspect catalog metadata and run read-only SQL, but do not expose a direct `pg_dump` file-download operation. The TinyFish browser profile available in this session is not signed in to Supabase. To avoid asking for a database password in chat, the next user interaction must be either (a) sign in to Supabase Dashboard in the browser profile, or (b) run the PowerShell command above locally and upload only the schema file plus its hash.
