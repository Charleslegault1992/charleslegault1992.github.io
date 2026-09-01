import assert from "node:assert/strict";
import test from "node:test";

import { TILE_SIZE, WORLD_RENDER_LAYER_CREATURE } from "../src/core/gameConstants.js";
import {
  getDoorLowerRenderZIndex,
  getEntityRenderSortY,
  getWorldRenderZIndex,
  WORLD_ROOT_RENDER_Z_INDEX,
} from "../src/render/renderOrder.js";

test("upward movement stays above depth tiles from its source row during interpolation", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 64, y: 64, oldY: 128, renderY: 96 }), 128);
});

test("upward diagonal movement stays above depth tiles from its source row", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 64, oldY: 128, renderY: 96 }), 128);
});

test("downward diagonal movement uses the southern row during interpolation", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 128, oldY: 64, renderY: 96 }), 128);
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 128, oldY: 64, renderY: 128 }), 128);
});

test("stationary entities fall back to their logical row", () => {
  assert.equal(getEntityRenderSortY({ y: 128, renderY: null }), 128);
});

test("the lower door section stays behind a creature on the collision tile", () => {
  const doorY = 128;
  const doorHeight = TILE_SIZE * 2;
  const doorTileY = doorY + doorHeight - TILE_SIZE;
  const lowerDoorZIndex = getDoorLowerRenderZIndex(doorY, doorHeight);
  const creatureOnDoor = getWorldRenderZIndex(doorTileY, WORLD_RENDER_LAYER_CREATURE);
  assert.ok(lowerDoorZIndex < creatureOnDoor);
});

test("top world layers always render after entities", () => {
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.verticalFloorUnderlay < WORLD_ROOT_RENDER_Z_INDEX.mapBelow);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.top > WORLD_ROOT_RENDER_Z_INDEX.entity);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.doorUpper > WORLD_ROOT_RENDER_Z_INDEX.top);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.roof > WORLD_ROOT_RENDER_Z_INDEX.doorUpper);
});
