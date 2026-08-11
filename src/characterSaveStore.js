const CHARACTER_SAVE_SCHEMA_VERSION = 2;
const CHARACTER_SAVE_STORAGE_KEY = "no-name-yet:characters";
const LEGACY_CHARACTER_SAVE_STORAGE_KEY = "no-name-yet:character:local-player";
const MIN_CHARACTER_NAME_LENGTH = 2;
const MAX_CHARACTER_NAME_LENGTH = 20;
const DEFAULT_CHARACTER_APPEARANCE_ID = "male";
const CHARACTER_APPEARANCE_IDS = new Set(["male", "female"]);

const createEmptyCharacterCollection = () => {
  return {
    schemaVersion: CHARACTER_SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
    activeCharacterId: null,
    charactersById: {},
  };
};

const writeCharacterCollection = (collection) => {
  collection.savedAt = Date.now();
  try {
    localStorage.setItem(CHARACTER_SAVE_STORAGE_KEY, JSON.stringify(collection));
    return { success: true, collection };
  } catch {
    return { success: false, reason: "storage-error" };
  }
};

const readLegacyCharacterCollection = () => {
  let rawLegacyDocument = null;
  try {
    rawLegacyDocument = localStorage.getItem(LEGACY_CHARACTER_SAVE_STORAGE_KEY);
  } catch {
    return { success: false, reason: "storage-error" };
  }

  if (rawLegacyDocument === null) {
    return { success: true, collection: createEmptyCharacterCollection() };
  }

  try {
    const legacyDocument = JSON.parse(rawLegacyDocument);
    const character = legacyDocument?.character;
    if (legacyDocument?.schemaVersion !== 1 || !character || typeof character !== "object") {
      return { success: false, reason: "unsupported-save" };
    }

    const characterId = typeof character.uid === "string" && character.uid !== "" ? character.uid : "local-player";
    const collection = createEmptyCharacterCollection();
    collection.activeCharacterId = characterId;
    collection.charactersById[characterId] = {
      characterId,
      name: character.name,
      createdAt: legacyDocument.savedAt ?? Date.now(),
      savedAt: legacyDocument.savedAt ?? Date.now(),
      character,
    };
    return writeCharacterCollection(collection);
  } catch {
    return { success: false, reason: "corrupted-save" };
  }
};

const readCharacterCollection = () => {
  let rawCollection = null;
  try {
    rawCollection = localStorage.getItem(CHARACTER_SAVE_STORAGE_KEY);
  } catch {
    return { success: false, reason: "storage-error" };
  }

  if (rawCollection === null) {
    return readLegacyCharacterCollection();
  }

  try {
    const collection = JSON.parse(rawCollection);
    if (
      collection?.schemaVersion !== CHARACTER_SAVE_SCHEMA_VERSION ||
      !collection.charactersById ||
      typeof collection.charactersById !== "object"
    ) {
      return { success: false, reason: "unsupported-save" };
    }
    return { success: true, collection };
  } catch {
    return { success: false, reason: "corrupted-save" };
  }
};

const normalizeCharacterName = (name) => {
  if (typeof name !== "string") {
    return "";
  }
  return name.trim().replace(/\s+/g, " ");
};

const isValidCharacterName = (name) => {
  return (
    name.length >= MIN_CHARACTER_NAME_LENGTH &&
    name.length <= MAX_CHARACTER_NAME_LENGTH &&
    /^[\p{L}][\p{L} '-]*[\p{L}]$/u.test(name)
  );
};

const createCharacterId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `character-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const saveCharacterSnapshot = (characterSnapshot) => {
  if (!characterSnapshot || typeof characterSnapshot !== "object") {
    return { success: false, reason: "invalid-character" };
  }

  const characterId = characterSnapshot.uid;
  const characterName = normalizeCharacterName(characterSnapshot.name);
  if (typeof characterId !== "string" || characterId === "" || !isValidCharacterName(characterName)) {
    return { success: false, reason: "invalid-character" };
  }

  const collectionResult = readCharacterCollection();
  if (!collectionResult.success) {
    return collectionResult;
  }

  const collection = collectionResult.collection;
  const existingEntry = collection.charactersById[characterId] ?? null;
  const savedAt = Date.now();
  collection.activeCharacterId = characterId;
  collection.charactersById[characterId] = {
    characterId,
    name: characterName,
    appearanceId: CHARACTER_APPEARANCE_IDS.has(characterSnapshot.appearanceId)
      ? characterSnapshot.appearanceId
      : (existingEntry?.appearanceId ?? DEFAULT_CHARACTER_APPEARANCE_ID),
    createdAt: existingEntry?.createdAt ?? savedAt,
    savedAt,
    character: characterSnapshot,
  };

  const writeResult = writeCharacterCollection(collection);
  if (!writeResult.success) {
    return writeResult;
  }
  return { success: true, document: collection.charactersById[characterId] };
};

export const loadCharacterSaveDocument = () => {
  const collectionResult = readCharacterCollection();
  if (!collectionResult.success) {
    return collectionResult;
  }

  const collection = collectionResult.collection;
  const characterId = collection.activeCharacterId;
  const entry = characterId ? (collection.charactersById[characterId] ?? null) : null;
  if (!entry) {
    return { success: false, reason: "not-found" };
  }
  if (!entry.character || typeof entry.character !== "object") {
    return { success: false, reason: "not-initialized", entry };
  }

  return {
    success: true,
    entry,
    document: {
      schemaVersion: CHARACTER_SAVE_SCHEMA_VERSION,
      savedAt: entry.savedAt,
      character: entry.character,
    },
  };
};

export const listCharacterProfiles = () => {
  const collectionResult = readCharacterCollection();
  if (!collectionResult.success) {
    return collectionResult;
  }

  const collection = collectionResult.collection;
  const characters = Object.values(collection.charactersById)
    .map((entry) => {
      return {
        characterId: entry.characterId,
        name: entry.name,
        appearanceId:
          entry.character?.appearanceId ?? entry.appearanceId ?? DEFAULT_CHARACTER_APPEARANCE_ID,
        experience: entry.character?.progression?.experience ?? 0,
        savedAt: entry.savedAt,
        isActive: entry.characterId === collection.activeCharacterId,
      };
    })
    .sort((firstCharacter, secondCharacter) => firstCharacter.name.localeCompare(secondCharacter.name));

  return { success: true, characters };
};

export const createCharacterProfile = (name, appearanceId = DEFAULT_CHARACTER_APPEARANCE_ID) => {
  const normalizedName = normalizeCharacterName(name);
  if (!isValidCharacterName(normalizedName)) {
    return { success: false, reason: "invalid-name" };
  }
  if (!CHARACTER_APPEARANCE_IDS.has(appearanceId)) {
    return { success: false, reason: "invalid-appearance" };
  }

  const collectionResult = readCharacterCollection();
  if (!collectionResult.success) {
    return collectionResult;
  }

  const collection = collectionResult.collection;
  const isDuplicateName = Object.values(collection.charactersById).some((entry) => {
    return entry.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase();
  });
  if (isDuplicateName) {
    return { success: false, reason: "duplicate-name" };
  }

  const characterId = createCharacterId();
  const now = Date.now();
  collection.activeCharacterId = characterId;
  collection.charactersById[characterId] = {
    characterId,
    name: normalizedName,
    appearanceId,
    createdAt: now,
    savedAt: now,
    character: null,
  };

  const writeResult = writeCharacterCollection(collection);
  if (!writeResult.success) {
    return writeResult;
  }
  return { success: true, characterId, name: normalizedName, appearanceId };
};

export const setActiveCharacterId = (characterId) => {
  const collectionResult = readCharacterCollection();
  if (!collectionResult.success) {
    return collectionResult;
  }

  const collection = collectionResult.collection;
  if (typeof characterId !== "string" || !collection.charactersById[characterId]) {
    return { success: false, reason: "not-found" };
  }

  collection.activeCharacterId = characterId;
  const writeResult = writeCharacterCollection(collection);
  return writeResult.success ? { success: true } : writeResult;
};

export const deleteCharacterProfile = (characterId) => {
  const collectionResult = readCharacterCollection();
  if (!collectionResult.success) {
    return collectionResult;
  }

  const collection = collectionResult.collection;
  if (typeof characterId !== "string" || !collection.charactersById[characterId]) {
    return { success: false, reason: "not-found" };
  }

  const wasActive = collection.activeCharacterId === characterId;
  delete collection.charactersById[characterId];

  if (wasActive) {
    const remainingEntries = Object.values(collection.charactersById).sort((firstEntry, secondEntry) => {
      return firstEntry.createdAt - secondEntry.createdAt;
    });
    collection.activeCharacterId = remainingEntries[0]?.characterId ?? null;
  }

  const writeResult = writeCharacterCollection(collection);
  if (!writeResult.success) {
    return writeResult;
  }
  return {
    success: true,
    wasActive,
    activeCharacterId: collection.activeCharacterId,
  };
};
