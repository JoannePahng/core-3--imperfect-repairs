-- Imperfect Repairs: community database
-- Supabase → SQL Editor → New query 에 전체를 붙여넣고 Run 한 번.
--
-- What visitors can do (anon key):
--   submissions  add a photograph (hidden until approved = true); read approved ones
--   comments     read and add comments on a photograph
--   opinions     read and add posts in the discussion
--   votes        cast one vote per browser; read the totals
-- Approving or deleting anything is done in the Supabase dashboard (Table Editor).

-- ---------- Tables ----------
create table if not exists public.submissions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text check (char_length(name) <= 40),
  place       text check (char_length(place) <= 60),
  found_on    text check (char_length(found_on) <= 10),
  type        text not null check (type in ('crack', 'patch', 'line', 'breach')),
  material    text not null check (material in ('asphalt', 'concrete', 'stone')),
  caption     text check (char_length(caption) <= 280),
  file_path   text not null check (char_length(file_path) <= 200),
  width       int  not null check (width between 1 and 10000),
  height      int  not null check (height between 1 and 10000),
  approved    boolean not null default false
);

create table if not exists public.comments (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  photo_id    text not null check (char_length(photo_id) <= 20),
  name        text check (char_length(name) <= 40),
  body        text not null check (char_length(body) between 1 and 500)
);
create index if not exists comments_photo on public.comments (photo_id, created_at desc);

create table if not exists public.opinions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text check (char_length(name) <= 40),
  body        text not null check (char_length(body) between 1 and 800)
);

create table if not exists public.votes (
  client_id   text primary key check (char_length(client_id) between 8 and 64),
  choice      text not null check (choice in ('beauty', 'vulnerability')),
  created_at  timestamptz not null default now()
);

-- Optional map pin for a visitor photograph
alter table public.submissions add column if not exists lat double precision check (lat between -90 and 90);
alter table public.submissions add column if not exists lng double precision check (lng between -180 and 180);

-- Totals only, so individual votes stay private
create or replace view public.vote_totals as
  select choice, count(*)::int as total from public.votes group by choice;

-- ---------- Row level security ----------
alter table public.submissions enable row level security;
alter table public.comments    enable row level security;
alter table public.opinions    enable row level security;
alter table public.votes       enable row level security;

drop policy if exists "read approved"   on public.submissions;
drop policy if exists "submit pending"  on public.submissions;
create policy "read approved"  on public.submissions for select to anon using (approved);
create policy "submit pending" on public.submissions for insert to anon with check (approved = false);

drop policy if exists "read comments" on public.comments;
drop policy if exists "add comment"   on public.comments;
create policy "read comments" on public.comments for select to anon using (true);
create policy "add comment"   on public.comments for insert to anon with check (true);

drop policy if exists "read opinions" on public.opinions;
drop policy if exists "add opinion"   on public.opinions;
create policy "read opinions" on public.opinions for select to anon using (true);
create policy "add opinion"   on public.opinions for insert to anon with check (true);

drop policy if exists "cast vote" on public.votes;
create policy "cast vote" on public.votes for insert to anon with check (true);

grant select on public.vote_totals to anon;

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', true, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 15728640, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "upload submission" on storage.objects;
create policy "upload submission" on storage.objects for insert to anon
  with check (bucket_id = 'submissions');
