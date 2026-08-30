-- Standard authentication cutover: confirmed Email/Password and Google OAuth only.
-- Existing anonymous identities remain in auth.users but lose application and direct RLS access.
create or replace function public.is_verified_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.email_verified
  );
$$;

create or replace function public.is_restaurant_member(target_restaurant uuid, allowed_roles public.restaurant_member_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_verified_user() and exists (
    select 1 from public.restaurant_memberships m
    where m.restaurant_id = target_restaurant
      and m.user_id = auth.uid()
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function public.can_view_order(target_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_verified_user() and (
    exists (select 1 from public.orders o where o.id = target_order and o.customer_id = auth.uid())
    or exists (
      select 1 from public.orders o
      join public.restaurant_memberships m on m.restaurant_id = o.restaurant_id
      where o.id = target_order and m.user_id = auth.uid()
    )
  );
$$;

alter table public.restaurants drop constraint if exists restaurants_owner_email_gmail;

alter policy "profiles self read" on public.profiles using (id = auth.uid() and public.is_verified_user());
alter policy "restaurant managers view team profiles" on public.profiles using (
  public.is_verified_user() and exists (
    select 1 from public.restaurant_memberships mine
    join public.restaurant_memberships theirs on theirs.restaurant_id = mine.restaurant_id
    where mine.user_id = auth.uid()
      and mine.role in ('owner', 'manager')
      and theirs.user_id = profiles.id
  )
);
alter policy "profiles self update" on public.profiles using (id = auth.uid() and public.is_verified_user()) with check (id = auth.uid() and public.is_verified_user());

alter policy "active restaurants readable" on public.restaurants using (public.is_verified_user() and (active or public.is_restaurant_member(id)));
alter policy "authenticated user creates complete own restaurant" on public.restaurants with check (
  public.is_verified_user()
  and created_by = auth.uid()
  and owner_name is not null
  and owner_email is not null
  and lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
alter policy "members manage restaurant" on public.restaurants using (public.can_manage_restaurant(id)) with check (public.can_manage_restaurant(id));

alter policy "memberships visible to members" on public.restaurant_memberships using (public.is_verified_user() and (user_id = auth.uid() or public.can_manage_restaurant(restaurant_id)));
alter policy "owners add verified staff" on public.restaurant_memberships with check (
  public.is_verified_user()
  and public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])
  and role in ('manager', 'rider')
  and exists (select 1 from public.profiles p where p.id = restaurant_memberships.user_id and p.email_verified)
);
alter policy "owners update verified staff" on public.restaurant_memberships using (
  public.is_verified_user()
  and public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])
  and role <> 'owner'
) with check (
  public.is_verified_user()
  and public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])
  and role in ('manager', 'rider')
  and exists (select 1 from public.profiles p where p.id = restaurant_memberships.user_id and p.email_verified)
);
alter policy "owners remove verified staff" on public.restaurant_memberships using (
  public.is_verified_user()
  and public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])
  and role <> 'owner'
);

alter policy "active menu visible" on public.menu_categories using (public.is_verified_user() and ((active and exists(select 1 from public.restaurants r where r.id = restaurant_id and r.active)) or public.can_manage_restaurant(restaurant_id)));
alter policy "managers manage categories" on public.menu_categories using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));
alter policy "active items visible" on public.menu_items using (public.is_verified_user() and ((active and exists(select 1 from public.restaurants r where r.id = restaurant_id and r.active)) or public.can_manage_restaurant(restaurant_id)));
alter policy "managers manage items" on public.menu_items using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

alter policy "customers own addresses" on public.customer_addresses using (customer_id = auth.uid() and public.is_verified_user());
alter policy "customers add own addresses" on public.customer_addresses with check (customer_id = auth.uid() and public.is_verified_user());
alter policy "customers update own addresses" on public.customer_addresses using (customer_id = auth.uid() and public.is_verified_user()) with check (customer_id = auth.uid() and public.is_verified_user());
alter policy "customers delete own addresses" on public.customer_addresses using (customer_id = auth.uid() and public.is_verified_user());

alter policy "customer or restaurant member views order" on public.orders using (public.is_verified_user() and (customer_id = auth.uid() or public.is_restaurant_member(restaurant_id)));
alter policy "customer inserts own order" on public.orders with check (customer_id = auth.uid() and public.is_verified_user());
alter policy "restaurant staff update orders" on public.orders using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));
alter policy "order viewers see items" on public.order_items using (public.can_view_order(order_id));
alter policy "customer inserts own order items" on public.order_items with check (public.can_view_order(order_id));

alter policy "assignment viewers" on public.delivery_assignments using (public.is_verified_user() and (public.can_view_order(order_id) or rider_id = auth.uid()));
alter policy "restaurant staff assign riders" on public.delivery_assignments with check (public.can_manage_restaurant(restaurant_id));
alter policy "restaurant staff update assignments" on public.delivery_assignments using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));
alter policy "restaurant staff remove assignments" on public.delivery_assignments using (public.can_manage_restaurant(restaurant_id));

alter policy "order viewers see live points" on public.delivery_location_points using (public.can_view_order(order_id));
alter policy "assigned rider writes points" on public.delivery_location_points with check (
  public.is_verified_user()
  and rider_id = auth.uid()
  and exists (
    select 1 from public.delivery_assignments a join public.orders o on o.id = a.order_id
    where a.order_id = delivery_location_points.order_id and a.rider_id = auth.uid() and o.status = 'out_for_delivery'
  )
);

alter policy "active restaurant hours readable" on public.restaurant_operating_hours using (
  public.is_verified_user() and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_operating_hours.restaurant_id
      and (r.active or public.can_manage_restaurant(r.id))
  )
);
alter policy "restaurant managers manage operating hours" on public.restaurant_operating_hours using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

comment on function public.is_verified_user() is 'True only for profiles synchronized from a confirmed Email/Password or Google OAuth identity.';
