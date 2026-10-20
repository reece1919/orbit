-- TROPHY / Steam game and achievement snapshots (private, owner-only, AAL2).
create table public.orbit_steam_connections (
 owner_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 steam_id text not null check (steam_id ~ '^[0-9]{17}$'),
 connected_at timestamptz not null default now(),
 last_synced_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.orbit_steam_games (
 owner_id uuid not null references auth.users(id) on delete cascade,
 app_id bigint not null check (app_id > 0),
 name text not null default '',
 playtime_minutes integer not null default 0 check (playtime_minutes >= 0),
 last_played_at timestamptz,
 icon_hash text not null default '',
 achievements_total integer check (achievements_total >= 0),
 achievements_unlocked integer check (achievements_unlocked >= 0),
 achievements_checked_at timestamptz,
 achievement_error text,
 updated_at timestamptz not null default now(),
 primary key (owner_id,app_id),
 foreign key (owner_id) references public.orbit_steam_connections(owner_id) on delete cascade,
 check (achievements_total is null or achievements_unlocked <= achievements_total)
);
create table public.orbit_steam_achievements (
 owner_id uuid not null,
 app_id bigint not null,
 api_name text not null,
 display_name text not null default '',
 description text not null default '',
 icon_url text not null default '',
 hidden boolean not null default false,
 unlocked boolean not null default false,
 unlocked_at timestamptz,
 primary key (owner_id,app_id,api_name),
 foreign key (owner_id,app_id) references public.orbit_steam_games(owner_id,app_id) on delete cascade
);
create index orbit_steam_games_completion_idx on public.orbit_steam_games (owner_id,achievements_total,achievements_unlocked);
create index orbit_steam_achievements_recent_idx on public.orbit_steam_achievements (owner_id,unlocked_at desc) where unlocked = true;
alter table public.orbit_steam_connections enable row level security;
alter table public.orbit_steam_games enable row level security;
alter table public.orbit_steam_achievements enable row level security;
revoke all on public.orbit_steam_connections, public.orbit_steam_games, public.orbit_steam_achievements from public,anon,authenticated;
grant select,insert,update,delete on public.orbit_steam_connections, public.orbit_steam_games, public.orbit_steam_achievements to authenticated;
create policy orbit_steam_connections_owner on public.orbit_steam_connections for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy orbit_steam_games_owner on public.orbit_steam_games for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy orbit_steam_achievements_owner on public.orbit_steam_achievements for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy orbit_steam_connections_mfa on public.orbit_steam_connections as restrictive for all to authenticated
 using (((select auth.jwt())->>'aal')='aal2') with check (((select auth.jwt())->>'aal')='aal2');
create policy orbit_steam_games_mfa on public.orbit_steam_games as restrictive for all to authenticated
 using (((select auth.jwt())->>'aal')='aal2') with check (((select auth.jwt())->>'aal')='aal2');
create policy orbit_steam_achievements_mfa on public.orbit_steam_achievements as restrictive for all to authenticated
 using (((select auth.jwt())->>'aal')='aal2') with check (((select auth.jwt())->>'aal')='aal2');
comment on table public.orbit_steam_connections is 'TROPHY: owner-bound SteamID64 only, never Steam credentials or Web API keys.';
comment on table public.orbit_steam_games is 'TROPHY: per-game playtime and achievement counts; NULL total means not checked/unavailable, never zero.';
comment on table public.orbit_steam_achievements is 'TROPHY: individual achievement metadata and Steam unlock timestamps.';