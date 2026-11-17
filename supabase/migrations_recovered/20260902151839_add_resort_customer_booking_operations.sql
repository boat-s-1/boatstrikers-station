
create table public.resort_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_normalized text generated always as (regexp_replace(phone, '[^0-9]'::text, ''::text, 'g'::text)) stored,
  line_name text,
  notes text not null default '',
  caution text not null default '',
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resort_customers_phone_required check (length(phone_normalized) >= 8),
  constraint resort_customers_phone_normalized_key unique (phone_normalized)
);

create table public.resort_bookings (
  id uuid primary key default gen_random_uuid(),
  store_id smallint not null references public.resort_stores(id) on delete restrict,
  therapist_id uuid not null references public.resort_therapists(id) on delete restrict,
  customer_id uuid not null references public.resort_customers(id) on delete restrict,
  booking_date date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 10 and 720),
  course_name text not null,
  base_price integer not null default 0 check (base_price >= 0),
  nomination_fee integer not null default 0 check (nomination_fee >= 0),
  extension_fee integer not null default 0 check (extension_fee >= 0),
  discount integer not null default 0 check (discount >= 0),
  total_amount integer generated always as (greatest(base_price + nomination_fee + extension_fee - discount, 0)) stored,
  therapist_payout integer not null default 0 check (therapist_payout >= 0),
  payment_method text not null default 'unpaid'
    check (payment_method in ('cash', 'card', 'paypay', 'other', 'unpaid')),
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'cancelled', 'no_show')),
  is_first_visit boolean not null default true,
  notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resort_bookings_booking_date_idx on public.resort_bookings (booking_date);
create index resort_bookings_store_date_idx on public.resort_bookings (store_id, booking_date);
create index resort_bookings_therapist_date_idx on public.resort_bookings (therapist_id, booking_date);
create index resort_bookings_customer_date_idx on public.resort_bookings (customer_id, booking_date);
create index resort_bookings_status_idx on public.resort_bookings (status);

create trigger resort_customers_set_updated_at
before update on public.resort_customers
for each row execute function public.resort_set_updated_at();

create trigger resort_bookings_set_updated_at
before update on public.resort_bookings
for each row execute function public.resort_set_updated_at();

alter table public.resort_customers enable row level security;
alter table public.resort_bookings enable row level security;

revoke all on public.resort_customers from anon;
revoke all on public.resort_bookings from anon;
grant select, insert, update, delete on public.resort_customers to authenticated;
grant select, insert, update, delete on public.resort_bookings to authenticated;

create policy "Resort admins manage customers"
on public.resort_customers
for all
to authenticated
using ((select exists (
  select 1 from public.resort_admins
  where resort_admins.user_id = (select auth.uid())
)))
with check ((select exists (
  select 1 from public.resort_admins
  where resort_admins.user_id = (select auth.uid())
)));

create policy "Resort admins manage bookings"
on public.resort_bookings
for all
to authenticated
using ((select exists (
  select 1 from public.resort_admins
  where resort_admins.user_id = (select auth.uid())
)))
with check ((select exists (
  select 1 from public.resort_admins
  where resort_admins.user_id = (select auth.uid())
)));
