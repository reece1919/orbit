-- Follow-up for ORBIT compare-and-swap cloud syncing.
-- Initialize only when expected revision is 0; update only when revision matches.
-- The database deployment applied this fix on October 13, 2026.
create or replace function public.orbit_workspace_save(p_expected_revision bigint,p_data jsonb)
 returns table (new_revision bigint,saved_at timestamptz)
 language plpgsql security invoker
 set search_path = ''
as $body$
declare v_owner uuid; v_rev bigint; v_time timestamptz;
begin
 v_owner := auth.uid();
 if v_owner is null or (auth.jwt()->>'aal') is distinct from 'aal2' then
   raise exception 'MFA_REQUIRED' using errcode='42501';
 end if;
 if p_expected_revision is null or p_expected_revision < 0 then
   raise exception 'Invalid sync revision' using errcode='22023';
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
    or p_data->>'version'<>'2' or octet_length(p_data::text)>1000000 then
   raise exception 'Invalid ORBIT workspace snapshot' using errcode='22023';
 end if;
 if p_expected_revision=0 then
   insert into public.orbit_local_workspaces(owner_id,data,revision,updated_at)
     values(v_owner,p_data,1,now())
     on conflict(owner_id) do nothing
     returning revision,updated_at into v_rev,v_time;
 else
   update public.orbit_local_workspaces
   set data=p_data,revision=revision+1,updated_at=now()
   where owner_id=v_owner and revision=p_expected_revision
   returning revision,updated_at into v_rev,v_time;
 end if;
 if v_rev is not null then
   return query select v_rev,v_time;
 end if;
end
$body$;
