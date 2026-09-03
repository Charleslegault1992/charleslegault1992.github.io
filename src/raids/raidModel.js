import { TILE_SIZE } from "../core/gameConstants.js";

export const RAID_PHASE = Object.freeze({
  idle: "idle",
  countdown: "countdown",
  monsters: "monsters",
  boss: "boss",
  completed: "completed",
  failed: "failed",
});

export const getRaidMarkers = (worldMapsByZ, raidId) => {
  const markers = [];

  for (const worldMap of worldMapsByZ?.values?.() ?? []) {
    for (const chunk of worldMap.chunksByKey?.values?.() ?? []) {
      for (const marker of chunk.raid_markers ?? []) {
        if (marker.properties?.raidId === raidId) {
          markers.push(marker);
        }
      }
    }
  }

  return markers;
};

export const getRaidMarkerByName = (worldMapsByZ, raidId, name) => {
  return getRaidMarkers(worldMapsByZ, raidId).find((marker) => marker.name === name) ?? null;
};

export const getRaidMonsterSpawnMarkers = (worldMapsByZ, raidId) => {
  return getRaidMarkers(worldMapsByZ, raidId).filter(
    (marker) => marker.properties?.spawnType === "monster",
  );
};

export const getRaidBossSpawnMarker = (worldMapsByZ, raidId) => {
  return getRaidMarkers(worldMapsByZ, raidId).find(
    (marker) =>
      marker.name === "raid_boss_spawn" ||
      marker.properties?.spawnType === "boss",
  ) ?? null;
};

export const getRaidPortalCollisionTiles = (portalMarker) => {
  if (
    !Number.isInteger(portalMarker?.col) ||
    !Number.isInteger(portalMarker?.row) ||
    !Number.isInteger(portalMarker?.z)
  ) {
    return [];
  }

  const offsets = [
    [-1, -1],
    [0, -1],
    [1, -1],

    [-1, 0],
    [1, 0],

    [-1, 1],
    [1, 1],
  ];

  return offsets.map(([colOffset, rowOffset]) => ({
    z: portalMarker.z,
    col: portalMarker.col + colOffset,
    row: portalMarker.row + rowOffset,
  }));
};

export const createRaidPortalTransition = (portalMarker) => {
  const targetCol = portalMarker?.properties?.targetCol;
  const targetRow = portalMarker?.properties?.targetRow;
  const targetZ = portalMarker?.properties?.targetZ;

  if (
    !Number.isInteger(targetCol) ||
    !Number.isInteger(targetRow) ||
    !Number.isInteger(targetZ)
  ) {
    return null;
  }

  return {
    z: portalMarker.z,
    col: portalMarker.col,
    row: portalMarker.row + 1,
    x: portalMarker.col * TILE_SIZE,
    y: (portalMarker.row + 1) * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE,

    properties: {
      transitionType: "portal",
      targetCol,
      targetRow,
      targetZ,
      raidId: portalMarker.properties?.raidId,
      raidExit: true,
    },
  };
};
