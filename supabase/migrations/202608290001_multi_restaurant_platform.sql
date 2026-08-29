-- Chandigarh Fastfood multi-restaurant schema. Apply with `supabase db push`.
create extension if not exists pgcrypto;
create extension if not exists postgis;

do $$ begin
  create type public.platform_role as enum ('customer', 'platform_admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.restaurant_member_role as enum ('owner', 'manager', 'rider');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('pending_payment', 'pending_approval', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_method as enum ('cod', 'razorpay');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  display_name text,
  platform_role public.platform_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  phone text,
  address_text text,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  location geography(point, 4326),
  delivery_fee_base numeric(10,2) not null default 0 check (delivery_fee_base >= 0),
  delivery_fee_per_km numeric(10,2) not null default 0 check (delivery_fee_per_km >= 0),
  delivery_radius_km numeric(6,2) not null default 8 check (delivery_radius_km > 0 and delivery_radius_km <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_memberships (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.restaurant_member_role not null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  vegetarian boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  address_text text not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  location geography(point, 4326),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_default_address_per_customer on public.customer_addresses(customer_id) where is_default;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  address_id uuid references public.customer_addresses(id) on delete set null,
  status public.order_status not null,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  idempotency_key uuid not null,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  route_distance_km numeric(8,3) not null check (route_distance_km >= 0),
  route_duration_seconds integer not null check (route_duration_seconds >= 0),
  customer_address_snapshot jsonb not null,
  restaurant_snapshot jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total numeric(10,2) not null check (line_total >= 0)
);

create table if not exists public.delivery_assignments (
  order_id uuid primary key references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique (order_id, rider_id)
);

create table if not exists public.delivery_location_points (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  location geography(point, 4326),
  accuracy_meters numeric(8,2),
  recorded_at timestamptz not null default now()
);
create index if not exists delivery_points_order_recorded_idx on public.delivery_location_points(order_id, recorded_at desc);

create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

create or replace function public.set_geography_from_coordinates()
returns trigger language plpgsql as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_delivery_point_geography()
returns trigger language plpgsql as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end;
$$;

drop trigger if exists restaurants_set_location on public.restaurants;
create trigger restaurants_set_location before insert or update of latitude, longitude on public.restaurants
for each row execute procedure public.set_geography_from_coordinates();
drop trigger if exists addresses_set_location on public.customer_addresses;
create trigger addresses_set_location before insert or update of latitude, longitude on public.customer_addresses
for each row execute procedure public.set_geography_from_coordinates();
drop trigger if exists points_set_location on public.delivery_location_points;
create trigger points_set_location before insert or update of latitude, longitude on public.delivery_location_points
for each row execute procedure public.set_delivery_point_geography();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.add_restaurant_creator_as_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.restaurant_memberships (restaurant_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
drop trigger if exists restaurant_creator_membership on public.restaurants;
create trigger restaurant_creator_membership after insert on public.restaurants
for each row execute procedure public.add_restaurant_creator_as_owner();

create or replace function public.is_restaurant_member(target_restaurant uuid, allowed_roles public.restaurant_member_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurant_memberships m
    where m.restaurant_id = target_restaurant
      and m.user_id = auth.uid()
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function public.can_manage_restaurant(target_restaurant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_restaurant_member(target_restaurant, array['owner', 'manager']::public.restaurant_member_role[]);
$$;

create or replace function public.can_view_order(target_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders o where o.id = target_order and o.customer_id = auth.uid())
    or exists (
      select 1 from public.orders o
      join public.restaurant_memberships m on m.restaurant_id = o.restaurant_id
      where o.id = target_order and m.user_id = auth.uid()
    );
$$;

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_location_points enable row level security;

create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "restaurant managers view team profiles" on public.profiles for select to authenticated using (
  exists (
    select 1 from public.restaurant_memberships mine
    join public.restaurant_memberships theirs on theirs.restaurant_id = mine.restaurant_id
    where mine.user_id = auth.uid()
      and mine.role in ('owner', 'manager')
      and theirs.user_id = profiles.id
  )
);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "active restaurants readable" on public.restaurants for select to authenticated using (active or public.is_restaurant_member(id));
create policy "authenticated user creates own restaurant" on public.restaurants for insert to authenticated with check (created_by = auth.uid());
create policy "members manage restaurant" on public.restaurants for update to authenticated using (public.can_manage_restaurant(id)) with check (public.can_manage_restaurant(id));

create policy "memberships visible to members" on public.restaurant_memberships for select to authenticated using (user_id = auth.uid() or public.can_manage_restaurant(restaurant_id));
create policy "owners manage non-owner memberships" on public.restaurant_memberships for insert to authenticated with check (public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[]) and role in ('manager', 'rider'));
create policy "owners update non-owner memberships" on public.restaurant_memberships for update to authenticated using (public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])) with check (role in ('manager', 'rider'));
create policy "owners remove non-owner memberships" on public.restaurant_memberships for delete to authenticated using (public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[]) and role <> 'owner');

create policy "active menu visible" on public.menu_categories for select to authenticated using (active and exists(select 1 from public.restaurants r where r.id = restaurant_id and r.active) or public.can_manage_restaurant(restaurant_id));
create policy "managers manage categories" on public.menu_categories for all to authenticated using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));
create policy "active items visible" on public.menu_items for select to authenticated using (active and exists(select 1 from public.restaurants r where r.id = restaurant_id and r.active) or public.can_manage_restaurant(restaurant_id));
create policy "managers manage items" on public.menu_items for all to authenticated using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

create policy "customers own addresses" on public.customer_addresses for select to authenticated using (customer_id = auth.uid());
create policy "customers add own addresses" on public.customer_addresses for insert to authenticated with check (customer_id = auth.uid());
create policy "customers update own addresses" on public.customer_addresses for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "customers delete own addresses" on public.customer_addresses for delete to authenticated using (customer_id = auth.uid());

create policy "customer or restaurant member views order" on public.orders for select to authenticated using (customer_id = auth.uid() or public.is_restaurant_member(restaurant_id));
create policy "customer inserts own order" on public.orders for insert to authenticated with check (customer_id = auth.uid());
create policy "restaurant staff update orders" on public.orders for update to authenticated using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));
create policy "order viewers see items" on public.order_items for select to authenticated using (public.can_view_order(order_id));
create policy "customer inserts own order items" on public.order_items for insert to authenticated with check (public.can_view_order(order_id));

create policy "assignment viewers" on public.delivery_assignments for select to authenticated using (public.can_view_order(order_id) or rider_id = auth.uid());
create policy "restaurant staff assign riders" on public.delivery_assignments for insert to authenticated with check (public.can_manage_restaurant(restaurant_id));
create policy "restaurant staff update assignments" on public.delivery_assignments for update to authenticated using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));
create policy "restaurant staff remove assignments" on public.delivery_assignments for delete to authenticated using (public.can_manage_restaurant(restaurant_id));

create policy "order viewers see live points" on public.delivery_location_points for select to authenticated using (public.can_view_order(order_id));
create policy "assigned rider writes points" on public.delivery_location_points for insert to authenticated with check (
  rider_id = auth.uid() and exists (
    select 1 from public.delivery_assignments a join public.orders o on o.id = a.order_id
    where a.order_id = delivery_location_points.order_id and a.rider_id = auth.uid() and o.status = 'out_for_delivery'
  )
);

alter table public.delivery_location_points replica identity full;
alter publication supabase_realtime add table public.delivery_location_points;

-- Raw coordinate reads are intentionally kept with each record for API responses; the geography point is authoritative for spatial indexes.
create index if not exists restaurants_location_idx on public.restaurants using gist(location);
create index if not exists addresses_location_idx on public.customer_addresses using gist(location);
