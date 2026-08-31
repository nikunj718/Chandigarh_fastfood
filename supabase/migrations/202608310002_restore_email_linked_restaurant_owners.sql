-- Restore owner memberships from the verified email stored on each restaurant.
-- The owner_email column already exists for restaurants created by the current app.
alter table public.restaurants
  add column if not exists owner_email text;

update public.restaurants
set owner_email = lower(trim(owner_email))
where owner_email is not null
  and owner_email <> lower(trim(owner_email));

create index if not exists restaurants_owner_email_ci_idx
  on public.restaurants (lower(owner_email))
  where owner_email is not null;

insert into public.restaurant_memberships (restaurant_id, user_id, role)
select restaurant.id, profile.id, 'owner'::public.restaurant_member_role
from public.restaurants restaurant
join public.profiles profile
  on lower(profile.email) = lower(restaurant.owner_email)
 and profile.email_verified
where restaurant.owner_email is not null
on conflict (restaurant_id, user_id) do update
  set role = excluded.role
  where public.restaurant_memberships.role <> 'owner';
