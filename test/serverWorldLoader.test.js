import assert from "node:assert/strict";
import test from "node:test";

import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";

test("Node loads the same Tiled floors without Vite", async () => {
  const worldMapsByZ = await loadServerWorldMaps();

  assert.deepEqual([...worldMapsByZ.keys()].sort((first, second) => first - second), [-1, 0]);
  assert.ok(worldMapsByZ.get(0).chunksByKey.size > 0);
  assert.ok(worldMapsByZ.get(-1).chunksByKey.size > 0);
  assert.ok(worldMapsByZ.get(0).tilesets.length > 0);
});

test("Node imports ground borders, current NPC positions and boat metadata", async () => {
  const worldMap = (await loadServerWorldMaps()).get(0);
  const groundBorderTileCount = [...worldMap.chunksByKey.values()].reduce(
    (count, chunk) => count + chunk.layers.groundBorders.filter((gid) => gid > 0).length,
    0,
  );
  const npcPositions = new Map();
  for (const chunk of worldMap.chunksByKey.values()) {
    for (const npc of chunk.npcs) {
      npcPositions.set(npc.properties.npcId, [npc.col, npc.row]);
    }
  }
  const boatTileset = worldMap.tilesets.find((tileset) => tileset.name === "boat");

  assert.equal(groundBorderTileCount, 597);
  assert.deepEqual(Object.fromEntries(npcPositions), {
    kay: [7, -6],
    ben: [-19, 10],
    kev: [-19, 0],
    charles: [-32, -11],
    dave: [-46, -14],
    jenny: [-78, 40],
    amanda: [-53, 56],
  });
  assert.deepEqual(
    {
      columns: boatTileset.columns,
      tilecount: boatTileset.tilecount,
      imagewidth: boatTileset.imagewidth,
      imageheight: boatTileset.imageheight,
    },
    { columns: 7, tilecount: 112, imagewidth: 448, imageheight: 1024 },
  );
});
