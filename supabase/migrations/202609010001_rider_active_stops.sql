-- A rider can select one current stop while carrying several dispatched orders.
create table if not exists public.rider_active_stops (
  rider_id uuid primary key references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  selected_at timestamptz not null default now()
);

alter table public.rider_active_stops enable row level security;

drop policy if exists "riders view own active stop" on public.rider_active_stops;
create policy "riders view own active stop" on public.rider_active_stops
for select to authenticated
using (rider_id = auth.uid() and public.is_verified_user());

create or replace function public.validate_rider_active_stop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.delivery_assignments assignment
    join public.orders order_record on order_record.id = assignment.order_id
    where assignment.order_id = new.order_id
      and assignment.rider_id = new.rider_id
      and order_record.status = 'out_for_delivery'
  ) then
    raise exception 'A rider can only select an assigned dispatched order as the current stop';
  end if;
  return new;
end;
$$;

drop trigger if exists rider_active_stops_validate on public.rider_active_stops;
create trigger rider_active_stops_validate
before insert or update on public.rider_active_stops
for each row execute function public.validate_rider_active_stop();

create or replace function public.touch_rider_dispatched_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rider_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_rider_id := old.rider_id;
  else
    affected_rider_id := new.rider_id;
  end if;

  update public.orders
  set updated_at = now()
  where id in (
    select assignment.order_id
    from public.delivery_assignments assignment
    join public.orders order_record on order_record.id = assignment.order_id
    where assignment.rider_id = affected_rider_id
      and order_record.status = 'out_for_delivery'
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists rider_active_stops_touch_orders on public.rider_active_stops;
create trigger rider_active_stops_touch_orders
after insert or update or delete on public.rider_active_stops
for each row execute function public.touch_rider_dispatched_orders();
