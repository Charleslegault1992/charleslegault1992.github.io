import { MAX_STEP_HEIGHT, TILE_SIZE } from "../src/core/gameConstants.js";
import { getRandomInt } from "../src/core/mathUtils.js";
import { getItemData, getItemSurfaceHeight } from "../src/items/itemModel.js";
import { getNpcData } from "../src/npcs/npcModel.js";
import { getCardinalDirectionFromTileDelta } from "../src/world/pathfinding.js";
import { getChunkPositionFromWorldPosition, getWorldChunkForTilePosition, isWorldCollisionAtTile } from "../src/world/worldCoordinates.js";

const NPC_ACTIVE_CHUNK_RADIUS = 1;
const CARDINAL_TILE_OFFSETS = Object.freeze([
  Object.freeze({ col: 0, row: -1 }),
  Object.freeze({ col: 1, row: 0 }),
  Object.freeze({ col: 0, row: 1 }),
  Object.freeze({ col: -1, row: 0 }),
]);

export const createServerNpcMovement = ({
  worldMapsByZ,
  playersByUid,
  monsters,
  npcs,
  worldItems,
  conversationStatesByNpcUid,
  randomInt = getRandomInt,
}) => {
  let occupiedPlayerTileKeys = new Set();

  const getPlayerTileKey = (x, y, z) => `${z}:${x}:${y}`;

  const getSurfaceHeight = (x, y, z) =>
    worldItems.getAllAt(x, y, z).reduce((height, item) => height + getItemSurfaceHeight(item), 0);

  const getActiveChunkKeys = () => {
    const chunkKeys = new Set();
    const nextOccupiedPlayerTileKeys = new Set();
    for (const player of playersByUid.values()) {
      nextOccupiedPlayerTileKeys.add(getPlayerTileKey(player.x, player.y, player.z));
      const centerChunk = getChunkPositionFromWorldPosition(player.x, player.y);
      if (!centerChunk || player.hp <= 0) {
        continue;
      }
      for (
        let chunkY = centerChunk.chunkY - NPC_ACTIVE_CHUNK_RADIUS;
        chunkY <= centerChunk.chunkY + NPC_ACTIVE_CHUNK_RADIUS;
        chunkY++
      ) {
        for (
          let chunkX = centerChunk.chunkX - NPC_ACTIVE_CHUNK_RADIUS;
          chunkX <= centerChunk.chunkX + NPC_ACTIVE_CHUNK_RADIUS;
          chunkX++
        ) {
          chunkKeys.add(`${player.z}:${chunkX}:${chunkY}`);
        }
      }
    }
    occupiedPlayerTileKeys = nextOccupiedPlayerTileKeys;
    return chunkKeys;
  };

  const isDestinationWalkable = (npc, worldMap, col, row) => {
    if (
      !getWorldChunkForTilePosition(worldMap, col, row) ||
      isWorldCollisionAtTile(worldMap, col, row)
    ) {
      return false;
    }

    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    if (
      monsters.getAt(x, y, npc.z) ||
      npcs.getAt(x, y, npc.z) ||
      occupiedPlayerTileKeys.has(getPlayerTileKey(x, y, npc.z))
    ) {
      return false;
    }

    const destinationItems = worldItems.getAllAt(x, y, npc.z);
    if (destinationItems.some((item) => getItemData(item.itemId)?.blockMovement === true)) {
      return false;
    }

    return getSurfaceHeight(x, y, npc.z) - getSurfaceHeight(npc.x, npc.y, npc.z) <= MAX_STEP_HEIGHT;
  };

  const update = (now) => {
    const activeChunkKeys = getActiveChunkKeys();
    if (activeChunkKeys.size === 0) {
      return [];
    }

    const changedNpcs = [];
    for (const npc of npcs.getInChunkKeys(activeChunkKeys)) {
      const npcData = getNpcData(npc.npcId);
      const movement = npcData?.movement;
      if (
        !movement?.enabled ||
        conversationStatesByNpcUid.get(npc.uid)?.activePlayerUid ||
        now < npc.nextWanderAt
      ) {
        continue;
      }

      npc.nextWanderAt = now + randomInt(movement.intervalMinMs, movement.intervalMaxMs);
      const worldMap = worldMapsByZ.get(npc.z);
      if (!worldMap) {
        continue;
      }

      const currentCol = npc.x / TILE_SIZE;
      const currentRow = npc.y / TILE_SIZE;
      const spawnCol = npc.spawnX / TILE_SIZE;
      const spawnRow = npc.spawnY / TILE_SIZE;
      const firstOffsetIndex = randomInt(0, CARDINAL_TILE_OFFSETS.length - 1);

      for (let offsetIndex = 0; offsetIndex < CARDINAL_TILE_OFFSETS.length; offsetIndex++) {
        const offset = CARDINAL_TILE_OFFSETS[(firstOffsetIndex + offsetIndex) % CARDINAL_TILE_OFFSETS.length];
        const nextCol = currentCol + offset.col;
        const nextRow = currentRow + offset.row;
        if (
          Math.abs(nextCol - spawnCol) > movement.roamRadiusTiles ||
          Math.abs(nextRow - spawnRow) > movement.roamRadiusTiles ||
          !isDestinationWalkable(npc, worldMap, nextCol, nextRow)
        ) {
          continue;
        }

        const previousX = npc.x;
        const previousY = npc.y;
        const nextX = nextCol * TILE_SIZE;
        const nextY = nextRow * TILE_SIZE;
        if (!npcs.updatePosition(npc.uid, nextX, nextY, npc.z)) {
          break;
        }
        npc.oldX = previousX;
        npc.oldY = previousY;
        npc.moveStartTime = now;
        npc.moveDuration = movement.moveCooldownMs;
        npc.direction = getCardinalDirectionFromTileDelta(offset.col, offset.row, npc.direction);
        changedNpcs.push(npc);
        break;
      }
    }
    return changedNpcs;
  };

  return Object.freeze({ update });
};
