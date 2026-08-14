/* ==================================================== */
//#region     -----  IMPORTS  -----
/* ==================================================== */
import { Application, Assets, ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { CHUNK_SIZE_TILES, PLAYER_APPEARANCE_LAYER_ORDER, TILE_SIZE } from "./core/gameConstants.js";
import { getTileRenderDataFromGid } from "./tiledGidResolver.js";
//#endregion  -----  IMPORTS  -----

/* ==================================================== */
//#region     -----  CONFIG  -----
/* ==================================================== */
const MAP_BELOW_LAYER_NAMES = ["ground", "groundDetails", "walls", "objects"];
const MAP_TOP_LAYER_NAME = "top";
const MINIMAP_LAYER_NAMES = ["ground", "groundDetails", "walls", "objects"];
const MINIMAP_CACHE_CELL_SIZE = 8;
const ITEM_SELECTION_OUTLINE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
//#endregion  -----  CONFIG  -----

/* ==================================================== */
//#region     -----  ASSETS - MODULES VITE  -----
/* ==================================================== */
const tilesetImageUrlModulesByPath = import.meta.glob("./assets/tilesets/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});
//#endregion  -----  ASSETS - MODULES VITE  -----

/* ==================================================== */
//#region     -----  PIXI - ETAT  -----
/* ==================================================== */
let pixiApp = null;
let worldContainer = null;
let mapBelowContainer = null;
let entityContainer = null;
let groundEffectContainer = null;
let itemUseTargetContainer = null;
let projectileContainer = null;
let topContainer = null;
let feedbackEffectContainer = null;
let mapLayerContainersByName = null;
let tilesetImageUrlByFileName = null;
let tilesetTextureByImageFileName = null;
let tileTextureByCacheKey = null;
let renderedChunkContainersByKey = null;
let worldEntityTextureByKey = null;
let entityFrameTextureByCacheKey = null;
let playerContainer = null;
let playerSpritesByLayer = null;
let remotePlayerVisualsByUid = null;
let monsterVisualsByUid = null;
let npcVisualsByUid = null;
let worldItemVisualsByUid = null;
let groundEffectVisualsByUid = null;
let itemUseTargetVisualsByKey = null;
let itemUseTargetAnimationElapsedMs = 0;
let worldItemSelectionFilter = null;
let minimapChunkCanvasesByWorldMap = null;
//#endregion  -----  PIXI - ETAT  -----

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
//#region     -----  ASSETS - TILESETS  -----
/* ==================================================== */
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
//#endregion  -----  ASSETS - TILESETS  -----

/* ==================================================== */
//#region     -----  RENDU - TEXTURES ET SPRITES  -----
/* ==================================================== */
const createTileTextureFromGid = (tilesets, gid) => {
  if (!(tileTextureByCacheKey instanceof Map)) {
    return null;
  }

  const tileRenderData = getTileRenderDataFromGid(tilesets, gid);
  if (!tileRenderData) {
    return;
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
//#endregion  -----  RENDU - TEXTURES ET SPRITES  -----

/* ==================================================== */
//#region     -----  RENDU - MINI-CARTE  -----
/* ==================================================== */
const getMinimapChunkCanvasCache = (worldMap) => {
  if (!(minimapChunkCanvasesByWorldMap instanceof WeakMap) || !worldMap) {
    return null;
  }
  let chunkCanvasesByKey = minimapChunkCanvasesByWorldMap.get(worldMap);
  if (!chunkCanvasesByKey) {
    chunkCanvasesByKey = new Map();
    minimapChunkCanvasesByWorldMap.set(worldMap, chunkCanvasesByKey);
  }
  return chunkCanvasesByKey;
};

const drawMinimapTile = (context, tilesets, gid, x, y) => {
  const tileRenderData = getTileRenderDataFromGid(tilesets, gid);
  if (!tileRenderData) {
    return false;
  }
  const tilesetTexture = getTilesetTexture(tileRenderData.tileset);
  const imageSource = tilesetTexture?.source?.resource ?? null;
  if (!imageSource) {
    return false;
  }
  context.drawImage(
    imageSource,
    tileRenderData.sourceX,
    tileRenderData.sourceY,
    tileRenderData.sourceWidth,
    tileRenderData.sourceHeight,
    x,
    y,
    MINIMAP_CACHE_CELL_SIZE,
    MINIMAP_CACHE_CELL_SIZE,
  );
  return true;
};

const createMinimapChunkCanvas = (worldMap, chunk) => {
  if (!Array.isArray(worldMap?.tilesets) || !chunk?.layers) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = CHUNK_SIZE_TILES * MINIMAP_CACHE_CELL_SIZE;
  canvas.height = CHUNK_SIZE_TILES * MINIMAP_CACHE_CELL_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.imageSmoothingEnabled = false;

  for (const layerName of MINIMAP_LAYER_NAMES) {
    const layerGids = chunk.layers[layerName];
    if (!Array.isArray(layerGids)) {
      continue;
    }
    for (let index = 0; index < layerGids.length; index++) {
      const gid = layerGids[index];
      if (!Number.isFinite(gid) || gid <= 0) {
        continue;
      }
      const localCol = index % CHUNK_SIZE_TILES;
      const localRow = Math.floor(index / CHUNK_SIZE_TILES);
      drawMinimapTile(
        context,
        worldMap.tilesets,
        gid,
        localCol * MINIMAP_CACHE_CELL_SIZE,
        localRow * MINIMAP_CACHE_CELL_SIZE,
      );
    }
  }
  return canvas;
};

const getOrCreateMinimapChunkCanvas = (worldMap, chunkKey, chunk) => {
  const chunkCanvasesByKey = getMinimapChunkCanvasCache(worldMap);
  if (!chunkCanvasesByKey) {
    return null;
  }
  if (!chunkCanvasesByKey.has(chunkKey)) {
    const chunkCanvas = createMinimapChunkCanvas(worldMap, chunk);
    if (!chunkCanvas) {
      return null;
    }
    chunkCanvasesByKey.set(chunkKey, chunkCanvas);
  }
  return chunkCanvasesByKey.get(chunkKey) ?? null;
};

export const drawPixiMinimapRegion = ({
  context,
  worldMap,
  firstCol,
  firstRow,
  visibleCols,
  visibleRows,
  cellSize,
}) => {
  if (
    !context ||
    !(worldMap?.chunksByKey instanceof Map) ||
    !Array.isArray(worldMap?.tilesets) ||
    !(tilesetTextureByImageFileName instanceof Map) ||
    !Number.isInteger(firstCol) ||
    !Number.isInteger(firstRow) ||
    !Number.isInteger(visibleCols) ||
    !Number.isInteger(visibleRows) ||
    !Number.isFinite(cellSize) ||
    cellSize <= 0
  ) {
    return false;
  }

  const firstChunkX = Math.floor(firstCol / CHUNK_SIZE_TILES);
  const firstChunkY = Math.floor(firstRow / CHUNK_SIZE_TILES);
  const lastChunkX = Math.floor((firstCol + visibleCols - 1) / CHUNK_SIZE_TILES);
  const lastChunkY = Math.floor((firstRow + visibleRows - 1) / CHUNK_SIZE_TILES);
  let didDrawChunk = false;

  context.save();
  context.imageSmoothingEnabled = false;
  context.beginPath();
  context.rect(0, 0, context.canvas.width, context.canvas.height);
  context.clip();

  for (let chunkY = firstChunkY; chunkY <= lastChunkY; chunkY++) {
    for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX++) {
      const chunkKey = `${worldMap.z}:${chunkX}:${chunkY}`;
      const chunk = worldMap.chunksByKey.get(chunkKey);
      if (!chunk) {
        continue;
      }
      const chunkCanvas = getOrCreateMinimapChunkCanvas(worldMap, chunkKey, chunk);
      if (!chunkCanvas) {
        continue;
      }
      const destinationX = (chunkX * CHUNK_SIZE_TILES - firstCol) * cellSize;
      const destinationY = (chunkY * CHUNK_SIZE_TILES - firstRow) * cellSize;
      const destinationSize = CHUNK_SIZE_TILES * cellSize;
      context.drawImage(chunkCanvas, destinationX, destinationY, destinationSize, destinationSize);
      didDrawChunk = true;
    }
  }

  context.restore();
  return didDrawChunk;
};
//#endregion  -----  RENDU - MINI-CARTE  -----

/* ==================================================== */
//#region     -----  RENDU - ENTITES DU MONDE  -----
/* ==================================================== */
const getEntityFrameTexture = (textureKey, sourceX, sourceY, sourceWidth, sourceHeight) => {
  if (
    !(worldEntityTextureByKey instanceof Map) ||
    !(entityFrameTextureByCacheKey instanceof Map) ||
    typeof textureKey !== "string" ||
    !Number.isFinite(sourceX) ||
    !Number.isFinite(sourceY) ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight)
  ) {
    return null;
  }

  const sourceTexture = worldEntityTextureByKey.get(textureKey);
  if (!sourceTexture) {
    return null;
  }

  const cacheKey = `${textureKey}:${sourceX}:${sourceY}:${sourceWidth}:${sourceHeight}`;
  if (entityFrameTextureByCacheKey.has(cacheKey)) {
    return entityFrameTextureByCacheKey.get(cacheKey);
  }

  const texture = new Texture({
    source: sourceTexture.source,
    frame: new Rectangle(sourceX, sourceY, sourceWidth, sourceHeight),
  });
  entityFrameTextureByCacheKey.set(cacheKey, texture);
  return texture;
};

export const loadPixiWorldEntityTextures = async ({
  playerTextureUrlsByLayer,
  itemTextureUrl,
  monsterTextureUrl,
  npcTextureUrlsById = {},
}) => {
  if (!(worldEntityTextureByKey instanceof Map)) {
    return false;
  }

  const textureUrlsByKey = new Map([
    ["items", itemTextureUrl],
    ["monsters", monsterTextureUrl],
  ]);

  for (const layerName of PLAYER_APPEARANCE_LAYER_ORDER) {
    const textureUrl = playerTextureUrlsByLayer?.[layerName];
    if (typeof textureUrl !== "string" || textureUrl === "") {
      return false;
    }
    worldEntityTextureByKey.set(`player:${layerName}`, await Assets.load(textureUrl));
  }

  for (const [textureKey, textureUrl] of textureUrlsByKey.entries()) {
    if (typeof textureUrl !== "string" || textureUrl === "") {
      return false;
    }
    worldEntityTextureByKey.set(textureKey, await Assets.load(textureUrl));
  }

  for (const [npcId, textureUrl] of Object.entries(npcTextureUrlsById)) {
    if (typeof npcId !== "string" || npcId === "" || typeof textureUrl !== "string" || textureUrl === "") {
      return false;
    }
    worldEntityTextureByKey.set(`npc:${npcId}`, await Assets.load(textureUrl));
  }

  entityFrameTextureByCacheKey = new Map();
  return true;
};

export const setPixiPlayerFrame = ({ sourceX, sourceY, sourceWidth, sourceHeight }) => {
  if (!entityContainer) {
    return false;
  }

  if (!playerContainer) {
    playerContainer = new Container();
    playerContainer.label = "player";
    playerSpritesByLayer = new Map();
    entityContainer.addChild(playerContainer);
  }

  for (const layerName of PLAYER_APPEARANCE_LAYER_ORDER) {
    const texture = getEntityFrameTexture(
      `player:${layerName}`,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
    );
    if (!texture) {
      return false;
    }
    let sprite = playerSpritesByLayer.get(layerName);
    if (!sprite) {
      sprite = new Sprite(texture);
      sprite.label = `player:${layerName}`;
      playerContainer.addChild(sprite);
      playerSpritesByLayer.set(layerName, sprite);
    } else {
      sprite.texture = texture;
    }
  }

  return true;
};

export const updatePixiPlayerTransform = ({ x, y, zIndex }) => {
  if (!playerContainer || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zIndex)) {
    return false;
  }

  playerContainer.x = x;
  playerContainer.y = y;
  playerContainer.zIndex = zIndex;
  return true;
};

export const upsertPixiRemotePlayerAppearance = async ({ uid, appearanceKey, textureUrlsByLayer }) => {
  if (
    !entityContainer ||
    !(remotePlayerVisualsByUid instanceof Map) ||
    typeof uid !== "string" ||
    uid === "" ||
    typeof appearanceKey !== "string" ||
    appearanceKey === ""
  ) {
    return false;
  }

  let refs = remotePlayerVisualsByUid.get(uid);
  if (!refs) {
    const container = new Container();
    const spritesByLayer = new Map();
    const name = new Text({
      text: "",
      style: { fontFamily: "Arial", fontSize: 12, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } },
    });
    const healthBackground = new Graphics().rect(8, -4, 48, 4).fill(0x1a1a1a);
    const health = new Graphics().rect(0, 0, 48, 4).fill(0xffffff);
    const selection = new Graphics()
      .rect(3, TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6)
      .stroke({ width: 2, color: 0xd94a42, alpha: 0.8 });
    const skull = new Container();
    const skullHead = new Graphics().circle(0, 0, 6).fill(0xffffff).rect(-4, 3, 8, 5).fill(0xffffff);
    const skullFace = new Graphics()
      .circle(-2, -1, 1.25)
      .circle(2, -1, 1.25)
      .fill(0x181818)
      .moveTo(0, 1)
      .lineTo(-1, 3)
      .lineTo(1, 3)
      .closePath()
      .fill(0x181818);
    selection.visible = false;
    skull.visible = false;
    skull.x = TILE_SIZE / 2;
    skull.y = -26;
    skull.addChild(skullHead, skullFace);
    name.anchor.set(0.5, 1);
    name.x = TILE_SIZE / 2;
    name.y = -7;
    health.x = 8;
    health.y = -4;
    container.label = `remote-player:${uid}`;
    container.addChild(name, healthBackground, health, skull, selection);
    entityContainer.addChild(container);
    refs = {
      container,
      spritesByLayer,
      name,
      health,
      skull,
      skullHead,
      selection,
      appearanceKey: null,
      appearanceRequestKey: null,
      frameKey: null,
    };
    remotePlayerVisualsByUid.set(uid, refs);
  }

  if (refs.appearanceKey === appearanceKey) {
    return true;
  }
  refs.appearanceRequestKey = appearanceKey;
  const loadedTextures = await Promise.all(
    PLAYER_APPEARANCE_LAYER_ORDER.map(async (layerName) => {
      const textureUrl = textureUrlsByLayer?.[layerName];
      if (typeof textureUrl !== "string" || textureUrl === "") {
        return null;
      }
      return [layerName, await Assets.load(textureUrl)];
    }),
  );
  if (refs.appearanceRequestKey !== appearanceKey || loadedTextures.some((entry) => entry === null)) {
    return false;
  }
  for (const [layerName, texture] of loadedTextures) {
    worldEntityTextureByKey.set(`remote-player:${appearanceKey}:${layerName}`, texture);
  }
  refs.appearanceKey = appearanceKey;
  refs.frameKey = null;
  return true;
};

export const updatePixiRemotePlayerVisual = ({
  uid,
  name,
  hp,
  maxHp,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  x,
  y,
  zIndex,
  selected = false,
  pvp = null,
}) => {
  const refs = remotePlayerVisualsByUid?.get(uid);
  if (!refs?.appearanceKey) {
    return false;
  }
  const frameKey = `${sourceX}:${sourceY}:${sourceWidth}:${sourceHeight}`;
  if (refs.frameKey !== frameKey) {
    for (const layerName of PLAYER_APPEARANCE_LAYER_ORDER) {
      const texture = getEntityFrameTexture(
        `remote-player:${refs.appearanceKey}:${layerName}`,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
      );
      if (!texture) {
        return false;
      }
      let sprite = refs.spritesByLayer.get(layerName);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.label = `remote-player:${uid}:${layerName}`;
        refs.container.addChildAt(sprite, refs.spritesByLayer.size);
        refs.spritesByLayer.set(layerName, sprite);
      } else {
        sprite.texture = texture;
      }
    }
    refs.frameKey = frameKey;
  }
  const healthRatio = Math.max(0, Math.min(1, Number.isFinite(hp / maxHp) ? hp / maxHp : 0));
  refs.health.scale.x = healthRatio;
  refs.health.tint = healthRatio > 0.5 ? 0x35b24a : healthRatio > 0.25 ? 0xe0b42f : 0xd93a32;
  refs.selection.visible = selected;
  const skullType = pvp?.skullType ?? "none";
  refs.skull.visible = skullType === "white" || skullType === "red";
  refs.skullHead.tint = skullType === "red" ? 0xd9362d : 0xffffff;
  refs.name.tint = skullType === "red" ? 0xff5a50 : pvp?.enabled === true ? 0xffa09a : 0xffffff;
  const nextName = String(name ?? "");
  if (refs.name.text !== nextName) {
    refs.name.text = nextName;
  }
  refs.container.x = x;
  refs.container.y = y;
  refs.container.zIndex = zIndex;
  return true;
};

export const removePixiRemotePlayerVisual = (uid) => {
  const refs = remotePlayerVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }
  refs.container.destroy({ children: true });
  remotePlayerVisualsByUid.delete(uid);
  return true;
};

export const clearPixiRemotePlayerVisuals = () => {
  for (const uid of [...(remotePlayerVisualsByUid?.keys() ?? [])]) {
    removePixiRemotePlayerVisual(uid);
  }
};

export const upsertPixiNpcVisual = ({
  uid,
  npcId,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  width,
  height,
  x,
  y,
  zIndex,
}) => {
  if (
    !entityContainer ||
    !(npcVisualsByUid instanceof Map) ||
    typeof uid !== "string" ||
    uid === "" ||
    typeof npcId !== "string" ||
    npcId === ""
  ) {
    return false;
  }

  const texture = getEntityFrameTexture(`npc:${npcId}`, sourceX, sourceY, sourceWidth, sourceHeight);
  if (!texture) {
    return false;
  }

  let refs = npcVisualsByUid.get(uid);
  if (!refs) {
    const sprite = new Sprite(texture);
    sprite.label = `npc:${uid}`;
    entityContainer.addChild(sprite);
    refs = { sprite };
    npcVisualsByUid.set(uid, refs);
  }

  refs.sprite.texture = texture;
  refs.sprite.width = width;
  refs.sprite.height = height;
  refs.sprite.x = x;
  refs.sprite.y = y;
  refs.sprite.zIndex = zIndex;
  return true;
};

export const updatePixiNpcTransform = (uid, x, y, zIndex) => {
  const refs = npcVisualsByUid?.get(uid);
  if (!refs || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zIndex)) {
    return false;
  }
  refs.sprite.x = x;
  refs.sprite.y = y;
  refs.sprite.zIndex = zIndex;
  return true;
};

export const removePixiNpcVisual = (uid) => {
  const refs = npcVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }
  refs.sprite.destroy();
  npcVisualsByUid.delete(uid);
  return true;
};

export const clearPixiNpcVisuals = () => {
  if (!(npcVisualsByUid instanceof Map)) {
    return;
  }
  for (const uid of [...npcVisualsByUid.keys()]) {
    removePixiNpcVisual(uid);
  }
};

const createMonsterSelectionGraphic = (width, height) => {
  const selection = new Graphics();
  selection.rect(0, 0, width, height).stroke({ color: 0xff0000, width: 4 });
  selection.visible = false;
  return selection;
};

export const upsertPixiMonsterVisual = ({
  uid,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  width,
  height,
  x,
  y,
  zIndex,
  selected = false,
}) => {
  if (!entityContainer || !(monsterVisualsByUid instanceof Map) || !Number.isInteger(uid)) {
    return false;
  }

  const texture = getEntityFrameTexture("monsters", sourceX, sourceY, sourceWidth, sourceHeight);
  if (!texture) {
    return false;
  }

  let refs = monsterVisualsByUid.get(uid);
  if (!refs) {
    const container = new Container();
    const sprite = new Sprite(texture);
    const selection = createMonsterSelectionGraphic(width, height);
    container.label = `monster:${uid}`;
    container.addChild(sprite);
    container.addChild(selection);
    entityContainer.addChild(container);
    refs = { container, sprite, selection };
    monsterVisualsByUid.set(uid, refs);
  }

  refs.sprite.texture = texture;
  refs.sprite.width = width;
  refs.sprite.height = height;
  refs.selection.visible = selected;
  refs.container.x = x;
  refs.container.y = y;
  refs.container.zIndex = zIndex;
  return true;
};

export const updatePixiMonsterTransform = (uid, x, y, zIndex) => {
  const refs = monsterVisualsByUid?.get(uid);
  if (!refs || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zIndex)) {
    return false;
  }

  refs.container.x = x;
  refs.container.y = y;
  refs.container.zIndex = zIndex;
  return true;
};

export const setPixiMonsterSelected = (uid, selected) => {
  const refs = monsterVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }

  refs.selection.visible = selected === true;
  return true;
};

export const clearPixiMonsterSelection = () => {
  if (!(monsterVisualsByUid instanceof Map)) {
    return;
  }
  for (const refs of monsterVisualsByUid.values()) {
    refs.selection.visible = false;
  }
};

export const removePixiMonsterVisual = (uid) => {
  const refs = monsterVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }
  refs.container.destroy({ children: true });
  monsterVisualsByUid.delete(uid);
  return true;
};

export const clearPixiMonsterVisuals = () => {
  if (!(monsterVisualsByUid instanceof Map)) {
    return;
  }
  for (const uid of [...monsterVisualsByUid.keys()]) {
    removePixiMonsterVisual(uid);
  }
};

const createWorldItemSelectionContainer = () => {
  const selectionContainer = new Container();
  selectionContainer.label = "selection-outline";
  selectionContainer.visible = false;
  selectionContainer.alpha = 0.5;
  selectionContainer.filters = [worldItemSelectionFilter];

  const outlineSprites = ITEM_SELECTION_OUTLINE_OFFSETS.map(() => {
    const sprite = new Sprite();
    selectionContainer.addChild(sprite);
    return sprite;
  });

  return { selectionContainer, outlineSprites };
};

export const upsertPixiWorldItemVisual = ({ uid, parts, x, y, zIndex }) => {
  if (
    !entityContainer ||
    !(worldItemVisualsByUid instanceof Map) ||
    !worldItemSelectionFilter ||
    !Number.isInteger(uid) ||
    !Array.isArray(parts) ||
    parts.length <= 0 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(zIndex)
  ) {
    return false;
  }

  let refs = worldItemVisualsByUid.get(uid);
  if (!refs) {
    const container = new Container();
    const { selectionContainer, outlineSprites } = createWorldItemSelectionContainer();
    container.label = `world-item:${uid}`;
    container.addChild(selectionContainer);
    entityContainer.addChild(container);
    refs = { container, selectionContainer, outlineSprites, sprites: [], selected: false };
    worldItemVisualsByUid.set(uid, refs);
  }

  while (refs.sprites.length < parts.length) {
    const sprite = new Sprite();
    refs.container.addChild(sprite);
    refs.sprites.push(sprite);
  }
  while (refs.sprites.length > parts.length) {
    refs.sprites.pop().destroy();
  }

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const texture = getEntityFrameTexture(
      "items",
      part.sourceX,
      part.sourceY,
      part.sourceWidth,
      part.sourceHeight,
    );
    if (!texture) {
      return false;
    }

    const sprite = refs.sprites[index];
    sprite.texture = texture;
    sprite.x = part.offsetX;
    sprite.y = part.offsetY;
    sprite.tint = 0xffffff;
  }

  const logicalPart = parts[0];
  const logicalTexture = refs.sprites[0].texture;
  for (let index = 0; index < refs.outlineSprites.length; index++) {
    const outlineSprite = refs.outlineSprites[index];
    const [offsetX, offsetY] = ITEM_SELECTION_OUTLINE_OFFSETS[index];
    outlineSprite.texture = logicalTexture;
    outlineSprite.x = logicalPart.offsetX + offsetX;
    outlineSprite.y = logicalPart.offsetY + offsetY;
  }

  refs.selectionContainer.visible = refs.selected;
  refs.container.x = x;
  refs.container.y = y;
  refs.container.zIndex = zIndex;
  return true;
};

export const updatePixiWorldItemTransform = (uid, x, y, zIndex) => {
  const refs = worldItemVisualsByUid?.get(uid);
  if (!refs || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zIndex)) {
    return false;
  }

  refs.container.x = x;
  refs.container.y = y;
  refs.container.zIndex = zIndex;
  return true;
};

export const setPixiWorldItemSelected = (uid, selected) => {
  const refs = worldItemVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }

  refs.selected = selected === true;
  refs.selectionContainer.visible = refs.selected;
  return true;
};

export const clearPixiWorldItemSelection = () => {
  if (!(worldItemVisualsByUid instanceof Map)) {
    return;
  }
  for (const uid of worldItemVisualsByUid.keys()) {
    setPixiWorldItemSelected(uid, false);
  }
};

export const removePixiWorldItemVisual = (uid) => {
  const refs = worldItemVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }
  refs.container.destroy({ children: true });
  worldItemVisualsByUid.delete(uid);
  return true;
};

export const clearPixiWorldItemVisuals = () => {
  if (!(worldItemVisualsByUid instanceof Map)) {
    return;
  }
  for (const uid of [...worldItemVisualsByUid.keys()]) {
    removePixiWorldItemVisual(uid);
  }
};
//#endregion  -----  RENDU - ENTITES DU MONDE  -----

/* ==================================================== */
//#region     -----  RENDU - EFFETS DE SOL  -----
/* ==================================================== */
export const upsertPixiGroundEffectVisual = ({ uid, sourceX, sourceY, sourceWidth, sourceHeight, x, y }) => {
  if (
    !groundEffectContainer ||
    !(groundEffectVisualsByUid instanceof Map) ||
    !Number.isInteger(uid) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return false;
  }

  const texture = getEntityFrameTexture("items", sourceX, sourceY, sourceWidth, sourceHeight);
  if (!texture) {
    return false;
  }

  let sprite = groundEffectVisualsByUid.get(uid);
  if (!sprite) {
    sprite = new Sprite(texture);
    sprite.label = `ground-effect:${uid}`;
    groundEffectContainer.addChild(sprite);
    groundEffectVisualsByUid.set(uid, sprite);
  } else {
    sprite.texture = texture;
  }

  sprite.x = x;
  sprite.y = y;
  return true;
};

export const removePixiGroundEffectVisual = (uid) => {
  const sprite = groundEffectVisualsByUid?.get(uid);
  if (!sprite) {
    return false;
  }
  sprite.destroy();
  groundEffectVisualsByUid.delete(uid);
  return true;
};

export const clearPixiGroundEffectVisuals = () => {
  if (!(groundEffectVisualsByUid instanceof Map)) {
    return;
  }
  for (const uid of [...groundEffectVisualsByUid.keys()]) {
    removePixiGroundEffectVisual(uid);
  }
};
//#endregion  -----  RENDU - EFFETS DE SOL  -----

/* ==================================================== */
//#region     -----  RENDU - CIBLES ITEM USE  -----
/* ==================================================== */
const drawPixiItemUseTarget = (graphic, color) => {
  graphic.clear();
  graphic.rect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8).stroke({ color, width: 2, alpha: 0.82 });
};

export const setPixiItemUseTargets = (targets) => {
  if (!itemUseTargetContainer || !(itemUseTargetVisualsByKey instanceof Map) || !Array.isArray(targets)) {
    return false;
  }

  const visibleTargetKeys = new Set();

  for (const target of targets) {
    if (
      typeof target?.key !== "string" ||
      target.key === "" ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !Number.isInteger(target.color)
    ) {
      continue;
    }

    visibleTargetKeys.add(target.key);
    let refs = itemUseTargetVisualsByKey.get(target.key);

    if (!refs) {
      const graphic = new Graphics();
      graphic.label = `item-use-target:${target.key}`;
      graphic.pivot.set(TILE_SIZE / 2, TILE_SIZE / 2);
      itemUseTargetContainer.addChild(graphic);
      refs = { graphic, color: null };
      itemUseTargetVisualsByKey.set(target.key, refs);
    }

    if (refs.color !== target.color) {
      drawPixiItemUseTarget(refs.graphic, target.color);
      refs.color = target.color;
    }

    refs.graphic.x = target.x + TILE_SIZE / 2;
    refs.graphic.y = target.y + TILE_SIZE / 2;
  }

  for (const [targetKey, refs] of itemUseTargetVisualsByKey.entries()) {
    if (!visibleTargetKeys.has(targetKey)) {
      refs.graphic.destroy();
      itemUseTargetVisualsByKey.delete(targetKey);
    }
  }

  return true;
};

export const clearPixiItemUseTargets = () => {
  if (!(itemUseTargetVisualsByKey instanceof Map)) {
    return;
  }
  for (const refs of itemUseTargetVisualsByKey.values()) {
    refs.graphic.destroy();
  }
  itemUseTargetVisualsByKey.clear();
};

const updatePixiItemUseTargetAnimation = (ticker) => {
  if (!(itemUseTargetVisualsByKey instanceof Map) || itemUseTargetVisualsByKey.size === 0) {
    return;
  }

  itemUseTargetAnimationElapsedMs += ticker.deltaMS;
  const pulse = (Math.sin((itemUseTargetAnimationElapsedMs / 1600) * Math.PI * 2) + 1) / 2;
  const alpha = 0.58 + pulse * 0.2;
  const scale = 0.985 + pulse * 0.015;

  for (const refs of itemUseTargetVisualsByKey.values()) {
    refs.graphic.alpha = alpha;
    refs.graphic.scale.set(scale);
  }
};
//#endregion  -----  RENDU - CIBLES ITEM USE  -----

/* ==================================================== */
//#region     -----  RENDU - PROJECTILES  -----
/* ==================================================== */
export const playPixiItemProjectile = ({
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  startX,
  startY,
  targetX,
  targetY,
  displaySize = 48,
  rotationOffset = 0,
  speedPixelsPerSecond = 1000,
}) => {
  if (
    !pixiApp ||
    !projectileContainer ||
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(targetX) ||
    !Number.isFinite(targetY) ||
    !Number.isFinite(displaySize) ||
    displaySize <= 0 ||
    !Number.isFinite(speedPixelsPerSecond) ||
    speedPixelsPerSecond <= 0
  ) {
    return false;
  }

  const texture = getEntityFrameTexture("items", sourceX, sourceY, sourceWidth, sourceHeight);
  if (!texture) {
    return false;
  }

  const distanceX = targetX - startX;
  const distanceY = targetY - startY;
  const distance = Math.hypot(distanceX, distanceY);
  const durationMs = Math.max(100, Math.min((distance / speedPixelsPerSecond) * 1000, 500));
  const sprite = new Sprite(texture);
  sprite.label = "item-projectile";
  sprite.anchor.set(0.5);
  sprite.width = displaySize;
  sprite.height = displaySize;
  sprite.x = startX;
  sprite.y = startY;
  sprite.rotation = Math.atan2(distanceY, distanceX) + rotationOffset;
  projectileContainer.addChild(sprite);

  let elapsedMs = 0;
  const updateProjectile = (ticker) => {
    elapsedMs += ticker.deltaMS;
    const progress = Math.min(elapsedMs / durationMs, 1);
    sprite.x = startX + distanceX * progress;
    sprite.y = startY + distanceY * progress;
    if (progress >= 1) {
      pixiApp.ticker.remove(updateProjectile);
      sprite.destroy();
    }
  };

  pixiApp.ticker.add(updateProjectile);
  return true;
};
//#endregion  -----  RENDU - PROJECTILES  -----

/* ==================================================== */
//#region     -----  RENDU - EFFETS DE FEEDBACK  -----
/* ==================================================== */
export const playPixiRewardChestEffect = ({ x, y }) => {
  if (!pixiApp || !feedbackEffectContainer || !Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  const durationMs = 900;
  const burstContainer = new Container();
  burstContainer.label = "reward-chest-effect";
  burstContainer.x = x;
  burstContainer.y = y;

  const ring = new Graphics();
  ring.circle(0, 0, 18).stroke({ color: 0xffd76a, width: 3 });
  burstContainer.addChild(ring);

  const colors = [0xffd76a, 0xfff1a8, 0x8fe36b];
  const particles = [];
  const particleCount = 14;
  for (let index = 0; index < particleCount; index++) {
    const angle = (Math.PI * 2 * index) / particleCount;
    const speed = 55 + (index % 4) * 12;
    const size = 3 + (index % 2);
    const graphic = new Graphics();
    graphic.rect(-size / 2, -size / 2, size, size).fill(colors[index % colors.length]);
    burstContainer.addChild(graphic);
    particles.push({
      graphic,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 45,
      rotationSpeed: index % 2 === 0 ? 4 : -4,
    });
  }

  feedbackEffectContainer.addChild(burstContainer);

  let elapsedMs = 0;
  const updateEffect = (ticker) => {
    const deltaSeconds = ticker.deltaMS / 1000;
    elapsedMs += ticker.deltaMS;
    const progress = Math.min(elapsedMs / durationMs, 1);

    ring.scale.set(1 + progress * 1.8);
    ring.alpha = 1 - progress;

    for (const particle of particles) {
      particle.velocityY += 140 * deltaSeconds;
      particle.graphic.x += particle.velocityX * deltaSeconds;
      particle.graphic.y += particle.velocityY * deltaSeconds;
      particle.graphic.rotation += particle.rotationSpeed * deltaSeconds;
      particle.graphic.alpha = 1 - progress;
    }

    if (progress >= 1) {
      pixiApp.ticker.remove(updateEffect);
      burstContainer.destroy({ children: true });
    }
  };

  pixiApp.ticker.add(updateEffect);
  return true;
};

export const playPixiSpellEffect = ({ x, y, color = 0x8fdcff, success = true }) => {
  if (!pixiApp || !feedbackEffectContainer || !Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  const durationMs = success ? 720 : 420;
  const effectContainer = new Container();
  effectContainer.label = success ? "spell-success-effect" : "spell-failure-effect";
  effectContainer.x = x;
  effectContainer.y = y;

  const ring = new Graphics();
  ring.circle(0, 0, success ? 13 : 11).stroke({ color: success ? color : 0xd85d55, width: 2, alpha: 0.9 });
  effectContainer.addChild(ring);

  const marks = [];
  if (success) {
    for (let index = 0; index < 8; index++) {
      const angle = (Math.PI * 2 * index) / 8;
      const mark = new Graphics();
      mark.rect(-2, -2, 4, 4).fill({ color, alpha: 0.88 });
      mark.x = Math.cos(angle) * 18;
      mark.y = Math.sin(angle) * 10;
      effectContainer.addChild(mark);
      marks.push({ graphic: mark, angle, distance: 18 + (index % 2) * 4 });
    }
  } else {
    const firstLine = new Graphics();
    firstLine.moveTo(-8, -8).lineTo(8, 8).stroke({ color: 0xe06c62, width: 3, alpha: 0.92 });
    const secondLine = new Graphics();
    secondLine.moveTo(8, -8).lineTo(-8, 8).stroke({ color: 0xe06c62, width: 3, alpha: 0.92 });
    effectContainer.addChild(firstLine, secondLine);
    marks.push({ graphic: firstLine }, { graphic: secondLine });
  }

  feedbackEffectContainer.addChild(effectContainer);
  let elapsedMs = 0;
  const updateEffect = (ticker) => {
    elapsedMs += ticker.deltaMS;
    const progress = Math.min(elapsedMs / durationMs, 1);
    ring.scale.set(1 + progress * (success ? 1.3 : 0.5));
    ring.alpha = 1 - progress;

    if (success) {
      for (let index = 0; index < marks.length; index++) {
        const mark = marks[index];
        const distance = mark.distance * (1 - progress * 0.35);
        mark.graphic.x = Math.cos(mark.angle + progress * 0.45) * distance;
        mark.graphic.y = Math.sin(mark.angle + progress * 0.45) * 10 - progress * (18 + index % 3);
        mark.graphic.alpha = 1 - progress;
      }
    } else {
      effectContainer.x = x + Math.sin(progress * Math.PI * 6) * 3 * (1 - progress);
      for (const mark of marks) {
        mark.graphic.alpha = 1 - progress;
      }
    }

    if (progress >= 1) {
      pixiApp.ticker.remove(updateEffect);
      effectContainer.destroy({ children: true });
    }
  };

  pixiApp.ticker.add(updateEffect);
  return true;
};
//#endregion  -----  RENDU - EFFETS DE FEEDBACK  -----

/* ==================================================== */
//#region     -----  RENDU - CHUNKS  -----
/* ==================================================== */
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

  const chunkKey = `${worldMap.z}:${chunk.chunkX}:${chunk.chunkY}`;
  const layerContainersByName = new Map();

  for (const layerName of [...MAP_BELOW_LAYER_NAMES, MAP_TOP_LAYER_NAME]) {
    const layerContainer = new Container();
    layerContainer.label = `${chunkKey}:${layerName}`;
    renderChunkTileLayer(layerContainer, worldMap, chunk, layerName);
    layerContainersByName.set(layerName, layerContainer);
  }

  return {
    layerContainersByName,
  };
};
//#endregion  -----  RENDU - CHUNKS  -----

/* ==================================================== */
//#region     -----  RENDU - VISIBILITE CHUNKS  -----
/* ==================================================== */
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
  for (const [chunkKey, chunkRenderRefs] of renderedChunkContainersByKey.entries()) {
    if (!visibleChunkKeys.has(chunkKey)) {
      for (const layerContainer of chunkRenderRefs.layerContainersByName.values()) {
        layerContainer.removeFromParent();
      }
      renderedChunkContainersByKey.delete(chunkKey);
    }
  }
};

const clearRenderedChunkContainers = () => {
  if (!(renderedChunkContainersByKey instanceof Map)) {
    return;
  }

  for (const chunkRenderRefs of renderedChunkContainersByKey.values()) {
    for (const layerContainer of chunkRenderRefs.layerContainersByName.values()) {
      layerContainer.removeFromParent();
    }
  }

  renderedChunkContainersByKey.clear();
};

const addVisibleChunkContainers = (worldMap, visibleChunkKeys) => {
  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    !(renderedChunkContainersByKey instanceof Map) ||
    !(visibleChunkKeys instanceof Set) ||
    !(mapLayerContainersByName instanceof Map) ||
    !topContainer
  ) {
    return;
  }

  for (const chunkKey of visibleChunkKeys) {
    if (renderedChunkContainersByKey.has(chunkKey)) {
      continue;
    }
    const chunk = worldMap.chunksByKey.get(chunkKey);
    const chunkRenderRefs = renderWorldChunk(worldMap, chunk);
    if (!chunkRenderRefs) {
      continue;
    }

    for (const layerName of MAP_BELOW_LAYER_NAMES) {
      const layerContainer = chunkRenderRefs.layerContainersByName.get(layerName);
      const worldLayerContainer = mapLayerContainersByName.get(layerName);
      if (layerContainer && worldLayerContainer) {
        worldLayerContainer.addChild(layerContainer);
      }
    }

    const topChunkContainer = chunkRenderRefs.layerContainersByName.get(MAP_TOP_LAYER_NAME);
    if (topChunkContainer) {
      topContainer.addChild(topChunkContainer);
    }

    renderedChunkContainersByKey.set(chunkKey, chunkRenderRefs);
  }
};
//#endregion  -----  RENDU - VISIBILITE CHUNKS  -----

/* ==================================================== */
//#region     -----  PIXI - INITIALISATION  -----
/* ==================================================== */
/* ---------- APPLICATION ET CONTAINERS ---------- */
export const initializePixiRenderer = async ({ htmlParentElement, gameWidth, gameHeight }) => {
  try {
    if (!htmlParentElement) {
      console.error('[Pixi] No parent element provided for Pixi renderer');
      return false;
    }

    pixiApp = new Application();
    console.log('[Pixi] Application created');

    await pixiApp.init({
      width: gameWidth,
      height: gameHeight,
      antialias: true,
      clearBeforeRender: true,
    });
    console.log('[Pixi] Application initialized, canvas ready');

    if (!pixiApp.canvas) {
      console.error('[Pixi] Failed to create canvas');
      return false;
    }

    pixiApp.canvas.classList.add("pixi-canvas");
    htmlParentElement.appendChild(pixiApp.canvas);
    console.log('[Pixi] Canvas appended to DOM');

    worldContainer = new Container();
    mapBelowContainer = new Container();
    entityContainer = new Container();
    groundEffectContainer = new Container();
    itemUseTargetContainer = new Container();
    projectileContainer = new Container();
    topContainer = new Container();
    feedbackEffectContainer = new Container();
    mapLayerContainersByName = new Map();

    entityContainer.sortableChildren = true;

    pixiApp.stage.addChild(worldContainer);
    worldContainer.addChild(mapBelowContainer);
    worldContainer.addChild(itemUseTargetContainer);
    worldContainer.addChild(entityContainer);
    worldContainer.addChild(projectileContainer);
    worldContainer.addChild(topContainer);
    worldContainer.addChild(feedbackEffectContainer);
    console.log('[Pixi] Stage hierarchy created');

    for (const layerName of MAP_BELOW_LAYER_NAMES) {
      const layerContainer = new Container();
      layerContainer.label = layerName;
      mapBelowContainer.addChild(layerContainer);
      mapLayerContainersByName.set(layerName, layerContainer);
      if (layerName === "groundDetails") {
        mapBelowContainer.addChild(groundEffectContainer);
      }
    }

    tilesetImageUrlByFileName = createTilesetImageUrlByFileName();
    tileTextureByCacheKey = new Map();
    renderedChunkContainersByKey = new Map();
    worldEntityTextureByKey = new Map();
    entityFrameTextureByCacheKey = new Map();
    playerContainer = null;
    playerSpritesByLayer = null;
    remotePlayerVisualsByUid = new Map();
  monsterVisualsByUid = new Map();
  npcVisualsByUid = new Map();
  worldItemVisualsByUid = new Map();
  groundEffectVisualsByUid = new Map();
  itemUseTargetVisualsByKey = new Map();
  itemUseTargetAnimationElapsedMs = 0;
  minimapChunkCanvasesByWorldMap = new WeakMap();
  worldItemSelectionFilter = new ColorMatrixFilter();
  worldItemSelectionFilter.matrix = [
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0,
  ];
  pixiApp.ticker.add(updatePixiItemUseTargetAnimation);
  pixiApp.stop();
  console.log('[Pixi] Initialization complete');
  } catch (error) {
    console.error('[Pixi] Initialization failed:', error);
    return false;
  }
};
//#endregion  -----  PIXI - INITIALISATION  -----

export const renderPixiFrame = (frameTime) => {
  if (!pixiApp || !Number.isFinite(frameTime)) {
    return;
  }
  pixiApp.ticker.update(frameTime);
};

/* ==================================================== */
//#region     -----  PIXI - CAMERA  -----
/* ==================================================== */
export const updatePixiCamera = (cameraX, cameraY) => {
  if (!worldContainer || !Number.isFinite(cameraX) || !Number.isFinite(cameraY)) {
    return;
  }
  worldContainer.x = -cameraX;
  worldContainer.y = -cameraY;
};
//#endregion  -----  PIXI - CAMERA  -----

/* ==================================================== */
//#region     -----  PIXI - RENDU MAP  -----
/* ==================================================== */
export const renderPixiWorldMap = async (worldMap) => {
  if (
    !(mapLayerContainersByName instanceof Map) ||
    !topContainer ||
    !Array.isArray(worldMap?.tilesets) ||
    !(worldMap?.chunksByKey instanceof Map)
  ) {
    return;
  }

  clearRenderedChunkContainers();
  tileTextureByCacheKey = new Map();
  tilesetTextureByImageFileName = await loadTilesetTextures(worldMap.tilesets);
  addVisibleChunkContainers(worldMap, new Set(worldMap.chunksByKey.keys()));
};

export const renderPixiVisibleWorldChunks = async (worldMap, centerChunkX, centerChunkY, radiusChunks) => {
  if (
    !(mapLayerContainersByName instanceof Map) ||
    !topContainer ||
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
//#endregion  -----  PIXI - RENDU MAP  -----
