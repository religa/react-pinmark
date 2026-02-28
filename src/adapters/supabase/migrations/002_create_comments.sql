create table if not exists rc_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references rc_threads(id) on delete cascade,
  author jsonb not null,
  body text not null,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_rc_comments_thread on rc_comments (thread_id, created_at);

-- RLS policies
alter table rc_comments enable row level security;

create policy "Anyone can read comments" on rc_comments
  for select using (true);

create policy "Anyone can create comments" on rc_comments
  for insert with check (true);

create policy "Anyone can delete comments" on rc_comments
  for delete using (true);

grant select, insert, update, delete on table rc_comments to anon, authenticated;
