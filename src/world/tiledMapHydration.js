export const getFileNameFromPath = (path) => {
  if (typeof path !== "string" || path === "") {
    return null;
  }
  return path.replaceAll("\\", "/").split("/").at(-1);
};

export const hydrateTiledMapTilesets = (tiledMap, tilesetRawByFileName) => {
  if (!Array.isArray(tiledMap?.tilesets) || !(tilesetRawByFileName instanceof Map)) {
    return null;
  }
  const hydratedTilesets = [];
  for (const tilesetRef of tiledMap.tilesets) {
    const fileName = getFileNameFromPath(tilesetRef.source);
    const rawData = fileName ? tilesetRawByFileName.get(fileName) : null;
    if (!rawData) {
      return null;
    }
    hydratedTilesets.push({ ...JSON.parse(rawData), ...tilesetRef });
  }
  return { ...tiledMap, tilesets: hydratedTilesets };
};
