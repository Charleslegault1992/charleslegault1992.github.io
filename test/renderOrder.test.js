import assert from "node:assert/strict";
import test from "node:test";

import { TILE_SIZE, WORLD_RENDER_LAYER_CREATURE } from "../src/core/gameConstants.js";
import {
  getDoorRenderZIndexes,
  getEntityRenderSortY,
  getWorldRenderZIndex,
  WORLD_ROOT_RENDER_Z_INDEX,
} from "../src/render/renderOrder.js";

test("vertical movement uses the logical destination row for the complete step", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 64, y: 64, oldY: 128, renderY: 96 }), 64);
});

test("diagonal movement uses the logical destination row for the complete step", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 64, oldY: 128, renderY: 96 }), 64);
});

test("stationary entities fall back to their logical row", () => {
  assert.equal(getEntityRenderSortY({ y: 128, renderY: null }), 128);
});

test("a door surrounds a creature on its tile but stays entirely behind a creature one tile below", () => {
  const doorY = 128;
  const doorHeight = TILE_SIZE * 2;
  const doorTileY = doorY + doorHeight - TILE_SIZE;
  const doorZIndexes = getDoorRenderZIndexes(doorY, doorHeight);
  const creatureOnDoor = getWorldRenderZIndex(doorTileY, WORLD_RENDER_LAYER_CREATURE);
  const creatureBelowDoor = getWorldRenderZIndex(doorTileY + TILE_SIZE, WORLD_RENDER_LAYER_CREATURE);

  assert.ok(doorZIndexes.lower < creatureOnDoor);
  assert.ok(doorZIndexes.upper > creatureOnDoor);
  assert.ok(doorZIndexes.upper < creatureBelowDoor);
});

test("top world layers always render after entities", () => {
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.top > WORLD_ROOT_RENDER_Z_INDEX.entity);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.roof > WORLD_ROOT_RENDER_Z_INDEX.top);
});
