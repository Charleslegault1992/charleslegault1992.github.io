import assert from "node:assert/strict";
import test from "node:test";

import { decodeTiledGid, getTileRenderDataFromGid } from "../src/tiledGidResolver.js";

const tilesets = [
  {
    firstgid: 100,
    columns: 4,
    tilecount: 8,
    tilewidth: 64,
    tileheight: 64,
    spacing: 0,
    margin: 0,
  },
];

test("Tiled GID flags are removed without changing the selected tile", () => {
  const cleanGid = 103;
  const flagCombinations = [
    0,
    0x80000000,
    0x40000000,
    0x20000000,
    0xc0000000,
    0xa0000000,
    0x60000000,
    0xe0000000,
  ];

  for (const flags of flagCombinations) {
    const rawGid = (cleanGid | flags) >>> 0;
    const renderData = getTileRenderDataFromGid(tilesets, rawGid);
    assert.equal(renderData.gid, cleanGid);
    assert.equal(renderData.localTileId, 3);
    assert.equal(renderData.sourceX, 192);
    assert.equal(renderData.sourceY, 0);
  }
});

test("Tiled GID decoding exposes each orthogonal transformation flag", () => {
  assert.deepEqual(decodeTiledGid((103 | 0xe0000000) >>> 0), {
    gid: 103,
    flipHorizontal: true,
    flipVertical: true,
    flipDiagonal: true,
    rotateHexagonal120: false,
  });
});

test("GIDs outside the declared tileset tile count are rejected", () => {
  assert.equal(getTileRenderDataFromGid(tilesets, 108), null);
});
