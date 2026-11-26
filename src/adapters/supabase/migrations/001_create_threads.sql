-- Safe to re-run: tables, indexes and policies are only created if missing.
create table if not exists rc_threads (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  page_url text not null,
  pin jsonb not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rc_threads_project on rc_threads (project_id);
create index if not exists idx_rc_threads_page on rc_threads (project_id, page_url);

-- RLS policies (permissive for trust-based identity)
alter table rc_threads enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rc_threads' and policyname = 'Anyone can read threads'
  ) then
    create policy "Anyone can read threads" on rc_threads
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rc_threads' and policyname = 'Anyone can create threads'
  ) then
    create policy "Anyone can create threads" on rc_threads
      for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rc_threads' and policyname = 'Anyone can update thread status'
  ) then
    create policy "Anyone can update thread status" on rc_threads
      for update using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rc_threads' and policyname = 'Anyone can delete threads'
  ) then
    create policy "Anyone can delete threads" on rc_threads
      for delete using (true);
  end if;
end $$;

grant select, insert, update, delete on table rc_threads to anon, authenticated;
