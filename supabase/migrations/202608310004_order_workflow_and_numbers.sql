-- Kitchen-to-delivery workflow, stable restaurant order numbers, and timeline data.
do $$ begin
  alter type public.order_status add value if not exists 'prepared' after 'preparing';
exception when duplicate_object then null; end $$;

alter table public.orders
  add column if not exists order_number bigint,
  add column if not exists preparation_minutes integer check (preparation_minutes between 1 and 240),
  add column if not exists confirmed_at timestamptz,
  add column if not exists preparing_at timestamptz,
  add column if not exists prepared_at timestamptz,
  add column if not exists out_for_delivery_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create table if not exists public.restaurant_order_counters (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  next_order_number bigint not null default 1 check (next_order_number > 0)
);

with numbered_orders as (
  select id, row_number() over (partition by restaurant_id order by created_at asc, id asc) as number
  from public.orders
  where order_number is null
)
update public.orders
set order_number = numbered_orders.number
from numbered_orders
where orders.id = numbered_orders.id;

insert into public.restaurant_order_counters as counter (restaurant_id, next_order_number)
select restaurant_id, coalesce(max(order_number), 0) + 1
from public.orders
group by restaurant_id
on conflict (restaurant_id) do update
set next_order_number = greatest(counter.next_order_number, excluded.next_order_number);

alter table public.orders alter column order_number set not null;
create unique index if not exists orders_restaurant_order_number_key on public.orders(restaurant_id, order_number);
create index if not exists orders_restaurant_created_at_idx on public.orders(restaurant_id, created_at desc);

create or replace function public.restaurant_order_daily_summary(
  p_restaurant_id uuid,
  p_day_start timestamptz,
  p_day_end timestamptz
)
returns table (accepted_order_count bigint, accepted_gross_value numeric)
language sql
stable
set search_path = public
as $$
  select
    count(*)::bigint as accepted_order_count,
    coalesce(sum(total), 0)::numeric as accepted_gross_value
  from public.orders
  where restaurant_id = p_restaurant_id
    and created_at >= p_day_start
    and created_at < p_day_end
    and status in ('confirmed', 'preparing', 'prepared', 'out_for_delivery', 'delivered')
    and (payment_method = 'cod' or payment_status = 'paid');
$$;

create or replace function public.assign_restaurant_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    insert into public.restaurant_order_counters as counter (restaurant_id, next_order_number)
    values (new.restaurant_id, 2)
    on conflict (restaurant_id) do update
      set next_order_number = counter.next_order_number + 1
    returning next_order_number - 1 into new.order_number;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_restaurant_order_number_before_insert on public.orders;
create trigger assign_restaurant_order_number_before_insert
before insert on public.orders
for each row execute function public.assign_restaurant_order_number();

update public.orders
set confirmed_at = created_at
where confirmed_at is null and status in ('confirmed', 'preparing', 'prepared', 'out_for_delivery', 'delivered');

alter table public.orders replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
