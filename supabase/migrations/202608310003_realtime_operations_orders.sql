-- Let Operations receive immediate inserts and updates for its restaurant's order feed.
alter table public.orders replica identity full;
alter table public.delivery_assignments replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.delivery_assignments;
exception when duplicate_object then null; end $$;
