import assert from "node:assert/strict";
import test from "node:test";

import { createVerticalFallbackPlan, getLowerWorldMaps } from "../src/world/verticalFloorComposition.js";

const createWorldMap = (z, ground) => {
  const chunk = {
    z,
    chunkX: 0,
    chunkY: 0,
    layers: { ground },
  };
  return {
    z,
    chunksByKey: new Map([[`${z}:0:0`, chunk]]),
  };
};

test("lower maps are ordered from the nearest floor to the deepest floor", () => {
  const maps = new Map([
    [-2, createWorldMap(-2, [1, 1, 1, 1])],
    [1, createWorldMap(1, [1, 1, 1, 1])],
    [-1, createWorldMap(-1, [1, 1, 1, 1])],
    [0, createWorldMap(0, [1, 1, 1, 1])],
  ]);

  assert.deepEqual(
    getLowerWorldMaps(maps, 1).map((worldMap) => worldMap.z),
    [0, -1, -2],
  );
});

test("transparent current tiles use only the nearest lower floor with a surface", () => {
  const currentMap = createWorldMap(1, [10, 0, 0, 13]);
  const groundMap = createWorldMap(0, [20, 21, 0, 23]);
  const caveMap = createWorldMap(-1, [30, 31, 32, 33]);
  const maps = new Map([
    [1, currentMap],
    [0, groundMap],
    [-1, caveMap],
  ]);

  const plan = createVerticalFallbackPlan({
    worldMapsByZ: maps,
    currentWorldMap: currentMap,
    chunkX: 0,
    chunkY: 0,
    chunkSizeTiles: 2,
  });

  assert.equal(plan.fallbackTileCount, 2);
  assert.equal(plan.sourcesByTileIndex[0], null);
  assert.equal(plan.sourcesByTileIndex[1].worldMap.z, 0);
  assert.equal(plan.sourcesByTileIndex[2].worldMap.z, -1);
  assert.equal(plan.sourcesByTileIndex[3], null);
});

test("a plan is omitted when the current chunk has no transparent surface tiles", () => {
  const currentMap = createWorldMap(0, [1, 1, 1, 1]);
  const caveMap = createWorldMap(-1, [2, 2, 2, 2]);

  assert.equal(
    createVerticalFallbackPlan({
      worldMapsByZ: new Map([
        [0, currentMap],
        [-1, caveMap],
      ]),
      currentWorldMap: currentMap,
      chunkX: 0,
      chunkY: 0,
      chunkSizeTiles: 2,
    }),
    null,
  );
});
