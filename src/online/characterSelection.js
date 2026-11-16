export function getAvailableCharacters(characters, occupiedIds = []) {
  const occupied = new Set(occupiedIds);
  return characters.filter((character) => !occupied.has(character.id));
}

export function getFirstAvailableCharacter(characters, occupiedIds = []) {
  return getAvailableCharacters(characters, occupiedIds)[0]?.id || '';
}
