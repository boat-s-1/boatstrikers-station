# 掲示板DB / RLS 安全実装レビュー用SQL（本番未適用）

このファイルは設計・レビュー専用。Supabase CLI でマイグレーションを生成して隔離DBで検証するまでは、本番に実行しない。

## 最小スキーマ

```sql
create table public.community_threads (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  title text not null check (char_length(title) between 1 and 120),
  excerpt text not null default '' check (char_length(excerpt) <= 240),
  body text not null check (char_length(body) between 1 and 20000),
  character_key text not null check (character_key in ('ichika','hatsune','kiina')),
  audience text not null check (audience in ('public','members','paid')),
  reply_policy text not null default 'paid' check (reply_policy in ('paid','disabled')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  locked boolean not null default false,
  published_at timestamptz,
  last_official_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index community_threads_public_feed_idx
  on public.community_threads (last_official_activity_at desc)
  where status = 'published' and audience = 'public';

alter table public.community_threads enable row level security;
revoke all on public.community_threads from anon, authenticated;
grant select on public.community_threads to anon, authenticated;

create policy community_threads_public_read
  on public.community_threads for select to anon, authenticated
  using (status = 'published' and audience = 'public' and published_at <= now());
```

上記は**一般公開投稿だけ**を対象とする初期防御。一般会員/有料会員への非公開投稿のSELECT権限は追加していない。管理者投稿も `anon` / `authenticated` からのINSERT/UPDATE/DELETEを許可しない。認証済み会員向けポリシーは既存会員権限の安全確認後に別レビューする。

## 次段階のレビュー項目

1. 特権列 `bs_member_profiles.plan` / `is_admin` 等の更新経路を隔離検証・是正する
2. サーバー側でJWTの真正性と会員有効期限を検証する
3. 会員限定/有料限定の閲覧は、会員自身に変更できない信頼できるデータのみで判断する
4. 管理者用書込APIは認証・運営ロール・CSRF/Origin・監査ログ・レート制限を備える
5. 返信テーブルには親スレッドの閲覧範囲、ロック状態、返信者の有料権限を検証するRLSを設定する
6. 公開範囲変更時のキャッシュ/OG/RSS/sitemap漏えいテストを実施する
7. 本番ではなく隔離DBで `anon`, `authenticated` のAPIを実通信テストする
8. 実際の権限変更・公開にはユーザーの明示承認を得る

## リスク

- このSQLを直接本番適用しない
- 新規テーブルへのサービスキー書込はRLSを迂回するため、サーバーAPIの認可が必須
- `public` スキーマの新テーブルのData API公開設定、既存GRANT、権限継承を隔離環境で検証する
- 投稿のHTMLはサニタイズ済みテキストとして表示し、危険なHTML挿入を行わない
