import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { validateTiledWorldAssets } from "../server/validateTiledWorld.js";

const createPngHeader = (width, height) => {
  const header = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
};

const createFixtureMap = () => ({
  infinite: true,
  orientation: "orthogonal",
  tileheight: 64,
  tilewidth: 64,
  layers: [
    {
      chunks: [
        {
          data: [1, ...Array(255).fill(0)],
          height: 16,
          width: 16,
          x: 0,
          y: 0,
        },
      ],
      name: "ground",
      type: "tilelayer",
    },
  ],
  tilesets: [{ firstgid: 1, source: "fixture.tsj" }],
});

const createFixtureTileset = () => ({
  columns: 1,
  image: "fixture.png",
  imageheight: 64,
  imagewidth: 64,
  margin: 0,
  name: "fixture",
  spacing: 0,
  tilecount: 1,
  tileheight: 64,
  tilewidth: 64,
});

const writeFixture = async (directory, map, tileset = createFixtureTileset()) => {
  await Promise.all([
    writeFile(join(directory, "world_z0.tmj"), JSON.stringify(map)),
    writeFile(join(directory, "fixture.tsj"), JSON.stringify(tileset)),
    writeFile(join(directory, "fixture.png"), createPngHeader(64, 64)),
  ]);
};

test("current Tiled world has no blocking validation errors", async () => {
  const report = await validateTiledWorldAssets();

  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.mapCount, 2);
  assert.ok(report.stats.usedTileCount > 0);
});

test("valid Tiled fixture passes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "nonameyet-tiled-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFixture(directory, createFixtureMap());

  const report = await validateTiledWorldAssets({ mapsDirectory: directory });

  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.usedTileCount, 1);
});

test("validator rejects unknown layers, malformed chunks and invalid GIDs", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "nonameyet-tiled-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const map = createFixtureMap();
  map.layers[0].name = "groundBorderTypo";
  map.layers.push({
    chunks: [{ data: [2], height: 1, width: 1, x: 1, y: 0 }],
    name: "ground",
    type: "tilelayer",
  });
  map.layers.push({
    chunks: [{ data: [2, ...Array(255).fill(0)], height: 16, width: 16, x: 0, y: 0 }],
    name: "walls",
    type: "tilelayer",
  });
  map.layers.push({
    name: "npcs",
    objects: [
      {
        id: 1,
        properties: [{ name: "npcId", value: "typoNpc" }],
        x: 0,
        y: 0,
      },
    ],
    type: "objectgroup",
  });
  await writeFixture(directory, map);

  const report = await validateTiledWorldAssets({ mapsDirectory: directory });
  const messages = report.errors.map((error) => error.message).join("\n");

  assert.match(messages, /Tile layer inconnu: groundBorderTypo/);
  assert.match(messages, /chunk attendu en 16x16/);
  assert.match(messages, /GID 2 ne correspond a aucune tile valide/);
  assert.match(messages, /npcId inconnu "typoNpc"/);
});

test("validator rejects used tilesets whose PNG metadata is stale", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "nonameyet-tiled-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tileset = createFixtureTileset();
  tileset.imagewidth = 128;
  await writeFixture(directory, createFixtureMap(), tileset);

  const report = await validateTiledWorldAssets({ mapsDirectory: directory });

  assert.match(report.errors.map((error) => error.message).join("\n"), /PNG 64x64, metadata 128x64/);
});
