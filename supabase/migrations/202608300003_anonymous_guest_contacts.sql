-- Anonymous guest sessions and encrypted delivery contacts.
-- CUSTOMER_CONTACT_ENCRYPTION_KEY remains server-only; ciphertext is created by the app.
alter table public.profiles
  add column if not exists email text,
  add column if not exists email_verified boolean not null default false,
  add column if not exists default_delivery_phone_ciphertext text;

alter table public.orders
  add column if not exists delivery_phone_ciphertext text,
  add column if not exists delivery_phone_last4 text check (delivery_phone_last4 is null or delivery_phone_last4 ~ '^[0-9]{4}$');

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email)) where email is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, display_name, email, email_verified)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(lower(new.email), ''),
    new.email_confirmed_at is not null
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    email = excluded.email,
    email_verified = excluded.email_verified,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists auth_user_profile_identity_sync on auth.users;
create trigger auth_user_profile_identity_sync after update of email, email_confirmed_at, phone on auth.users
for each row execute procedure public.handle_new_user();

update public.profiles p
set email = nullif(lower(u.email), ''),
    email_verified = u.email_confirmed_at is not null,
    updated_at = now()
from auth.users u
where u.id = p.id;

create or replace function public.block_direct_delivery_contact_updates()
returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' and pg_trigger_depth() <= 1
    and new.default_delivery_phone_ciphertext is distinct from old.default_delivery_phone_ciphertext then
    raise exception 'Delivery contacts can only be updated by the trusted server';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_direct_delivery_contact on public.profiles;
create trigger profiles_block_direct_delivery_contact
before update of default_delivery_phone_ciphertext on public.profiles
for each row execute procedure public.block_direct_delivery_contact_updates();

create or replace function public.block_direct_profile_identity_updates()
returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' and pg_trigger_depth() <= 1
    and (new.email is distinct from old.email
      or new.email_verified is distinct from old.email_verified
      or new.platform_role is distinct from old.platform_role) then
    raise exception 'Profile identity and role fields can only be updated by the trusted authentication path';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_direct_identity_updates on public.profiles;
create trigger profiles_block_direct_identity_updates
before update of email, email_verified, platform_role on public.profiles
for each row execute procedure public.block_direct_profile_identity_updates();

create or replace function public.remember_delivery_contact_from_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.delivery_phone_ciphertext is not null then
    update public.profiles
    set default_delivery_phone_ciphertext = new.delivery_phone_ciphertext,
        updated_at = now()
    where id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_remember_delivery_contact on public.orders;
create trigger orders_remember_delivery_contact
after insert on public.orders
for each row execute procedure public.remember_delivery_contact_from_order();

drop policy if exists "owners manage non-owner memberships" on public.restaurant_memberships;
drop policy if exists "owners update non-owner memberships" on public.restaurant_memberships;
drop policy if exists "owners remove non-owner memberships" on public.restaurant_memberships;

create policy "owners add verified staff" on public.restaurant_memberships
for insert to authenticated
with check (
  public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])
  and role in ('manager', 'rider')
  and exists (
    select 1 from public.profiles p
    where p.id = restaurant_memberships.user_id and p.email_verified
  )
);

create policy "owners update verified staff" on public.restaurant_memberships
for update to authenticated
using (public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[]) and role <> 'owner')
with check (
  public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[])
  and role in ('manager', 'rider')
  and exists (
    select 1 from public.profiles p
    where p.id = restaurant_memberships.user_id and p.email_verified
  )
);

create policy "owners remove verified staff" on public.restaurant_memberships
for delete to authenticated
using (public.is_restaurant_member(restaurant_id, array['owner']::public.restaurant_member_role[]) and role <> 'owner');

comment on column public.profiles.default_delivery_phone_ciphertext is 'AES-256-GCM ciphertext; only the trusted server decrypts it for the customer or authorized delivery staff.';
comment on column public.orders.delivery_phone_ciphertext is 'AES-256-GCM ciphertext snapshot of the checkout delivery contact.';
