-- Repair partial deployments where the menu-photo bucket was not created.
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
