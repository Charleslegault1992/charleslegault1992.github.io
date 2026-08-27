import assert from "node:assert/strict";
import test from "node:test";

import { getEntityRenderSortY } from "../src/render/renderOrder.js";

test("vertical upward movement keeps the previous render row until arrival", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 64, y: 64, oldY: 128, renderY: 96 }), 128);
});

test("diagonal upward movement also keeps the previous render row until arrival", () => {
  assert.equal(getEntityRenderSortY({ x: 64, oldX: 0, y: 64, oldY: 128, renderY: 96 }), 128);
});
