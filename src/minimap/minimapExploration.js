import {
  CHUNK_SIZE_TILES,
  MINIMAP_DISCOVERY_RADIUS_X,
  MINIMAP_DISCOVERY_RADIUS_Y,
  TILE_SIZE,
} from "../core/gameConstants.js";
import {
  getLocalTileIndexInChunk,
  getWorldChunkForTilePosition,
} from "../world/worldCoordinates.js";

const discoveredTileIndexesByChunkKey = new Map();

let lastDiscoveryCol = null;
let lastDiscoveryRow = null;
let lastDiscoveryZ = null;

const getMinimapExplorationChunkKey = (z, col, row) => {
  if (!Number.isInteger(z) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
  const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
  return `${z}:${chunkX}:${chunkY}`;
};

const discoverMinimapTile = (worldMap, col, row) => {
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  const chunkKey = getMinimapExplorationChunkKey(worldMap?.z, col, row);
  const tileIndex = getLocalTileIndexInChunk(col, row);
  if (!chunk || !chunkKey || !Number.isInteger(tileIndex)) {
    return false;
  }
  let discoveredIndexes = discoveredTileIndexesByChunkKey.get(chunkKey);
  if (!discoveredIndexes) {
    discoveredIndexes = new Set();
    discoveredTileIndexesByChunkKey.set(chunkKey, discoveredIndexes);
  }
  const wasAlreadyDiscovered = discoveredIndexes.has(tileIndex);
  discoveredIndexes.add(tileIndex);
  return !wasAlreadyDiscovered;
};

export const serializeMinimapExploration = () => {
  const serializedExploration = {};
  for (const [chunkKey, discoveredIndexes] of discoveredTileIndexesByChunkKey.entries()) {
    serializedExploration[chunkKey] = Array.from(discoveredIndexes).sort((firstIndex, secondIndex) => {
      return firstIndex - secondIndex;
    });
  }
  return serializedExploration;
};

export const hydrateMinimapExploration = (serializedExploration) => {
  discoveredTileIndexesByChunkKey.clear();
  if (!serializedExploration || typeof serializedExploration !== "object") {
    return;
  }
  const maxTileIndex = CHUNK_SIZE_TILES * CHUNK_SIZE_TILES;
  for (const [chunkKey, discoveredIndexes] of Object.entries(serializedExploration)) {
    if (!Array.isArray(discoveredIndexes)) {
      continue;
    }
    const validIndexes = discoveredIndexes.filter((index) => {
      return Number.isInteger(index) && index >= 0 && index < maxTileIndex;
    });
    discoveredTileIndexesByChunkKey.set(chunkKey, new Set(validIndexes));
  }
  lastDiscoveryCol = null;
  lastDiscoveryRow = null;
  lastDiscoveryZ = null;
};

export const isMinimapTileDiscovered = (z, col, row) => {
  const chunkKey = getMinimapExplorationChunkKey(z, col, row);
  const tileIndex = getLocalTileIndexInChunk(col, row);
  if (!chunkKey || !Number.isInteger(tileIndex)) {
    return false;
  }
  return discoveredTileIndexesByChunkKey.get(chunkKey)?.has(tileIndex) === true;
};

export const revealMinimapAroundPlayer = (worldMap, playerState) => {
  if (!worldMap || !playerState) {
    return false;
  }
  const playerCol = Math.floor(playerState.x / TILE_SIZE);
  const playerRow = Math.floor(playerState.y / TILE_SIZE);
  if (lastDiscoveryCol === playerCol && lastDiscoveryRow === playerRow && lastDiscoveryZ === playerState.z) {
    return false;
  }

  let didDiscoverTile = false;
  for (let row = playerRow - MINIMAP_DISCOVERY_RADIUS_Y; row <= playerRow + MINIMAP_DISCOVERY_RADIUS_Y; row++) {
    for (let col = playerCol - MINIMAP_DISCOVERY_RADIUS_X; col <= playerCol + MINIMAP_DISCOVERY_RADIUS_X; col++) {
      if (discoverMinimapTile(worldMap, col, row)) {
        didDiscoverTile = true;
      }
    }
  }
  lastDiscoveryCol = playerCol;
  lastDiscoveryRow = playerRow;
  lastDiscoveryZ = playerState.z;
  return didDiscoverTile;
};
