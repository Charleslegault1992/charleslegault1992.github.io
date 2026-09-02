import { TILE_SIZE, WORLD_RENDER_LAYER_CREATURE, WORLD_RENDER_LAYER_SIZE } from "../core/gameConstants.js";

const WORLD_RENDER_Z_INDEX_BASE = 1000000;

export const WORLD_ROOT_RENDER_Z_INDEX = Object.freeze({
  verticalFloorUnderlay: -10,
  mapBelow: 0,
  itemUseTarget: 20,
  entity: 30,
  projectile: 40,
  top: 50,
  doorUpper: 60,
  roof: 70,
  feedbackEffect: 80,
});

export const getWorldRenderZIndex = (worldY, localLayer = 0) => {
  return WORLD_RENDER_Z_INDEX_BASE + worldY * WORLD_RENDER_LAYER_SIZE + localLayer;
};

export const getDoorLowerRenderZIndex = (doorY, doorHeight) => {
  const doorSortY = doorY + Math.max(0, doorHeight - TILE_SIZE);
  return getWorldRenderZIndex(doorSortY, WORLD_RENDER_LAYER_CREATURE - 1);
};

export const getEntityRenderSortY = (entity) => {
  if (!Number.isFinite(entity?.y)) {
    return 0;
  }
  if (Number.isFinite(entity.oldY) && Number.isFinite(entity.renderY) && entity.renderY !== entity.y) {
    return Math.min(entity.oldY, entity.y);
  }
  return entity.y;
};
