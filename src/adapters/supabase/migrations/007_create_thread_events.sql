-- Status history: one row per status change, with who made it.
-- Without this table react-pinmark still works; threads just show no history.
-- Safe to re-run.

create table if not exists rc_thread_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references rc_threads(id) on delete cascade,
  project_id text not null,
  type text not null check (type in ('status_changed')),
  actor jsonb not null,
  to_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rc_thread_events_project
  on rc_thread_events (project_id, created_at);

alter table rc_thread_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rc_thread_events'
      and policyname = 'Anyone can read thread events'
  ) then
    create policy "Anyone can read thread events" on rc_thread_events
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rc_thread_events'
      and policyname = 'Anyone can create thread events'
  ) then
    create policy "Anyone can create thread events" on rc_thread_events
      for insert with check (true);
  end if;
end $$;

-- History is append-only: no update or delete grants. Rows go away with their
-- thread through the on delete cascade.
grant select, insert on table rc_thread_events to anon, authenticated;
