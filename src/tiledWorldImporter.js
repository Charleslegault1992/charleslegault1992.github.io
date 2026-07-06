/* ==================================================== */
//#region     -----  CONFIG  -----
/* ==================================================== */
/* ---------- MAP / CHUNKS ---------- */
const TILE_SIZE = 64;
const CHUNK_SIZE_TILES = 16;
//#endregion  -----  CONFIG  -----

/* ==================================================== */
//#region     -----  OUTILS - FILE NAME  -----
/* ==================================================== */
/* ---------- Z DEPUIS NOM DE FICHIER ---------- */
export const getMapZFromFileName = (fileName) => {
  if (!fileName) {
    return null;
  }
  return parseInt(fileName.split("_z")[1].split(".")[0], 10);
};
//#endregion  -----  OUTILS - FILE NAME  -----

/* ==================================================== */
//#region     -----  WORLD MAP  -----
/* ==================================================== */
/* ---------- CREATION WORLD MAP ---------- */
export const createEmptyWorldMap = (z) => {
  if (!Number.isFinite(z)) {
    return null;
  }
  return {
    z,
    chunksByKey: new Map(),
  };
};

/* ---------- ACCES WORLD MAP ---------- */
const getOrCreateWorldMap = (worldMapsByZ, z) => {
  if (!(worldMapsByZ instanceof Map) || !Number.isFinite(z)) {
    return null;
  }
  if (worldMapsByZ.has(z)) {
    return worldMapsByZ.get(z);
  }
  const emptyWorldMap = createEmptyWorldMap(z);
  if (!emptyWorldMap) {
    return null;
  }
  worldMapsByZ.set(z, emptyWorldMap);
  return worldMapsByZ.get(z);
};
//#endregion  -----  WORLD MAP  -----

/* ==================================================== */
//#region     -----  CHUNKS  -----
/* ==================================================== */
/* ---------- KEY ---------- */
export const getWorldChunkKey = (z, chunkX, chunkY) => {
  if (!isFinite(z) || !isFinite(chunkX) || !isFinite(chunkY)) {
    return null;
  }
  return `${z}:${chunkX}:${chunkY}`;
};

/* ---------- POSITION GRILLE DEPUIS TILED ---------- */
const getTiledChunkGridPosition = (tiledChunk) => {
  const originCol = tiledChunk?.x ?? null;
  const originRow = tiledChunk?.y ?? null;
  const width = tiledChunk?.width ?? null;
  const height = tiledChunk?.height ?? null;

  if (
    !Number.isFinite(originCol) ||
    !Number.isFinite(originRow) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  const chunkX = originCol / width;
  const chunkY = originRow / height;

  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
    return null;
  }

  return { chunkX, chunkY };
};

/* ---------- CREATION CHUNK ---------- */
const createEmptyWorldChunk = (z, chunkX, chunkY) => {
  return {
    z,
    chunkX,
    chunkY,
    layers: {
      ground: [],
      groundDetails: [],
      walls: [],
      objects: [],
      top: [],
      collision: [],
    },
    interactables: [],
    transitions: [],
    spawns: [],
  };
};

/* ---------- ACCES CHUNK DEPUIS CHUNK TILED ---------- */
const getOrCreateWorldChunk = (chunksByKey, z, tiledChunk) => {
  if (!(chunksByKey instanceof Map) || !Number.isFinite(z)) {
    return null;
  }
  const chunkGridPosition = getTiledChunkGridPosition(tiledChunk);
  if (!Number.isFinite(chunkGridPosition?.chunkX) || !Number.isFinite(chunkGridPosition?.chunkY)) {
    return null;
  }
  const chunkKey = getWorldChunkKey(z, chunkGridPosition.chunkX, chunkGridPosition.chunkY);
  if (!chunkKey) {
    return null;
  }
  if (!chunksByKey.has(chunkKey)) {
    chunksByKey.set(chunkKey, createEmptyWorldChunk(z, chunkGridPosition.chunkX, chunkGridPosition.chunkY));
  }
  return chunksByKey.get(chunkKey);
};

/* ---------- ACCES CHUNK DEPUIS POSITION GRILLE ---------- */
const getOrCreateWorldChunkByGridPosition = (chunksByKey, z, chunkX, chunkY) => {
  if (!(chunksByKey instanceof Map) || !Number.isFinite(z) || !Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
    return null;
  }

  const chunkKey = getWorldChunkKey(z, chunkX, chunkY);
  if (!chunkKey) {
    return null;
  }
  if (!chunksByKey.has(chunkKey)) {
    chunksByKey.set(chunkKey, createEmptyWorldChunk(z, chunkX, chunkY));
  }
  return chunksByKey.get(chunkKey);
};
//#endregion  -----  CHUNKS  -----

/* ==================================================== */
//#region     -----  IMPORT - TILE LAYERS  -----
/* ==================================================== */
/* ---------- CHUNKS TILE LAYER ---------- */
const importTiledTileLayerChunks = (worldMap, tiledLayer) => {
  if (
    !Number.isFinite(worldMap?.z) ||
    !(worldMap?.chunksByKey instanceof Map) ||
    !tiledLayer?.chunks ||
    !tiledLayer?.name
  ) {
    return null;
  }
  const layerName = tiledLayer.name;

  for (const tiledChunk of tiledLayer.chunks) {
    const worldChunk = getOrCreateWorldChunk(worldMap.chunksByKey, worldMap.z, tiledChunk);
    if (!worldChunk || !(layerName in worldChunk.layers) || !Array.isArray(tiledChunk.data)) {
      continue;
    }
    worldChunk.layers[layerName] = [...tiledChunk.data];
  }
};
//#endregion  -----  IMPORT - TILE LAYERS  -----

/* ==================================================== */
//#region     -----  IMPORT - OBJECT LAYERS  -----
/* ==================================================== */
/* ---------- PROPERTIES TILED ---------- */
const getTiledObjectProperties = (tiledObject) => {
  if (!Array.isArray(tiledObject?.properties)) {
    return {};
  }
  const objectProperties = {};
  for (const property of tiledObject.properties) {
    if (property?.name) {
      objectProperties[property.name] = property.value;
    }
  }
  return objectProperties;
};

/* ---------- OBJETS OBJECT LAYER ---------- */
const importTiledObjectLayerObjects = (worldMap, tiledLayer) => {
  if (
    !Number.isFinite(worldMap?.z) ||
    !(worldMap?.chunksByKey instanceof Map) ||
    !tiledLayer?.objects ||
    !tiledLayer?.name
  ) {
    return null;
  }
  const layerName = tiledLayer.name;

  for (const tiledObject of tiledLayer.objects) {
    const col = Math.floor(tiledObject.x / TILE_SIZE);
    const row = Math.floor(tiledObject.y / TILE_SIZE);
    const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
    const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
    const worldChunk = getOrCreateWorldChunkByGridPosition(worldMap.chunksByKey, worldMap.z, chunkX, chunkY);
    if (!worldChunk || !(layerName in worldChunk)) {
      continue;
    }
    const cleanTiledObject = {
      col,
      row,
      x: tiledObject.x,
      y: tiledObject.y,
      width: tiledObject.width,
      height: tiledObject.height,
      properties: getTiledObjectProperties(tiledObject),
    };
    worldChunk[layerName].push(cleanTiledObject);
  }
};
//#endregion  -----  IMPORT - OBJECT LAYERS  -----

/* ==================================================== */
//#region     -----  IMPORT - MAP COMPLETE  -----
/* ==================================================== */
/* ---------- TILED MAP VERS WORLD MAPS ---------- */
export const importTiledMapIntoWorldMaps = (worldMapsByZ, tiledMap, fileName) => {
  if (!(worldMapsByZ instanceof Map)) {
    return null;
  }
  const z = getMapZFromFileName(fileName);
  if (!Number.isInteger(z)) {
    return null;
  }
  const worldMap = getOrCreateWorldMap(worldMapsByZ, z);
  if (!worldMap) {
    return null;
  }
  if (!Array.isArray(tiledMap.layers)) {
    return null;
  }
  for (const tiledLayer of tiledMap.layers) {
    if (tiledLayer.type === "tilelayer") {
      importTiledTileLayerChunks(worldMap, tiledLayer);
    } else if (tiledLayer.type === "objectgroup") {
      importTiledObjectLayerObjects(worldMap, tiledLayer);
    }
  }
  return worldMap;
};
//#endregion  -----  IMPORT - MAP COMPLETE  -----
