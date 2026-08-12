import { TILE_SIZE } from "../core/gameConstants.js";
import { getRandomInt } from "../core/mathUtils.js";
import { npcsDatabase } from "../data/npcsDatabase.js";

export const getNpcData = (npcId) => {
  return npcsDatabase[npcId] ?? null;
};

export const getNpcTextureUrlsById = () => {
  const textureUrlsById = {};
  for (const npcData of Object.values(npcsDatabase)) {
    textureUrlsById[npcData.npcId] = npcData.textureUrl;
  }
  return textureUrlsById;
};

export const createNpcFromWorldObject = (worldNpcObject) => {
  const npcId = worldNpcObject?.properties?.npcId;
  const npcData = getNpcData(npcId);
  if (!npcData || !Number.isInteger(worldNpcObject?.col) || !Number.isInteger(worldNpcObject?.row)) {
    return null;
  }

  const x = worldNpcObject.col * TILE_SIZE;
  const y = worldNpcObject.row * TILE_SIZE;
  return {
    uid: `npc:${worldNpcObject.z}:${worldNpcObject.tiledObjectId}:${npcId}`,
    npcId,
    name: npcData.name,
    x,
    y,
    z: worldNpcObject.z,
    spawnX: x,
    spawnY: y,
    oldX: x,
    oldY: y,
    renderX: x,
    renderY: y,
    moveStartTime: 0,
    moveDuration: 0,
    nextWanderAt: Date.now() + getRandomInt(npcData.movement.intervalMinMs, npcData.movement.intervalMaxMs),
    hp: npcData.maxHp,
    direction: npcData.direction,
    walkFrame: 1,
  };
};
