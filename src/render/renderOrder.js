import { WORLD_RENDER_LAYER_SIZE } from "../core/gameConstants.js";

const WORLD_RENDER_Z_INDEX_BASE = 1000000;

export const WORLD_ROOT_RENDER_Z_INDEX = Object.freeze({
  mapBelow: 0,
  doorLower: 10,
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

export const getEntityRenderSortY = (entity) => {
  if (!Number.isFinite(entity?.y)) {
    return 0;
  }
  return entity.y;
};
