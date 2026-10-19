create table if not exists public.rc_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  constraint rc_gallery_photos_owner_path_check
    check (storage_path like user_id::text || '/gallery/%')
);

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

alter table public.rc_gallery_photos enable row level security;

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
