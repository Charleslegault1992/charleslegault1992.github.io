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
    if (
      Number.isFinite(tilesetRef?.firstgid) &&
      Number.isFinite(tilesetRef?.columns) &&
      Number.isFinite(tilesetRef?.tilewidth) &&
      Number.isFinite(tilesetRef?.tileheight) &&
      typeof tilesetRef?.image === "string" &&
      tilesetRef.image !== ""
    ) {
      hydratedTilesets.push({ ...tilesetRef, source: tilesetRef.source ?? `embedded:${tilesetRef.name ?? tilesetRef.image}` });
      continue;
    }
    const fileName = getFileNameFromPath(tilesetRef.source);
    const rawData = fileName ? tilesetRawByFileName.get(fileName) : null;
    if (!rawData) {
      return null;
    }
    hydratedTilesets.push({ ...JSON.parse(rawData), ...tilesetRef });
  }
  return { ...tiledMap, tilesets: hydratedTilesets };
};
