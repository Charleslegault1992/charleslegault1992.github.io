/* ==================================================== */
//#region     -----  IMPORTS  -----
/* ==================================================== */
import { importTiledMapIntoWorldMaps } from "./tiledWorldImporter.js";
import { getFileNameFromPath, hydrateTiledMapTilesets } from "./world/tiledMapHydration.js";
//#endregion  -----  IMPORTS  -----

/* ==================================================== */
//#region     -----  ASSETS - MODULES VITE  -----
/* ==================================================== */
const tilesetRawModulesByPath = import.meta.glob(["./assets/tilesets/*.tsj", "./assets/maps/tiled/*.tsj"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const tiledMapRawModulesByPath = import.meta.glob("./assets/maps/tiled/world_z*.tmj", {
  query: "?raw",
  import: "default",
  eager: true,
});
//#endregion  -----  ASSETS - MODULES VITE  -----

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

//#endregion  -----  TILESETS - HYDRATATION  -----

/* ==================================================== */
//#region     -----  WORLD MAPS - LOAD  -----
/* ==================================================== */
export const loadWorldMaps = () => {
  const tilesetRawByFileName = createTilesetRawByFileName();
  const worldMapsByZ = new Map();
  for (const [path, rawMap] of Object.entries(tiledMapRawModulesByPath)) {
    const fileName = getFileNameFromPath(path);
    if (!fileName) {
      continue;
    }
    const tiledMap = JSON.parse(rawMap);
    const hydratedMap = hydrateTiledMapTilesets(tiledMap, tilesetRawByFileName);
    if (hydratedMap) {
      importTiledMapIntoWorldMaps(worldMapsByZ, hydratedMap, fileName);
    }
  }
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
