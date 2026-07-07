/* ==================================================== */
//#region     -----  IMPORTS  -----
/* ==================================================== */
import { Application, Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import { getTileRenderDataFromGid } from "./tiledGidResolver.js";
const tilesetImageUrlModulesByPath = import.meta.glob("./assets/tilesets/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});
//#endregion  -----  IMPORTS  -----

/* ==================================================== */
//#region     -----  TOOLS  -----
/* ==================================================== */
const CHUNK_SIZE_TILES = 16;
const TILE_SIZE = 64;

const createTileTextureFromGid = (tilesets, gid) => {
  if (!(tileTextureByCacheKey instanceof Map)) {
    return null;
  }

  const tileRenderData = getTileRenderDataFromGid(tilesets, gid);
  if (!tileRenderData) {
    return null;
  }
  const cacheKey = `${tileRenderData.tileset.source}:${gid}`;
  if (tileTextureByCacheKey.has(cacheKey)) {
    return tileTextureByCacheKey.get(cacheKey);
  }
  const tilesetTexture = getTilesetTexture(tileRenderData.tileset);
  if (!tilesetTexture) {
    return null;
  }
  const frame = new Rectangle(
    tileRenderData.sourceX,
    tileRenderData.sourceY,
    tileRenderData.sourceWidth,
    tileRenderData.sourceHeight,
  );
  const texture = new Texture({
    source: tilesetTexture.source,
    frame,
  });
  tileTextureByCacheKey.set(cacheKey, texture);
  return texture;
};

const createTileSprite = (tilesets, gid, x, y) => {
  if (!Number.isFinite(gid) || gid <= 0) {
    return null;
  }
  const texture = createTileTextureFromGid(tilesets, gid);
  if (!texture) {
    return null;
  }
  const sprite = new Sprite(texture);
  sprite.x = x;
  sprite.y = y;
  return sprite;
};

const renderChunkTileLayer = (chunkContainer, worldMap, chunk, layerName) => {
  if (!chunkContainer || !worldMap?.tilesets || !chunk?.layers || !(layerName in chunk.layers)) {
    return;
  }
  const layerGids = chunk.layers[layerName];
  if (!Array.isArray(layerGids)) {
    return;
  }
  for (const [index, gid] of layerGids.entries()) {
    if (gid <= 0) {
      continue;
    }
    const localCol = index % CHUNK_SIZE_TILES;
    const localRow = Math.floor(index / CHUNK_SIZE_TILES);
    const worldCol = chunk.chunkX * CHUNK_SIZE_TILES + localCol;
    const worldRow = chunk.chunkY * CHUNK_SIZE_TILES + localRow;
    const x = worldCol * TILE_SIZE;
    const y = worldRow * TILE_SIZE;
    const sprite = createTileSprite(worldMap.tilesets, gid, x, y);
    if (sprite) {
      chunkContainer.addChild(sprite);
    }
  }
};

const renderWorldChunk = (worldMap, chunk) => {
  if (!worldMap || !chunk) {
    return null;
  }
  const chunkContainer = new Container();
  chunkContainer.label = `${worldMap.z}:${chunk.chunkX}:${chunk.chunkY}`;
  renderChunkTileLayer(chunkContainer, worldMap, chunk, "ground");
  renderChunkTileLayer(chunkContainer, worldMap, chunk, "groundDetails");
  renderChunkTileLayer(chunkContainer, worldMap, chunk, "walls");
  renderChunkTileLayer(chunkContainer, worldMap, chunk, "objects");
  renderChunkTileLayer(chunkContainer, worldMap, chunk, "top");
  return chunkContainer;
};

const getFileNameFromPath = (path) => {
  if (typeof path !== "string" || path === "") {
    return null;
  }
  return path.split("/").at(-1);
};

const createTilesetImageUrlByFileName = () => {
  const tilesetImageUrlByFileName = new Map();
  for (const [path, url] of Object.entries(tilesetImageUrlModulesByPath)) {
    const fileName = getFileNameFromPath(path);
    if (!fileName) {
      continue;
    }
    tilesetImageUrlByFileName.set(fileName, url);
  }
  return tilesetImageUrlByFileName;
};

const getTilesetImageUrl = (tileset) => {
  if (!tileset?.image || !(tilesetImageUrlByFileName instanceof Map)) {
    return null;
  }
  return tilesetImageUrlByFileName.get(tileset.image) ?? null;
};

const loadTilesetTextures = async (tilesets) => {
  const tilesetTextures = new Map();
  if (Array.isArray(tilesets)) {
    for (const tileset of tilesets) {
      if (!tileset?.image) {
        continue;
      }
      const imageUrl = getTilesetImageUrl(tileset);
      if (!imageUrl) {
        continue;
      }
      const texture = await Assets.load(imageUrl);
      tilesetTextures.set(tileset.image, texture);
    }
  }
  return tilesetTextures;
};

const getTilesetTexture = (tileset) => {
  if (!tileset?.image || !(tilesetTextureByImageFileName instanceof Map)) {
    return null;
  }
  return tilesetTextureByImageFileName.get(tileset.image) ?? null;
};

export const updatePixiCamera = (cameraX, cameraY) => {
  if (!worldContainer || !Number.isFinite(cameraX) || !Number.isFinite(cameraY)) {
    return;
  }
  worldContainer.x = -cameraX;
  worldContainer.y = -cameraY;
};

//#endregion  -----  TOOLS  -----

/* ==================================================== */
//#region     -----  PIXI - ETAT  -----
/* ==================================================== */
let pixiApp = null;
let worldContainer = null;
let mapContainer = null;
let tilesetImageUrlByFileName = null;
let tilesetTextureByImageFileName = null;
let tileTextureByCacheKey = null;
let renderedChunkContainersByKey = null;
//#endregion  -----  PIXI - ETAT  -----

/* ==================================================== */
//#region     -----  PIXI - INITIALISATION  -----
/* ==================================================== */
/* ---------- APPLICATION ET CONTAINERS ---------- */
export const initializePixiRenderer = async ({ htmlParentElement, gameWidth, gameHeight }) => {
  pixiApp = new Application();

  await pixiApp.init({
    width: gameWidth,
    height: gameHeight,
  });

  pixiApp.canvas.classList.add("pixi-canvas");
  htmlParentElement.appendChild(pixiApp.canvas);

  worldContainer = new Container();
  mapContainer = new Container();
  pixiApp.stage.addChild(worldContainer);
  worldContainer.addChild(mapContainer);
  tilesetImageUrlByFileName = createTilesetImageUrlByFileName();
  tileTextureByCacheKey = new Map();
  renderedChunkContainersByKey = new Map();
};
//#endregion  -----  PIXI - INITIALISATION  -----

/* ==================================================== */
//#region     -----  PIXI - RENDU MAP TEMPORAIRE  -----
/* ==================================================== */
/* ---------- MAP DEBUG PAR RECTANGLES ---------- */

const getVisibleChunkKeys = (worldMap, centerChunkX, centerChunkY, radiusChunks) => {
  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    !Number.isInteger(centerChunkX) ||
    !Number.isInteger(centerChunkY) ||
    !Number.isInteger(radiusChunks) ||
    radiusChunks < 0
  ) {
    return new Set();
  }

  const visibleChunkKeys = new Set();
  for (let chunkY = centerChunkY - radiusChunks; chunkY <= centerChunkY + radiusChunks; chunkY++) {
    for (let chunkX = centerChunkX - radiusChunks; chunkX <= centerChunkX + radiusChunks; chunkX++) {
      const chunkKey = `${worldMap.z}:${chunkX}:${chunkY}`;
      if (worldMap.chunksByKey.has(chunkKey)) {
        visibleChunkKeys.add(chunkKey);
      }
    }
  }
  return visibleChunkKeys;
};

const removeHiddenChunkContainers = (visibleChunkKeys) => {
  if (!(renderedChunkContainersByKey instanceof Map) || !(visibleChunkKeys instanceof Set)) {
    return;
  }
  for (const [chunkKey, chunkContainer] of renderedChunkContainersByKey.entries()) {
    if (!visibleChunkKeys.has(chunkKey)) {
      chunkContainer.removeFromParent();
      renderedChunkContainersByKey.delete(chunkKey);
    }
  }
};

const addVisibleChunkContainers = (worldMap, visibleChunkKeys) => {
  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    !(renderedChunkContainersByKey instanceof Map) ||
    !(visibleChunkKeys instanceof Set) ||
    !mapContainer
  ) {
    return;
  }

  for (const chunkKey of visibleChunkKeys) {
    if (renderedChunkContainersByKey.has(chunkKey)) {
      continue;
    }
    const chunk = worldMap.chunksByKey.get(chunkKey);
    const chunkContainer = renderWorldChunk(worldMap, chunk);
    if (chunkContainer) {
      mapContainer.addChild(chunkContainer);
      renderedChunkContainersByKey.set(chunkKey, chunkContainer);
    }
  }
};

export const renderPixiWorldMap = async (worldMap) => {
  if (!mapContainer || !Array.isArray(worldMap?.tilesets) || !(worldMap?.chunksByKey instanceof Map)) {
    return;
  }

  mapContainer.removeChildren();
  tileTextureByCacheKey = new Map();
  tilesetTextureByImageFileName = await loadTilesetTextures(worldMap.tilesets);
  for (const chunk of worldMap.chunksByKey.values()) {
    const chunkContainer = renderWorldChunk(worldMap, chunk);
    if (chunkContainer) {
      mapContainer.addChild(chunkContainer);
    }
  }
};

export const renderPixiVisibleWorldChunks = async (worldMap, centerChunkX, centerChunkY, radiusChunks) => {
  if (
    !mapContainer ||
    !(worldMap?.chunksByKey instanceof Map) ||
    !Array.isArray(worldMap?.tilesets) ||
    !Number.isInteger(centerChunkX) ||
    !Number.isInteger(centerChunkY) ||
    !Number.isInteger(radiusChunks) ||
    radiusChunks < 0
  ) {
    return;
  }

  if (!(tilesetTextureByImageFileName instanceof Map)) {
    tilesetTextureByImageFileName = await loadTilesetTextures(worldMap.tilesets);
  }

  if (!(tileTextureByCacheKey instanceof Map)) {
    tileTextureByCacheKey = new Map();
  }
  const visibleChunkKeys = getVisibleChunkKeys(worldMap, centerChunkX, centerChunkY, radiusChunks);
  removeHiddenChunkContainers(visibleChunkKeys);
  addVisibleChunkContainers(worldMap, visibleChunkKeys);
};
//#endregion  -----  PIXI - RENDU MAP TEMPORAIRE  -----
