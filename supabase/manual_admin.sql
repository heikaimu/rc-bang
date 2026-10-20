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

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'manuals'
      and column_name = 'brand'
  ) then
    alter table public.manuals add column brand text;
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
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'manuals'
      and column_name = 'sort_order'
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

create table if not exists public.manual_brands (
  name text primary key check (char_length(name) between 1 and 40)
);

insert into public.manual_brands (name)
values ('田宫'), ('Traxxas'), ('Arrma'), ('Losi'), ('京商')
on conflict (name) do nothing;

insert into public.manual_brands (name)
select distinct brand from public.manuals where brand is not null
on conflict (name) do nothing;

alter table public.manuals drop constraint if exists manuals_brand_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'manuals_brand_fkey'
      and conrelid = 'public.manuals'::regclass
  ) then
    alter table public.manuals
      add constraint manuals_brand_fkey
      foreign key (brand) references public.manual_brands (name) on delete set null;
  end if;
end;
$$;

alter table public.manual_brands enable row level security;
revoke all on public.manual_brands from anon, authenticated;
grant select on public.manual_brands to anon, authenticated;
grant insert, delete on public.manual_brands to authenticated;

drop policy if exists "Anyone can view manual brands" on public.manual_brands;
create policy "Anyone can view manual brands"
on public.manual_brands for select
to anon, authenticated
using (true);

drop policy if exists "MH admin can create manual brands" on public.manual_brands;
create policy "MH admin can create manual brands"
on public.manual_brands for insert
to authenticated
with check (public.is_rc_manual_admin());

drop policy if exists "MH admin can delete manual brands" on public.manual_brands;
create policy "MH admin can delete manual brands"
on public.manual_brands for delete
to authenticated
using (public.is_rc_manual_admin());

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
