import { WORLD_RENDER_LAYER_SIZE } from "../core/gameConstants.js";

const WORLD_RENDER_Z_INDEX_BASE = 1000000;

export const getWorldRenderZIndex = (worldY, localLayer = 0) => {
  return WORLD_RENDER_Z_INDEX_BASE + worldY * WORLD_RENDER_LAYER_SIZE + localLayer;
};

export const getEntityRenderSortY = (entity) => {
  if (!Number.isFinite(entity?.y)) {
    return 0;
  }

  const isStillMovingUp =
    Number.isFinite(entity.oldY) &&
    Number.isFinite(entity.renderY) &&
    entity.oldY > entity.y &&
    entity.renderY > entity.y;
  const isVerticalMovement =
    !Number.isFinite(entity.oldX) ||
    !Number.isFinite(entity.x) ||
    entity.oldX === entity.x;

  return isStillMovingUp && isVerticalMovement ? entity.oldY : entity.y;
};
