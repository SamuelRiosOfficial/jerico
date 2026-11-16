const CHARACTER_ROWS = Object.freeze({ warrior: 0, soldier: 1, trumpeter: 2, woman: 3 });

export function getCharacterSpriteRow(characterId) {
  return CHARACTER_ROWS[characterId] ?? 0;
}

export function getCharacterSpritePosition(characterId) {
  return (getCharacterSpriteRow(characterId) * 100) / 3;
}

export function getAvailableCharacters(characters, occupiedIds = []) {
  const occupied = new Set(occupiedIds);
  return characters.filter((character) => !occupied.has(character.id));
}

export function getFirstAvailableCharacter(characters, occupiedIds = []) {
  return getAvailableCharacters(characters, occupiedIds)[0]?.id || '';
}
