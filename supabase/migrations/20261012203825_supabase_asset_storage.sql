-- Server-owned assets. No client policies: all file operations go through
-- application routes/actions which enforce admin, tenant and creator consent.
-- Never insert storage.objects rows directly; file bytes use the Storage API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('storyloop-brand-assets', 'storyloop-brand-assets', false, 5242880,
    array['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon']),
  ('storyloop-private-media', 'storyloop-private-media', false, 52428800,
    array['image/png','image/jpeg','image/webp','video/mp4','video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Fail closed if Storage RLS was unexpectedly disabled on the project.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'Storage object RLS must be enabled before creating private asset buckets';
  end if;
end $$;
