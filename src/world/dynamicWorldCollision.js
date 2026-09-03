const getDynamicCollisionTileKey = (z, col, row) => {
  return `${z}:${col}:${row}`;
};

const getOwners = (worldMap) => {
  if (!(worldMap.dynamicCollisionTilesByOwner instanceof Map)) {
    worldMap.dynamicCollisionTilesByOwner = new Map();
  }

  return worldMap.dynamicCollisionTilesByOwner;
};

export const setDynamicCollisionOwnerTiles = (
  worldMap,
  ownerId,
  tiles,
) => {
  if (!worldMap || typeof ownerId !== "string") {
    return false;
  }

  const tileKeys = new Set();

  for (const tile of tiles ?? []) {
    if (
      tile.z === worldMap.z &&
      Number.isInteger(tile.col) &&
      Number.isInteger(tile.row)
    ) {
      tileKeys.add(
        getDynamicCollisionTileKey(tile.z, tile.col, tile.row),
      );
    }
  }

  getOwners(worldMap).set(ownerId, tileKeys);

  return true;
};

export const clearDynamicCollisionOwner = (worldMap, ownerId) => {
  return getOwners(worldMap).delete(ownerId);
};

export const isDynamicWorldCollisionAtTile = (
  worldMap,
  col,
  row,
) => {
  const key = getDynamicCollisionTileKey(worldMap?.z, col, row);

  for (const tileKeys of getOwners(worldMap).values()) {
    if (tileKeys.has(key)) {
      return true;
    }
  }

  return false;
};