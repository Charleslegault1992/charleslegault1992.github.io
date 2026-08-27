import assert from "node:assert/strict";
import test from "node:test";

import { getEntityRenderSortY, WORLD_ROOT_RENDER_Z_INDEX } from "../src/render/renderOrder.js";

test("vertical movement sorts from the current interpolated foot position", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 64, y: 64, oldY: 128, renderY: 96 }), 96);
});

test("diagonal movement sorts from the current interpolated foot position", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 64, oldY: 128, renderY: 96 }), 96);
});

test("stationary entities fall back to their logical row", () => {
  assert.equal(getEntityRenderSortY({ y: 128, renderY: null }), 128);
});

test("top world layers always render after entities", () => {
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.top > WORLD_ROOT_RENDER_Z_INDEX.entity);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.doorUpper > WORLD_ROOT_RENDER_Z_INDEX.top);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.roof > WORLD_ROOT_RENDER_Z_INDEX.doorUpper);
});
