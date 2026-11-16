create or replace function private.jerico_start_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $$
declare
  v_room public.jerico_rooms%rowtype;
  v_players jsonb;
  v_count integer;
begin
  select * into v_room
  from public.jerico_rooms
  where id = p_room_id
  for update;

  if not found then raise exception 'Room not found'; end if;
  if v_room.host_user_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if v_room.status <> 'lobby' then raise exception 'Room already started'; end if;

  select count(*) into v_count
  from public.jerico_room_players
  where room_id = p_room_id;

  if v_count < 1 or v_count > 4 then
    raise exception 'The room needs 1 to 4 players';
  end if;

  select jsonb_agg(
    jsonb_build_object('id', user_id::text, 'name', name, 'characterId', character_id, 'steps', 0)
    order by joined_at
  )
  into v_players
  from public.jerico_room_players
  where room_id = p_room_id;

  update public.jerico_rooms
  set status = 'playing',
      revision = revision + 1,
      game_state = jsonb_build_object(
        'phase', 'board',
        'turn', 0,
        'players', v_players,
        'usedQuestionIds', jsonb_build_object(
          'facil', '[]'::jsonb,
          'medio', '[]'::jsonb,
          'dificil', '[]'::jsonb
        ),
        'question', null,
        'feedback', null,
        'winner', null
      ),
      updated_at = now()
  where id = p_room_id
  returning game_state into v_players;

  return v_players;
end;
$$;
