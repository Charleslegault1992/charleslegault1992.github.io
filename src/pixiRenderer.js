/* ==================================================== */
//#region     -----  IMPORTS  -----
/* ==================================================== */
import {
  Application,
  Assets,
  BufferImageSource,
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { CHUNK_SIZE_TILES, PLAYER_APPEARANCE_LAYER_ORDER, TILE_SIZE } from "./core/gameConstants.js";
import { getTileRenderDataFromGid } from "./tiledGidResolver.js";
import { getPixiRendererPreference, getRequestedPixiRenderer } from "./render/pixiRendererPreference.js";
import { getWorldRenderZIndex, WORLD_ROOT_RENDER_Z_INDEX } from "./render/renderOrder.js";
import {
  combatEffectsDatabase,
  EFFECT_ATLAS_CELL_SIZE,
  EFFECT_ATLAS_FILE_NAME,
  getElementCombatEffects,
} from "./data/combatEffectsDatabase.js";
import { groundEffectsDatabase } from "./data/groundEffectsDatabase.js";
import { getDoorData, getDoorVariantData } from "./data/doorsDatabase.js";
//#endregion  -----  IMPORTS  -----

/* ==================================================== */
//#region     -----  CONFIG  -----
/* ==================================================== */
const MAP_BELOW_LAYER_NAMES = ["ground", "groundDetails"];
const MAP_DEPTH_LAYER_NAMES = ["walls", "objects"];
const MAP_TOP_LAYER_NAMES = ["top", "topDeco"];
const MAP_ROOF_LAYER_NAME = "roofs";
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
const LIGHT_TEXTURE_SIZE = 256;
const LIGHT_SOURCE_STRIDE = 3;
const LIGHT_POOL_INITIAL_CAPACITY = 32;
const LIGHT_POOL_GROWTH = 16;
const LIGHT_DARKNESS_ALPHA = 0.995;
const LIGHT_TORCH_CUTOUT_OPACITY = 0.69;
const LIGHT_TORCH_GLOW_RADIUS_SCALE = 0.85;
const LIGHT_MAGIC_GLOW_RADIUS_SCALE = 0.75;
const LIGHT_PLAYER_CUTOUT_STOPS = [
  [0, 0, 0, 0, 0.18],
  [0.65, 0, 0, 0, 0.036],
  [1, 0, 0, 0, 0],
];
const LIGHT_SPELL_CUTOUT_STOPS = [
  [0, 0, 0, 0, 0.7],
  [0.65, 0, 0, 0, 0.14],
  [1, 0, 0, 0, 0],
];
const LIGHT_TORCH_CUTOUT_STOPS = [
  [0, 0, 0, 0, LIGHT_TORCH_CUTOUT_OPACITY],
  [0.65, 0, 0, 0, LIGHT_TORCH_CUTOUT_OPACITY * 0.2],
  [1, 0, 0, 0, 0],
];
const LIGHT_TORCH_GLOW_STOPS = [
  [0, 255, 246, 169, 0.015],
  [0.55, 255, 174, 45, 0.055],
  [1, 255, 70, 0, 0],
];
const LIGHT_MAGIC_GLOW_STOPS = [
  [0, 222, 239, 255, 0.04],
  [0.6, 139, 194, 255, 0.025],
  [1, 90, 150, 255, 0],
];
const LIGHT_SUN_STOPS = [
  [0, 255, 246, 197, 0.055],
  [1, 255, 236, 167, 0.012],
];
const ROOF_FADE_DURATION_MS = 180;
//#endregion  -----  CONFIG  -----

/* ==================================================== */
//#region     -----  ASSETS - MODULES VITE  -----
/* ==================================================== */
const tilesetImageUrlModulesByPath = import.meta.glob("./assets/tilesets/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});
const effectImageUrlModulesByPath = import.meta.glob("./assets/images/effects/*.png", {
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
let doorUpperContainer = null;
let roofContainer = null;
let feedbackEffectContainer = null;
let entityNameplateContainer = null;
let mapLayerContainersByName = null;
let tilesetImageUrlByFileName = null;
let tilesetTextureByImageFileName = null;
let tilesetTextureLoadPromiseByImageFileName = null;
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
let groundEffectAnimationFrame = 0;
let groundEffectAnimationElapsedMs = 0;
let combatEffectVisualPool = null;
let availableCombatEffectVisuals = null;
let itemUseTargetVisualsByKey = null;
let itemUseTargetAnimationElapsedMs = 0;
let worldItemSelectionFilter = null;
let minimapChunkCanvasesByWorldMap = null;
let visibleChunkRenderGeneration = 0;
let lightingRenderTexture = null;
let lightingOverlaySprite = null;
let lightingRenderContainer = null;
let lightingCutoutContainer = null;
let lightingGlowContainer = null;
let lightingDarknessSprite = null;
let lightingSunlightSprite = null;
let lightingPlayerCutoutSprite = null;
let lightingSpellCutoutSprite = null;
let lightingSpellGlowSprite = null;
let lightingTorchVisualPool = null;
let lightingTorchCutoutTextureByRadius = null;
let lightingTorchGlowTextureByRadius = null;
let lightingSpellCutoutTextureByRadius = null;
let lightingSpellGlowTextureByRadius = null;
let lightingPlayerCutoutTexture = null;
let lightingSunlightTexture = null;
let lightingRenderOptions = null;
let lightingGameWidth = 0;
let lightingGameHeight = 0;
let lightingIsOutdoor = null;
let lightingActiveTorchCount = 0;
let requestedPixiRenderer = null;
let doorVisualsByUid = null;
let roofContainersById = null;
let hiddenRoofIds = null;
let activeRoofFadeIds = null;
let roofFadeTargetById = null;
let roofAlphaById = null;
let lastRoofWorldMap = null;
let lastRoofPlayerCol = null;
let lastRoofPlayerRow = null;
let lastRoofPlayerZ = null;
//#endregion  -----  PIXI - ETAT  -----

/* ==================================================== */
//#region     -----  PIXI - LUMIERE  -----
/* ==================================================== */
const createRadialLightTexture = (outerRadius, innerRadius, colorStops) => {
  const pixels = new Uint8Array(LIGHT_TEXTURE_SIZE * LIGHT_TEXTURE_SIZE * 4);
  const center = (LIGHT_TEXTURE_SIZE - 1) / 2;
  const maxTextureRadius = LIGHT_TEXTURE_SIZE / 2;
  const gradientRange = Math.max(outerRadius - innerRadius, 1);

  for (let y = 0; y < LIGHT_TEXTURE_SIZE; y++) {
    const normalizedY = (y - center) / maxTextureRadius;
    for (let x = 0; x < LIGHT_TEXTURE_SIZE; x++) {
      const normalizedX = (x - center) / maxTextureRadius;
      const normalizedDistance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      if (normalizedDistance >= 1) {
        continue;
      }

      const worldDistance = normalizedDistance * outerRadius;
      const gradientPosition = Math.max(0, Math.min((worldDistance - innerRadius) / gradientRange, 1));
      let upperStopIndex = 1;
      while (upperStopIndex < colorStops.length - 1 && gradientPosition > colorStops[upperStopIndex][0]) {
        upperStopIndex++;
      }

      const lowerStop = colorStops[upperStopIndex - 1];
      const upperStop = colorStops[upperStopIndex];
      const stopRange = upperStop[0] - lowerStop[0];
      const mix = stopRange > 0 ? (gradientPosition - lowerStop[0]) / stopRange : 0;
      const lowerAlpha = lowerStop[4];
      const upperAlpha = upperStop[4];
      const alpha = lowerAlpha + (upperAlpha - lowerAlpha) * mix;
      const pixelIndex = (y * LIGHT_TEXTURE_SIZE + x) * 4;

      pixels[pixelIndex] = Math.round(
        lowerStop[1] * lowerAlpha + (upperStop[1] * upperAlpha - lowerStop[1] * lowerAlpha) * mix,
      );
      pixels[pixelIndex + 1] = Math.round(
        lowerStop[2] * lowerAlpha + (upperStop[2] * upperAlpha - lowerStop[2] * lowerAlpha) * mix,
      );
      pixels[pixelIndex + 2] = Math.round(
        lowerStop[3] * lowerAlpha + (upperStop[3] * upperAlpha - lowerStop[3] * lowerAlpha) * mix,
      );
      pixels[pixelIndex + 3] = Math.round(alpha * 255);
    }
  }

  const source = new BufferImageSource({
    resource: pixels,
    width: LIGHT_TEXTURE_SIZE,
    height: LIGHT_TEXTURE_SIZE,
    format: "rgba8unorm",
    alphaMode: "premultiplied-alpha",
    scaleMode: "linear",
    autoGarbageCollect: false,
  });
  return new Texture({ source });
};

const createLightingSprite = (blendMode = "normal") => {
  const sprite = new Sprite(Texture.EMPTY);
  sprite.anchor.set(0.5);
  sprite.blendMode = blendMode;
  sprite.visible = false;
  sprite.eventMode = "none";
  return sprite;
};

const getOrCreateTorchCutoutTexture = (radius) => {
  let texture = lightingTorchCutoutTextureByRadius.get(radius);
  if (!texture) {
    texture = createRadialLightTexture(radius, 12, LIGHT_TORCH_CUTOUT_STOPS);
    lightingTorchCutoutTextureByRadius.set(radius, texture);
  }
  return texture;
};

const getOrCreateTorchGlowTexture = (radius) => {
  let texture = lightingTorchGlowTextureByRadius.get(radius);
  if (!texture) {
    const glowRadius = radius * LIGHT_TORCH_GLOW_RADIUS_SCALE;
    texture = createRadialLightTexture(glowRadius, 16, LIGHT_TORCH_GLOW_STOPS);
    lightingTorchGlowTextureByRadius.set(radius, texture);
  }
  return texture;
};

const getOrCreateSpellCutoutTexture = (radius) => {
  let texture = lightingSpellCutoutTextureByRadius.get(radius);
  if (!texture) {
    texture = createRadialLightTexture(radius, 12, LIGHT_SPELL_CUTOUT_STOPS);
    lightingSpellCutoutTextureByRadius.set(radius, texture);
  }
  return texture;
};

const getOrCreateSpellGlowTexture = (radius) => {
  let texture = lightingSpellGlowTextureByRadius.get(radius);
  if (!texture) {
    const glowRadius = radius * LIGHT_MAGIC_GLOW_RADIUS_SCALE;
    texture = createRadialLightTexture(glowRadius, 12, LIGHT_MAGIC_GLOW_STOPS);
    lightingSpellGlowTextureByRadius.set(radius, texture);
  }
  return texture;
};

const appendLightingTorchVisual = () => {
  const cutoutSprite = createLightingSprite("erase");
  const glowSprite = createLightingSprite();
  lightingCutoutContainer.addChild(cutoutSprite);
  lightingGlowContainer.addChild(glowSprite);
  lightingTorchVisualPool.push({ cutoutSprite, glowSprite });
};

const ensureLightingTorchPoolCapacity = (requiredCapacity) => {
  while (lightingTorchVisualPool.length < requiredCapacity) {
    const targetCapacity = Math.max(requiredCapacity, lightingTorchVisualPool.length + LIGHT_POOL_GROWTH);
    while (lightingTorchVisualPool.length < targetCapacity) {
      appendLightingTorchVisual();
    }
  }
};

const setLightingSpriteState = (sprite, texture, x, y, diameter, visible) => {
  let didChange = false;
  if (sprite.visible !== visible) {
    sprite.visible = visible;
    didChange = true;
  }
  if (!visible) {
    return didChange;
  }
  if (sprite.texture !== texture) {
    sprite.texture = texture;
    didChange = true;
  }
  if (sprite.x !== x) {
    sprite.x = x;
    didChange = true;
  }
  if (sprite.y !== y) {
    sprite.y = y;
    didChange = true;
  }
  if (sprite.width !== diameter) {
    sprite.width = diameter;
    didChange = true;
  }
  if (sprite.height !== diameter) {
    sprite.height = diameter;
    didChange = true;
  }
  return didChange;
};

const initializePixiLighting = ({ gameWidth, gameHeight, lightingPresets }) => {
  lightingGameWidth = gameWidth;
  lightingGameHeight = gameHeight;
  lightingTorchCutoutTextureByRadius = new Map();
  lightingTorchGlowTextureByRadius = new Map();
  lightingSpellCutoutTextureByRadius = new Map();
  lightingSpellGlowTextureByRadius = new Map();
  lightingTorchVisualPool = [];
  lightingIsOutdoor = null;
  lightingActiveTorchCount = 0;

  const playerRevealRadius = lightingPresets?.playerRevealRadius ?? 64;
  lightingPlayerCutoutTexture = createRadialLightTexture(playerRevealRadius, 12, LIGHT_PLAYER_CUTOUT_STOPS);
  const sunlightRadius = Math.max(gameWidth, gameHeight);
  lightingSunlightTexture = createRadialLightTexture(sunlightRadius, 0, LIGHT_SUN_STOPS);

  for (const radius of lightingPresets?.torchRadii ?? []) {
    if (Number.isFinite(radius) && radius > 0) {
      getOrCreateTorchCutoutTexture(radius);
      getOrCreateTorchGlowTexture(radius);
    }
  }
  for (const radius of lightingPresets?.spellRadii ?? []) {
    if (Number.isFinite(radius) && radius > 0) {
      getOrCreateSpellCutoutTexture(radius);
      getOrCreateSpellGlowTexture(radius);
    }
  }

  lightingRenderTexture = RenderTexture.create({
    width: gameWidth,
    height: gameHeight,
    resolution: 1,
    format: "rgba8unorm",
    alphaMode: "premultiplied-alpha",
  });
  lightingOverlaySprite = new Sprite(lightingRenderTexture);
  lightingOverlaySprite.eventMode = "none";

  lightingRenderContainer = new Container();
  lightingCutoutContainer = new Container();
  lightingGlowContainer = new Container();
  lightingDarknessSprite = new Sprite(Texture.WHITE);
  lightingDarknessSprite.tint = 0x000000;
  lightingDarknessSprite.alpha = LIGHT_DARKNESS_ALPHA;
  lightingDarknessSprite.width = gameWidth;
  lightingDarknessSprite.height = gameHeight;
  lightingDarknessSprite.eventMode = "none";

  lightingSunlightSprite = new Sprite(lightingSunlightTexture);
  lightingSunlightSprite.anchor.set(0.5);
  lightingSunlightSprite.x = gameWidth * 0.18;
  lightingSunlightSprite.y = 0;
  lightingSunlightSprite.width = sunlightRadius * 2;
  lightingSunlightSprite.height = sunlightRadius * 2;
  lightingSunlightSprite.eventMode = "none";

  lightingPlayerCutoutSprite = createLightingSprite("erase");
  lightingSpellCutoutSprite = createLightingSprite("erase");
  lightingSpellGlowSprite = createLightingSprite();
  lightingCutoutContainer.addChild(lightingPlayerCutoutSprite);
  lightingCutoutContainer.addChild(lightingSpellCutoutSprite);
  lightingGlowContainer.addChild(lightingSpellGlowSprite);

  lightingRenderContainer.addChild(lightingSunlightSprite);
  lightingRenderContainer.addChild(lightingDarknessSprite);
  lightingRenderContainer.addChild(lightingCutoutContainer);
  lightingRenderContainer.addChild(lightingGlowContainer);
  pixiApp.stage.addChild(lightingOverlaySprite);

  ensureLightingTorchPoolCapacity(LIGHT_POOL_INITIAL_CAPACITY);
  lightingRenderOptions = {
    container: lightingRenderContainer,
    target: lightingRenderTexture,
    clear: true,
    clearColor: [0, 0, 0, 0],
  };
};

const isLightingCircleVisible = (screenX, screenY, radius) => {
  return (
    screenX + radius >= 0 &&
    screenX - radius <= lightingGameWidth &&
    screenY + radius >= 0 &&
    screenY - radius <= lightingGameHeight
  );
};

export const updatePixiLighting = (frame) => {
  if (!pixiApp || !lightingRenderOptions || !frame) {
    return false;
  }

  let didChange = false;
  const isOutdoor = frame.isOutdoor === true;
  if (lightingIsOutdoor !== isOutdoor) {
    lightingIsOutdoor = isOutdoor;
    lightingSunlightSprite.visible = isOutdoor;
    lightingDarknessSprite.visible = !isOutdoor;
    lightingCutoutContainer.visible = !isOutdoor;
    lightingGlowContainer.visible = !isOutdoor;
    didChange = true;
  }

  if (!isOutdoor) {
    const playerVisible =
      Number.isFinite(frame.playerScreenX) &&
      Number.isFinite(frame.playerScreenY) &&
      Number.isFinite(frame.playerRevealRadius) &&
      frame.playerRevealRadius > 0;
    didChange =
      setLightingSpriteState(
        lightingPlayerCutoutSprite,
        lightingPlayerCutoutTexture,
        frame.playerScreenX,
        frame.playerScreenY,
        frame.playerRevealRadius * 2,
        playerVisible,
      ) || didChange;

    const spellRadius = Number.isFinite(frame.spellRadius) ? frame.spellRadius : 0;
    const spellVisible = playerVisible && spellRadius > 0;
    const spellCutoutTexture = spellVisible ? getOrCreateSpellCutoutTexture(spellRadius) : Texture.EMPTY;
    const spellGlowTexture = spellVisible ? getOrCreateSpellGlowTexture(spellRadius) : Texture.EMPTY;
    didChange =
      setLightingSpriteState(
        lightingSpellCutoutSprite,
        spellCutoutTexture,
        frame.playerScreenX,
        frame.playerScreenY,
        spellRadius * 2,
        spellVisible,
      ) || didChange;
    didChange =
      setLightingSpriteState(
        lightingSpellGlowSprite,
        spellGlowTexture,
        frame.playerScreenX,
        frame.playerScreenY,
        spellRadius * LIGHT_MAGIC_GLOW_RADIUS_SCALE * 2,
        spellVisible,
      ) || didChange;

    const torchData = frame.torchData;
    const requestedTorchCount = Number.isInteger(frame.torchCount) ? frame.torchCount : 0;
    const torchCount = torchData instanceof Float32Array ? requestedTorchCount : 0;
    ensureLightingTorchPoolCapacity(torchCount);

    for (let index = 0; index < torchCount; index++) {
      const dataIndex = index * LIGHT_SOURCE_STRIDE;
      const screenX = torchData[dataIndex];
      const screenY = torchData[dataIndex + 1];
      const radius = torchData[dataIndex + 2];
      const visible =
        Number.isFinite(screenX) &&
        Number.isFinite(screenY) &&
        Number.isFinite(radius) &&
        radius > 0 &&
        isLightingCircleVisible(screenX, screenY, radius);
      const visual = lightingTorchVisualPool[index];
      const cutoutTexture = visible ? getOrCreateTorchCutoutTexture(radius) : Texture.EMPTY;
      const glowTexture = visible ? getOrCreateTorchGlowTexture(radius) : Texture.EMPTY;
      didChange =
        setLightingSpriteState(visual.cutoutSprite, cutoutTexture, screenX, screenY, radius * 2, visible) || didChange;
      didChange =
        setLightingSpriteState(
          visual.glowSprite,
          glowTexture,
          screenX,
          screenY,
          radius * LIGHT_TORCH_GLOW_RADIUS_SCALE * 2,
          visible,
        ) || didChange;
    }

    for (let index = torchCount; index < lightingActiveTorchCount; index++) {
      const visual = lightingTorchVisualPool[index];
      if (visual.cutoutSprite.visible || visual.glowSprite.visible) {
        visual.cutoutSprite.visible = false;
        visual.glowSprite.visible = false;
        didChange = true;
      }
    }
    lightingActiveTorchCount = torchCount;
  }

  if (didChange) {
    pixiApp.renderer.render(lightingRenderOptions);
  }
  return didChange;
};
//#endregion  -----  PIXI - LUMIERE  -----

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
  if (!Array.isArray(tilesets)) {
    return tilesetTextures;
  }
  const textureEntries = tilesets
    .map((tileset) => ({ image: tileset?.image, imageUrl: getTilesetImageUrl(tileset) }))
    .filter(({ image, imageUrl }) => typeof image === "string" && typeof imageUrl === "string");
  const textures = await Promise.all(textureEntries.map(({ imageUrl }) => Assets.load(imageUrl)));
  textureEntries.forEach(({ image }, index) => tilesetTextures.set(image, textures[index]));
  return tilesetTextures;
};

const getTilesetsUsedByChunks = (worldMap, chunkKeys) => {
  const tilesetsByImage = new Map();
  if (!(worldMap?.chunksByKey instanceof Map) || !Array.isArray(worldMap?.tilesets)) {
    return [];
  }
  for (const chunkKey of chunkKeys) {
    const chunk = worldMap.chunksByKey.get(chunkKey);
    for (const layerName of [
      ...MAP_BELOW_LAYER_NAMES,
      ...MAP_DEPTH_LAYER_NAMES,
      ...MAP_TOP_LAYER_NAMES,
      MAP_ROOF_LAYER_NAME,
    ]) {
      const gids = chunk?.layers?.[layerName];
      if (!Array.isArray(gids)) {
        continue;
      }
      for (const gid of gids) {
        if (!Number.isFinite(gid) || gid <= 0) {
          continue;
        }
        const tileset = getTileRenderDataFromGid(worldMap.tilesets, gid)?.tileset;
        if (tileset?.image) {
          tilesetsByImage.set(tileset.image, tileset);
        }
      }
    }
  }
  return [...tilesetsByImage.values()];
};

const loadTilesetTexturesForChunks = async (worldMap, chunkKeys) => {
  if (!(tilesetTextureByImageFileName instanceof Map)) {
    tilesetTextureByImageFileName = new Map();
  }
  if (!(tilesetTextureLoadPromiseByImageFileName instanceof Map)) {
    tilesetTextureLoadPromiseByImageFileName = new Map();
  }
  const pendingTextures = getTilesetsUsedByChunks(worldMap, chunkKeys).map(async (tileset) => {
    if (tilesetTextureByImageFileName.has(tileset.image)) {
      return;
    }
    let loadPromise = tilesetTextureLoadPromiseByImageFileName.get(tileset.image);
    if (!loadPromise) {
      const imageUrl = getTilesetImageUrl(tileset);
      if (!imageUrl) {
        return;
      }
      loadPromise = Assets.load(imageUrl);
      tilesetTextureLoadPromiseByImageFileName.set(tileset.image, loadPromise);
    }
    const texture = await loadPromise;
    tilesetTextureByImageFileName.set(tileset.image, texture);
  });
  await Promise.all(pendingTextures);
};

const getTilesetTexture = (tileset) => {
  if (!tileset?.image || !(tilesetTextureByImageFileName instanceof Map)) {
    return null;
  }
  return tilesetTextureByImageFileName.get(tileset.image) ?? null;
};

const ensureTilesetTextureLoaded = async (tileset) => {
  if (!tileset?.image) {
    return null;
  }
  const currentTexture = getTilesetTexture(tileset);
  if (currentTexture) {
    return currentTexture;
  }
  let loadPromise = tilesetTextureLoadPromiseByImageFileName.get(tileset.image);
  if (!loadPromise) {
    const imageUrl = getTilesetImageUrl(tileset);
    if (!imageUrl) {
      return null;
    }
    loadPromise = Assets.load(imageUrl);
    tilesetTextureLoadPromiseByImageFileName.set(tileset.image, loadPromise);
  }
  const texture = await loadPromise;
  tilesetTextureByImageFileName.set(tileset.image, texture);
  return texture;
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
//#region     -----  RENDU - PORTES  -----
/* ==================================================== */
const fillDoorFrameSlice = (stateContainer, tileset, stateData, sliceY, sliceHeight) => {
  const { x, y, width } = stateData.frame;
  const cacheKey = `${tileset.source}:door-frame:${x}:${y + sliceY}:${width}:${sliceHeight}`;
  let texture = tileTextureByCacheKey.get(cacheKey);
  if (!texture) {
    const tilesetTexture = getTilesetTexture(tileset);
    if (!tilesetTexture) {
      return;
    }
    texture = new Texture({
      source: tilesetTexture.source,
      frame: new Rectangle(x, y + sliceY, width, sliceHeight),
    });
    tileTextureByCacheKey.set(cacheKey, texture);
  }
  const sprite = new Sprite(texture);
  sprite.x = stateData.offsetX ?? 0;
  sprite.y = (stateData.offsetY ?? 0) + sliceY;
  stateContainer.addChild(sprite);
};

const fillDoorStateContainers = (upperContainer, lowerContainer, tilesets, tileset, stateData) => {
  if (stateData?.frame) {
    const upperHeight = Math.max(0, stateData.frame.height - TILE_SIZE);
    const lowerHeight = stateData.frame.height - upperHeight;
    fillDoorFrameSlice(upperContainer, tileset, stateData, 0, upperHeight);
    if (lowerHeight > 0) {
      fillDoorFrameSlice(lowerContainer, tileset, stateData, upperHeight, lowerHeight);
    }
    return;
  }

  for (const tile of stateData.tiles) {
    const gid = tileset.firstgid + tile.localTileId;
    const sprite = createTileSprite(
      tilesets,
      gid,
      (tile.col - stateData.anchorCol) * TILE_SIZE,
      (tile.row - stateData.anchorRow) * TILE_SIZE,
    );
    if (sprite) {
      upperContainer.addChild(sprite);
    }
  }
};

const upsertPixiDoorVisual = async (door, worldMap) => {
  if (!entityContainer || !doorUpperContainer || !door?.uid || !Array.isArray(worldMap?.tilesets)) {
    return false;
  }
  let visual = doorVisualsByUid.get(door.uid);
  if (!visual) {
    const lowerRoot = new Container();
    const lowerClosed = new Container();
    const lowerOpen = new Container();
    const upperRoot = new Container();
    const upperClosed = new Container();
    const upperOpen = new Container();
    lowerRoot.label = `door-lower:${door.uid}`;
    upperRoot.label = `door-upper:${door.uid}`;
    lowerRoot.eventMode = "none";
    upperRoot.eventMode = "none";
    lowerRoot.addChild(lowerClosed, lowerOpen);
    upperRoot.addChild(upperClosed, upperOpen);
    entityContainer.addChild(lowerRoot);
    doorUpperContainer.addChild(upperRoot);
    visual = { lowerRoot, lowerClosed, lowerOpen, upperRoot, upperClosed, upperOpen, isReady: false };
    doorVisualsByUid.set(door.uid, visual);
  }

  visual.lowerRoot.x = door.x;
  visual.lowerRoot.y = door.y;
  visual.lowerRoot.zIndex = getWorldRenderZIndex(door.y + door.height);
  visual.upperRoot.x = door.x;
  visual.upperRoot.y = door.y;
  visual.lowerRoot.visible = door.z === worldMap.z;
  visual.upperRoot.visible = door.z === worldMap.z;
  visual.lowerClosed.visible = door.isOpen !== true;
  visual.lowerOpen.visible = door.isOpen === true;
  visual.upperClosed.visible = door.isOpen !== true;
  visual.upperOpen.visible = door.isOpen === true;
  if (visual.isReady) {
    return true;
  }

  const doorData = getDoorData(door.doorType);
  const doorVariantData = getDoorVariantData(door.doorType, door.wallSide);
  const tileset = worldMap.tilesets.find((candidate) => candidate?.image === doorData?.tilesetImage) ?? null;
  if (!doorData || !doorVariantData || !tileset || !(await ensureTilesetTextureLoaded(tileset))) {
    return false;
  }
  if (doorVisualsByUid.get(door.uid) !== visual) {
    return false;
  }
  fillDoorStateContainers(
    visual.upperClosed,
    visual.lowerClosed,
    worldMap.tilesets,
    tileset,
    doorVariantData.closed,
  );
  fillDoorStateContainers(
    visual.upperOpen,
    visual.lowerOpen,
    worldMap.tilesets,
    tileset,
    doorVariantData.open,
  );
  visual.isReady = true;
  return true;
};

export const syncPixiDoorVisuals = (doors, worldMap) => {
  if (!(doorVisualsByUid instanceof Map) || !worldMap) {
    return false;
  }
  const visibleDoorUids = new Set();
  for (const door of doors ?? []) {
    if (door?.z !== worldMap.z) {
      continue;
    }
    visibleDoorUids.add(door.uid);
    void upsertPixiDoorVisual(door, worldMap);
  }
  for (const [doorUid, visual] of doorVisualsByUid) {
    if (!visibleDoorUids.has(doorUid)) {
      visual.lowerRoot.destroy({ children: true });
      visual.upperRoot.destroy({ children: true });
      doorVisualsByUid.delete(doorUid);
    }
  }
  return true;
};
//#endregion  -----  RENDU - PORTES  -----

/* ==================================================== */
//#region     -----  RENDU - TOITS  -----
/* ==================================================== */
const getRoofIdAtWorldTile = (worldMap, col, row) => {
  for (const area of worldMap?.roofAreas ?? []) {
    const widthTiles = Math.max(1, Math.ceil(area.width / TILE_SIZE));
    const heightTiles = Math.max(1, Math.ceil(area.height / TILE_SIZE));
    if (
      col >= area.col &&
      col < area.col + widthTiles &&
      row >= area.row &&
      row < area.row + heightTiles
    ) {
      return area.properties?.roofId ?? null;
    }
  }
  return null;
};

const registerRoofContainer = (roofId, container) => {
  if (!roofId) {
    return;
  }
  let containers = roofContainersById.get(roofId);
  if (!containers) {
    containers = new Set();
    roofContainersById.set(roofId, containers);
  }
  containers.add(container);
  container.alpha = roofAlphaById.get(roofId) ?? (hiddenRoofIds.has(roofId) ? 0 : 1);
};

const unregisterChunkRoofContainers = (chunkRenderRefs) => {
  for (const [roofId, container] of chunkRenderRefs?.roofContainersById ?? []) {
    const containers = roofContainersById.get(roofId);
    containers?.delete(container);
    if (containers?.size === 0) {
      roofContainersById.delete(roofId);
    }
  }
};

const setRoofHidden = (roofId, hidden) => {
  if (!roofId) {
    return;
  }
  if (hidden) {
    hiddenRoofIds.add(roofId);
  } else {
    hiddenRoofIds.delete(roofId);
  }
  roofFadeTargetById.set(roofId, hidden ? 0 : 1);
  activeRoofFadeIds.add(roofId);
};

const updateRoofFades = (ticker) => {
  if (activeRoofFadeIds.size === 0) {
    return;
  }
  const fadeStep = ticker.deltaMS / ROOF_FADE_DURATION_MS;
  for (const roofId of activeRoofFadeIds) {
    const targetAlpha = roofFadeTargetById.get(roofId) ?? 1;
    const currentAlpha = roofAlphaById.get(roofId) ?? (targetAlpha === 0 ? 1 : 0);
    const nextAlpha =
      targetAlpha < currentAlpha
        ? Math.max(targetAlpha, currentAlpha - fadeStep)
        : Math.min(targetAlpha, currentAlpha + fadeStep);
    roofAlphaById.set(roofId, nextAlpha);
    for (const container of roofContainersById.get(roofId) ?? []) {
      container.alpha = nextAlpha;
    }
    if (nextAlpha === targetAlpha) {
      activeRoofFadeIds.delete(roofId);
    }
  }
};

export const updatePixiRoofVisibility = (worldMap, playerX, playerY, playerZ) => {
  if (!worldMap || !Number.isFinite(playerX) || !Number.isFinite(playerY) || !Number.isInteger(playerZ)) {
    return false;
  }
  const playerCol = Math.floor(playerX / TILE_SIZE);
  const playerRow = Math.floor(playerY / TILE_SIZE);
  if (
    lastRoofWorldMap === worldMap &&
    lastRoofPlayerCol === playerCol &&
    lastRoofPlayerRow === playerRow &&
    lastRoofPlayerZ === playerZ
  ) {
    return true;
  }

  const nextHiddenRoofIds = new Set();
  if (playerZ === worldMap.z) {
    for (const zone of worldMap.roofRevealZones ?? []) {
      const widthTiles = Math.max(1, Math.ceil(zone.width / TILE_SIZE));
      const heightTiles = Math.max(1, Math.ceil(zone.height / TILE_SIZE));
      if (
        playerCol >= zone.col &&
        playerCol < zone.col + widthTiles &&
        playerRow >= zone.row &&
        playerRow < zone.row + heightTiles
      ) {
        const roofId = zone.properties?.roofId;
        if (roofId) {
          nextHiddenRoofIds.add(roofId);
        }
      }
    }
  }

  for (const roofId of hiddenRoofIds) {
    if (!nextHiddenRoofIds.has(roofId)) {
      setRoofHidden(roofId, false);
    }
  }
  for (const roofId of nextHiddenRoofIds) {
    if (!hiddenRoofIds.has(roofId)) {
      setRoofHidden(roofId, true);
    }
  }
  lastRoofWorldMap = worldMap;
  lastRoofPlayerCol = playerCol;
  lastRoofPlayerRow = playerRow;
  lastRoofPlayerZ = playerZ;
  return true;
};
//#endregion  -----  RENDU - TOITS  -----

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

const prewarmEffectFrameTextures = () => {
  if (!worldEntityTextureByKey?.has("effects")) {
    return;
  }

  for (const effectData of Object.values(groundEffectsDatabase)) {
    if (effectData.atlas !== "effects") {
      continue;
    }
    const frameCount = (effectData.framesPerStage ?? 1) * 3;
    for (let frame = 0; frame < frameCount; frame++) {
      getEntityFrameTexture(
        "effects",
        (effectData.atlasCol + frame) * EFFECT_ATLAS_CELL_SIZE,
        effectData.atlasRow * EFFECT_ATLAS_CELL_SIZE,
        EFFECT_ATLAS_CELL_SIZE,
        EFFECT_ATLAS_CELL_SIZE,
      );
    }
  }

  const animationDefinitions = Object.values(combatEffectsDatabase).flatMap((effectData) =>
    Number.isInteger(effectData?.row) ? [effectData] : Object.values(effectData ?? {}),
  );
  for (const animation of animationDefinitions) {
    for (let frame = 0; frame < animation.frameCount; frame++) {
      getEntityFrameTexture(
        "effects",
        (animation.startCol + frame) * EFFECT_ATLAS_CELL_SIZE,
        animation.row * EFFECT_ATLAS_CELL_SIZE,
        EFFECT_ATLAS_CELL_SIZE,
        EFFECT_ATLAS_CELL_SIZE,
      );
    }
  }
};

export const loadPixiWorldEntityTextures = async ({
  playerTextureUrlsByLayer = null,
  itemTextureUrl = null,
  monsterTextureUrl = null,
  npcTextureUrlsById = {},
}) => {
  if (!(worldEntityTextureByKey instanceof Map)) {
    return false;
  }

  const textureUrlsByKey = new Map();
  if (playerTextureUrlsByLayer !== null) {
    for (const layerName of PLAYER_APPEARANCE_LAYER_ORDER) {
      const textureUrl = playerTextureUrlsByLayer?.[layerName];
      if (typeof textureUrl !== "string" || textureUrl === "") {
        return false;
      }
      textureUrlsByKey.set(`player:${layerName}`, textureUrl);
    }
  }
  if (itemTextureUrl !== null) {
    if (typeof itemTextureUrl !== "string" || itemTextureUrl === "") {
      return false;
    }
    textureUrlsByKey.set("items", itemTextureUrl);
  }
  if (monsterTextureUrl !== null) {
    if (typeof monsterTextureUrl !== "string" || monsterTextureUrl === "") {
      return false;
    }
    textureUrlsByKey.set("monsters", monsterTextureUrl);
  }
  for (const [npcId, textureUrl] of Object.entries(npcTextureUrlsById)) {
    if (typeof npcId !== "string" || npcId === "" || typeof textureUrl !== "string" || textureUrl === "") {
      return false;
    }
    textureUrlsByKey.set(`npc:${npcId}`, textureUrl);
  }
  const effectTextureEntry = Object.entries(effectImageUrlModulesByPath).find(([path]) => path.endsWith(`/${EFFECT_ATLAS_FILE_NAME}`));
  if (effectTextureEntry) {
    textureUrlsByKey.set("effects", effectTextureEntry[1]);
  }

  const unloadedEntries = [...textureUrlsByKey.entries()]
    .filter(([textureKey]) => !worldEntityTextureByKey.has(textureKey));
  const textures = await Promise.all(unloadedEntries.map(([, textureUrl]) => Assets.load(textureUrl)));
  unloadedEntries.forEach(([textureKey], index) => worldEntityTextureByKey.set(textureKey, textures[index]));

  entityFrameTextureByCacheKey = new Map();
  prewarmEffectFrameTextures();
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
    const texture = getEntityFrameTexture(`player:${layerName}`, sourceX, sourceY, sourceWidth, sourceHeight);
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

  if (playerContainer.x !== x) playerContainer.x = x;
  if (playerContainer.y !== y) playerContainer.y = y;
  if (playerContainer.zIndex !== zIndex) playerContainer.zIndex = zIndex;
  return true;
};

export const upsertPixiRemotePlayerAppearance = async ({ uid, appearanceKey, textureUrlsByLayer }) => {
  if (
    !entityContainer ||
    !entityNameplateContainer ||
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
    const nameplateContainer = new Container();
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
    skull.addChild(skullHead, skullFace);
    name.anchor.set(0.5, 1);
    name.x = TILE_SIZE / 2;
    name.y = -7;
    health.x = 8;
    health.y = -4;
    container.label = `remote-player:${uid}`;
    nameplateContainer.label = `remote-player-nameplate:${uid}`;
    container.addChild(selection);
    nameplateContainer.addChild(name, healthBackground, health, skull);
    entityContainer.addChild(container);
    entityNameplateContainer.addChild(nameplateContainer);
    refs = {
      container,
      nameplateContainer,
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
  refs.name.tint = refs.skull.visible ? 0xff5a50 : 0x3cff00;
  const nextName = String(name ?? "");
  if (refs.name.text !== nextName) {
    refs.name.text = nextName;
  }
  const skullX = refs.name.x + refs.name.width / 2 + 10;
  const skullY = refs.name.y - refs.name.height / 2;
  if (refs.skull.x !== skullX) refs.skull.x = skullX;
  if (refs.skull.y !== skullY) refs.skull.y = skullY;
  if (refs.container.x !== x) refs.container.x = x;
  if (refs.container.y !== y) refs.container.y = y;
  if (refs.container.zIndex !== zIndex) refs.container.zIndex = zIndex;
  if (refs.nameplateContainer.x !== x) refs.nameplateContainer.x = x;
  if (refs.nameplateContainer.y !== y) refs.nameplateContainer.y = y;
  if (refs.nameplateContainer.zIndex !== zIndex) refs.nameplateContainer.zIndex = zIndex;
  return true;
};

export const removePixiRemotePlayerVisual = (uid) => {
  const refs = remotePlayerVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }
  refs.container.destroy({ children: true });
  refs.nameplateContainer.destroy({ children: true });
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
  if (refs.sprite.x !== x) refs.sprite.x = x;
  if (refs.sprite.y !== y) refs.sprite.y = y;
  if (refs.sprite.zIndex !== zIndex) refs.sprite.zIndex = zIndex;
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

  if (refs.container.x !== x) refs.container.x = x;
  if (refs.container.y !== y) refs.container.y = y;
  if (refs.container.zIndex !== zIndex) refs.container.zIndex = zIndex;
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
    const texture = getEntityFrameTexture("items", part.sourceX, part.sourceY, part.sourceWidth, part.sourceHeight);
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

  if (refs.container.x !== x) refs.container.x = x;
  if (refs.container.y !== y) refs.container.y = y;
  if (refs.container.zIndex !== zIndex) refs.container.zIndex = zIndex;
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
export const upsertPixiGroundEffectVisual = ({
  uid,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  textureKey = "items",
  animationFrames = 1,
  animationFrameMs = 0,
  frameStride = sourceWidth,
  x,
  y,
}) => {
  if (
    !groundEffectContainer ||
    !(groundEffectVisualsByUid instanceof Map) ||
    !Number.isInteger(uid) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return false;
  }

  const texture = getEntityFrameTexture(textureKey, sourceX, sourceY, sourceWidth, sourceHeight);
  if (!texture) {
    return false;
  }

  let refs = groundEffectVisualsByUid.get(uid);
  if (!refs) {
    const sprite = new Sprite(texture);
    sprite.label = `ground-effect:${uid}`;
    groundEffectContainer.addChild(sprite);
    refs = { sprite };
    groundEffectVisualsByUid.set(uid, refs);
  } else {
    refs.sprite.texture = texture;
  }

  refs.textureKey = textureKey;
  refs.sourceX = sourceX;
  refs.sourceY = sourceY;
  refs.sourceWidth = sourceWidth;
  refs.sourceHeight = sourceHeight;
  refs.animationFrames = Math.max(1, animationFrames);
  refs.animationFrameMs = Math.max(0, animationFrameMs);
  refs.frameStride = frameStride;
  refs.renderedFrame = 0;
  refs.sprite.x = x;
  refs.sprite.y = y;
  return true;
};

export const removePixiGroundEffectVisual = (uid) => {
  const refs = groundEffectVisualsByUid?.get(uid);
  if (!refs) {
    return false;
  }
  refs.sprite.destroy();
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

const getCombatEffectAnimation = (effectId, variant) => {
  const elementalEffects = getElementCombatEffects(effectId);
  if (elementalEffects && variant in elementalEffects) {
    return elementalEffects[variant];
  }
  return combatEffectsDatabase[effectId] ?? null;
};

const setCombatEffectFrame = (refs, frame) => {
  if (refs.renderedFrame === frame) {
    return;
  }
  refs.sprite.texture = getEntityFrameTexture(
    "effects",
    (refs.animation.startCol + frame) * EFFECT_ATLAS_CELL_SIZE,
    refs.animation.row * EFFECT_ATLAS_CELL_SIZE,
    EFFECT_ATLAS_CELL_SIZE,
    EFFECT_ATLAS_CELL_SIZE,
  );
  refs.renderedFrame = frame;
};

const acquireCombatEffectVisual = () => {
  let refs = availableCombatEffectVisuals.pop() ?? null;
  if (!refs) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    sprite.visible = false;
    sprite.label = "combat-effect";
    feedbackEffectContainer.addChild(sprite);
    refs = { sprite, active: false, renderedFrame: -1 };
    combatEffectVisualPool.push(refs);
  }
  refs.active = true;
  refs.sprite.visible = true;
  refs.renderedFrame = -1;
  return refs;
};

const releaseCombatEffectVisual = (refs) => {
  if (!refs.active) {
    return;
  }
  refs.active = false;
  refs.sprite.visible = false;
  refs.animation = null;
  refs.impactAnimation = null;
  availableCombatEffectVisuals.push(refs);
};

export const playPixiCombatEffect = ({
  effectId,
  variant = "impact",
  startX,
  startY,
  targetX = startX,
  targetY = startY,
  speedPixelsPerSecond = 900,
}) => {
  if (
    !feedbackEffectContainer ||
    !(combatEffectVisualPool instanceof Array) ||
    !worldEntityTextureByKey?.has("effects") ||
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(targetX) ||
    !Number.isFinite(targetY)
  ) {
    return false;
  }
  const animation = getCombatEffectAnimation(effectId, variant);
  if (!animation) {
    return false;
  }
  const refs = acquireCombatEffectVisual();
  refs.effectId = effectId;
  refs.variant = variant;
  refs.animation = animation;
  refs.impactAnimation = variant === "projectile" ? getCombatEffectAnimation(effectId, "impact") : null;
  refs.elapsedMs = 0;
  refs.startX = startX;
  refs.startY = startY;
  refs.targetX = targetX;
  refs.targetY = targetY;
  refs.distanceX = targetX - startX;
  refs.distanceY = targetY - startY;
  refs.travelDurationMs = variant === "projectile"
    ? Math.max(100, Math.min((Math.hypot(refs.distanceX, refs.distanceY) / speedPixelsPerSecond) * 1000, 600))
    : 0;
  refs.sprite.x = startX;
  refs.sprite.y = startY;
  setCombatEffectFrame(refs, 0);
  return true;
};

const updatePixiCombatEffects = (ticker) => {
  if (!(combatEffectVisualPool instanceof Array)) {
    return;
  }
  for (const refs of combatEffectVisualPool) {
    if (!refs.active) {
      continue;
    }
    refs.elapsedMs += ticker.deltaMS;
    if (refs.variant === "projectile") {
      const progress = Math.min(refs.elapsedMs / refs.travelDurationMs, 1);
      refs.sprite.x = refs.startX + refs.distanceX * progress;
      refs.sprite.y = refs.startY + refs.distanceY * progress;
      if (progress < 1) {
        continue;
      }
      if (!refs.impactAnimation) {
        releaseCombatEffectVisual(refs);
        continue;
      }
      refs.variant = "impact";
      refs.animation = refs.impactAnimation;
      refs.impactAnimation = null;
      refs.elapsedMs = 0;
      refs.renderedFrame = -1;
      setCombatEffectFrame(refs, 0);
      continue;
    }
    const frame = Math.floor(refs.elapsedMs / refs.animation.frameMs);
    if (frame >= refs.animation.frameCount) {
      releaseCombatEffectVisual(refs);
      continue;
    }
    setCombatEffectFrame(refs, frame);
  }
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
        mark.graphic.y = Math.sin(mark.angle + progress * 0.45) * 10 - progress * (18 + (index % 3));
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

const renderChunkDepthLayers = (worldMap, chunk) => {
  const depthRowContainers = [];

  for (let localRow = 0; localRow < CHUNK_SIZE_TILES; localRow++) {
    let rowContainer = null;
    const worldRow = chunk.chunkY * CHUNK_SIZE_TILES + localRow;

    for (const layerName of MAP_DEPTH_LAYER_NAMES) {
      const layerGids = chunk.layers?.[layerName];
      if (!Array.isArray(layerGids)) {
        continue;
      }

      for (let localCol = 0; localCol < CHUNK_SIZE_TILES; localCol++) {
        const gid = layerGids[localRow * CHUNK_SIZE_TILES + localCol];
        if (!Number.isFinite(gid) || gid <= 0) {
          continue;
        }

        if (!rowContainer) {
          rowContainer = new Container();
          rowContainer.label = `${chunk.z}:${chunk.chunkX}:${chunk.chunkY}:depth-row:${worldRow}`;
          rowContainer.zIndex = getWorldRenderZIndex(worldRow * TILE_SIZE);
        }

        const worldCol = chunk.chunkX * CHUNK_SIZE_TILES + localCol;
        const sprite = createTileSprite(worldMap.tilesets, gid, worldCol * TILE_SIZE, worldRow * TILE_SIZE);
        if (sprite) {
          rowContainer.addChild(sprite);
        }
      }
    }

    if (rowContainer) {
      depthRowContainers.push(rowContainer);
    }
  }

  return depthRowContainers;
};

const renderChunkRoofLayer = (chunkContainer, worldMap, chunk) => {
  const roofContainersForChunk = new Map();
  const layerGids = chunk?.layers?.[MAP_ROOF_LAYER_NAME];
  if (!Array.isArray(layerGids)) {
    return roofContainersForChunk;
  }
  for (const [index, gid] of layerGids.entries()) {
    if (!Number.isFinite(gid) || gid <= 0) {
      continue;
    }
    const localCol = index % CHUNK_SIZE_TILES;
    const localRow = Math.floor(index / CHUNK_SIZE_TILES);
    const worldCol = chunk.chunkX * CHUNK_SIZE_TILES + localCol;
    const worldRow = chunk.chunkY * CHUNK_SIZE_TILES + localRow;
    const roofId = getRoofIdAtWorldTile(worldMap, worldCol, worldRow);
    let targetContainer = chunkContainer;
    if (roofId) {
      targetContainer = roofContainersForChunk.get(roofId);
      if (!targetContainer) {
        targetContainer = new Container();
        targetContainer.label = `${chunk.z}:${chunk.chunkX}:${chunk.chunkY}:roof:${roofId}`;
        chunkContainer.addChild(targetContainer);
        roofContainersForChunk.set(roofId, targetContainer);
      }
    }
    const sprite = createTileSprite(worldMap.tilesets, gid, worldCol * TILE_SIZE, worldRow * TILE_SIZE);
    if (sprite) {
      targetContainer.addChild(sprite);
    }
  }
  return roofContainersForChunk;
};

const renderWorldChunk = (worldMap, chunk) => {
  if (!worldMap || !chunk) {
    return null;
  }

  const chunkKey = `${worldMap.z}:${chunk.chunkX}:${chunk.chunkY}`;
  const layerContainersByName = new Map();
  const depthRowContainers = renderChunkDepthLayers(worldMap, chunk);
  let roofContainersForChunk = new Map();

  for (const layerName of [...MAP_BELOW_LAYER_NAMES, ...MAP_TOP_LAYER_NAMES, MAP_ROOF_LAYER_NAME]) {
    const layerContainer = new Container();
    layerContainer.label = `${chunkKey}:${layerName}`;
    if (layerName === MAP_ROOF_LAYER_NAME) {
      roofContainersForChunk = renderChunkRoofLayer(layerContainer, worldMap, chunk);
    } else {
      renderChunkTileLayer(layerContainer, worldMap, chunk, layerName);
    }
    layerContainersByName.set(layerName, layerContainer);
  }

  return {
    layerContainersByName,
    depthRowContainers,
    roofContainersById: roofContainersForChunk,
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
      unregisterChunkRoofContainers(chunkRenderRefs);
      for (const layerContainer of chunkRenderRefs.layerContainersByName.values()) {
        layerContainer.removeFromParent();
      }
      for (const rowContainer of chunkRenderRefs.depthRowContainers) {
        rowContainer.removeFromParent();
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
    unregisterChunkRoofContainers(chunkRenderRefs);
    for (const layerContainer of chunkRenderRefs.layerContainersByName.values()) {
      layerContainer.removeFromParent();
    }
    for (const rowContainer of chunkRenderRefs.depthRowContainers) {
      rowContainer.removeFromParent();
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
    !entityContainer ||
    !topContainer ||
    !roofContainer
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

    for (const rowContainer of chunkRenderRefs.depthRowContainers) {
      entityContainer.addChild(rowContainer);
    }

    for (const layerName of MAP_TOP_LAYER_NAMES) {
      const layerContainer = chunkRenderRefs.layerContainersByName.get(layerName);
      const worldLayerContainer = mapLayerContainersByName.get(layerName);
      if (layerContainer && worldLayerContainer) {
        worldLayerContainer.addChild(layerContainer);
      }
    }

    const roofChunkContainer = chunkRenderRefs.layerContainersByName.get(MAP_ROOF_LAYER_NAME);
    if (roofChunkContainer) {
      roofContainer.addChild(roofChunkContainer);
      for (const [roofId, container] of chunkRenderRefs.roofContainersById) {
        registerRoofContainer(roofId, container);
      }
    }

    renderedChunkContainersByKey.set(chunkKey, chunkRenderRefs);
  }
};
//#endregion  -----  RENDU - VISIBILITE CHUNKS  -----

/* ==================================================== */
//#region     -----  PIXI - INITIALISATION  -----
/* ==================================================== */
/* ---------- APPLICATION ET CONTAINERS ---------- */
export const initializePixiRenderer = async ({ htmlParentElement, gameWidth, gameHeight, lightingPresets }) => {
  try {
    if (pixiApp) {
      return true;
    }
    if (!htmlParentElement) {
      console.error("[Pixi] No parent element provided for Pixi renderer");
      return false;
    }

    pixiApp = new Application();
    console.log("[Pixi] Application created");

    requestedPixiRenderer = getRequestedPixiRenderer(globalThis.location?.search ?? "");

    await pixiApp.init({
      width: gameWidth,
      height: gameHeight,
      antialias: true,
      clearBeforeRender: true,
      preference: getPixiRendererPreference(requestedPixiRenderer),
      powerPreference: "high-performance",
    });
    console.log(`[Pixi] ${pixiApp.renderer.name} renderer initialized, canvas ready`);

    if (!pixiApp.canvas) {
      console.error("[Pixi] Failed to create canvas");
      return false;
    }

    pixiApp.canvas.classList.add("pixi-canvas");
    pixiApp.canvas.dataset.pixiRenderer = pixiApp.renderer.name;
    htmlParentElement.appendChild(pixiApp.canvas);
    console.log("[Pixi] Canvas appended to DOM");

    worldContainer = new Container();
    mapBelowContainer = new Container();
    entityContainer = new Container();
    groundEffectContainer = new Container();
    itemUseTargetContainer = new Container();
    projectileContainer = new Container();
    topContainer = new Container();
    doorUpperContainer = new Container();
    roofContainer = new Container();
    feedbackEffectContainer = new Container();
    entityNameplateContainer = new Container();
    mapLayerContainersByName = new Map();

    entityContainer.sortableChildren = true;
    entityNameplateContainer.sortableChildren = true;
    worldContainer.sortableChildren = true;

    mapBelowContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.mapBelow;
    itemUseTargetContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.itemUseTarget;
    entityContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.entity;
    projectileContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.projectile;
    topContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.top;
    doorUpperContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.doorUpper;
    roofContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.roof;
    feedbackEffectContainer.zIndex = WORLD_ROOT_RENDER_Z_INDEX.feedbackEffect;

    pixiApp.stage.addChild(worldContainer);
    worldContainer.addChild(mapBelowContainer);
    worldContainer.addChild(itemUseTargetContainer);
    worldContainer.addChild(entityContainer);
    worldContainer.addChild(projectileContainer);
    worldContainer.addChild(topContainer);
    worldContainer.addChild(doorUpperContainer);
    worldContainer.addChild(roofContainer);
    worldContainer.addChild(feedbackEffectContainer);
    console.log("[Pixi] Stage hierarchy created");

    for (const layerName of MAP_BELOW_LAYER_NAMES) {
      const layerContainer = new Container();
      layerContainer.label = layerName;
      mapBelowContainer.addChild(layerContainer);
      mapLayerContainersByName.set(layerName, layerContainer);
      if (layerName === "groundDetails") {
        mapBelowContainer.addChild(groundEffectContainer);
      }
    }

    for (const layerName of MAP_TOP_LAYER_NAMES) {
      const layerContainer = new Container();
      layerContainer.label = layerName;
      topContainer.addChild(layerContainer);
      mapLayerContainersByName.set(layerName, layerContainer);
    }

    tilesetImageUrlByFileName = createTilesetImageUrlByFileName();
    tilesetTextureByImageFileName = new Map();
    tilesetTextureLoadPromiseByImageFileName = new Map();
    tileTextureByCacheKey = new Map();
    renderedChunkContainersByKey = new Map();
    worldEntityTextureByKey = new Map();
    entityFrameTextureByCacheKey = new Map();
    playerContainer = null;
    playerSpritesByLayer = null;
    remotePlayerVisualsByUid = new Map();
    monsterVisualsByUid = new Map();
    npcVisualsByUid = new Map();
    doorVisualsByUid = new Map();
    roofContainersById = new Map();
    hiddenRoofIds = new Set();
    activeRoofFadeIds = new Set();
    roofFadeTargetById = new Map();
    roofAlphaById = new Map();
    lastRoofWorldMap = null;
    lastRoofPlayerCol = null;
    lastRoofPlayerRow = null;
    lastRoofPlayerZ = null;
    worldItemVisualsByUid = new Map();
    groundEffectVisualsByUid = new Map();
    groundEffectAnimationFrame = 0;
    groundEffectAnimationElapsedMs = 0;
    combatEffectVisualPool = [];
    availableCombatEffectVisuals = [];
    itemUseTargetVisualsByKey = new Map();
    itemUseTargetAnimationElapsedMs = 0;
    minimapChunkCanvasesByWorldMap = new WeakMap();
    worldItemSelectionFilter = new ColorMatrixFilter();
    worldItemSelectionFilter.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    initializePixiLighting({ gameWidth, gameHeight, lightingPresets });
    pixiApp.stage.addChild(entityNameplateContainer);
    pixiApp.ticker.add(updatePixiItemUseTargetAnimation);
    pixiApp.ticker.add(updatePixiGroundEffectAnimations);
    pixiApp.ticker.add(updatePixiCombatEffects);
    pixiApp.ticker.add(updateRoofFades);
    pixiApp.stop();
    console.log("[Pixi] Initialization complete");
    return true;
  } catch (error) {
    console.error("[Pixi] Initialization failed:", error);
    return false;
  }
};

const updatePixiGroundEffectAnimations = (ticker) => {
  if (!(groundEffectVisualsByUid instanceof Map) || groundEffectVisualsByUid.size === 0) {
    return;
  }
  groundEffectAnimationElapsedMs += ticker.deltaMS;
  const nextGlobalFrame = Math.floor(groundEffectAnimationElapsedMs / 180);
  if (nextGlobalFrame === groundEffectAnimationFrame) {
    return;
  }
  groundEffectAnimationFrame = nextGlobalFrame;
  for (const refs of groundEffectVisualsByUid.values()) {
    if (refs.animationFrames <= 1 || refs.animationFrameMs <= 0) {
      continue;
    }
    const frame = Math.floor(groundEffectAnimationElapsedMs / refs.animationFrameMs) % refs.animationFrames;
    if (frame === refs.renderedFrame) {
      continue;
    }
    refs.sprite.texture = getEntityFrameTexture(
      refs.textureKey,
      refs.sourceX + frame * refs.frameStride,
      refs.sourceY,
      refs.sourceWidth,
      refs.sourceHeight,
    );
    refs.renderedFrame = frame;
  }
};
//#endregion  -----  PIXI - INITIALISATION  -----

export const getPixiRendererDiagnostics = () => {
  const selectedRenderer = pixiApp?.renderer?.name ?? null;
  return {
    requestedRenderer: requestedPixiRenderer,
    selectedRenderer,
    didFallback: requestedPixiRenderer !== null && selectedRenderer !== requestedPixiRenderer,
    lightingReady: Boolean(lightingRenderTexture && lightingRenderOptions && lightingOverlaySprite),
    lighting: {
      activeTorchCount: lightingActiveTorchCount,
      pooledTorchCount: lightingTorchVisualPool?.length ?? 0,
      torchCutoutTextureCount: lightingTorchCutoutTextureByRadius?.size ?? 0,
      torchGlowTextureCount: lightingTorchGlowTextureByRadius?.size ?? 0,
      spellCutoutTextureCount: lightingSpellCutoutTextureByRadius?.size ?? 0,
      spellGlowTextureCount: lightingSpellGlowTextureByRadius?.size ?? 0,
    },
  };
};

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
  if (!worldContainer || !entityNameplateContainer || !Number.isFinite(cameraX) || !Number.isFinite(cameraY)) {
    return;
  }
  worldContainer.x = -cameraX;
  worldContainer.y = -cameraY;
  entityNameplateContainer.x = -cameraX;
  entityNameplateContainer.y = -cameraY;
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

  const renderGeneration = ++visibleChunkRenderGeneration;
  const visibleChunkKeys = getVisibleChunkKeys(worldMap, centerChunkX, centerChunkY, radiusChunks);
  await loadTilesetTexturesForChunks(worldMap, visibleChunkKeys);
  if (renderGeneration !== visibleChunkRenderGeneration) {
    return;
  }

  if (!(tileTextureByCacheKey instanceof Map)) {
    tileTextureByCacheKey = new Map();
  }
  removeHiddenChunkContainers(visibleChunkKeys);
  addVisibleChunkContainers(worldMap, visibleChunkKeys);
};
//#endregion  -----  PIXI - RENDU MAP  -----
