import assert from "node:assert/strict";
import test from "node:test";

import { TILE_SIZE } from "../src/core/gameConstants.js";
import { findTransitionAtTile, isPlayerNearTiledObject } from "../src/world/tiledWorldObjects.js";
import { applyPlayerWorldTransitionState } from "../src/world/worldTransitions.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";

test("Tiled world objects are found by their logical tile", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const transition = findTransitionAtTile(worldMapsByZ.get(0), 14, 16);

  assert.equal(transition.properties.transitionType, "ropeDown");
  assert.equal(isPlayerNearTiledObject({ x: 13 * TILE_SIZE, y: 16 * TILE_SIZE, z: 0 }, transition, 1), true);
  assert.equal(isPlayerNearTiledObject({ x: 10 * TILE_SIZE, y: 16 * TILE_SIZE, z: 0 }, transition, 1), false);
});

test("world transition state is independent from Pixi and the DOM", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const transition = findTransitionAtTile(worldMapsByZ.get(0), 14, 16);
  const player = { uid: "player:test", x: 14 * TILE_SIZE, y: 16 * TILE_SIZE, z: 0 };

  const result = applyPlayerWorldTransitionState(player, transition, worldMapsByZ);

  assert.equal(result.success, true);
  assert.deepEqual({ x: player.x, y: player.y, z: player.z }, { x: 14 * TILE_SIZE, y: 16 * TILE_SIZE, z: -1 });
  assert.equal(result.events[0].type, "player-world-transitioned");
});
