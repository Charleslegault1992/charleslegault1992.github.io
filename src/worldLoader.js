/* ==================================================== */
//#region     -----  IMPORTS  -----
/* ==================================================== */
import worldZMinus1Raw from "./assets/maps/tiled/world_z-1.tmj?raw";
import worldZ0Raw from "./assets/maps/tiled/world_z0.tmj?raw";
import { importTiledMapIntoWorldMaps } from "./tiledWorldImporter.js";
//#endregion  -----  IMPORTS  -----

/* ==================================================== */
//#region     -----  ASSETS - MODULES VITE  -----
/* ==================================================== */
const tilesetRawModulesByPath = import.meta.glob("./assets/tilesets/*.tsj", {
  query: "?raw",
  import: "default",
  eager: true,
});
//#endregion  -----  ASSETS - MODULES VITE  -----

/* ==================================================== */
//#region     -----  OUTILS - PATHS  -----
/* ==================================================== */
const getFileNameFromPath = (path) => {
  if (typeof path !== "string" || path === "") {
    return null;
  }
  return path.split("/").at(-1);
};
//#endregion  -----  OUTILS - PATHS  -----

/* ==================================================== */
//#region     -----  TILESETS - HYDRATATION  -----
/* ==================================================== */
const createTilesetRawByFileName = () => {
  const tilesetRawByFileName = new Map();
  for (const [path, raw] of Object.entries(tilesetRawModulesByPath)) {
    const fileName = getFileNameFromPath(path);
    if (fileName) {
      tilesetRawByFileName.set(fileName, raw);
    }
  }
  return tilesetRawByFileName;
};

const hydrateTiledMapTilesets = (tiledMap, tilesetRawByFileName) => {
  if (!Array.isArray(tiledMap?.tilesets) || !(tilesetRawByFileName instanceof Map)) {
    return null;
  }
  const hydratedTilesets = [];

  for (const tilesetRef of tiledMap.tilesets) {
    const path = tilesetRef.source;
    const fileName = getFileNameFromPath(path);
    if (!fileName) {
      return null;
    }
    const rawData = tilesetRawByFileName.get(fileName);
    if (!rawData) {
      return null;
    }
    const tilesetData = JSON.parse(rawData);
    const fullTileset = {
      ...tilesetData,
      ...tilesetRef,
    };

    hydratedTilesets.push(fullTileset);
  }

  return {
    ...tiledMap,
    tilesets: hydratedTilesets,
  };
};
//#endregion  -----  TILESETS - HYDRATATION  -----

/* ==================================================== */
//#region     -----  WORLD MAPS - LOAD  -----
/* ==================================================== */
export const loadWorldMaps = () => {
  const tilesetRawByFileName = createTilesetRawByFileName();
  const worldMapsByZ = new Map();
  const worldZ0 = JSON.parse(worldZ0Raw);
  const worldZMinus1 = JSON.parse(worldZMinus1Raw);
  const hydratedWorldZ0 = hydrateTiledMapTilesets(worldZ0, tilesetRawByFileName);
  const hydratedWorldZMinus1 = hydrateTiledMapTilesets(worldZMinus1, tilesetRawByFileName);
  importTiledMapIntoWorldMaps(worldMapsByZ, hydratedWorldZ0, "world_z0.tmj");
  importTiledMapIntoWorldMaps(worldMapsByZ, hydratedWorldZMinus1, "world_z-1.tmj");
  return worldMapsByZ;
};
//#endregion  -----  WORLD MAPS - LOAD  -----

/* ==================================================== */
//#region     -----  WORLD MAPS - DIAGNOSTICS  -----
/* ==================================================== */
export const getWorldMapsDebugSummary = (worldMapsByZ) => {
  const maps = [];
  for (const worldMap of worldMapsByZ.values()) {
    let transitions = 0;
    let spawns = 0;
    let interactables = 0;
    let npcs = 0;
    for (const chunk of worldMap.chunksByKey.values()) {
      transitions += chunk.transitions.length;
      spawns += chunk.spawns.length;
      interactables += chunk.interactables.length;
      npcs += chunk.npcs.length;
    }
    maps.push({
      z: worldMap.z,
      chunkCount: worldMap.chunksByKey.size,
      transitions,
      spawns,
      interactables,
      npcs,
    });
  }
  return {
    mapCount: worldMapsByZ.size,
    maps,
  };
};
//#endregion  -----  WORLD MAPS - DIAGNOSTICS  -----
