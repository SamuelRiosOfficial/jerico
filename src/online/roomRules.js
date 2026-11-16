export const MIN_ROOM_PLAYERS = 1;
export const MAX_ROOM_PLAYERS = 4;

export function canStartOnlineRoom(playerCount) {
  return Number.isInteger(playerCount) &&
    playerCount >= MIN_ROOM_PLAYERS &&
    playerCount <= MAX_ROOM_PLAYERS;
}
