import { getItemData, getTorchFuelStage } from "../items/itemModel.js";

const cloneOrNull = (value) => (value == null ? null : structuredClone(value));

const valuesFrom = (collection) => {
  if (collection instanceof Map) {
    return [...collection.values()];
  }
  return Array.isArray(collection) ? collection : [];
};

const sortByUid = (entities) => {
  return entities.sort((first, second) => String(first.uid).localeCompare(String(second.uid)));
};

const getPlayerPublicLightState = (player) => {
  const equippedLight = player?.equipment?.ammo;
  const equippedLightData = equippedLight?.isLit === true ? getItemData(equippedLight.itemId)?.lightSource : null;
  const fuelStage = equippedLightData ? getTorchFuelStage(equippedLight) : null;
  const equippedRadius = Number.isInteger(fuelStage)
    ? (equippedLightData.radiusByStage?.[fuelStage] ?? 0)
    : 0;
  const spellRadius = Number.isFinite(player?.spellEffects?.light?.radius) ? player.spellEffects.light.radius : 0;
  return {
    equippedRadius: Math.max(equippedRadius, 0),
    spellRadius: Math.max(spellRadius, 0),
  };
};

export const serializeItem = (item) => {
  if (!item || !Number.isInteger(item.uid) || typeof item.itemId !== "string") {
    return null;
  }
  const serializedItem = {
    uid: item.uid,
    itemId: item.itemId,
    quantity: item.quantity,
  };
  for (const field of ["charges", "isLit", "fuelRemainingMs", "lastFuelUpdateAt", "decayStage", "nextDecayAt"]) {
    if (field in item) {
      serializedItem[field] = item[field];
    }
  }
  if (Array.isArray(item.content)) {
    serializedItem.content = item.content.map(serializeItem);
  }
  return serializedItem;
};

export const serializeWorldItem = (item) => {
  const serializedItem = serializeItem(item);
  if (!serializedItem || !Number.isInteger(item.x) || !Number.isInteger(item.y) || !Number.isInteger(item.z)) {
    return null;
  }
  return {
    ...serializedItem,
    x: item.x,
    y: item.y,
    z: item.z,
    tileStackOrder: Number.isSafeInteger(item.tileStackOrder) ? item.tileStackOrder : 0,
  };
};

export const serializePlayerPublicState = (player) => {
  if (!player || typeof player.uid !== "string") {
    return null;
  }
  return {
    uid: player.uid,
    name: player.name,
    appearanceId: player.appearanceId,
    appearanceParts: cloneOrNull(player.appearanceParts),
    appearanceColors: cloneOrNull(player.appearanceColors),
    x: player.x,
    y: player.y,
    z: player.z,
    oldX: player.oldX,
    oldY: player.oldY,
    direction: player.direction,
    moveStartTime: player.moveStartTime,
    moveDuration: player.moveDuration,
    tileStackOrder: Number.isSafeInteger(player.tileStackOrder) ? player.tileStackOrder : 0,
    hp: player.hp,
    maxHp: player.maxHp,
    level: player.level,
    speed: player.speed,
    light: getPlayerPublicLightState(player),
    pvp: {
      enabled: player.pvp?.enabled === true,
      skullType: player.pvp?.skullType ?? "none",
      skullExpiresAt: Number.isFinite(player.pvp?.skullExpiresAt) ? player.pvp.skullExpiresAt : 0,
    },
    statusEffects: cloneOrNull(player.statusEffects) ?? {},
  };
};

export const serializePlayerPrivateState = (player) => {
  const publicState = serializePlayerPublicState(player);
  if (!publicState) {
    return null;
  }
  const equipment = {};
  for (const [slotName, item] of Object.entries(player.equipment ?? {})) {
    equipment[slotName] = serializeItem(item);
  }
  return {
    ...publicState,
    mana: player.mana,
    maxMana: player.maxMana,
    sanity: player.sanity,
    maxSanity: player.maxSanity,
    experience: player.experience,
    classId: player.classId,
    carriedWeight: player.carriedWeight,
    capacity: player.capacity,
    combatMode: player.combatMode,
    spawn: cloneOrNull(player.spawn),
    bank: cloneOrNull(player.bank),
    skills: cloneOrNull(player.skills),
    spellbook: cloneOrNull(player.spellbook),
    spellEffects: cloneOrNull(player.spellEffects),
    cooldowns: cloneOrNull(player.cooldowns),
    progress: cloneOrNull(player.progress),
    pvp: cloneOrNull(player.pvp),
    equipment,
  };
};

export const serializeMonsterState = (monster) => {
  if (!monster || !Number.isInteger(monster.uid) || typeof monster.monsterId !== "string") {
    return null;
  }
  return {
    uid: monster.uid,
    monsterId: monster.monsterId,
    x: monster.x,
    y: monster.y,
    z: monster.z,
    oldX: monster.oldX,
    oldY: monster.oldY,
    direction: monster.direction,
    moveStartTime: monster.moveStartTime,
    moveDuration: monster.moveDuration,
    hp: monster.hp,
    state: monster.state,
    statusEffects: cloneOrNull(monster.statusEffects) ?? {},
  };
};

export const serializeNpcState = (npc) => {
  if (!npc || typeof npc.uid !== "string" || npc.uid === "" || typeof npc.npcId !== "string") {
    return null;
  }
  return {
    uid: npc.uid,
    npcId: npc.npcId,
    x: npc.x,
    y: npc.y,
    z: npc.z,
    oldX: npc.oldX,
    oldY: npc.oldY,
    direction: npc.direction,
    moveStartTime: npc.moveStartTime,
    moveDuration: npc.moveDuration,
    hp: npc.hp,
  };
};

export const serializeGroundEffectState = (groundEffect) => {
  if (!groundEffect || !Number.isInteger(groundEffect.uid) || typeof groundEffect.groundEffectId !== "string") {
    return null;
  }
  return {
    uid: groundEffect.uid,
    groundEffectId: groundEffect.groundEffectId,
    x: groundEffect.x,
    y: groundEffect.y,
    z: groundEffect.z,
    decayStage: groundEffect.decayStage,
    nextDecayAt: groundEffect.nextDecayAt,
    isPermanent: groundEffect.isPermanent === true,
    ownerUid: typeof groundEffect.ownerUid === "string" ? groundEffect.ownerUid : null,
  };
};

export const serializeDoorState = (door) => {
  if (!door || typeof door.uid !== "string" || typeof door.doorType !== "string") {
    return null;
  }
  return {
    uid: door.uid,
    doorId: door.doorId,
    doorType: door.doorType,
    x: door.x,
    y: door.y,
    z: door.z,
    col: door.col,
    row: door.row,
    width: door.width,
    height: door.height,
    isOpen: door.isOpen === true,
    locked: door.locked === true,
  };
};

export const serializeWorldChunk = (chunk) => {
  if (!chunk || !Number.isInteger(chunk.z) || !Number.isInteger(chunk.chunkX) || !Number.isInteger(chunk.chunkY)) {
    return null;
  }
  return {
    key: `${chunk.z}:${chunk.chunkX}:${chunk.chunkY}`,
    z: chunk.z,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    layers: cloneOrNull(chunk.layers) ?? {},
    transitions: cloneOrNull(chunk.transitions) ?? [],
    spawns: cloneOrNull(chunk.spawns) ?? [],
    interactables: cloneOrNull(chunk.interactables) ?? [],
    roofAreas: cloneOrNull(chunk.roofAreas) ?? [],
    roofRevealZones: cloneOrNull(chunk.roofRevealZones) ?? [],
    doors: cloneOrNull(chunk.doors) ?? [],
    zones: cloneOrNull(chunk.zones) ?? [],
  };
};

const serializeCollection = (collection, serializer) => {
  return sortByUid(valuesFrom(collection).map(serializer).filter(Boolean));
};

export const createWorldSnapshot = ({
  revision,
  serverTime,
  selfPlayer,
  players = [],
  monsters = [],
  npcs = [],
  worldItems = [],
  groundEffects = [],
  doors = [],
  chunks = [],
  chunksAreSerialized = false,
  visibleChunkKeys = [],
  acknowledgedActionRequestId = null,
  selfCombatLogoutExpiresAt = 0,
}) => {
  if (!Number.isSafeInteger(revision) || revision < 0 || !Number.isFinite(serverTime)) {
    return null;
  }
  const self = serializePlayerPrivateState(selfPlayer);
  if (!self) {
    return null;
  }
  self.combatLogoutExpiresAt = Number.isFinite(selfCombatLogoutExpiresAt)
    ? Math.max(0, selfCombatLogoutExpiresAt)
    : 0;
  return {
    revision,
    serverTime,
    acknowledgedActionRequestId,
    self,
    entities: {
      players: serializeCollection(players, serializePlayerPublicState).filter((player) => player.uid !== self.uid),
      monsters: serializeCollection(monsters, serializeMonsterState),
      npcs: serializeCollection(npcs, serializeNpcState),
      worldItems: serializeCollection(worldItems, serializeWorldItem),
      groundEffects: serializeCollection(groundEffects, serializeGroundEffectState),
      doors: serializeCollection(doors, serializeDoorState),
    },
    chunks: valuesFrom(chunks)
      .map((chunk) => (chunksAreSerialized ? chunk : serializeWorldChunk(chunk)))
      .filter(Boolean)
      .sort((first, second) => first.key.localeCompare(second.key)),
    visibleChunkKeys: [...new Set(visibleChunkKeys)].sort(),
  };
};

export const createWorldDelta = ({
  baseRevision,
  revision,
  serverTime,
  acknowledgedActionRequestId = null,
  upserts = {},
  removals = {},
  events = [],
}) => {
  if (
    !Number.isSafeInteger(baseRevision) ||
    !Number.isSafeInteger(revision) ||
    revision <= baseRevision ||
    !Number.isFinite(serverTime) ||
    !Array.isArray(events)
  ) {
    return null;
  }
  return {
    baseRevision,
    revision,
    serverTime,
    acknowledgedActionRequestId,
    upserts: structuredClone(upserts),
    removals: structuredClone(removals),
    events: structuredClone(events),
  };
};
