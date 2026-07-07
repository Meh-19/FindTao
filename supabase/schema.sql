-- FindTao schema — cloud sync, profiles/roles, store directory, and tag definitions.
-- Idempotent: run the whole file in the Supabase dashboard → SQL Editor any time
-- it changes (or `supabase db push`).

-- ─────────────────────────────────────────────────────────────────────────────
-- Cloud sync: one row per user holding their full app state as JSON.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;

drop policy if exists "read own state" on public.user_state;
create policy "read own state" on public.user_state for select using (auth.uid() = user_id);
drop policy if exists "insert own state" on public.user_state;
create policy "insert own state" on public.user_state for insert with check (auth.uid() = user_id);
drop policy if exists "update own state" on public.user_state;
create policy "update own state" on public.user_state for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles: one row per user, created automatically on signup. `tags` holds
-- role-style labels (owner, admin, beta, …) assigned from the dev panel.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for anyone who signed up before this table existed.
insert into public.profiles (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- Admin check: the owner email is always admin; otherwise the profile needs
-- an 'admin' or 'owner' tag. security definer so RLS policies can call it.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.jwt() ->> 'email') = 'ren.tipton@icloud.com'
    or coalesce(
      (select tags && array['admin','owner'] from public.profiles where user_id = auth.uid()),
      false
    )
$$;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles for update
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Tag definitions — Discord-role-style labels, creatable from the dev panel.
-- kind 'store' tags decorate directory stores; kind 'user' tags go on profiles.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tag_defs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('store', 'user')),
  name text not null,
  color text not null default '#8b5cf6',
  unique (kind, name)
);
alter table public.tag_defs enable row level security;

drop policy if exists "anyone reads tags" on public.tag_defs;
create policy "anyone reads tags" on public.tag_defs for select using (true);
drop policy if exists "admin inserts tags" on public.tag_defs;
create policy "admin inserts tags" on public.tag_defs for insert with check (public.is_admin());
drop policy if exists "admin updates tags" on public.tag_defs;
create policy "admin updates tags" on public.tag_defs for update using (public.is_admin());
drop policy if exists "admin deletes tags" on public.tag_defs;
create policy "admin deletes tags" on public.tag_defs for delete using (public.is_admin());

insert into public.tag_defs (kind, name, color) values
  ('store', 'hot', '#ef4444'),
  ('store', 'popular', '#f59e0b'),
  ('store', 'trending', '#d946ef'),
  ('store', 'trusted seller', '#22c55e'),
  ('store', 'new', '#22d3ee'),
  ('user', 'owner', '#f59e0b'),
  ('user', 'admin', '#ef4444'),
  ('user', 'beta', '#8b5cf6')
on conflict (kind, name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Store directory — the community stores everyone sees. Managed from /dev.
-- Banned stores are hidden from everyone but admins by RLS.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.store_directory (
  id text primary key,
  name text not null,
  url text not null,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  blurb text not null default '',
  hue1 text not null default '#8b5cf6',
  hue2 text not null default '#22d3ee',
  trust int not null default 50,
  discover boolean not null default true,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.store_directory enable row level security;

drop policy if exists "read visible stores" on public.store_directory;
create policy "read visible stores" on public.store_directory for select
  using (not banned or public.is_admin());
drop policy if exists "admin inserts stores" on public.store_directory;
create policy "admin inserts stores" on public.store_directory for insert with check (public.is_admin());
drop policy if exists "admin updates stores" on public.store_directory;
create policy "admin updates stores" on public.store_directory for update using (public.is_admin());
drop policy if exists "admin deletes stores" on public.store_directory;
create policy "admin deletes stores" on public.store_directory for delete using (public.is_admin());
