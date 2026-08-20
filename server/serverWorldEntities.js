import { MONSTER_RESPAWN_CONFIG } from "../src/core/gameConstants.js";
import { createMonster } from "../src/monsters/monsterModel.js";
import { createMonsterRespawnSystem } from "../src/monsters/monsterRespawnSystem.js";
import { createNpcFromWorldObject } from "../src/npcs/npcModel.js";
import { createInitialWorldItems } from "../src/world/initialWorldItems.js";
import { createSpatialEntityStore } from "./spatialEntityStore.js";

export const createServerWorldEntities = (
  worldMapsByZ,
  { playersByUid = new Map(), now = () => Date.now(), onMonsterSpawned = () => {} } = {},
) => {
  if (!(worldMapsByZ instanceof Map)) {
    throw new TypeError("Server world entities require loaded maps.");
  }
  const monsters = createSpatialEntityStore();
  const npcs = createSpatialEntityStore();
  const worldItems = createSpatialEntityStore({ stackOrderField: "tileStackOrder" });
  const groundEffects = createSpatialEntityStore();
  const decayingItems = [];
  const spawnDefinitionsById = new Map();
  const spawnStateById = new Map();
  const eventOrderState = { nextEventOrder: 1 };

  for (const worldItem of createInitialWorldItems(0)) {
    worldItems.add(worldItem);
  }

  for (const worldMap of worldMapsByZ.values()) {
    for (const chunk of worldMap.chunksByKey.values()) {
      for (const worldNpcObject of chunk.npcs ?? []) {
        const npc = createNpcFromWorldObject(worldNpcObject);
        if (npc) {
          npcs.add(npc);
        }
      }
    }
  }

  const respawnSystem = createMonsterRespawnSystem({
    createMonster,
    addMonsterToState: (monster) => monsters.add(monster),
    isBlockingItemAtPosition: (x, y, z) => worldItems.getAt(x, y, z) !== null,
    isMonsterAtPosition: (x, y, z) => monsters.getAt(x, y, z) !== null,
    isNpcAtPosition: (x, y, z) => npcs.getAt(x, y, z) !== null,
    isPlayerAtPosition: (x, y, z) =>
      [...playersByUid.values()].some((player) => player.x === x && player.y === y && player.z === z),
    refreshMonsterHp: () => {},
    renderMonsters: () => {},
    spawnDefinitionsById,
    spawnStateById,
    eventOrderState,
    getPlayers: () => [...playersByUid.values()],
    onMonsterSpawned,
  });

  for (const worldMap of worldMapsByZ.values()) {
    for (const spawnZone of respawnSystem.getSpawnZones(worldMap)) {
      const definition = respawnSystem.registerSpawnDefinition(worldMap, spawnZone);
      if (!definition) {
        continue;
      }
      for (let count = 0; count < definition.maxCount; count++) {
        if (!respawnSystem.spawnFromZone(worldMap, spawnZone)) {
          respawnSystem.scheduleAt(definition.spawnId, now() + MONSTER_RESPAWN_CONFIG.blockedRetryMs);
        }
      }
    }
  }

  return Object.freeze({
    monsters,
    npcs,
    worldItems,
    groundEffects,
    decayingItems,
    respawnSystem,
    spawnDefinitionsById,
    spawnStateById,
  });
};
