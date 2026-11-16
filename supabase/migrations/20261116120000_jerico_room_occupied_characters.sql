-- Allow authenticated players to preview occupied character IDs before joining a JERICO room.
create or replace function private.jerico_room_occupied_characters(p_code text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_characters text[];
begin
  if v_uid is null then
    raise exception 'Sign in is required';
  end if;

  select r.id, r.status, r.expires_at
    into v_room_id, v_status, v_expires_at
  from public.jerico_rooms as r
  where r.code = upper(trim(p_code))
  limit 1;

  if v_room_id is null or v_expires_at < now() or v_status <> 'lobby' then
    raise exception 'Room unavailable';
  end if;

  select coalesce(array_agg(p.character_id order by p.joined_at), array[]::text[])
    into v_characters
  from public.jerico_room_players as p
  where p.room_id = v_room_id
    and p.user_id <> v_uid;

  return v_characters;
end;
$$;

revoke all on function private.jerico_room_occupied_characters(text) from public, anon;
grant execute on function private.jerico_room_occupied_characters(text) to authenticated;

create or replace function public.jerico_room_occupied_characters(p_code text)
returns text[]
language sql
security invoker
set search_path = ''
as $$
  select private.jerico_room_occupied_characters(p_code);
$$;

revoke all on function public.jerico_room_occupied_characters(text) from public, anon;
grant execute on function public.jerico_room_occupied_characters(text) to authenticated;
