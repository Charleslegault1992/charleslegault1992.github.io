import { normalizeCharacterAppearanceColors, normalizeCharacterAppearanceParts } from "../characterSaveStore.js";
import { PLAYER_APPEARANCE_LAYER_ORDER, TILE_SIZE } from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";

export const PLAYER_FRAME_WIDTH = TILE_SIZE;
export const PLAYER_FRAME_HEIGHT = TILE_SIZE * 2;
export const PLAYER_ANIMATION_FRAMES = 4;
export const DEFAULT_PLAYER_APPEARANCE_ID = "male";
const playerAppearanceLayerTexturePromiseByCacheKey = new Map();
const playerAppearanceSourceImagePromiseByUrl = new Map();
export const playerAppearancesDatabase = {
  male: {
    appearanceId: "male",
    label: "Boy",
  },
  female: {
    appearanceId: "female",
    label: "Girl",
  },
};
export const playerAppearancePartsDatabase = {
  head: {
    partId: "head",
    layerName: "head",
    label: "1",
    colorKey: "hair",
    colorMask: "hair",
    referenceBrightness: 105,
    textureUrl: new URL("../assets/images/joueurs/head.png", import.meta.url).href,
  },
  head1: {
    partId: "head1",
    layerName: "head",
    label: "2",
    colorKey: "hair",
    colorMask: "hair",
    referenceBrightness: 105,
    textureUrl: new URL("../assets/images/joueurs/head1.png", import.meta.url).href,
  },
  body: {
    partId: "body",
    layerName: "body",
    label: "1",
    colorKey: "clothes",
    colorMask: "clothes",
    referenceBrightness: 230,
    textureUrl: new URL("../assets/images/joueurs/body.png", import.meta.url).href,
  },
  body2: {
    partId: "body2",
    layerName: "body",
    label: "2",
    colorKey: "clothes",
    colorMask: "clothes",
    referenceBrightness: 230,
    textureUrl: new URL("../assets/images/joueurs/body2.png", import.meta.url).href,
  },
  legs: {
    partId: "legs",
    layerName: "legs",
    label: "Legs",
    colorKey: "pants",
    colorMask: "all",
    referenceBrightness: 120,
    textureUrl: new URL("../assets/images/joueurs/legs.png", import.meta.url).href,
  },
  boots: {
    partId: "boots",
    layerName: "boots",
    label: "Boots",
    colorKey: "shoes",
    colorMask: "all",
    referenceBrightness: 75,
    textureUrl: new URL("../assets/images/joueurs/boots.png", import.meta.url).href,
  },
};

export const getPlayerAppearanceData = (appearanceId = DEFAULT_PLAYER_APPEARANCE_ID) => {
  return playerAppearancesDatabase[appearanceId] ?? playerAppearancesDatabase[DEFAULT_PLAYER_APPEARANCE_ID];
};

const getPlayerAppearancePartData = (partId) => {
  return playerAppearancePartsDatabase[partId] ?? null;
};

export const clearPlayerAppearanceColorTextureCache = (colorKey, previousColor) => {
  for (const partData of Object.values(playerAppearancePartsDatabase)) {
    if (partData.colorKey === colorKey) {
      playerAppearanceLayerTexturePromiseByCacheKey.delete(`${partData.partId}:${previousColor}`);
    }
  }
};

const getPlayerAppearancePartsByLayer = (appearanceParts) => {
  const normalizedParts = normalizeCharacterAppearanceParts(appearanceParts);
  return {
    head: getPlayerAppearancePartData(normalizedParts.headId),
    body: getPlayerAppearancePartData(normalizedParts.bodyId),
    legs: getPlayerAppearancePartData(normalizedParts.legsId),
    boots: getPlayerAppearancePartData(normalizedParts.bootsId),
  };
};

const parseHexColor = (hexColor) => {
  const normalizedColor = normalizeCharacterAppearanceColors({ hair: hexColor, clothes: hexColor }).hair;
  return {
    red: Number.parseInt(normalizedColor.slice(1, 3), 16),
    green: Number.parseInt(normalizedColor.slice(3, 5), 16),
    blue: Number.parseInt(normalizedColor.slice(5, 7), 16),
  };
};

const loadPlayerAppearanceSourceImage = (textureUrl) => {
  if (!playerAppearanceSourceImagePromiseByUrl.has(textureUrl)) {
    playerAppearanceSourceImagePromiseByUrl.set(
      textureUrl,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", reject, { once: true });
        image.src = textureUrl;
      }),
    );
  }
  return playerAppearanceSourceImagePromiseByUrl.get(textureUrl);
};

const collectAppearanceHairPixels = (pixelData, imageWidth, frameCol, frameRow) => {
  const selectedPixelIndexes = [];

  for (let localY = 0; localY < PLAYER_FRAME_HEIGHT; localY++) {
    for (let localX = 0; localX < PLAYER_FRAME_WIDTH; localX++) {
      const imageX = frameCol * PLAYER_FRAME_WIDTH + localX;
      const imageY = frameRow * PLAYER_FRAME_HEIGHT + localY;
      const pixelOffset = (imageY * imageWidth + imageX) * 4;
      const red = pixelData[pixelOffset];
      const green = pixelData[pixelOffset + 1];
      const blue = pixelData[pixelOffset + 2];
      const alpha = pixelData[pixelOffset + 3];
      const isHairPalette =
        alpha > 24 &&
        red >= 35 &&
        green <= 2 &&
        Math.abs(red - blue) <= 2;
      if (isHairPalette) {
        selectedPixelIndexes.push(pixelOffset);
      }
    }
  }
  return selectedPixelIndexes;
};

const collectAppearanceClothesPixels = (pixelData) => {
  const selectedPixelIndexes = [];
  for (let pixelOffset = 0; pixelOffset < pixelData.length; pixelOffset += 4) {
    const red = pixelData[pixelOffset];
    const green = pixelData[pixelOffset + 1];
    const blue = pixelData[pixelOffset + 2];
    const alpha = pixelData[pixelOffset + 3];
    const brightness = (red + green + blue) / 3;
    const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (alpha > 24 && brightness >= 45 && colorSpread <= 35) {
      selectedPixelIndexes.push(pixelOffset);
    }
  }
  return selectedPixelIndexes;
};

const collectAllOpaqueAppearancePixels = (pixelData) => {
  const selectedPixelIndexes = [];
  for (let pixelOffset = 0; pixelOffset < pixelData.length; pixelOffset += 4) {
    const brightness =
      (pixelData[pixelOffset] + pixelData[pixelOffset + 1] + pixelData[pixelOffset + 2]) / 3;
    if (pixelData[pixelOffset + 3] > 24 && brightness > 14) {
      selectedPixelIndexes.push(pixelOffset);
    }
  }
  return selectedPixelIndexes;
};

const recolorAppearancePixels = (pixelData, pixelIndexes, targetColor, referenceBrightness) => {
  for (const pixelOffset of pixelIndexes) {
    const brightness =
      (pixelData[pixelOffset] + pixelData[pixelOffset + 1] + pixelData[pixelOffset + 2]) / 3;
    const shade = clamp(brightness / referenceBrightness, 0.2, 1.35);
    pixelData[pixelOffset] = Math.min(255, Math.round(targetColor.red * shade));
    pixelData[pixelOffset + 1] = Math.min(255, Math.round(targetColor.green * shade));
    pixelData[pixelOffset + 2] = Math.min(255, Math.round(targetColor.blue * shade));
  }
};

const createPlayerAppearancePartTextureUrl = async (partData, targetHexColor) => {
  const sourceImage = await loadPlayerAppearanceSourceImage(partData.textureUrl);
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return partData.textureUrl;
  }

  context.drawImage(sourceImage, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let pixelIndexes = [];
  if (partData.colorMask === "hair") {
    for (let frameRow = 0; frameRow < PLAYER_ANIMATION_FRAMES; frameRow++) {
      for (let frameCol = 0; frameCol < PLAYER_ANIMATION_FRAMES; frameCol++) {
        pixelIndexes.push(...collectAppearanceHairPixels(imageData.data, canvas.width, frameCol, frameRow));
      }
    }
  } else if (partData.colorMask === "clothes") {
    pixelIndexes = collectAppearanceClothesPixels(imageData.data);
  } else {
    pixelIndexes = collectAllOpaqueAppearancePixels(imageData.data);
  }
  recolorAppearancePixels(
    imageData.data,
    pixelIndexes,
    parseHexColor(targetHexColor),
    partData.referenceBrightness,
  );
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

export const getPlayerAppearanceLayerTextureUrls = (appearanceParts, appearanceColors) => {
  const partsByLayer = getPlayerAppearancePartsByLayer(appearanceParts);
  const normalizedColors = normalizeCharacterAppearanceColors(appearanceColors);
  const textureUrlPromises = PLAYER_APPEARANCE_LAYER_ORDER.map(async (layerName) => {
    const partData = partsByLayer[layerName];
    const targetColor = normalizedColors[partData.colorKey];
    const cacheKey = `${partData.partId}:${targetColor}`;
    if (!playerAppearanceLayerTexturePromiseByCacheKey.has(cacheKey)) {
      playerAppearanceLayerTexturePromiseByCacheKey.set(
        cacheKey,
        createPlayerAppearancePartTextureUrl(partData, targetColor).catch(() => partData.textureUrl),
      );
    }
    return [layerName, await playerAppearanceLayerTexturePromiseByCacheKey.get(cacheKey)];
  });
  return Promise.all(textureUrlPromises).then((entries) => Object.fromEntries(entries));
};

const getOrCreatePlayerAppearancePreviewLayers = (element) => {
  const layersByName = new Map();
  for (const layerName of PLAYER_APPEARANCE_LAYER_ORDER) {
    let layerElement = element.querySelector(`[data-appearance-layer="${layerName}"]`);
    if (!layerElement) {
      layerElement = document.createElement("span");
      layerElement.classList.add("character-appearance-layer");
      layerElement.dataset.appearanceLayer = layerName;
      element.appendChild(layerElement);
    }
    layersByName.set(layerName, layerElement);
  }
  return layersByName;
};

export const applyPlayerAppearanceBackground = async (element, appearanceParts, appearanceColors) => {
  if (!element) {
    return;
  }
  const normalizedParts = normalizeCharacterAppearanceParts(appearanceParts);
  const normalizedColors = normalizeCharacterAppearanceColors(appearanceColors);
  const requestKey = `${normalizedParts.headId}:${normalizedParts.bodyId}:${normalizedColors.hair}:${normalizedColors.clothes}:${normalizedColors.pants}:${normalizedColors.shoes}`;
  element.dataset.appearanceRequestKey = requestKey;
  const layersByName = getOrCreatePlayerAppearancePreviewLayers(element);
  const textureUrlsByLayer = await getPlayerAppearanceLayerTextureUrls(normalizedParts, normalizedColors);
  if (element.dataset.appearanceRequestKey !== requestKey) {
    return;
  }
  for (const [layerName, textureUrl] of Object.entries(textureUrlsByLayer)) {
    const layerElement = layersByName.get(layerName);
    if (layerElement) {
      layerElement.style.backgroundImage = `url("${textureUrl}")`;
    }
  }
};
