create table if not exists public.manual_link_reports (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint manual_link_reports_one_per_user unique (manual_id, user_id)
);

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
