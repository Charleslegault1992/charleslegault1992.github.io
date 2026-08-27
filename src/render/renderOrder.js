import { TILE_SIZE, WORLD_RENDER_LAYER_CREATURE, WORLD_RENDER_LAYER_SIZE } from "../core/gameConstants.js";

const WORLD_RENDER_Z_INDEX_BASE = 1000000;

export const WORLD_ROOT_RENDER_Z_INDEX = Object.freeze({
  mapBelow: 0,
  itemUseTarget: 20,
  entity: 30,
  projectile: 40,
  top: 50,
  roof: 70,
  feedbackEffect: 80,
});

export const getWorldRenderZIndex = (worldY, localLayer = 0) => {
  return WORLD_RENDER_Z_INDEX_BASE + worldY * WORLD_RENDER_LAYER_SIZE + localLayer;
};

export const getDoorRenderZIndexes = (doorY, doorHeight) => {
  const doorSortY = doorY + Math.max(0, doorHeight - TILE_SIZE);
  return {
    lower: getWorldRenderZIndex(doorSortY, WORLD_RENDER_LAYER_CREATURE - 1),
    upper: getWorldRenderZIndex(doorSortY, WORLD_RENDER_LAYER_CREATURE + 1),
  };
};

export const getEntityRenderSortY = (entity) => {
  if (!Number.isFinite(entity?.y)) {
    return 0;
  }
  return entity.y;
};
