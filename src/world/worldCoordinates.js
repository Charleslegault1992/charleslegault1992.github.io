import { CHUNK_SIZE_TILES, TILE_SIZE } from "../core/gameConstants.js";
import { getBlockingDoorAtTile } from "./doorModel.js";
import { isDynamicWorldCollisionAtTile } from "./dynamicWorldCollision.js";

export const getChunkPositionFromWorldPosition = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
  const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
  return { chunkX, chunkY };
};

export const getWorldChunkForTilePosition = (worldMap, col, row) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
  const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
  const chunkKey = `${worldMap.z}:${chunkX}:${chunkY}`;
  return worldMap.chunksByKey.get(chunkKey) ?? null;
};

export const getLocalTileIndexInChunk = (col, row) => {
  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  const localCol = ((col % CHUNK_SIZE_TILES) + CHUNK_SIZE_TILES) % CHUNK_SIZE_TILES;
  const localRow = ((row % CHUNK_SIZE_TILES) + CHUNK_SIZE_TILES) % CHUNK_SIZE_TILES;
  return localRow * CHUNK_SIZE_TILES + localCol;
};

export const getWorldLayerGidAtTile = (worldMap, layerName, col, row) => {
  if (!worldMap || typeof layerName !== "string" || !Number.isInteger(col) || !Number.isInteger(row)) {
    return 0;
  }
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  const index = getLocalTileIndexInChunk(col, row);
  if (!chunk || !Number.isInteger(index)) {
    return 0;
  }
  const layer = chunk.layers?.[layerName];
  if (!Array.isArray(layer)) {
    return 0;
  }
  return layer[index] ?? 0;
};

export const getCollisionGidAtTile = (worldMap, col, row) => {
  return getWorldLayerGidAtTile(worldMap, "collision", col, row);
};

export const isTiledCollisionAtTile = (worldMap, col, row) => {
  if (!worldMap || !Number.isInteger(col) || !Number.isInteger(row)) {
    return false;
  }
  return getCollisionGidAtTile(worldMap, col, row) > 0;
};

export const isWorldCollisionAtTile = (worldMap, col, row) => {
  return (
    isTiledCollisionAtTile(worldMap, col, row) ||
    isDynamicWorldCollisionAtTile(worldMap, col, row) ||
    Boolean(getBlockingDoorAtTile(worldMap?.doorsByUid, worldMap?.doorUidByTileKey, worldMap?.z, col, row))
  );
};

export const getTilePosition = (source) => {
  const col = source.x / TILE_SIZE;
  const row = source.y / TILE_SIZE;
  return { col, row };
};

export const getWorldPosition = (tile) => {
  const tileX = tile.col * TILE_SIZE;
  const tileY = tile.row * TILE_SIZE;
  return { tileX, tileY };
};
