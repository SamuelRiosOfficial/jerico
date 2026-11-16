import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isOnlineConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabase = isOnlineConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    })
  : null;

export async function ensureAnonymousSession() {
  if (!supabase) throw new Error('El modo en línea todavía no está configurado.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('No se pudo iniciar una sesión de jugador.');
  return data.user;
}

export async function createRoom({ code, name, characterId }) {
  const user = await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('jerico_create_room', {
    p_code: code, p_name: name, p_character_id: characterId
  });
  if (error) throw error;
  return { roomId: data, userId: user.id };
}

export async function joinRoom({ code, name, characterId }) {
  const user = await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('jerico_join_room', {
    p_code: code, p_name: name, p_character_id: characterId
  });
  if (error) throw error;
  return { roomId: data, userId: user.id };
}

export async function getRoomOccupiedCharacters(code) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.rpc('jerico_room_occupied_characters', {
    p_code: code.trim().toUpperCase()
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchRoom(roomId) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const [{ data: room, error: roomError }, { data: players, error: playersError }] = await Promise.all([
    supabase.from('jerico_rooms').select('*').eq('id', roomId).single(),
    supabase.from('jerico_room_players').select('*').eq('room_id', roomId).order('joined_at')
  ]);
  if (roomError) throw roomError;
  if (playersError) throw playersError;
  return { room, players: players || [] };
}

export async function startRoom(roomId) {
  const { error } = await supabase.rpc('jerico_start_room', { p_room_id: roomId });
  if (error) throw error;
}

export async function updateGameState(roomId, expectedRevision, gameState) {
  const { data, error } = await supabase.rpc('jerico_update_game_state', {
    p_room_id: roomId, p_expected_revision: expectedRevision, p_game_state: gameState
  });
  if (error) throw error;
  return data;
}

export async function leaveRoom(roomId) {
  if (!supabase || !roomId) return;
  const { error } = await supabase.rpc('jerico_leave_room', { p_room_id: roomId });
  if (error) throw error;
}

export function subscribeToRoom(roomId, userId, onChange, onPresence) {
  if (!supabase) return () => {};
  const channel = supabase.channel('jerico:room:' + roomId, {
    config: { presence: { key: userId } }
  });
  channel
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'jerico_rooms', filter: 'id=eq.' + roomId
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'jerico_room_players', filter: 'room_id=eq.' + roomId
    }, onChange)
    .on('presence', { event: 'sync' }, () => {
      if (onPresence) onPresence(channel.presenceState());
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, onlineAt: new Date().toISOString() });
      }
    });
  return () => { supabase.removeChannel(channel); };
}

export function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}
