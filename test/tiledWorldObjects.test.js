import assert from "node:assert/strict";
import test from "node:test";

import { TILE_SIZE } from "../src/core/gameConstants.js";
import { getDoorData, getDoorVariantData } from "../src/data/doorsDatabase.js";
import {
  findProtectionZoneAtTile,
  findTransitionAtTile,
  isPlayerNearTiledObject,
} from "../src/world/tiledWorldObjects.js";
import { applyPlayerWorldTransitionState } from "../src/world/worldTransitions.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";
import { initializeDoorsFromWorldMaps } from "../src/world/doorModel.js";

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

test("protection zones are resolved from authored Tiled zone objects", () => {
  const worldMap = {
    z: 0,
    chunksByKey: new Map([
      [
        "0:0:0",
        {
          z: 0,
          chunkX: 0,
          chunkY: 0,
          zones: [
            {
              col: 2,
              row: 3,
              width: TILE_SIZE * 2,
              height: TILE_SIZE,
              properties: { zoneType: "protection" },
            },
          ],
        },
      ],
    ]),
  };

  assert.equal(findProtectionZoneAtTile(worldMap, 2, 3)?.properties.zoneType, "protection");
  assert.equal(findProtectionZoneAtTile(worldMap, 4, 3), null);
});

test("house roof zones and doors are imported from Tiled", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const worldMap = worldMapsByZ.get(0);
  const doorsByUid = initializeDoorsFromWorldMaps(worldMapsByZ);
  const lowerDoor = doorsByUid.get("house_01_main_door");
  const upperDoor = doorsByUid.get("house_02_main_door");
  const doorData = getDoorData(lowerDoor?.doorType);
  const lowerDoorData = getDoorVariantData(lowerDoor?.doorType, lowerDoor?.wallSide);
  const upperDoorData = getDoorVariantData(upperDoor?.doorType, upperDoor?.wallSide);
  const roofArea = worldMap.roofAreas.find((area) => area.properties?.roofId === "house_01");
  const roofRevealZone = worldMap.roofRevealZones.find((zone) => zone.properties?.roofId === "house_01");

  assert.ok(roofArea);
  assert.ok(roofRevealZone);
  assert.equal(lowerDoor.doorType, "woodenDoor");
  assert.equal(lowerDoor.wallSide, "lower");
  assert.equal(lowerDoor.isOpen, false);
  assert.equal(upperDoor.wallSide, "upper");
  assert.equal(doorData.tilesetImage, "house1.png");
  assert.deepEqual(lowerDoorData.closed.frame, { x: 1856, y: 128, width: 192, height: 192 });
  assert.deepEqual(lowerDoorData.open.frame, { x: 1856, y: 320, width: 192, height: 192 });
  assert.equal(lowerDoorData.open.offsetX, -128);
  assert.equal(lowerDoorData.open.offsetY, 0);
  assert.deepEqual(upperDoorData.open.frame, { x: 1856, y: 512, width: 192, height: 192 });
  assert.equal(worldMap.interactablesById.get(lowerDoor.doorId)?.properties?.interactableType, "door");

  const chunksWithTopDeco = [...worldMap.chunksByKey.values()].filter((chunk) =>
    chunk.layers.topDeco.some((gid) => gid > 0),
  );
  assert.ok(chunksWithTopDeco.length > 0);
});
