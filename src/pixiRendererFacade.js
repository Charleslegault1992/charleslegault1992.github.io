let pixiRenderer = null;
let pixiRendererLoadPromise = null;

const loadPixiRenderer = async () => {
  if (pixiRenderer) {
    return pixiRenderer;
  }
  if (!pixiRendererLoadPromise) {
    pixiRendererLoadPromise = import("./pixiRenderer.js");
  }
  pixiRenderer = await pixiRendererLoadPromise;
  return pixiRenderer;
};

const callPixiRenderer = (methodName, args, fallbackValue = undefined) => {
  const method = pixiRenderer?.[methodName];
  if (typeof method !== "function") {
    return fallbackValue;
  }
  return method(...args);
};

export const initializePixiRenderer = async (options) => {
  const renderer = await loadPixiRenderer();
  return renderer.initializePixiRenderer(options);
};

export const loadPixiWorldEntityTextures = async (options) => {
  const renderer = await loadPixiRenderer();
  return renderer.loadPixiWorldEntityTextures(options);
};

export const renderPixiWorldMap = async (worldMap) => {
  const renderer = await loadPixiRenderer();
  return renderer.renderPixiWorldMap(worldMap);
};

export const renderPixiVisibleWorldChunks = async (...args) => {
  const renderer = await loadPixiRenderer();
  return renderer.renderPixiVisibleWorldChunks(...args);
};

export const drawPixiMinimapRegion = (...args) => callPixiRenderer("drawPixiMinimapRegion", args, false);
export const setPixiPlayerFrame = (...args) => callPixiRenderer("setPixiPlayerFrame", args, false);
export const updatePixiPlayerTransform = (...args) => callPixiRenderer("updatePixiPlayerTransform", args, false);
export const upsertPixiRemotePlayerAppearance = async (...args) => {
  const renderer = await loadPixiRenderer();
  return renderer.upsertPixiRemotePlayerAppearance(...args);
};
export const updatePixiRemotePlayerVisual = (...args) => callPixiRenderer("updatePixiRemotePlayerVisual", args, false);
export const removePixiRemotePlayerVisual = (...args) => callPixiRenderer("removePixiRemotePlayerVisual", args, false);
export const clearPixiRemotePlayerVisuals = (...args) => callPixiRenderer("clearPixiRemotePlayerVisuals", args);
export const upsertPixiNpcVisual = (...args) => callPixiRenderer("upsertPixiNpcVisual", args, false);
export const updatePixiNpcTransform = (...args) => callPixiRenderer("updatePixiNpcTransform", args, false);
export const removePixiNpcVisual = (...args) => callPixiRenderer("removePixiNpcVisual", args, false);
export const clearPixiNpcVisuals = (...args) => callPixiRenderer("clearPixiNpcVisuals", args);
export const upsertPixiMonsterVisual = (...args) => callPixiRenderer("upsertPixiMonsterVisual", args, false);
export const updatePixiMonsterTransform = (...args) => callPixiRenderer("updatePixiMonsterTransform", args, false);
export const setPixiMonsterSelected = (...args) => callPixiRenderer("setPixiMonsterSelected", args, false);
export const clearPixiMonsterSelection = (...args) => callPixiRenderer("clearPixiMonsterSelection", args);
export const removePixiMonsterVisual = (...args) => callPixiRenderer("removePixiMonsterVisual", args, false);
export const clearPixiMonsterVisuals = (...args) => callPixiRenderer("clearPixiMonsterVisuals", args);
export const upsertPixiWorldItemVisual = (...args) => callPixiRenderer("upsertPixiWorldItemVisual", args, false);
export const updatePixiWorldItemTransform = (...args) => callPixiRenderer("updatePixiWorldItemTransform", args, false);
export const setPixiWorldItemSelected = (...args) => callPixiRenderer("setPixiWorldItemSelected", args, false);
export const clearPixiWorldItemSelection = (...args) => callPixiRenderer("clearPixiWorldItemSelection", args);
export const removePixiWorldItemVisual = (...args) => callPixiRenderer("removePixiWorldItemVisual", args, false);
export const clearPixiWorldItemVisuals = (...args) => callPixiRenderer("clearPixiWorldItemVisuals", args);
export const upsertPixiGroundEffectVisual = (...args) => callPixiRenderer("upsertPixiGroundEffectVisual", args, false);
export const removePixiGroundEffectVisual = (...args) => callPixiRenderer("removePixiGroundEffectVisual", args, false);
export const clearPixiGroundEffectVisuals = (...args) => callPixiRenderer("clearPixiGroundEffectVisuals", args);
export const setPixiItemUseTargets = (...args) => callPixiRenderer("setPixiItemUseTargets", args, false);
export const clearPixiItemUseTargets = (...args) => callPixiRenderer("clearPixiItemUseTargets", args);
export const playPixiItemProjectile = (...args) => callPixiRenderer("playPixiItemProjectile", args, false);
export const playPixiCombatEffect = (...args) => callPixiRenderer("playPixiCombatEffect", args, false);
export const playPixiRewardChestEffect = (...args) => callPixiRenderer("playPixiRewardChestEffect", args, false);
export const playPixiSpellEffect = (...args) => callPixiRenderer("playPixiSpellEffect", args, false);
export const renderPixiFrame = (...args) => callPixiRenderer("renderPixiFrame", args);
export const updatePixiCamera = (...args) => callPixiRenderer("updatePixiCamera", args);
export const updatePixiLighting = (frame) => pixiRenderer?.updatePixiLighting(frame) ?? false;
