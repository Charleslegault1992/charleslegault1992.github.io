import assert from "node:assert/strict";
import test from "node:test";

import { getEntityRenderSortY, WORLD_ROOT_RENDER_Z_INDEX } from "../src/render/renderOrder.js";

test("vertical upward movement keeps the previous render row until arrival", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 64, y: 64, oldY: 128, renderY: 96 }), 128);
});

test("diagonal upward movement keeps the previous render row until arrival", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 64, oldY: 128, renderY: 96 }), 128);
});

test("top world layers always render after entities", () => {
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.top > WORLD_ROOT_RENDER_Z_INDEX.entity);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.doorUpper > WORLD_ROOT_RENDER_Z_INDEX.top);
  assert.ok(WORLD_ROOT_RENDER_Z_INDEX.roof > WORLD_ROOT_RENDER_Z_INDEX.doorUpper);
});
