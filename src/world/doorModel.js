import { TILE_SIZE } from "../core/gameConstants.js";
import { getDoorData } from "../data/doorsDatabase.js";

export const getDoorTileKey = (z, col, row) => `${z}:${col}:${row}`;

export const getDoorTiles = (door) => {
  if (
    !Number.isInteger(door?.z) ||
    !Number.isInteger(door?.col) ||
    !Number.isInteger(door?.row) ||
    !Number.isFinite(door?.width) ||
    !Number.isFinite(door?.height)
  ) {
    return [];
  }

  const widthTiles = Math.max(1, Math.ceil(door.width / TILE_SIZE));
  const heightTiles = Math.max(1, Math.ceil(door.height / TILE_SIZE));
  const tiles = [];
  for (let rowOffset = 0; rowOffset < heightTiles; rowOffset++) {
    for (let colOffset = 0; colOffset < widthTiles; colOffset++) {
      tiles.push({ z: door.z, col: door.col + colOffset, row: door.row + rowOffset });
    }
  }
  return tiles;
};

export const createDoorFromWorldObject = (worldObject) => {
  const properties = worldObject?.properties;
  const doorId = properties?.doorId;
  const doorType = properties?.doorType;
  if (
    typeof doorId !== "string" ||
    doorId === "" ||
    !getDoorData(doorType) ||
    !Number.isInteger(worldObject?.z) ||
    !Number.isInteger(worldObject?.col) ||
    !Number.isInteger(worldObject?.row)
  ) {
    return null;
  }

  return {
    uid: doorId,
    doorId,
    doorType,
    x: worldObject.x,
    y: worldObject.y,
    z: worldObject.z,
    col: worldObject.col,
    row: worldObject.row,
    width: Math.max(worldObject.width || TILE_SIZE, TILE_SIZE),
    height: Math.max(worldObject.height || TILE_SIZE, TILE_SIZE),
    isOpen: properties.startsOpen === true,
    locked: properties.locked === true,
  };
};

export const indexDoorTiles = (doors, doorUidByTileKey = new Map()) => {
  doorUidByTileKey.clear();
  for (const door of doors ?? []) {
    for (const tile of getDoorTiles(door)) {
      doorUidByTileKey.set(getDoorTileKey(tile.z, tile.col, tile.row), door.uid);
    }
  }
  return doorUidByTileKey;
};

export const getBlockingDoorAtTile = (doorsByUid, doorUidByTileKey, z, col, row) => {
  const doorUid = doorUidByTileKey?.get(getDoorTileKey(z, col, row));
  const door = doorUid ? doorsByUid?.get(doorUid) : null;
  return door && door.isOpen !== true ? door : null;
};

export const initializeDoorsFromWorldMaps = (worldMapsByZ, doorsByUid = new Map(), doorUidByTileKey = new Map()) => {
  doorsByUid.clear();
  for (const worldMap of worldMapsByZ?.values?.() ?? []) {
    for (const chunk of worldMap.chunksByKey?.values?.() ?? []) {
      for (const worldObject of chunk.doors ?? []) {
        const door = createDoorFromWorldObject(worldObject);
        if (door) {
          doorsByUid.set(door.uid, door);
        }
      }
    }
  }
  indexDoorTiles(doorsByUid.values(), doorUidByTileKey);
  for (const worldMap of worldMapsByZ?.values?.() ?? []) {
    worldMap.doorsByUid = doorsByUid;
    worldMap.doorUidByTileKey = doorUidByTileKey;
  }
  return doorsByUid;
};
