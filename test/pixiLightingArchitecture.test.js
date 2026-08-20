import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getPixiRendererPreference,
  getRequestedPixiRenderer,
} from "../src/render/pixiRendererPreference.js";

test("Pixi renderer preference keeps a GPU-only fallback path", () => {
  assert.deepEqual(getPixiRendererPreference(null), ["webgl", "webgpu"]);
  assert.deepEqual(getPixiRendererPreference("webgl"), ["webgl", "webgpu"]);
  assert.deepEqual(getPixiRendererPreference("webgpu"), ["webgpu", "webgl"]);
});

test("Pixi renderer can be selected explicitly for real backend diagnostics", () => {
  assert.equal(getRequestedPixiRenderer("?pixiRenderer=webgpu"), "webgpu");
  assert.equal(getRequestedPixiRenderer("?pixiRenderer=webgl"), "webgl");
  assert.equal(getRequestedPixiRenderer("?pixiRenderer=canvas"), null);
});

test("the runtime lighting path contains no Canvas2D implementation", async () => {
  const [mainSource, rendererSource] = await Promise.all([
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pixiRenderer.js", import.meta.url), "utf8"),
  ]);
  const lightingStart = rendererSource.indexOf("//#region     -----  PIXI - LUMIERE");
  const lightingEnd = rendererSource.indexOf("//#endregion  -----  PIXI - LUMIERE", lightingStart);
  const lightingSource = rendererSource.slice(lightingStart, lightingEnd);

  assert.equal(mainSource.includes("lightCanvas"), false);
  assert.equal(lightingSource.includes('getContext("2d")'), false);
  assert.equal(lightingSource.includes("createRadialGradient"), false);
  assert.equal(lightingSource.includes("destination-out"), false);
  assert.equal(lightingSource.includes("RenderTexture.create"), true);
});
