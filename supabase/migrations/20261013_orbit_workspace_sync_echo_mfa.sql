-- ORBIT v1.2 private cross-device workspace, account-scoped and MFA-gated.
create table if not exists public.orbit_local_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint orbit_local_workspace_data_valid check (
    jsonb_typeof(data) = 'object'
    and data->>'version' = '2'
    and octet_length(data::text) <= 1000000
  )
);
alter table public.orbit_local_workspaces enable row level security;
revoke all on public.orbit_local_workspaces from PUBLIC, anon;
grant select,insert,update on public.orbit_local_workspaces to authenticated;
create policy "orbit_local_select_own" on public.orbit_local_workspaces
 for select to authenticated using ((select auth.uid()) = owner_id);
create policy "orbit_local_insert_own" on public.orbit_local_workspaces
 for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "orbit_local_update_own" on public.orbit_local_workspaces
 for update to authenticated using ((select auth.uid()) = owner_id)
 with check ((select auth.uid()) = owner_id);
create policy "orbit_local_require_mfa" on public.orbit_local_workspaces
 as restrictive for all to authenticated
 using (((select auth.jwt())->>'aal') = 'aal2')
 with check (((select auth.jwt())->>'aal') = 'aal2');
create or replace function public.orbit_workspace_save(
  p_expected_revision bigint,
  p_data jsonb
) returns table (new_revision bigint, saved_at timestamptz)
language plpgsql security invoker
set search_path = ''
as $body$
declare
  v_owner uuid;
begin
  v_owner := auth.uid();
  if v_owner is null or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid sync revision' using errcode = '22023';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or p_data->>'version' <> '2' or octet_length(p_data::text) > 1000000 then
    raise exception 'Invalid ORBIT workspace snapshot' using errcode = '22023';
  end if;
  return query
    insert into public.orbit_local_workspaces(owner_id,data,revision,updated_at)
      select v_owner,p_data,1,now() where p_expected_revision=0
    on conflict (owner_id) do update
      set data=excluded.data,
          revision=public.orbit_local_workspaces.revision+1,
          updated_at=now()
      where public.orbit_local_workspaces.revision=p_expected_revision
    returning revision,updated_at;
end
$body$;
revoke all on function public.orbit_workspace_save(bigint,jsonb) from PUBLIC,anon;
grant execute on function public.orbit_workspace_save(bigint,jsonb) to authenticated;
comment on table public.orbit_local_workspaces is 'Private ORBIT browser workspace snapshots; server CAS revision, enforced AAL2.';
comment on function public.orbit_workspace_save(bigint,jsonb) is 'Revision compare-and-swap; returns no rows on edit conflict, requires AAL2.';
-- ECHO is already using this shared auth backend; align its workspace privacy with ORBIT and GAIA.
create policy "echo_require_mfa" on public.echo_workspaces
 as restrictive for all to authenticated
 using (((select auth.jwt())->>'aal') = 'aal2')
 with check (((select auth.jwt())->>'aal') = 'aal2');
