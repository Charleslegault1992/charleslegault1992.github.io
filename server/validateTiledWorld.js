import { open, readFile, readdir } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { monstersDatabase } from "../src/data/monstersDatabase.js";
import { npcsDatabase } from "../src/data/npcsDatabase.js";
import { decodeTiledGid, getTileRenderDataFromGid } from "../src/tiledGidResolver.js";
import {
  TILED_OBJECT_LAYER_NAMES,
  TILED_TILE_LAYER_NAMES,
} from "../src/world/tiledLayerSchema.js";

const CHUNK_SIZE_TILES = 16;
const TILE_SIZE = 64;
const WORLD_MAP_FILE_PATTERN = /^world_z-?\d+\.tmj$/;
const PNG_HEADER_LENGTH = 24;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_DIAGNOSTICS = 200;
const MONSTER_ID_SET = new Set(Object.keys(monstersDatabase));
const NPC_ID_SET = new Set(Object.keys(npcsDatabase));
const TILED_OBJECT_LAYER_NAME_SET = new Set(TILED_OBJECT_LAYER_NAMES);
const TILED_TILE_LAYER_NAME_SET = new Set(TILED_TILE_LAYER_NAMES);

const defaultMapsDirectory = new URL("../src/assets/maps/tiled/", import.meta.url);

const addDiagnostic = (diagnostics, severity, fileName, message) => {
  if (diagnostics.length >= MAX_DIAGNOSTICS) {
    diagnostics.suppressedCount += 1;
    return;
  }
  diagnostics.push({ severity, fileName, message });
};

const readJson = async (fileUrl, diagnostics) => {
  const fileName = basename(fileURLToPath(fileUrl));
  try {
    return JSON.parse(await readFile(fileUrl, "utf8"));
  } catch (error) {
    addDiagnostic(diagnostics, "error", fileName, `JSON illisible: ${error.message}`);
    return null;
  }
};

const readPngDimensions = async (imageUrl) => {
  const file = await open(imageUrl, "r");
  try {
    const header = Buffer.allocUnsafe(PNG_HEADER_LENGTH);
    const { bytesRead } = await file.read(header, 0, PNG_HEADER_LENGTH, 0);
    if (
      bytesRead !== PNG_HEADER_LENGTH ||
      !header.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
      header.toString("ascii", 12, 16) !== "IHDR"
    ) {
      throw new Error("le fichier n'est pas un PNG valide");
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await file.close();
  }
};

const getPropertiesByName = (object, diagnostics, fileName, layerName) => {
  const propertiesByName = new Map();
  for (const property of object?.properties ?? []) {
    if (typeof property?.name !== "string" || property.name === "") {
      addDiagnostic(diagnostics, "error", fileName, `${layerName} #${object?.id}: propriete sans nom.`);
      continue;
    }
    if (propertiesByName.has(property.name)) {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `${layerName} #${object?.id}: propriete dupliquee "${property.name}".`,
      );
    }
    propertiesByName.set(property.name, property.value);
  }
  return propertiesByName;
};

const validateObjectLayer = (layer, context) => {
  const { diagnostics, fileName, objectIds, semanticIds } = context;
  if (!Array.isArray(layer.objects)) {
    addDiagnostic(diagnostics, "error", fileName, `${layer.name}: liste d'objets absente.`);
    return;
  }

  for (const object of layer.objects) {
    if (!Number.isInteger(object?.id) || object.id <= 0) {
      addDiagnostic(diagnostics, "error", fileName, `${layer.name}: objet avec ID Tiled invalide.`);
    } else if (objectIds.has(object.id)) {
      addDiagnostic(diagnostics, "error", fileName, `ID Tiled duplique: ${object.id}.`);
    } else {
      objectIds.add(object.id);
    }

    if (!Number.isFinite(object?.x) || !Number.isFinite(object?.y)) {
      addDiagnostic(diagnostics, "error", fileName, `${layer.name} #${object?.id}: position invalide.`);
    }

    const properties = getPropertiesByName(object, diagnostics, fileName, layer.name);
    const semanticPropertyByLayer = {
      interactables: "interactableId",
      doors: "doorId",
      spawns: "spawnId",
      npcs: "npcId",
    };
    const semanticProperty = semanticPropertyByLayer[layer.name];
    if (!semanticProperty) {
      continue;
    }

    const semanticId = properties.get(semanticProperty);
    if (typeof semanticId !== "string" || semanticId.trim() === "") {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `${layer.name} #${object?.id}: propriete ${semanticProperty} absente.`,
      );
      continue;
    }
    const semanticNamespace = layer.name === "doors" || layer.name === "interactables" ? "interactables" : layer.name;
    const semanticKey = `${semanticNamespace}:${semanticId}`;
    if (semanticIds.has(semanticKey)) {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `${layer.name}: ${semanticProperty} duplique "${semanticId}".`,
      );
    } else {
      semanticIds.add(semanticKey);
    }

    if (layer.name === "npcs" && !NPC_ID_SET.has(semanticId)) {
      addDiagnostic(diagnostics, "error", fileName, `npcs #${object.id}: npcId inconnu "${semanticId}".`);
    }
    if (
      layer.name === "spawns" &&
      properties.get("spawnType") === "monster" &&
      !MONSTER_ID_SET.has(properties.get("monsterId"))
    ) {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `spawns #${object.id}: monsterId inconnu "${properties.get("monsterId")}".`,
      );
    }
  }
};

const validateTileLayer = (layer, context) => {
  const { diagnostics, fileName, mapTilesets, tilesetUsage } = context;
  if (!Array.isArray(layer.chunks)) {
    addDiagnostic(diagnostics, "error", fileName, `${layer.name}: chunks absents.`);
    return;
  }

  const chunkPositions = new Set();
  for (const chunk of layer.chunks) {
    const chunkLabel = `${layer.name} (${chunk?.x}, ${chunk?.y})`;
    if (
      !Number.isInteger(chunk?.x) ||
      !Number.isInteger(chunk?.y) ||
      chunk.width !== CHUNK_SIZE_TILES ||
      chunk.height !== CHUNK_SIZE_TILES
    ) {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `${chunkLabel}: chunk attendu en ${CHUNK_SIZE_TILES}x${CHUNK_SIZE_TILES}.`,
      );
      continue;
    }
    if (chunk.x % CHUNK_SIZE_TILES !== 0 || chunk.y % CHUNK_SIZE_TILES !== 0) {
      addDiagnostic(diagnostics, "error", fileName, `${chunkLabel}: origine non alignee sur la grille de chunks.`);
    }

    const chunkKey = `${chunk.x}:${chunk.y}`;
    if (chunkPositions.has(chunkKey)) {
      addDiagnostic(diagnostics, "error", fileName, `${layer.name}: chunk duplique a ${chunkKey}.`);
    }
    chunkPositions.add(chunkKey);

    if (!Array.isArray(chunk.data) || chunk.data.length !== chunk.width * chunk.height) {
      addDiagnostic(diagnostics, "error", fileName, `${chunkLabel}: nombre de GID incorrect.`);
      continue;
    }

    for (let index = 0; index < chunk.data.length; index += 1) {
      const rawGid = chunk.data[index];
      if (rawGid === 0) {
        continue;
      }
      const decodedGid = decodeTiledGid(rawGid);
      const renderData = getTileRenderDataFromGid(mapTilesets, rawGid);
      if (!decodedGid || !renderData) {
        addDiagnostic(
          diagnostics,
          "error",
          fileName,
          `${chunkLabel} index ${index}: GID ${rawGid} ne correspond a aucune tile valide.`,
        );
        continue;
      }
      if (decodedGid.rotateHexagonal120) {
        addDiagnostic(
          diagnostics,
          "error",
          fileName,
          `${chunkLabel} index ${index}: rotation hexagonale interdite sur une map orthogonale.`,
        );
      }
      tilesetUsage.set(renderData.tileset, (tilesetUsage.get(renderData.tileset) ?? 0) + 1);
      const imageWidth = renderData.tileset.imagewidth;
      const imageHeight = renderData.tileset.imageheight;
      if (
        renderData.sourceX + renderData.sourceWidth > imageWidth ||
        renderData.sourceY + renderData.sourceHeight > imageHeight
      ) {
        addDiagnostic(
          diagnostics,
          "error",
          fileName,
          `${chunkLabel} index ${index}: GID ${rawGid} sort de l'image du tileset ${renderData.tileset.name}.`,
        );
      }
    }
  }
};

const validateTilesetMetadata = (tileset, fileName, diagnostics) => {
  const positiveIntegerProperties = ["firstgid", "columns", "tilecount", "tilewidth", "tileheight", "imagewidth", "imageheight"];
  for (const propertyName of positiveIntegerProperties) {
    if (!Number.isInteger(tileset?.[propertyName]) || tileset[propertyName] <= 0) {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `Tileset ${tileset?.name ?? "sans nom"}: ${propertyName} doit etre un entier positif.`,
      );
    }
  }
  if (typeof tileset?.image !== "string" || tileset.image === "") {
    addDiagnostic(diagnostics, "error", fileName, `Tileset ${tileset?.name ?? "sans nom"}: image absente.`);
  }
  if (tileset?.tilewidth !== TILE_SIZE || tileset?.tileheight !== TILE_SIZE) {
    addDiagnostic(
      diagnostics,
      "error",
      fileName,
      `Tileset ${tileset?.name ?? "sans nom"}: tiles attendues en ${TILE_SIZE}x${TILE_SIZE}.`,
    );
  }

  const margin = tileset?.margin ?? 0;
  const spacing = tileset?.spacing ?? 0;
  if (!Number.isInteger(margin) || margin < 0 || !Number.isInteger(spacing) || spacing < 0) {
    addDiagnostic(diagnostics, "error", fileName, `Tileset ${tileset?.name ?? "sans nom"}: margin ou spacing invalide.`);
  }
  if (
    Number.isInteger(tileset?.tilecount) &&
    tileset.tilecount > 0 &&
    Number.isInteger(tileset?.columns) &&
    tileset.columns > 0 &&
    Number.isInteger(tileset?.imagewidth) &&
    Number.isInteger(tileset?.imageheight)
  ) {
    const lastTileId = tileset.tilecount - 1;
    const lastTileCol = lastTileId % tileset.columns;
    const lastTileRow = Math.floor(lastTileId / tileset.columns);
    const lastTileRight = margin + lastTileCol * (TILE_SIZE + spacing) + TILE_SIZE;
    const lastTileBottom = margin + lastTileRow * (TILE_SIZE + spacing) + TILE_SIZE;
    if (lastTileRight > tileset.imagewidth || lastTileBottom > tileset.imageheight) {
      addDiagnostic(
        diagnostics,
        "error",
        fileName,
        `Tileset ${tileset.name}: tilecount depasse les dimensions declarees de l'image.`,
      );
    }
  }
};

const loadMapTilesets = async (map, mapUrl, diagnostics, pngDimensionPromises) => {
  const fileName = basename(fileURLToPath(mapUrl));
  if (!Array.isArray(map?.tilesets)) {
    addDiagnostic(diagnostics, "error", fileName, "Liste de tilesets absente.");
    return [];
  }

  const mapTilesets = [];
  for (const reference of map.tilesets) {
    let tileset = reference;
    let tilesetUrl = mapUrl;
    if (typeof reference?.source === "string" && reference.source !== "") {
      tilesetUrl = new URL(reference.source, mapUrl);
      const externalTileset = await readJson(tilesetUrl, diagnostics);
      if (!externalTileset) {
        continue;
      }
      tileset = { ...externalTileset, ...reference };
    }

    validateTilesetMetadata(tileset, fileName, diagnostics);
    tileset.__validationImageUrl =
      typeof tileset.image === "string" && tileset.image !== "" ? new URL(tileset.image, tilesetUrl) : null;
    if (tileset.__validationImageUrl) {
      const imageKey = tileset.__validationImageUrl.href;
      if (!pngDimensionPromises.has(imageKey)) {
        pngDimensionPromises.set(
          imageKey,
          readPngDimensions(tileset.__validationImageUrl).then(
            (dimensions) => ({ dimensions, error: null }),
            (error) => ({ dimensions: null, error }),
          ),
        );
      }
      tileset.__validationImagePromise = pngDimensionPromises.get(imageKey);
    }
    mapTilesets.push(tileset);
  }
  return mapTilesets;
};

const validateTilesetRanges = (mapTilesets, fileName, diagnostics) => {
  const sortedTilesets = [...mapTilesets].sort((first, second) => first.firstgid - second.firstgid);
  for (let index = 1; index < sortedTilesets.length; index += 1) {
    const previous = sortedTilesets[index - 1];
    const current = sortedTilesets[index];
    if (
      Number.isInteger(previous.firstgid) &&
      Number.isInteger(previous.tilecount) &&
      Number.isInteger(current.firstgid) &&
      current.firstgid < previous.firstgid + previous.tilecount
    ) {
      addDiagnostic(
        diagnostics,
        "warning",
        fileName,
        `Tilesets ${previous.name} et ${current.name}: plages GID superposees.`,
      );
    }
  }
};

const validateTilesetImages = async (mapTilesets, tilesetUsage, fileName, diagnostics) => {
  for (const tileset of mapTilesets) {
    const usedTileCount = tilesetUsage.get(tileset) ?? 0;
    const severity = usedTileCount > 0 ? "error" : "warning";
    if (!tileset.__validationImagePromise) {
      continue;
    }
    const { dimensions, error } = await tileset.__validationImagePromise;
    if (!error) {
      if (dimensions.width !== tileset.imagewidth || dimensions.height !== tileset.imageheight) {
        const imageIsSmallerThanMetadata =
          dimensions.width < tileset.imagewidth || dimensions.height < tileset.imageheight;
        addDiagnostic(
          diagnostics,
          imageIsSmallerThanMetadata ? severity : "warning",
          fileName,
          `Tileset ${tileset.name}: PNG ${dimensions.width}x${dimensions.height}, metadata ${tileset.imagewidth}x${tileset.imageheight}.`,
        );
      }
    } else {
      addDiagnostic(
        diagnostics,
        severity,
        fileName,
        `Tileset ${tileset.name}: image introuvable ou invalide (${error.message}).`,
      );
    }
  }
};

const validateMap = async (map, mapUrl, diagnostics, stats, pngDimensionPromises, semanticIds) => {
  const fileName = basename(fileURLToPath(mapUrl));
  if (map?.orientation !== "orthogonal") {
    addDiagnostic(diagnostics, "error", fileName, "Seules les maps orthogonales sont supportees.");
  }
  if (map?.infinite !== true) {
    addDiagnostic(diagnostics, "error", fileName, "La map doit utiliser les chunks infinis de Tiled.");
  }
  if (map?.tilewidth !== TILE_SIZE || map?.tileheight !== TILE_SIZE) {
    addDiagnostic(diagnostics, "error", fileName, `La grille Tiled doit etre en ${TILE_SIZE}x${TILE_SIZE}.`);
  }

  const mapTilesets = await loadMapTilesets(map, mapUrl, diagnostics, pngDimensionPromises);
  validateTilesetRanges(mapTilesets, fileName, diagnostics);
  const tilesetUsage = new Map();
  const objectIds = new Set();
  const layerNames = new Set();

  if (!Array.isArray(map?.layers)) {
    addDiagnostic(diagnostics, "error", fileName, "Liste de layers absente.");
    return;
  }

  for (const layer of map.layers) {
    if (typeof layer?.name !== "string" || layer.name === "") {
      addDiagnostic(diagnostics, "error", fileName, "Layer sans nom.");
      continue;
    }
    if (layerNames.has(layer.name)) {
      addDiagnostic(diagnostics, "error", fileName, `Layer duplique: ${layer.name}.`);
    }
    layerNames.add(layer.name);

    const context = { diagnostics, fileName, mapTilesets, tilesetUsage, objectIds, semanticIds };
    if (layer.type === "tilelayer") {
      if (!TILED_TILE_LAYER_NAME_SET.has(layer.name)) {
        addDiagnostic(diagnostics, "error", fileName, `Tile layer inconnu: ${layer.name}.`);
        continue;
      }
      validateTileLayer(layer, context);
    } else if (layer.type === "objectgroup") {
      if (!TILED_OBJECT_LAYER_NAME_SET.has(layer.name)) {
        addDiagnostic(diagnostics, "error", fileName, `Object layer inconnu: ${layer.name}.`);
        continue;
      }
      validateObjectLayer(layer, context);
    } else {
      addDiagnostic(diagnostics, "error", fileName, `Type de layer non supporte: ${layer.type ?? "absent"}.`);
    }
  }

  await validateTilesetImages(mapTilesets, tilesetUsage, fileName, diagnostics);
  stats.mapCount += 1;
  stats.tilesetCount += mapTilesets.length;
  stats.usedTileCount += [...tilesetUsage.values()].reduce((total, count) => total + count, 0);
};

export const validateTiledWorldAssets = async ({ mapsDirectory = defaultMapsDirectory } = {}) => {
  const directoryUrl = mapsDirectory instanceof URL ? mapsDirectory : pathToFileURL(`${mapsDirectory}/`);
  const diagnostics = [];
  diagnostics.suppressedCount = 0;
  const stats = { mapCount: 0, tilesetCount: 0, usedTileCount: 0 };
  const pngDimensionPromises = new Map();
  const semanticIds = new Set();
  const mapFileNames = (await readdir(directoryUrl)).filter((fileName) => WORLD_MAP_FILE_PATTERN.test(fileName)).sort();

  if (mapFileNames.length === 0) {
    addDiagnostic(diagnostics, "error", basename(fileURLToPath(directoryUrl)), "Aucune map world_z*.tmj trouvee.");
  }
  for (const fileName of mapFileNames) {
    const mapUrl = new URL(fileName, directoryUrl);
    const map = await readJson(mapUrl, diagnostics);
    if (map) {
      await validateMap(map, mapUrl, diagnostics, stats, pngDimensionPromises, semanticIds);
    }
  }

  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
    suppressedDiagnosticCount: diagnostics.suppressedCount,
    stats,
  };
};

export const formatTiledWorldValidationReport = (report) => {
  const lines = [];
  for (const diagnostic of [...report.errors, ...report.warnings]) {
    lines.push(`${diagnostic.severity === "error" ? "ERREUR" : "AVERTISSEMENT"} ${diagnostic.fileName}: ${diagnostic.message}`);
  }
  if (report.suppressedDiagnosticCount > 0) {
    lines.push(`${report.suppressedDiagnosticCount} diagnostic(s) additionnel(s) masque(s).`);
  }
  lines.push(
    `${report.stats.mapCount} map(s), ${report.stats.tilesetCount} tileset(s), ${report.stats.usedTileCount} tile(s) utilisee(s), ${report.errors.length} erreur(s), ${report.warnings.length} avertissement(s).`,
  );
  return lines.join("\n");
};

const isExecutedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isExecutedDirectly) {
  const report = await validateTiledWorldAssets();
  console.log(formatTiledWorldValidationReport(report));
  if (report.errors.length > 0) {
    process.exitCode = 1;
  }
}
