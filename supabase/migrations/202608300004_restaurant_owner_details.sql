-- Restaurant publication details for the creator who owns the initial membership.
alter table public.restaurants
  add column if not exists owner_name text,
  add column if not exists owner_email text;

do $$ begin
  alter table public.restaurants
    add constraint restaurants_owner_name_length check (owner_name is null or char_length(owner_name) between 2 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.restaurants
    add constraint restaurants_owner_email_gmail check (
      owner_email is null
      or (owner_email = lower(owner_email) and owner_email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@gmail\.com$')
    );
exception when duplicate_object then null; end $$;

drop policy if exists "authenticated user creates own restaurant" on public.restaurants;
create policy "authenticated user creates complete own restaurant" on public.restaurants
for insert to authenticated
with check (
  created_by = auth.uid()
  and owner_name is not null
  and owner_email is not null
);

comment on column public.restaurants.owner_name is 'Restaurant creator full name, supplied when publishing the restaurant.';
comment on column public.restaurants.owner_email is 'Restaurant creator Gmail address; linked to their staff account after Supabase email confirmation.';
