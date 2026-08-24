import { MONSTER_RESPAWN_CONFIG } from "../src/core/gameConstants.js";
import { createMonster } from "../src/monsters/monsterModel.js";
import { createMonsterRespawnSystem } from "../src/monsters/monsterRespawnSystem.js";
import { createNpcFromWorldObject } from "../src/npcs/npcModel.js";
import { createInitialWorldItems } from "../src/world/initialWorldItems.js";
import { TILE_SIZE } from "../src/core/gameConstants.js";
import { groundEffectsDatabase } from "../src/data/groundEffectsDatabase.js";
import { allocateGroundEffectUid } from "../src/state/uidAllocator.js";
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

  for (const z of worldMapsByZ.keys()) {
    for (const worldItem of createInitialWorldItems(z)) {
      worldItems.add(worldItem);
    }
  }

  for (const worldMap of worldMapsByZ.values()) {
    for (const chunk of worldMap.chunksByKey.values()) {
      for (const worldNpcObject of chunk.npcs ?? []) {
        const npc = createNpcFromWorldObject(worldNpcObject);
        if (npc) {
          npcs.add(npc);
        }
      }
      for (const interactable of chunk.interactables ?? []) {
        const properties = interactable.properties ?? {};
        const effectData = groundEffectsDatabase[properties.groundEffectId];
        if (properties.interactableType !== "field" || effectData?.kind !== "field") {
          continue;
        }
        const widthTiles = Math.max(1, Math.ceil((interactable.width || TILE_SIZE) / TILE_SIZE));
        const heightTiles = Math.max(1, Math.ceil((interactable.height || TILE_SIZE) / TILE_SIZE));
        for (let rowOffset = 0; rowOffset < heightTiles; rowOffset++) {
          for (let colOffset = 0; colOffset < widthTiles; colOffset++) {
            groundEffects.add({
              uid: allocateGroundEffectUid(),
              groundEffectId: properties.groundEffectId,
              x: (interactable.col + colOffset) * TILE_SIZE,
              y: (interactable.row + rowOffset) * TILE_SIZE,
              z: worldMap.z,
              decayStage: 0,
              isPermanent: properties.isPermanent !== false,
              ownerUid: null,
              nextDecayAt: Number.POSITIVE_INFINITY,
            });
          }
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
