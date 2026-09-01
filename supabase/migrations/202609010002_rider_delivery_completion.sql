-- Complete the current rider stop in one transaction so customer tracking and the rider queue stay consistent.
create or replace function public.complete_rider_delivery(target_order_id uuid)
returns table(order_id uuid, delivered_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_at timestamptz := now();
  completed_order_id uuid;
begin
  if not public.is_verified_user() then
    raise exception 'A confirmed rider account is required' using errcode = '42501';
  end if;

  select order_record.id
  into completed_order_id
  from public.rider_active_stops active_stop
  join public.delivery_assignments assignment on assignment.order_id = active_stop.order_id
  join public.orders order_record on order_record.id = assignment.order_id
  join public.restaurant_memberships membership on membership.restaurant_id = assignment.restaurant_id
    and membership.user_id = active_stop.rider_id
    and membership.role = 'rider'
  where active_stop.rider_id = auth.uid()
    and active_stop.order_id = target_order_id
    and assignment.rider_id = active_stop.rider_id
    and order_record.status = 'out_for_delivery'
  for update of active_stop, assignment, order_record;

  if completed_order_id is null then
    raise exception 'Only your current dispatched delivery can be marked delivered' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'delivered', delivered_at = completed_at, updated_at = completed_at
  where id = completed_order_id and status = 'out_for_delivery';

  if not found then
    raise exception 'This delivery is no longer active' using errcode = 'P0001';
  end if;

  delete from public.rider_active_stops
  where rider_id = auth.uid() and order_id = completed_order_id;

  return query select completed_order_id, completed_at;
end;
$$;

revoke all on function public.complete_rider_delivery(uuid) from public;
grant execute on function public.complete_rider_delivery(uuid) to authenticated;
