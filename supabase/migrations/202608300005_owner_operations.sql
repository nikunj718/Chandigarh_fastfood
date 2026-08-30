-- Owner operations: weekly availability and public storefront-safe dish media.
create table if not exists public.restaurant_operating_hours (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_closed boolean not null default true,
  opens_at time without time zone,
  closes_at time without time zone,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, day_of_week),
  check (
    (is_closed and opens_at is null and closes_at is null)
    or (not is_closed and opens_at is not null and closes_at is not null and opens_at <> closes_at)
  )
);

create index if not exists restaurant_operating_hours_restaurant_idx
  on public.restaurant_operating_hours(restaurant_id, day_of_week);

create or replace function public.seed_restaurant_operating_hours()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.restaurant_operating_hours (restaurant_id, day_of_week, is_closed)
  select new.id, day_of_week, true
  from generate_series(0, 6) as day_of_week
  on conflict (restaurant_id, day_of_week) do nothing;
  return new;
end;
$$;

drop trigger if exists restaurant_default_operating_hours on public.restaurants;
create trigger restaurant_default_operating_hours
after insert on public.restaurants
for each row execute procedure public.seed_restaurant_operating_hours();

insert into public.restaurant_operating_hours (restaurant_id, day_of_week, is_closed)
select r.id, day_of_week, true
from public.restaurants r
cross join generate_series(0, 6) as day_of_week
on conflict (restaurant_id, day_of_week) do nothing;

alter table public.restaurant_operating_hours enable row level security;

create policy "active restaurant hours readable" on public.restaurant_operating_hours
for select to authenticated using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_operating_hours.restaurant_id
      and (r.active or public.can_manage_restaurant(r.id))
  )
);

create policy "restaurant managers manage operating hours" on public.restaurant_operating_hours
for all to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-food-images',
  'restaurant-food-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads restaurant food images" on storage.objects;
create policy "public reads restaurant food images" on storage.objects
for select using (bucket_id = 'restaurant-food-images');

comment on table public.restaurant_operating_hours is 'India weekly operating schedule. A closing time earlier than opening time continues into the next day.';
comment on table storage.buckets is 'restaurant-food-images bucket stores public menu photography uploaded through trusted restaurant management APIs.';
