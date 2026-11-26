-- Safe to re-run: tables, indexes and policies are only created if missing.
-- Create storage bucket for attachments
insert into storage.buckets (id, name, public)
values ('rc-attachments', 'rc-attachments', true)
on conflict (id) do nothing;

-- Allow public reads
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read access'
  ) then
    create policy "Public read access" on storage.objects
      for select using (bucket_id = 'rc-attachments');
  end if;
end $$;

-- Allow uploads
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow uploads'
  ) then
    create policy "Allow uploads" on storage.objects
      for insert with check (bucket_id = 'rc-attachments');
  end if;
end $$;
