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
