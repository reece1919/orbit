-- Tokens stay encrypted in Vault. Public RPC wrappers are service-only and
-- SECURITY INVOKER; privileged work lives in an unexposed private schema.
create schema if not exists driftmark_private;
revoke all on schema driftmark_private from public, anon, authenticated;
grant usage on schema driftmark_private to service_role;

create table driftmark_private.worldanvil_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  secret_id uuid not null unique references vault.secrets(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worldanvil_connection_owner check (owner_id = '48c2d998-89ca-48bc-ac6f-0a45d8f25b5a'::uuid)
);
alter table driftmark_private.worldanvil_connections enable row level security;
revoke all on driftmark_private.worldanvil_connections from public, anon, authenticated;

create function driftmark_private.require_worldanvil_owner(p_owner uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_owner is distinct from '48c2d998-89ca-48bc-ac6f-0a45d8f25b5a'::uuid
     or (select auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'Private connection access denied' using errcode = '42501';
  end if;
end;
$$;

create function driftmark_private.worldanvil_read(p_owner uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  perform driftmark_private.require_worldanvil_owner(p_owner);
  return (select secret.decrypted_secret from driftmark_private.worldanvil_connections connection
    join vault.decrypted_secrets secret on secret.id = connection.secret_id where connection.owner_id = p_owner);
end;
$$;

create function driftmark_private.worldanvil_store(p_owner uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_secret uuid;
begin
  perform driftmark_private.require_worldanvil_owner(p_owner);
  if p_token is null or length(p_token) < 1 or length(p_token) > 500 or p_token ~ '[[:space:][:cntrl:]]' then
    raise exception 'Invalid connection credential' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('driftmark-worldanvil/' || p_owner::text, 0));
  select secret_id into existing_secret from driftmark_private.worldanvil_connections where owner_id = p_owner;
  if existing_secret is null then
    existing_secret := vault.create_secret(p_token, 'driftmark-worldanvil/' || p_owner::text, 'DRIFTMARK World Anvil connection');
    insert into driftmark_private.worldanvil_connections(owner_id, secret_id) values (p_owner, existing_secret);
  else
    perform vault.update_secret(existing_secret, p_token);
    update driftmark_private.worldanvil_connections set updated_at = pg_catalog.now() where owner_id = p_owner;
  end if;
end;
$$;

create function driftmark_private.worldanvil_forget(p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform driftmark_private.require_worldanvil_owner(p_owner);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('driftmark-worldanvil/' || p_owner::text, 0));
  delete from driftmark_private.worldanvil_connections where owner_id = p_owner;
end;
$$;

create function driftmark_private.cleanup_worldanvil_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;
create trigger cleanup_worldanvil_secret after delete on driftmark_private.worldanvil_connections
  for each row execute function driftmark_private.cleanup_worldanvil_secret();

revoke all on function driftmark_private.require_worldanvil_owner(uuid) from public, anon, authenticated;
revoke all on function driftmark_private.worldanvil_read(uuid) from public, anon, authenticated;
revoke all on function driftmark_private.worldanvil_store(uuid,text) from public, anon, authenticated;
revoke all on function driftmark_private.worldanvil_forget(uuid) from public, anon, authenticated;
revoke all on function driftmark_private.cleanup_worldanvil_secret() from public, anon, authenticated;
grant execute on function driftmark_private.require_worldanvil_owner(uuid), driftmark_private.worldanvil_read(uuid),
  driftmark_private.worldanvil_store(uuid,text), driftmark_private.worldanvil_forget(uuid) to service_role;

create function public.driftmark_wa_read(p_owner uuid) returns text language sql security invoker set search_path = ''
  as $$ select driftmark_private.worldanvil_read(p_owner); $$;
create function public.driftmark_wa_store(p_owner uuid, p_token text) returns void language sql security invoker set search_path = ''
  as $$ select driftmark_private.worldanvil_store(p_owner,p_token); $$;
create function public.driftmark_wa_forget(p_owner uuid) returns void language sql security invoker set search_path = ''
  as $$ select driftmark_private.worldanvil_forget(p_owner); $$;
revoke all on function public.driftmark_wa_read(uuid), public.driftmark_wa_store(uuid,text), public.driftmark_wa_forget(uuid)
  from public, anon, authenticated;
grant execute on function public.driftmark_wa_read(uuid), public.driftmark_wa_store(uuid,text), public.driftmark_wa_forget(uuid)
  to service_role;
