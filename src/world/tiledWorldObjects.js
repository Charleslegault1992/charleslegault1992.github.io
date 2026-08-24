import { TILE_SIZE } from "../core/gameConstants.js";
import { getWorldChunkForTilePosition } from "./worldCoordinates.js";

export const isTileInsideTiledObject = (tileCol, tileRow, tiledObject) => {
  if (
    !Number.isInteger(tileCol) ||
    !Number.isInteger(tileRow) ||
    !Number.isInteger(tiledObject?.col) ||
    !Number.isInteger(tiledObject?.row) ||
    !Number.isFinite(tiledObject?.width) ||
    !Number.isFinite(tiledObject?.height)
  ) {
    return false;
  }

  const widthTiles = Math.ceil(tiledObject.width / TILE_SIZE);
  const heightTiles = Math.ceil(tiledObject.height / TILE_SIZE);
  return (
    widthTiles > 0 &&
    heightTiles > 0 &&
    tileCol >= tiledObject.col &&
    tileCol < tiledObject.col + widthTiles &&
    tileRow >= tiledObject.row &&
    tileRow < tiledObject.row + heightTiles
  );
};

const findTiledObjectAtTile = (worldMap, collectionName, col, row) => {
  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    typeof collectionName !== "string" ||
    !Number.isInteger(col) ||
    !Number.isInteger(row)
  ) {
    return null;
  }
  const collection = getWorldChunkForTilePosition(worldMap, col, row)?.[collectionName];
  return Array.isArray(collection)
    ? collection.find((tiledObject) => isTileInsideTiledObject(col, row, tiledObject)) ?? null
    : null;
};

export const findInteractableAtTile = (worldMap, col, row) => {
  return findTiledObjectAtTile(worldMap, "interactables", col, row);
};

export const findTransitionAtTile = (worldMap, col, row) => {
  return findTiledObjectAtTile(worldMap, "transitions", col, row);
};

export const findProtectionZoneAtTile = (worldMap, col, row) => {
  const worldChunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!Array.isArray(worldChunk?.zones)) {
    return null;
  }
  return (
    worldChunk.zones.find(
      (zone) =>
        isTileInsideTiledObject(col, row, zone) &&
        (zone.properties?.zoneType === "protection" || zone.properties?.protectionZone === true),
    ) ?? null
  );
};

export const isPlayerNearTiledObject = (player, tiledObject, range = 1) => {
  if (
    !player ||
    tiledObject?.z !== player.z ||
    !Number.isFinite(player.x) ||
    !Number.isFinite(player.y) ||
    !Number.isInteger(range) ||
    range < 0 ||
    !Number.isInteger(tiledObject?.col) ||
    !Number.isInteger(tiledObject?.row) ||
    !Number.isFinite(tiledObject?.width) ||
    !Number.isFinite(tiledObject?.height)
  ) {
    return false;
  }

  const widthTiles = Math.max(Math.ceil(tiledObject.width / TILE_SIZE), 1);
  const heightTiles = Math.max(Math.ceil(tiledObject.height / TILE_SIZE), 1);
  const playerCol = player.x / TILE_SIZE;
  const playerRow = player.y / TILE_SIZE;
  const nearestCol = Math.min(Math.max(playerCol, tiledObject.col), tiledObject.col + widthTiles - 1);
  const nearestRow = Math.min(Math.max(playerRow, tiledObject.row), tiledObject.row + heightTiles - 1);
  return Math.abs(playerCol - nearestCol) <= range && Math.abs(playerRow - nearestRow) <= range;
};
