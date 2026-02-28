-- Create storage bucket for attachments
insert into storage.buckets (id, name, public)
values ('rc-attachments', 'rc-attachments', true)
on conflict (id) do nothing;

-- Allow public reads
create policy "Public read access" on storage.objects
  for select using (bucket_id = 'rc-attachments');

-- Allow uploads
create policy "Allow uploads" on storage.objects
  for insert with check (bucket_id = 'rc-attachments');
