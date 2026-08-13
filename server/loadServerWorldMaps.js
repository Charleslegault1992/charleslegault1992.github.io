import { readFile, readdir } from "node:fs/promises";

import { importTiledMapIntoWorldMaps } from "../src/tiledWorldImporter.js";
import { hydrateTiledMapTilesets } from "../src/world/tiledMapHydration.js";

const tiledMapsDirectory = new URL("../src/assets/maps/tiled/", import.meta.url);
const tilesetsDirectory = new URL("../src/assets/tilesets/", import.meta.url);

const loadTilesetRawByFileName = async () => {
  const fileNames = (await readdir(tilesetsDirectory)).filter((fileName) => fileName.endsWith(".tsj"));
  const entries = await Promise.all(
    fileNames.map(async (fileName) => [fileName, await readFile(new URL(fileName, tilesetsDirectory), "utf8")]),
  );
  return new Map(entries);
};

export const loadServerWorldMaps = async () => {
  const tilesetRawByFileName = await loadTilesetRawByFileName();
  const mapFileNames = (await readdir(tiledMapsDirectory)).filter((fileName) => /^world_z-?\d+\.tmj$/.test(fileName));
  const worldMapsByZ = new Map();

  for (const fileName of mapFileNames) {
    const rawMap = await readFile(new URL(fileName, tiledMapsDirectory), "utf8");
    const tiledMap = hydrateTiledMapTilesets(JSON.parse(rawMap), tilesetRawByFileName);
    if (!tiledMap || !importTiledMapIntoWorldMaps(worldMapsByZ, tiledMap, fileName)) {
      throw new Error(`Unable to import Tiled map: ${fileName}`);
    }
  }
  return worldMapsByZ;
};
