import { readFile, readdir } from "node:fs/promises";

import { importTiledMapIntoWorldMaps } from "../src/tiledWorldImporter.js";
import { hydrateTiledMapTilesets } from "../src/world/tiledMapHydration.js";
import { formatTiledWorldValidationReport, validateTiledWorldAssets } from "./validateTiledWorld.js";

const tiledMapsDirectory = new URL("../src/assets/maps/tiled/", import.meta.url);
const tilesetsDirectory = new URL("../src/assets/tilesets/", import.meta.url);
let tiledWorldValidationPromise = null;

const ensureTiledWorldAssetsAreValid = async () => {
  tiledWorldValidationPromise ??= validateTiledWorldAssets({ mapsDirectory: tiledMapsDirectory });
  const report = await tiledWorldValidationPromise;
  if (report.errors.length > 0) {
    throw new Error(`Validation Tiled echouee:\n${formatTiledWorldValidationReport(report)}`);
  }
};

const loadTilesetEntriesFromDirectory = async (directory) => {
  const fileNames = (await readdir(directory)).filter((fileName) => fileName.endsWith(".tsj"));
  return Promise.all(fileNames.map(async (fileName) => [fileName, await readFile(new URL(fileName, directory), "utf8")]));
};

const loadTilesetRawByFileName = async () => {
  const [sharedTilesets, mapTilesets] = await Promise.all([
    loadTilesetEntriesFromDirectory(tilesetsDirectory),
    loadTilesetEntriesFromDirectory(tiledMapsDirectory),
  ]);
  return new Map([...sharedTilesets, ...mapTilesets]);
};

export const loadServerWorldMaps = async () => {
  await ensureTiledWorldAssetsAreValid();
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
