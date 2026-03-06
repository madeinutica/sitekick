-- Create the system_updates history table
create table if not exists public.system_updates (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  features      text[] not null default '{}',
  bug_fixes     text[] not null default '{}',
  recipient_count integer not null default 0,
  created_by    uuid references auth.users(id),
  sent_at       timestamptz not null default now()
);

-- Only super_admins can see / insert
alter table public.system_updates enable row level security;

create policy "super_admin_all" on public.system_updates
  for all
  using (
    exists (
      select 1
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('super_admin', 'brand_ambassador')
    )
  );
