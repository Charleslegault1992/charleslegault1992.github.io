import { MAX_STEP_HEIGHT, MONSTER_AI_CHUNK_RADIUS, TILE_SIZE } from "../src/core/gameConstants.js";
import { getItemData, getItemSurfaceHeight } from "../src/items/itemModel.js";
import { createMonsterAiSystem } from "../src/monsters/monsterAiSystem.js";
import {
  createPathfinder,
  getDistanceToClosestTile,
  getNeighbors,
  getPathMovementCost,
  getTileMovementAnimationMultiplier,
  getTileMovementCost,
  hasLineOfSightBetweenTiles,
} from "../src/world/pathfinding.js";
import {
  getChunkPositionFromWorldPosition,
  getTilePosition,
  getWorldChunkForTilePosition,
  getWorldPosition,
  isTiledCollisionAtTile,
} from "../src/world/worldCoordinates.js";

export const createServerMonsterAi = ({ worldMapsByZ, playersByUid, monsters, npcs, worldItems }) => {
  const systemsByZ = new Map();
  let activePlayersByZ = new Map();
  let occupiedPlayerTileKeysByZ = new Map();

  const getSurfaceHeight = (x, y, z) =>
    worldItems.getAllAt(x, y, z).reduce((height, item) => height + getItemSurfaceHeight(item), 0);

  for (const [z, worldMap] of worldMapsByZ.entries()) {
    const isTilePathTraversable = (row, col, fromTile = null) => {
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(col) ||
        !getWorldChunkForTilePosition(worldMap, col, row) ||
        isTiledCollisionAtTile(worldMap, col, row)
      ) {
        return false;
      }
      const destinationItems = worldItems.getAllAt(col * TILE_SIZE, row * TILE_SIZE, z);
      if (destinationItems.some((item) => getItemData(item.itemId)?.blockMovement === true)) {
        return false;
      }
      if (fromTile) {
        const fromHeight = getSurfaceHeight(fromTile.col * TILE_SIZE, fromTile.row * TILE_SIZE, z);
        const destinationHeight = getSurfaceHeight(col * TILE_SIZE, row * TILE_SIZE, z);
        if (destinationHeight - fromHeight > MAX_STEP_HEIGHT) {
          return false;
        }
      }
      return true;
    };

    const isTileOccupiedByCreature = (row, col) => {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      return Boolean(
        monsters.getAt(x, y, z) || npcs.getAt(x, y, z) || occupiedPlayerTileKeysByZ.get(z)?.has(`${col}:${row}`),
      );
    };
    const pathfinder = createPathfinder({ isTilePathTraversable, isTileOccupiedByCreature });

    const system = createMonsterAiSystem({
      findPathToAnyTarget: pathfinder.findPathToAnyTarget,
      getDistanceToClosestTile,
      getNeighbors,
      getPathMovementCost,
      getPathTraversableAdjacentTiles: pathfinder.getPathTraversableAdjacentTiles,
      getTileMovementAnimationMultiplier,
      getTileMovementCost,
      getTilePosition,
      getWorldPosition,
      hasLineOfSightBetweenTiles,
      isTileOccupiedByCreature,
      isTilePathTraversable,
      isWalkableTile: pathfinder.isWalkableTile,
      moveMonsterInTileIndex: (monster, x, y) => {
        const previousX = monster.x;
        const previousY = monster.y;
        const moved = monsters.updatePosition(monster.uid, x, y, monster.z);
        // Restore old position so updateMonsterDirection can compute the correct delta;
        // the AI system sets monster.x/y to the new position right after.
        monster.x = previousX;
        monster.y = previousY;
        return moved;
      },
      syncMonsterRenderVisibility: () => {},
      updateMonsterDirection: (monster, tile) => {
        const current = getTilePosition(monster);
        const deltaCol = tile.col - current.col;
        const deltaRow = tile.row - current.row;
        if (Math.abs(deltaCol) >= Math.abs(deltaRow) && deltaCol !== 0) {
          monster.direction = deltaCol > 0 ? "right" : "left";
        } else if (deltaRow !== 0) {
          monster.direction = deltaRow > 0 ? "down" : "up";
        }
      },
      updateMonsterSprite: () => {},
      getPlayers: () => activePlayersByZ.get(z) ?? [],
      getPlayerByUid: (playerUid) => playersByUid.get(playerUid) ?? null,
      getWorldMap: () => worldMap,
    });
    systemsByZ.set(z, system);
  }

  const update = (now) => {
    const changedMonsters = [];
    const nextActivePlayersByZ = new Map();
    const nextOccupiedPlayerTileKeysByZ = new Map();
    const activeMonsterChunkKeysByZ = new Map();

    for (const player of playersByUid.values()) {
      let players = nextActivePlayersByZ.get(player.z);
      if (!players) {
        players = [];
        nextActivePlayersByZ.set(player.z, players);
      }
      players.push(player);

      let occupiedTileKeys = nextOccupiedPlayerTileKeysByZ.get(player.z);
      if (!occupiedTileKeys) {
        occupiedTileKeys = new Set();
        nextOccupiedPlayerTileKeysByZ.set(player.z, occupiedTileKeys);
      }
      occupiedTileKeys.add(`${player.x / TILE_SIZE}:${player.y / TILE_SIZE}`);

      if (player.hp <= 0) {
        continue;
      }
      const centerChunk = getChunkPositionFromWorldPosition(player.x, player.y);
      if (!centerChunk) {
        continue;
      }
      let chunkKeys = activeMonsterChunkKeysByZ.get(player.z);
      if (!chunkKeys) {
        chunkKeys = new Set();
        activeMonsterChunkKeysByZ.set(player.z, chunkKeys);
      }
      for (
        let chunkY = centerChunk.chunkY - MONSTER_AI_CHUNK_RADIUS;
        chunkY <= centerChunk.chunkY + MONSTER_AI_CHUNK_RADIUS;
        chunkY++
      ) {
        for (
          let chunkX = centerChunk.chunkX - MONSTER_AI_CHUNK_RADIUS;
          chunkX <= centerChunk.chunkX + MONSTER_AI_CHUNK_RADIUS;
          chunkX++
        ) {
          chunkKeys.add(`${player.z}:${chunkX}:${chunkY}`);
        }
      }
    }

    activePlayersByZ = nextActivePlayersByZ;
    occupiedPlayerTileKeysByZ = nextOccupiedPlayerTileKeysByZ;

    for (const [z, system] of systemsByZ.entries()) {
      const activeChunkKeys = activeMonsterChunkKeysByZ.get(z);
      if (!activeChunkKeys || activeChunkKeys.size === 0) {
        continue;
      }
      const activeMonsters = monsters.getInChunkKeys(activeChunkKeys);
      const previousByUid = new Map(
        activeMonsters.map((monster) => [
          monster.uid,
          {
            x: monster.x,
            y: monster.y,
            state: monster.state,
            targetUid: monster.targetUid,
          },
        ]),
      );
      system.updateMovement(now, activeMonsters);
      for (const monster of activeMonsters) {
        const previous = previousByUid.get(monster.uid);
        if (
          previous.x !== monster.x ||
          previous.y !== monster.y ||
          previous.state !== monster.state ||
          previous.targetUid !== monster.targetUid
        ) {
          changedMonsters.push(monster);
        }
      }
    }
    return changedMonsters;
  };

  return Object.freeze({ update });
};
