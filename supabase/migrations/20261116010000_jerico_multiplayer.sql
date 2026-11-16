-- JERICO online multiplayer: hardened private RPC implementation. anonymous players, private rooms and host/turn-authorized game state.
create extension if not exists pgcrypto;
create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists public.jerico_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  game_state jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.jerico_room_players (
  room_id uuid not null references public.jerico_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 12),
  character_id text not null check (character_id in ('warrior','soldier','trumpeter','woman')),
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id,user_id),
  unique (room_id,character_id)
);

create index if not exists jerico_rooms_code_status_idx on public.jerico_rooms(code,status);
create index if not exists jerico_players_room_idx on public.jerico_room_players(room_id);

alter table public.jerico_rooms enable row level security;
alter table public.jerico_room_players enable row level security;

create or replace function private.jerico_is_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog, public, auth
as $
  select exists(select 1 from public.jerico_room_players where room_id=p_room_id and user_id=auth.uid())
$;

drop policy if exists "room members can read their room" on public.jerico_rooms;
create policy "room members can read their room" on public.jerico_rooms
  for select to authenticated using (private.jerico_is_room_member(id));

drop policy if exists "room members can read roster" on public.jerico_room_players;
create policy "room members can read roster" on public.jerico_room_players
  for select to authenticated using (private.jerico_is_room_member(room_id));

revoke all on public.jerico_rooms from anon, authenticated;
revoke all on public.jerico_room_players from anon, authenticated;
grant select on public.jerico_rooms, public.jerico_room_players to authenticated;

create or replace function private.jerico_create_room(p_code text,p_name text,p_character_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog, public, auth
as $$
declare v_uid uuid:=auth.uid(); v_room_id uuid;
begin
  if v_uid is null then raise exception 'Sign in is required'; end if;
  if p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'Invalid room code'; end if;
  if char_length(trim(p_name)) not between 1 and 12 then raise exception 'Name must be 1 to 12 characters'; end if;
  if p_character_id not in ('warrior','soldier','trumpeter','woman') then raise exception 'Invalid character'; end if;
  insert into public.jerico_rooms(code,host_user_id) values (p_code,v_uid) returning id into v_room_id;
  insert into public.jerico_room_players(room_id,user_id,name,character_id,is_host)
    values (v_room_id,v_uid,trim(p_name),p_character_id,true);
  return v_room_id;
end $$;

create or replace function private.jerico_join_room(p_code text,p_name text,p_character_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog, public, auth
as $$
declare v_uid uuid:=auth.uid(); v_room public.jerico_rooms%rowtype; v_count integer;
begin
  if v_uid is null then raise exception 'Sign in is required'; end if;
  if char_length(trim(p_name)) not between 1 and 12 then raise exception 'Name must be 1 to 12 characters'; end if;
  if p_character_id not in ('warrior','soldier','trumpeter','woman') then raise exception 'Invalid character'; end if;
  select * into v_room from public.jerico_rooms where code=upper(trim(p_code)) for update;
  if not found or v_room.expires_at < now() or v_room.status <> 'lobby' then raise exception 'Room unavailable'; end if;
  select count(*) into v_count from public.jerico_room_players where room_id=v_room.id;
  if not exists(select 1 from public.jerico_room_players where room_id=v_room.id and user_id=v_uid) and v_count>=4 then
    raise exception 'Room is full';
  end if;
  if exists(select 1 from public.jerico_room_players where room_id=v_room.id and character_id=p_character_id and user_id<>v_uid) then
    raise exception 'Character already taken';
  end if;
  insert into public.jerico_room_players(room_id,user_id,name,character_id,is_host)
    values(v_room.id,v_uid,trim(p_name),p_character_id,false)
  on conflict(room_id,user_id) do update set name=excluded.name,character_id=excluded.character_id;
  return v_room.id;
end $$;

create or replace function private.jerico_start_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog, public, auth
as $$
declare v_room public.jerico_rooms%rowtype; v_players jsonb; v_count integer;
begin
  select * into v_room from public.jerico_rooms where id=p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.host_user_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if v_room.status<>'lobby' then raise exception 'Room already started'; end if;
  select count(*) into v_count from public.jerico_room_players where room_id=p_room_id;
  if v_count<2 or v_count>4 then raise exception 'The room needs 2 to 4 players'; end if;
  select jsonb_agg(jsonb_build_object('id',user_id::text,'name',name,'characterId',character_id,'steps',0) order by joined_at)
    into v_players from public.jerico_room_players where room_id=p_room_id;
  update public.jerico_rooms set status='playing',revision=revision+1,
    game_state=jsonb_build_object('phase','board','turn',0,'players',v_players,
      'usedQuestionIds',jsonb_build_object('facil','[]'::jsonb,'medio','[]'::jsonb,'dificil','[]'::jsonb),
      'question',null,'feedback',null,'winner',null),
    updated_at=now()
    where id=p_room_id returning game_state into v_players;
  return v_players;
end $$;

create or replace function private.jerico_update_game_state(p_room_id uuid,p_expected_revision integer,p_game_state jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog, public, auth
as $$
declare
  v_room public.jerico_rooms%rowtype;
  v_active_id uuid;
  v_turn integer;
  v_count integer;
  v_old_phase text;
  v_new_phase text;
  v_old_steps integer;
  v_new_steps integer;
  v_next_turn integer;
  v_i integer;
begin
  select * into v_room from public.jerico_rooms where id=p_room_id for update;
  if not found or v_room.status<>'playing' then raise exception 'Room is not active'; end if;
  if v_room.revision<>p_expected_revision then raise exception 'Game state changed; refresh and retry'; end if;
  if not exists(select 1 from public.jerico_room_players where room_id=p_room_id and user_id=auth.uid()) then
    raise exception 'Not a room member';
  end if;
  if jsonb_typeof(p_game_state->'players')<>'array' then raise exception 'Invalid game state'; end if;
  select count(*) into v_count from public.jerico_room_players where room_id=p_room_id;
  if jsonb_array_length(p_game_state->'players')<>v_count then raise exception 'Player roster cannot be changed'; end if;
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_turn<0 or v_turn>=v_count then raise exception 'Invalid active turn'; end if;
  v_active_id:=(v_room.game_state->'players'->v_turn->>'id')::uuid;
  if auth.uid()<>v_room.host_user_id and auth.uid()<>v_active_id then
    raise exception 'Only the host or active player may act';
  end if;
  v_old_phase:=v_room.game_state->>'phase';
  v_new_phase:=p_game_state->>'phase';
  if (p_game_state->>'turn')::integer is distinct from v_turn then
    if not (v_old_phase='feedback' and v_new_phase='board' and
      (p_game_state->>'turn')::integer=((v_turn+1)%v_count)) then
      raise exception 'Invalid turn transition';
    end if;
  end if;
  if v_old_phase='board' and v_new_phase='question' then
    if p_game_state->'question' is null or p_game_state->'question'='null'::jsonb then
      raise exception 'A question is required';
    end if;
    for v_i in 0..v_count-1 loop
      if p_game_state->'players'->v_i is distinct from v_room.game_state->'players'->v_i then
        raise exception 'Player scores cannot change while selecting a question';
      end if;
    end loop;
  elsif v_old_phase='question' and v_new_phase in ('feedback','finished') then
    for v_i in 0..v_count-1 loop
      if p_game_state->'players'->v_i->>'id' is distinct from v_room.game_state->'players'->v_i->>'id'
        or p_game_state->'players'->v_i->>'name' is distinct from v_room.game_state->'players'->v_i->>'name'
        or p_game_state->'players'->v_i->>'characterId' is distinct from v_room.game_state->'players'->v_i->>'characterId' then
        raise exception 'Player identity cannot be changed';
      end if;
      if v_i<>v_turn and p_game_state->'players'->v_i->>'steps' is distinct from v_room.game_state->'players'->v_i->>'steps' then
        raise exception 'Only the active player can advance';
      end if;
    end loop;
    v_old_steps:=coalesce((v_room.game_state->'players'->v_turn->>'steps')::integer,0);
    v_new_steps:=coalesce((p_game_state->'players'->v_turn->>'steps')::integer,-1);
    if v_new_steps<v_old_steps or v_new_steps>least(30,v_old_steps+3) then
      raise exception 'Invalid step update';
    end if;
    if v_new_phase='finished' and v_new_steps<30 then raise exception 'Winner has not reached Jericho'; end if;
    if v_new_phase='feedback' and v_new_steps>=30 then raise exception 'The game must finish at 30 steps'; end if;
  elsif v_old_phase='feedback' and v_new_phase='board' then
    for v_i in 0..v_count-1 loop
      if p_game_state->'players'->v_i->>'steps' is distinct from v_room.game_state->'players'->v_i->>'steps' then
        raise exception 'Scores cannot change between turns';
      end if;
    end loop;
  else
    raise exception 'Invalid game phase transition';
  end if;
  if v_new_phase not in ('board','question','feedback','finished') then raise exception 'Invalid game phase'; end if;
  update public.jerico_rooms set game_state=p_game_state,
    status=case when v_new_phase='finished' then 'finished' else 'playing' end,
    revision=revision+1,updated_at=now()
    where id=p_room_id;
  return p_expected_revision+1;
end $$;

create or replace function private.jerico_leave_room(p_room_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog, public, auth
as $$
declare v_room public.jerico_rooms%rowtype;
begin
  select * into v_room from public.jerico_rooms where id=p_room_id for update;
  if not found then return; end if;
  if v_room.host_user_id=auth.uid() then
    delete from public.jerico_rooms where id=p_room_id;
  else
    delete from public.jerico_room_players where room_id=p_room_id and user_id=auth.uid();
  end if;
end $$;


-- Privileged implementation stays in the non-exposed private schema.
revoke all on all functions in schema private from public, anon;
grant execute on function private.jerico_is_room_member(uuid) to authenticated;
grant execute on function private.jerico_create_room(text,text,text) to authenticated;
grant execute on function private.jerico_join_room(text,text,text) to authenticated;
grant execute on function private.jerico_start_room(uuid) to authenticated;
grant execute on function private.jerico_update_game_state(uuid,integer,jsonb) to authenticated;
grant execute on function private.jerico_leave_room(uuid) to authenticated;

-- Public RPC entry points are invoker functions and delegate to private implementations.
create or replace function public.jerico_create_room(p_code text,p_name text,p_character_id text)
returns uuid language sql security invoker set search_path=''
as $$ select private.jerico_create_room(p_code,p_name,p_character_id) $$;
create or replace function public.jerico_join_room(p_code text,p_name text,p_character_id text)
returns uuid language sql security invoker set search_path=''
as $$ select private.jerico_join_room(p_code,p_name,p_character_id) $$;
create or replace function public.jerico_start_room(p_room_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.jerico_start_room(p_room_id) $$;
create or replace function public.jerico_update_game_state(p_room_id uuid,p_expected_revision integer,p_game_state jsonb)
returns integer language sql security invoker set search_path=''
as $$ select private.jerico_update_game_state(p_room_id,p_expected_revision,p_game_state) $$;
create or replace function public.jerico_leave_room(p_room_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.jerico_leave_room(p_room_id) $$;

revoke all on function public.jerico_create_room(text,text,text) from public, anon;
revoke all on function public.jerico_join_room(text,text,text) from public, anon;
revoke all on function public.jerico_start_room(uuid) from public, anon;
revoke all on function public.jerico_update_game_state(uuid,integer,jsonb) from public, anon;
revoke all on function public.jerico_leave_room(uuid) from public, anon;
grant execute on function public.jerico_create_room(text,text,text) to authenticated;
grant execute on function public.jerico_join_room(text,text,text) to authenticated;
grant execute on function public.jerico_start_room(uuid) to authenticated;
grant execute on function public.jerico_update_game_state(uuid,integer,jsonb) to authenticated;
grant execute on function public.jerico_leave_room(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.jerico_rooms;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.jerico_room_players;
exception when duplicate_object then null;
end $$;
