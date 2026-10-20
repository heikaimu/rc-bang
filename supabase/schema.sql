create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '' check (char_length(nickname) <= 40),
  wechat_id text not null default '' check (char_length(wechat_id) <= 100),
  group_names text[] not null default '{}'::text[],
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 1200),
  category text not null check (category in ('整车', '配件', '电装', '工具')),
  price numeric(10, 2) not null check (price >= 0),
  images text[] not null check (cardinality(images) between 1 and 5),
  seller_name text not null default '' check (char_length(seller_name) <= 40),
  seller_avatar_url text,
  wechat_id text not null check (char_length(wechat_id) between 1 and 100),
  group_names text[] not null default '{}'::text[],
  xianyu_url text,
  status text not null default 'available' check (status in ('available', 'sold', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  brand text check (brand is null or brand in ('田宫', 'Traxxas', 'Arrma', 'Losi')),
  cover_url text,
  manual_url text not null check (char_length(manual_url) between 1 and 2048),
  status text not null default 'unavailable' check (status in ('available', 'unavailable')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manuals alter column user_id drop not null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'manuals' and column_name = 'brand'
  ) then
    alter table public.manuals
      add column brand text
      check (brand is null or brand in ('田宫', 'Traxxas', 'Arrma', 'Losi'));
  end if;
  update public.manuals
  set brand = case
    when title ilike 'Traxxas %' then 'Traxxas'
    when title ilike 'ARRMA %' then 'Arrma'
    when title ilike 'Losi %' then 'Losi'
  end
  where brand is null
    and (title ilike 'Traxxas %' or title ilike 'ARRMA %' or title ilike 'Losi %');

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'manuals'
      and column_name = 'status'
  ) then
    alter table public.manuals
      add column status text not null default 'unavailable'
      check (status in ('available', 'unavailable'));
    update public.manuals set status = 'available';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'manuals' and column_name = 'sort_order'
  ) then
    alter table public.manuals add column sort_order integer not null default 0;
    with ordered_manuals as (
      select id, row_number() over (order by created_at desc, id) - 1 as position
      from public.manuals
    )
    update public.manuals
    set sort_order = ordered_manuals.position
    from ordered_manuals
    where public.manuals.id = ordered_manuals.id;
  end if;
end;
$$;

create table if not exists public.manual_link_reports (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint manual_link_reports_one_per_user unique (manual_id, user_id)
);

create or replace function public.is_rc_manual_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email = 'u-1b0316ed1cfed044035c55363e02ccafab26d66b1c2746b94d17285f043324aa@ygklgnablhnitcsptqor.supabase.co'
  );
$$;

revoke all on function public.is_rc_manual_admin() from public, anon;
grant execute on function public.is_rc_manual_admin() to authenticated;

create or replace function public.reorder_rc_manuals(manual_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_rc_manual_admin() then
    raise exception 'Only the manual administrator can reorder manuals';
  end if;

  if coalesce(cardinality(manual_ids), 0) <> (select count(*) from public.manuals)
    or coalesce(cardinality(manual_ids), 0) <> (
      select count(distinct item_id) from unnest(manual_ids) as items(item_id)
    )
    or coalesce(cardinality(manual_ids), 0) <> (
      select count(*) from unnest(manual_ids) as items(item_id)
      where exists (select 1 from public.manuals where id = items.item_id)
    ) then
    raise exception 'Manual order must include every manual exactly once';
  end if;

  update public.manuals
  set sort_order = ordered.position - 1
  from unnest(manual_ids) with ordinality as ordered(id, position)
  where public.manuals.id = ordered.id;
end;
$$;

revoke all on function public.reorder_rc_manuals(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_rc_manuals(uuid[]) to authenticated;

drop policy if exists "Users can create their own manuals" on public.manuals;
drop policy if exists "Users can update their own manuals" on public.manuals;
drop policy if exists "Users can delete their own manuals" on public.manuals;

drop policy if exists "MH admin can create manuals" on public.manuals;
create policy "MH admin can create manuals"
on public.manuals for insert
to authenticated
with check (public.is_rc_manual_admin());

drop policy if exists "MH admin can update manuals" on public.manuals;
create policy "MH admin can update manuals"
on public.manuals for update
to authenticated
using (public.is_rc_manual_admin())
with check (public.is_rc_manual_admin());

drop policy if exists "MH admin can delete manuals" on public.manuals;
create policy "MH admin can delete manuals"
on public.manuals for delete
to authenticated
using (public.is_rc_manual_admin());

alter table public.manual_link_reports enable row level security;
revoke all on public.manual_link_reports from anon, authenticated;
grant insert on public.manual_link_reports to authenticated;

drop policy if exists "Signed-in users can report unavailable manuals" on public.manual_link_reports;
create policy "Signed-in users can report unavailable manuals"
on public.manual_link_reports for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.get_manual_link_report_summary()
returns table (manual_id uuid, report_count bigint, reported_by_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    manuals.id,
    count(reports.id),
    coalesce(bool_or(reports.user_id = auth.uid()), false)
  from public.manuals
  left join public.manual_link_reports as reports
    on reports.manual_id = manuals.id
  group by manuals.id;
$$;

revoke all on function public.get_manual_link_report_summary() from public, anon, authenticated;
grant execute on function public.get_manual_link_report_summary() to anon, authenticated;

create or replace function public.reset_manual_link_reports(target_manual_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_rc_manual_admin() then
    raise exception 'Only the manual administrator can reset manual reports';
  end if;
  delete from public.manual_link_reports where manual_id = target_manual_id;
end;
$$;

revoke all on function public.reset_manual_link_reports(uuid) from public, anon, authenticated;
grant execute on function public.reset_manual_link_reports(uuid) to authenticated;

create table if not exists public.manual_votes (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  constraint manual_votes_one_per_user unique (manual_id, user_id)
);

alter table public.manual_votes enable row level security;
revoke all on public.manual_votes from anon, authenticated;
grant insert on public.manual_votes to authenticated;

drop policy if exists "Signed-in users can vote on manuals once" on public.manual_votes;
create policy "Signed-in users can vote on manuals once"
on public.manual_votes for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.get_manual_vote_summary()
returns table (manual_id uuid, up_count bigint, down_count bigint, my_vote text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    manuals.id,
    count(votes.id) filter (where votes.vote = 'up'),
    count(votes.id) filter (where votes.vote = 'down'),
    max(votes.vote) filter (where votes.user_id = auth.uid())
  from public.manuals
  left join public.manual_votes as votes on votes.manual_id = manuals.id
  group by manuals.id;
$$;

revoke all on function public.get_manual_vote_summary() from public, anon, authenticated;
grant execute on function public.get_manual_vote_summary() to anon, authenticated;

create table if not exists public.rc_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  constraint rc_gallery_photos_owner_path_check
    check (storage_path like user_id::text || '/gallery/%')
);

create table if not exists public.rc_gallery_photo_votes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.rc_gallery_photos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  constraint rc_gallery_photo_votes_one_per_user unique (photo_id, user_id)
);

alter table public.rc_gallery_photo_votes enable row level security;
revoke all on public.rc_gallery_photo_votes from anon, authenticated;
grant insert on public.rc_gallery_photo_votes to authenticated;

drop policy if exists "Signed-in users can vote on gallery photos once" on public.rc_gallery_photo_votes;
create policy "Signed-in users can vote on gallery photos once"
on public.rc_gallery_photo_votes for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.get_rc_gallery_photo_vote_summary()
returns table (photo_id uuid, up_count bigint, down_count bigint, my_vote text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    photos.id,
    count(votes.id) filter (where votes.vote = 'up'),
    count(votes.id) filter (where votes.vote = 'down'),
    max(votes.vote) filter (where votes.user_id = auth.uid())
  from public.rc_gallery_photos as photos
  left join public.rc_gallery_photo_votes as votes on votes.photo_id = photos.id
  group by photos.id;
$$;

revoke all on function public.get_rc_gallery_photo_vote_summary() from public, anon, authenticated;
grant execute on function public.get_rc_gallery_photo_vote_summary() to anon, authenticated;

create index if not exists rc_gallery_photos_created_at_idx
  on public.rc_gallery_photos (created_at desc);
create index if not exists rc_gallery_photos_user_id_idx
  on public.rc_gallery_photos (user_id);

create or replace function public.enforce_rc_gallery_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.rc_gallery_photos where user_id = new.user_id) >= 10 then
    raise exception '每位用户最多上传 10 张靓图';
  end if;
  return new;
end;
$$;

drop trigger if exists rc_gallery_photos_limit on public.rc_gallery_photos;
create trigger rc_gallery_photos_limit
before insert on public.rc_gallery_photos
for each row execute function public.enforce_rc_gallery_photo_limit();

alter table public.profiles add column if not exists avatar_url text;
alter table public.listings add column if not exists seller_avatar_url text;
alter table public.listings add column if not exists xianyu_url text;
alter table public.listings drop constraint if exists listings_xianyu_url_check;
alter table public.listings add constraint listings_xianyu_url_check
  check (xianyu_url is null or (char_length(xianyu_url) <= 2048 and xianyu_url ~* '^https?://'));

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings
  add constraint listings_status_check check (status in ('available', 'sold', 'withdrawn'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'group_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'group_names'
  ) then
    alter table public.profiles rename column group_name to group_names;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'group_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'group_names'
  ) then
    alter table public.listings rename column group_name to group_names;
  end if;
end;
$$;

alter table public.profiles add column if not exists group_names text[] not null default '{}'::text[];
alter table public.listings add column if not exists group_names text[] not null default '{}'::text[];
alter table public.profiles drop constraint if exists profiles_group_name_check;
alter table public.listings drop constraint if exists listings_group_name_check;
alter table public.profiles alter column group_names drop default;
alter table public.listings alter column group_names drop default;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'group_names' and data_type <> 'ARRAY'
  ) then
    alter table public.profiles
      alter column group_names type text[]
      using case when nullif(btrim(group_names), '') is null
        then '{}'::text[] else array[group_names] end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings'
      and column_name = 'group_names' and data_type <> 'ARRAY'
  ) then
    alter table public.listings
      alter column group_names type text[]
      using case when nullif(btrim(group_names), '') is null
        then '{}'::text[] else array[group_names] end;
  end if;
end;
$$;

alter table public.profiles alter column group_names set default '{}'::text[];
alter table public.profiles alter column group_names set not null;
alter table public.listings alter column group_names set default '{}'::text[];
alter table public.listings alter column group_names set not null;

create index if not exists listings_created_at_idx on public.listings (created_at desc);
create index if not exists listings_user_id_idx on public.listings (user_id);

create table if not exists public.nickname_signup_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0
);

alter table public.nickname_signup_limits enable row level security;
revoke all on public.nickname_signup_limits from anon, authenticated;

create or replace function public.consume_nickname_signup_attempt(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempts integer;
begin
  insert into public.nickname_signup_limits as limits (ip_hash, window_started_at, attempt_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set
    window_started_at = case
      when limits.window_started_at < now() - interval '1 hour' then now()
      else limits.window_started_at
    end,
    attempt_count = case
      when limits.window_started_at < now() - interval '1 hour' then 1
      else limits.attempt_count + 1
    end
  returning attempt_count into attempts;

  return attempts <= 5;
end;
$$;

revoke all on function public.consume_nickname_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_nickname_signup_attempt(text) to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

drop trigger if exists manuals_set_updated_at on public.manuals;
create trigger manuals_set_updated_at
before update on public.manuals
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, wechat_id, group_names)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_user_meta_data ->> 'wechat_id', ''),
    array(
      select jsonb_array_elements_text(
        coalesce(new.raw_user_meta_data -> 'group_names', '[]'::jsonb)
      )
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.manuals enable row level security;
alter table public.rc_gallery_photos enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Anyone can view marketplace listings" on public.listings;
create policy "Anyone can view marketplace listings"
on public.listings for select
to anon, authenticated
using (true);

drop policy if exists "Users can create their own listings" on public.listings;
create policy "Users can create their own listings"
on public.listings for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own listings" on public.listings;
create policy "Users can update their own listings"
on public.listings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own listings" on public.listings;
create policy "Users can delete their own listings"
on public.listings for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can view manuals" on public.manuals;
drop policy if exists "Anyone can view available manuals" on public.manuals;
create policy "Anyone can view available manuals"
on public.manuals for select
to anon, authenticated
using (status = 'available');

drop policy if exists "MH admin can view all manuals" on public.manuals;
create policy "MH admin can view all manuals"
on public.manuals for select
to authenticated
using (public.is_rc_manual_admin());

drop policy if exists "Anyone can view RC gallery photos" on public.rc_gallery_photos;
create policy "Anyone can view RC gallery photos"
on public.rc_gallery_photos for select
to anon, authenticated
using (true);

drop policy if exists "Users can upload their own RC gallery photos" on public.rc_gallery_photos;
create policy "Users can upload their own RC gallery photos"
on public.rc_gallery_photos for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own RC gallery photos" on public.rc_gallery_photos;
create policy "Users can delete their own RC gallery photos"
on public.rc_gallery_photos for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rc-listing-images', 'rc-listing-images', true, 10485760, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rc-avatars', 'rc-avatars', true, 3145728, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view RC profile avatars" on storage.objects;
create policy "Anyone can view RC profile avatars"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'rc-avatars');

drop policy if exists "Users can upload avatars to their own folder" on storage.objects;
create policy "Users can upload avatars to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'rc-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update avatars in their own folder" on storage.objects;
create policy "Users can update avatars in their own folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'rc-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'rc-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete avatars in their own folder" on storage.objects;
create policy "Users can delete avatars in their own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'rc-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Anyone can view RC listing photos" on storage.objects;
create policy "Anyone can view RC listing photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'rc-listing-images');

drop policy if exists "Users can upload photos to their own folder" on storage.objects;
create policy "Users can upload photos to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'rc-listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update photos in their own folder" on storage.objects;
create policy "Users can update photos in their own folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'rc-listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'rc-listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete photos in their own folder" on storage.objects;
create policy "Users can delete photos in their own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'rc-listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
