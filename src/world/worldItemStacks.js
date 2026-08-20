import { MAX_SURFACE_HEIGHT, TILE_SIZE } from "../core/gameConstants.js";
import { getItemSurfaceHeight, isValidWorldItem } from "../items/itemModel.js";
import { worldItemsByUid, worldTileStacksByKey } from "../state/worldState.js";

export const getWorldTileStackKey = (x, y, z) => {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);

  return `${z}:${col}:${row}`;
};

export const getWorldTileStack = (x, y, z) => {
  const tileStackKey = getWorldTileStackKey(x, y, z);
  return worldTileStacksByKey.get(tileStackKey) ?? null;
};

export const findWorldItemByUid = (itemUid) => {
  return worldItemsByUid.get(itemUid) ?? null;
};

export const getTopWorldItemUidAtTile = (x, y, z) => {
  const tileStack = getWorldTileStack(x, y, z);
  if (!tileStack || tileStack.itemUids.length <= 0) {
    return null;
  }
  return tileStack.itemUids[tileStack.itemUids.length - 1];
};

export const getTopWorldItemAtTile = (x, y, z) => {
  const itemUid = getTopWorldItemUidAtTile(x, y, z);
  if (!itemUid) {
    return null;
  }
  return findWorldItemByUid(itemUid);
};

export const getOrCreateWorldTileStack = (x, y, z) => {
  const tileStackKey = getWorldTileStackKey(x, y, z);
  let tileStack = getWorldTileStack(x, y, z);
  if (tileStack) {
    return tileStack;
  }
  tileStack = {
    x,
    y,
    z,
    itemUids: [],
  };
  worldTileStacksByKey.set(tileStackKey, tileStack);
  return tileStack;
};

export const addItemUidToWorldTileStack = (item) => {
  if (!isValidWorldItem(item)) {
    return false;
  }
  const tileStack = getOrCreateWorldTileStack(item.x, item.y, item.z);
  if (!tileStack.itemUids.includes(item.uid)) {
    tileStack.itemUids.push(item.uid);
  }
  return true;
};

export const rebuildWorldTileStacks = () => {
  worldTileStacksByKey.clear();
  for (const item of worldItemsByUid.values()) {
    addItemUidToWorldTileStack(item);
  }
  for (const tileStack of worldTileStacksByKey.values()) {
    tileStack.itemUids.sort((firstUid, secondUid) => {
      const firstOrder = worldItemsByUid.get(firstUid)?.tileStackOrder;
      const secondOrder = worldItemsByUid.get(secondUid)?.tileStackOrder;
      if (!Number.isSafeInteger(firstOrder) || !Number.isSafeInteger(secondOrder)) {
        return 0;
      }
      return firstOrder - secondOrder;
    });
  }
};

export const removeItemUidFromWorldTileStack = (item) => {
  if (!isValidWorldItem(item)) {
    return false;
  }
  const tileStack = getWorldTileStack(item.x, item.y, item.z);
  if (!tileStack?.itemUids?.includes(item.uid)) {
    return false;
  }
  const index = tileStack.itemUids.indexOf(item.uid);
  tileStack.itemUids.splice(index, 1);
  if (tileStack.itemUids.length <= 0) {
    const tileStackKey = getWorldTileStackKey(item.x, item.y, item.z);
    worldTileStacksByKey.delete(tileStackKey);
  }
  return true;
};

export const moveItemUidToWorldTileStack = (item, nextX, nextY) => {
  if (!isValidWorldItem(item) || !Number.isInteger(nextX) || !Number.isInteger(nextY)) {
    return false;
  }

  if (item.x === nextX && item.y === nextY) {
    return true;
  }

  const previousX = item.x;
  const previousY = item.y;
  if (!removeItemUidFromWorldTileStack(item)) {
    return false;
  }

  item.x = nextX;
  item.y = nextY;
  if (addItemUidToWorldTileStack(item)) {
    return true;
  }

  item.x = previousX;
  item.y = previousY;
  addItemUidToWorldTileStack(item);
  return false;
};

export const isWorldItemTopOfTileStack = (item) => {
  if (!isValidWorldItem(item)) {
    return false;
  }
  return getTopWorldItemUidAtTile(item.x, item.y, item.z) === item.uid;
};

export const getWorldItemStackIndex = (item) => {
  if (!isValidWorldItem(item)) {
    return 0;
  }

  const tileStack = getWorldTileStack(item.x, item.y, item.z);
  if (!tileStack) {
    return 0;
  }

  const index = tileStack.itemUids.indexOf(item.uid);
  return index === -1 ? 0 : index;
};

export const getWorldTileSurfaceHeight = (x, y, z) => {
  const tileStack = getWorldTileStack(x, y, z);
  if (!tileStack) {
    return 0;
  }
  let totalSurfaceHeight = 0;
  for (const itemUid of tileStack.itemUids) {
    totalSurfaceHeight += getItemSurfaceHeight(findWorldItemByUid(itemUid));
  }
  return Math.min(totalSurfaceHeight, MAX_SURFACE_HEIGHT);
};

export const getEntitySurfaceOffsetY = (entity) => {
  if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || !Number.isInteger(entity.z)) {
    return 0;
  }
  return getWorldTileSurfaceHeight(entity.x, entity.y, entity.z);
};

export const getWorldItemStackOffsetY = (item) => {
  if (!isValidWorldItem(item)) {
    return 0;
  }
  const tileStack = getWorldTileStack(item.x, item.y, item.z);
  if (!tileStack) {
    return 0;
  }
  let itemSurfaceHeight = 0;
  for (const itemUid of tileStack.itemUids) {
    if (itemUid === item.uid) {
      break;
    }
    itemSurfaceHeight += getItemSurfaceHeight(findWorldItemByUid(itemUid));
  }
  return Math.min(itemSurfaceHeight, MAX_SURFACE_HEIGHT);
};

export const canAddItemSurfaceToTile = (item, x, y) => {
  const currentHeight = getWorldTileSurfaceHeight(x, y, item.z);
  const itemSurfaceHeight = getItemSurfaceHeight(item);
  return currentHeight + itemSurfaceHeight <= MAX_SURFACE_HEIGHT;
};
