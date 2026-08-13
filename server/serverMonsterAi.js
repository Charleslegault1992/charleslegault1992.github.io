import { MAX_STEP_HEIGHT, TILE_SIZE } from "../src/core/gameConstants.js";
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
  getTilePosition,
  getWorldChunkForTilePosition,
  getWorldPosition,
  isTiledCollisionAtTile,
} from "../src/world/worldCoordinates.js";

export const createServerMonsterAi = ({ worldMapsByZ, playersByUid, monsters, npcs, worldItems }) => {
  const systemsByZ = new Map();

  const getSurfaceHeight = (x, y, z) => worldItems.getAllAt(x, y, z)
    .reduce((height, item) => height + getItemSurfaceHeight(item), 0);

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
        monsters.getAt(x, y, z) ||
        npcs.getAt(x, y, z) ||
        [...playersByUid.values()].some((player) => player.z === z && player.x === x && player.y === y),
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
      moveMonsterInTileIndex: (monster, x, y) => monsters.updatePosition(monster.uid, x, y, monster.z),
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
      getPlayers: () => [...playersByUid.values()].filter((player) => player.z === z),
      getWorldMap: () => worldMap,
    });
    systemsByZ.set(z, system);
  }

  const update = (now) => {
    const changedMonsters = [];
    for (const [z, system] of systemsByZ.entries()) {
      if (![...playersByUid.values()].some((player) => player.z === z && player.hp > 0)) {
        continue;
      }
      const activeMonsters = [...monsters.values()].filter((monster) => monster.z === z);
      const previousByUid = new Map(activeMonsters.map((monster) => [monster.uid, {
        x: monster.x,
        y: monster.y,
        state: monster.state,
        targetUid: monster.targetUid,
      }]));
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
