-- FindTao schema — cloud sync, profiles/roles, store directory, and tag definitions.
-- Idempotent: run the whole file in the Supabase dashboard → SQL Editor any time
-- it changes (or `supabase db push`).
--
-- AUTH: identity comes from Clerk via the Supabase third-party-auth integration,
-- not Supabase Auth. Clerk user ids are strings, so id columns are `text` and RLS
-- is keyed on the verified Clerk `sub` claim: (auth.jwt() ->> 'sub'). BEFORE this
-- works, add Clerk as a provider under Supabase → Authentication → Sign In /
-- Providers (paste your Clerk domain) so Supabase validates the token.
--
-- Note: policies are NOT scoped `to authenticated`. Clerk's session token doesn't
-- reliably carry a `role: "authenticated"` claim, so Supabase runs these requests
-- as the `anon` Postgres role even when signed in — a `to authenticated` policy
-- would then deny every write. Gating on the cryptographically-verified `sub`
-- (and is_admin(), which reads that sub) is the real security boundary and works
-- regardless of the role claim. A request with no valid token has a null sub and
-- matches nothing. Public reads stay open for signed-out browsing.

-- ─────────────────────────────────────────────────────────────────────────────
-- Cloud sync: one row per user holding their full app state as JSON.
-- user_id is the Clerk user id (text).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_state (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;

-- Migrate a pre-Clerk table (uuid user_id + FK to auth.users) in place. The
-- column retype rewrites the table under an exclusive lock, so it's guarded to
-- run only while the column is still uuid — otherwise a re-run needlessly
-- re-locks the table and can deadlock against the live app's reads. Policies are
-- dropped first so retyping can't break their old expressions.
drop policy if exists "read own state" on public.user_state;
drop policy if exists "insert own state" on public.user_state;
drop policy if exists "update own state" on public.user_state;
alter table public.user_state drop constraint if exists user_state_user_id_fkey;
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'user_state' and column_name = 'user_id') = 'uuid' then
    alter table public.user_state alter column user_id type text using user_id::text;
  end if;
end $$;

create policy "read own state" on public.user_state for select
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "insert own state" on public.user_state for insert
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "update own state" on public.user_state for update
  using ((auth.jwt() ->> 'sub') = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles: one row per user, upserted app-side on first Clerk sign-in (the old
-- auth.users signup trigger no longer applies). `tags` holds role-style labels
-- (owner, admin, beta, …) assigned from the dev panel. user_id is the Clerk id.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id text primary key,
  email text,
  username text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles enable row level security;

-- Remove the Supabase-Auth signup trigger + function (Clerk users never hit
-- auth.users, so it can't fire; profile rows are upserted by the app instead).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Migrate a pre-Clerk profiles table in place (drop policies first, then retype).
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "admin updates profiles" on public.profiles;
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
-- Guarded like user_state above: only rewrite while the column is still uuid.
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id') = 'uuid' then
    alter table public.profiles alter column user_id type text using user_id::text;
  end if;
end $$;

-- Admin check: an 'admin' or 'owner' tag on the caller's own profile. security
-- definer so RLS policies can call it. Keyed on the Clerk `sub` claim.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select tags && array['admin','owner'] from public.profiles
       where user_id = (auth.jwt() ->> 'sub')),
    false
  )
$$;

create policy "read own profile" on public.profiles for select
  using (user_id = (auth.jwt() ->> 'sub') or public.is_admin());
create policy "insert own profile" on public.profiles for insert
  with check (user_id = (auth.jwt() ->> 'sub'));
create policy "update own profile" on public.profiles for update
  using (user_id = (auth.jwt() ->> 'sub'));
create policy "admin updates profiles" on public.profiles for update
  using (public.is_admin());

-- Bootstrap the site owner with the 'owner' role tag so the admin UI + RLS
-- writes are enabled for them. Requires the owner to have signed in once (which
-- creates their profile row and populates email from their Clerk account);
-- re-run this file after that first sign-in. Change the email if the owner does.
update public.profiles
  set tags = array['owner']
  where email = 'ren.tipton@icloud.com'
    and not (tags && array['owner', 'admin']);

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
-- Site-default referral codes per agent, set from the dev panel. Stored as a
-- full query fragment (e.g. 'partnercode=FINDTAO') appended to agent links.
-- A user's own code from Settings overrides the default in links they build.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.agent_refs (
  agent_id text primary key,
  code text not null default ''
);
alter table public.agent_refs enable row level security;

drop policy if exists "anyone reads agent refs" on public.agent_refs;
create policy "anyone reads agent refs" on public.agent_refs for select using (true);
drop policy if exists "admin inserts agent refs" on public.agent_refs;
create policy "admin inserts agent refs" on public.agent_refs for insert with check (public.is_admin());
drop policy if exists "admin updates agent refs" on public.agent_refs;
create policy "admin updates agent refs" on public.agent_refs for update using (public.is_admin());
drop policy if exists "admin deletes agent refs" on public.agent_refs;
create policy "admin deletes agent refs" on public.agent_refs for delete using (public.is_admin());

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
  image_url text,
  created_at timestamptz not null default now()
);
-- Uploaded store profile picture (Supabase Storage public URL); idempotent add.
alter table public.store_directory add column if not exists image_url text;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Store reviews — sizing/fit notes imported from Discord exports (Discrub
-- JSON or plain text), one row per message. Managed from /dev; read by
-- everyone so the AI Advisor can factor them into its recommendation for any
-- signed-in or local-only user, not just the admin who imported them.
-- `store_id` is a loose text reference (not a foreign key) since a review
-- can be imported for a store before/without it existing in the directory.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.store_reviews (
  id bigint generated always as identity primary key,
  store_id text not null,
  author text not null default 'Unknown',
  content text not null,
  source text not null default 'discord',
  created_at timestamptz not null default now()
);
alter table public.store_reviews enable row level security;
create index if not exists store_reviews_store_id_idx on public.store_reviews (store_id);

drop policy if exists "anyone reads reviews" on public.store_reviews;
create policy "anyone reads reviews" on public.store_reviews for select using (true);
drop policy if exists "admin inserts reviews" on public.store_reviews;
create policy "admin inserts reviews" on public.store_reviews for insert with check (public.is_admin());
drop policy if exists "admin deletes reviews" on public.store_reviews;
create policy "admin deletes reviews" on public.store_reviews for delete using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog items — the searchable product catalog (Browse, item cards/detail).
-- Admin-curated from /dev, same pattern as store_directory. store_name/
-- store_trust/store_hue are denormalized copies of the picked directory
-- store at add-time (not a live join) — the catalog has no reliable way to
-- resolve a store at read time otherwise, since the static/legacy STORES
-- list is intentionally empty and the real directory only exists in this
-- database. A store's trust score changing later won't retroactively
-- update items already added; re-add or edit the item to refresh it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.catalog_items (
  id text primary key,
  title text not null,
  marketplace text not null check (marketplace in ('taobao', 'weidian', '1688', 'xianyu')),
  item_id text not null,
  price_cny numeric not null check (price_cny >= 0),
  category text not null check (category in ('jacket', 'hoodie', 'tee', 'pants', 'shoes', 'bag', 'accessory')),
  store_id text not null,
  store_name text not null,
  store_trust int not null default 50,
  store_hue1 text not null default '#8b5cf6',
  store_hue2 text not null default '#22d3ee',
  qc_count int not null default 0,
  tags text[] not null default '{}',
  fit_note text,
  hue1 text not null default '#8b5cf6',
  hue2 text not null default '#22d3ee',
  created_at timestamptz not null default now()
);
alter table public.catalog_items enable row level security;
create index if not exists catalog_items_store_id_idx on public.catalog_items (store_id);

drop policy if exists "anyone reads catalog items" on public.catalog_items;
create policy "anyone reads catalog items" on public.catalog_items for select using (true);
drop policy if exists "admin inserts catalog items" on public.catalog_items;
create policy "admin inserts catalog items" on public.catalog_items for insert with check (public.is_admin());
drop policy if exists "admin updates catalog items" on public.catalog_items;
create policy "admin updates catalog items" on public.catalog_items for update using (public.is_admin());
drop policy if exists "admin deletes catalog items" on public.catalog_items;
create policy "admin deletes catalog items" on public.catalog_items for delete using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared hauls — a public snapshot of a user's haul, published from /hauls for
-- sharing (short /haul/<slug> links, Discord/Twitter unfurl, copy-image). `data`
-- is a self-contained array of item snapshots (title, price, qty, image, store,
-- url) so viewers need none of the owner's other data. Totals are denormalized
-- so the share page + OG image don't recompute. Anyone can read a public share
-- (no sign-in); only the owner (Clerk sub) can publish/update/unpublish theirs.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.shared_hauls (
  slug text primary key,
  owner_id text not null,
  owner_name text not null default 'Anonymous',
  owner_image text,
  kind text not null default 'haul',
  name text not null default 'Haul',
  data jsonb not null default '[]'::jsonb,
  total_cny numeric not null default 0,
  unit_count int not null default 0,
  weight_g int not null default 0,
  -- Sharer's display currency + the CNY→currency rate captured at share time,
  -- so the preview page and images render a stable secondary price.
  currency text not null default 'USD',
  rate numeric not null default 0,
  public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Add the newer columns to a pre-existing table (idempotent re-run).
alter table public.shared_hauls add column if not exists owner_image text;
alter table public.shared_hauls add column if not exists kind text not null default 'haul';
alter table public.shared_hauls add column if not exists currency text not null default 'USD';
alter table public.shared_hauls add column if not exists rate numeric not null default 0;
alter table public.shared_hauls enable row level security;
create index if not exists shared_hauls_owner_idx on public.shared_hauls (owner_id);

-- Public shares are readable by anyone (no `to authenticated`); private ones
-- only by their owner. Writes are owner-only.
drop policy if exists "read public or own shares" on public.shared_hauls;
create policy "read public or own shares" on public.shared_hauls for select
  using (public or owner_id = (auth.jwt() ->> 'sub'));
drop policy if exists "insert own shares" on public.shared_hauls;
create policy "insert own shares" on public.shared_hauls for insert
  with check (owner_id = (auth.jwt() ->> 'sub'));
drop policy if exists "update own shares" on public.shared_hauls;
create policy "update own shares" on public.shared_hauls for update
  using (owner_id = (auth.jwt() ->> 'sub'));
drop policy if exists "delete own shares" on public.shared_hauls;
create policy "delete own shares" on public.shared_hauls for delete
  using (owner_id = (auth.jwt() ->> 'sub'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: public bucket for store profile pictures, uploaded from /dev. Anyone
-- can read (avatars show for signed-out visitors too); only admins can write.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('store-avatars', 'store-avatars', true)
  on conflict (id) do nothing;

drop policy if exists "public reads store avatars" on storage.objects;
create policy "public reads store avatars" on storage.objects for select
  using (bucket_id = 'store-avatars');
drop policy if exists "admin inserts store avatars" on storage.objects;
create policy "admin inserts store avatars" on storage.objects for insert
  with check (bucket_id = 'store-avatars' and public.is_admin());
drop policy if exists "admin updates store avatars" on storage.objects;
create policy "admin updates store avatars" on storage.objects for update
  using (bucket_id = 'store-avatars' and public.is_admin());
drop policy if exists "admin deletes store avatars" on storage.objects;
create policy "admin deletes store avatars" on storage.objects for delete
  using (bucket_id = 'store-avatars' and public.is_admin());
