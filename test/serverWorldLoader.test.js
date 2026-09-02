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

  assert.ok(groundBorderTileCount > 0);
  assert.deepEqual([...npcPositions.keys()].sort(), ["amanda", "ben", "charles", "dave", "jenny", "kay", "kev"]);
  for (const [col, row] of npcPositions.values()) {
    assert.ok(Number.isInteger(col));
    assert.ok(Number.isInteger(row));
  }
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
