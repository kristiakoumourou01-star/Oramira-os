-- Oramira OS — Migration 0107: public bucket for mobile-app images
-- Settings → Mobile app: images of home-screen blocks (banner, hero, projects…)
-- and Apple / Google Wallet card logos. They are shown inside the customer app,
-- so the bucket is public (read by anyone with the URL); only staff upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-media', 'app-media', true, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_media_public_read on storage.objects;
create policy app_media_public_read on storage.objects for select
  using (bucket_id = 'app-media');

drop policy if exists app_media_staff_insert on storage.objects;
create policy app_media_staff_insert on storage.objects for insert
  with check (bucket_id = 'app-media' and is_staff());

drop policy if exists app_media_staff_update on storage.objects;
create policy app_media_staff_update on storage.objects for update
  using (bucket_id = 'app-media' and is_staff())
  with check (bucket_id = 'app-media' and is_staff());

drop policy if exists app_media_staff_delete on storage.objects;
create policy app_media_staff_delete on storage.objects for delete
  using (bucket_id = 'app-media' and is_staff());
