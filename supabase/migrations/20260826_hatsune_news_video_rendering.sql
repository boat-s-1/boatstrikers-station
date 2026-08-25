alter table public.hatsune_news_videos
  add column if not exists rendered_at timestamptz,
  add column if not exists render_meta jsonb not null default '{}'::jsonb,
  add column if not exists render_error text;

comment on column public.hatsune_news_videos.rendered_at is 'ローカルAivisSpeech/FFmpegレンダラーでMP4生成が完了した日時';
comment on column public.hatsune_news_videos.render_meta is 'レンダー結果。duration_seconds/output_file/renderer_version等を保存';
comment on column public.hatsune_news_videos.render_error is '直近のローカルレンダーエラー';
