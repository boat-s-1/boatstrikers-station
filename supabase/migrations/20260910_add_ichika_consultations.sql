create table if not exists public.bs_ichika_consultations (
  id bigserial primary key,
  user_id uuid not null,
  race_date date,
  course_code text,
  course_name text,
  race_no integer,
  topic text not null,
  question text not null,
  ai_conclusion text,
  ai_answer text not null,
  escalated boolean not null default false,
  admin_status text not null default 'none' check (admin_status in ('none','pending','answered')),
  admin_reply text,
  admin_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bs_ichika_consultations_user_created_idx
  on public.bs_ichika_consultations(user_id, created_at desc);

create index if not exists bs_ichika_consultations_admin_status_idx
  on public.bs_ichika_consultations(admin_status, created_at desc);

alter table public.bs_ichika_consultations enable row level security;
