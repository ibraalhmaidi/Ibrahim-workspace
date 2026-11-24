-- مساحة إبراهيم: جداول المهام والأفكار مع عزل بيانات كل مستخدم
create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  category text default 'work',
  due timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.ideas enable row level security;

drop policy if exists "Users manage own tasks" on public.tasks;
create policy "Users manage own tasks" on public.tasks
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own ideas" on public.ideas;
create policy "Users manage own ideas" on public.ideas
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.ideas to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ideas;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
