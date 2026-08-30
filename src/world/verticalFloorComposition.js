const getChunkKey = (z, chunkX, chunkY) => `${z}:${chunkX}:${chunkY}`;

export const getLowerWorldMaps = (worldMapsByZ, currentZ) => {
  if (!(worldMapsByZ instanceof Map) || !Number.isInteger(currentZ)) {
    return [];
  }

  return [...worldMapsByZ.values()]
    .filter((worldMap) => Number.isInteger(worldMap?.z) && worldMap.z < currentZ)
    .sort((left, right) => right.z - left.z);
};

export const createVerticalFallbackPlan = ({
  worldMapsByZ,
  currentWorldMap,
  chunkX,
  chunkY,
  chunkSizeTiles,
  surfaceLayerName = "ground",
}) => {
  if (
    !(worldMapsByZ instanceof Map) ||
    !Number.isInteger(currentWorldMap?.z) ||
    !Number.isInteger(chunkX) ||
    !Number.isInteger(chunkY) ||
    !Number.isInteger(chunkSizeTiles) ||
    chunkSizeTiles <= 0
  ) {
    return null;
  }

  const tileCount = chunkSizeTiles * chunkSizeTiles;
  const currentChunk = currentWorldMap.chunksByKey?.get(getChunkKey(currentWorldMap.z, chunkX, chunkY)) ?? null;
  const currentSurface = currentChunk?.layers?.[surfaceLayerName];
  const lowerChunkSources = [];

  for (const lowerWorldMap of getLowerWorldMaps(worldMapsByZ, currentWorldMap.z)) {
    const lowerChunk = lowerWorldMap.chunksByKey?.get(getChunkKey(lowerWorldMap.z, chunkX, chunkY)) ?? null;
    if (lowerChunk) {
      lowerChunkSources.push({ worldMap: lowerWorldMap, chunk: lowerChunk });
    }
  }

  if (lowerChunkSources.length === 0) {
    return null;
  }

  const sourcesByTileIndex = new Array(tileCount).fill(null);
  const sourceChunkKeysByWorldMap = new Map();
  let fallbackTileCount = 0;

  for (let index = 0; index < tileCount; index++) {
    if (Number.isFinite(currentSurface?.[index]) && currentSurface[index] > 0) {
      continue;
    }

    for (const source of lowerChunkSources) {
      const lowerSurface = source.chunk.layers?.[surfaceLayerName];
      if (!Number.isFinite(lowerSurface?.[index]) || lowerSurface[index] <= 0) {
        continue;
      }

      sourcesByTileIndex[index] = source;
      let chunkKeys = sourceChunkKeysByWorldMap.get(source.worldMap);
      if (!chunkKeys) {
        chunkKeys = new Set();
        sourceChunkKeysByWorldMap.set(source.worldMap, chunkKeys);
      }
      chunkKeys.add(getChunkKey(source.worldMap.z, chunkX, chunkY));
      fallbackTileCount++;
      break;
    }
  }

  if (fallbackTileCount === 0) {
    return null;
  }

  return {
    key: `${currentWorldMap.z}:${chunkX}:${chunkY}`,
    chunkX,
    chunkY,
    sourcesByTileIndex,
    sourceChunkKeysByWorldMap,
    fallbackTileCount,
  };
};
