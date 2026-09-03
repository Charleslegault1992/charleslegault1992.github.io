export const TILED_TILE_LAYER_NAMES = Object.freeze([
  "ground",
  "groundBorders",
  "groundDetails",
  "walls",
  "objects",
  "top",
  "topDeco",
  "roofs",
  "collision",
]);

export const TILED_OBJECT_LAYER_NAMES = Object.freeze([
  "interactables",
  "roofAreas",
  "roofRevealZones",
  "doors",
  "transitions",
  "spawns",
  "npcs",
  "zones",
  "raid_markers",
]);

export const createTiledLayerCollections = (layerNames) => {
  const layers = {};
  for (const layerName of layerNames) {
    layers[layerName] = [];
  }
  return layers;
};
