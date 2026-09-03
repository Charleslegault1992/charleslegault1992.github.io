import { SPRITE_SIZE } from "../core/gameConstants.js";
import { getAtlasSource } from "../core/atlasUtils.js";
import { itemsDatabase } from "../data/itemsDatabase.js";

export const getItemData = (itemId) => {
  return itemsDatabase[itemId] ?? null;
};

export const getItemUseData = (item) => {
  const itemData = getItemData(item?.itemId);
  return itemData?.use ?? null;
};

export const isContainerItem = (item) => {
  return getItemData(item?.itemId)?.container === true;
};

export const isOpenableContainerItem = (item) => {
  if (!isContainerItem(item)) {
    return false;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData?.decayType) {
    return true;
  }
  return Number.isInteger(item.decayStage) && item.decayStage < 2;
};

export const isValidWorldItem = (item) => {
  const itemData = getItemData(item?.itemId);
  return Boolean(
    itemData &&
    Number.isInteger(item.uid) &&
    Number.isInteger(item.x) &&
    Number.isInteger(item.y) &&
    Number.isInteger(item.z) &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0,
  );
};

export const getItemRenderParts = (itemId) => {
  const itemData = getItemData(itemId);
  return Array.isArray(itemData?.render?.parts) ? itemData.render.parts : [];
};

export const getStackableAtlasColOffset = (quantity) => {
  if (quantity >= 50) {
    return 4;
  }
  if (quantity >= 25) {
    return 3;
  }
  if (quantity >= 3) {
    return 2;
  }
  if (quantity >= 2) {
    return 1;
  }
  return 0;
};

export const getTorchFuelStage = (item) => {
  const itemData = getItemData(item?.itemId);
  const fuelDurationMs = itemData?.lightSource?.fuelDurationMs;
  if (!Number.isFinite(fuelDurationMs) || fuelDurationMs <= 0 || !Number.isFinite(item?.fuelRemainingMs)) {
    return null;
  }
  if (item.fuelRemainingMs <= 0) {
    return 3;
  }
  const fuelRatio = item.fuelRemainingMs / fuelDurationMs;
  if (fuelRatio > 2 / 3) {
    return 0;
  }
  if (fuelRatio > 1 / 3) {
    return 1;
  }
  return 2;
};

export const getTorchAtlasCol = (item) => {
  const fuelStage = getTorchFuelStage(item);
  if (!Number.isInteger(fuelStage)) {
    return null;
  }
  if (fuelStage >= 3) {
    return 6;
  }
  return (item.isLit ? 3 : 0) + fuelStage;
};

export const getItemRenderData = (item) => {
  const itemData = getItemData(item?.itemId);
  if (!itemData) {
    return [];
  }

  const renderConfig = itemData.render ?? {};
  const defaultSpriteSize = renderConfig.spriteSize ?? SPRITE_SIZE;
  const defaultAtlasCellSize = renderConfig.atlasCellSize;
  const defaultAtlasPadding = renderConfig.atlasPadding;

  return getItemRenderParts(item.itemId).map((part) => {
    let atlasCol = part.atlasCol;

    const torchAtlasCol = getTorchAtlasCol(item);
    if (Number.isInteger(torchAtlasCol)) {
      atlasCol = torchAtlasCol;
    }

    if (itemData.stackable && itemData.stackAtlasVariants !== false) {
      atlasCol += getStackableAtlasColOffset(item.quantity);
    }

    if (Number.isInteger(item.decayStage)) {
      atlasCol += item.decayStage;
    }

    const spriteSize = part.spriteSize ?? defaultSpriteSize;
    const atlasCellSize = part.atlasCellSize ?? defaultAtlasCellSize;
    const atlasPadding = part.atlasPadding ?? defaultAtlasPadding;

    return {
      ...part,

      textureKey: renderConfig.atlas ?? "items",
      selectionMode: renderConfig.selectionMode ?? "sprite",

      ...getAtlasSource(atlasCol, part.atlasRow, spriteSize, {
        cellSize: atlasCellSize,
        padding: atlasPadding,
      }),
    };
  });
};

export const getItemSurfaceHeight = (item) => {
  return getItemData(item?.itemId)?.surfaceHeight ?? 0;
};

export const isValidItemRenderPart = (part) => {
  return Boolean(
    part &&
    Number.isInteger(part.atlasCol) &&
    Number.isInteger(part.atlasRow) &&
    Number.isInteger(part.offsetX) &&
    Number.isInteger(part.offsetY) &&
    Number.isInteger(part.zOffset),
  );
};
