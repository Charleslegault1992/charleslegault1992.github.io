import {
  MINIMAP_AUTOWALK_MAX_DISTANCE_TILES,
  MINIMAP_DEFAULT_CELL_SIZE,
  MINIMAP_DYNAMIC_REFRESH_MS,
  MINIMAP_MONSTER_REVEAL_RANGE_TILES,
  MINIMAP_ZOOM_LEVELS,
  TILE_SIZE,
} from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";
import { getGameUiText } from "../localization/gameLocalization.js";
import { drawPixiMinimapRegion } from "../pixiRendererFacade.js";
import { characterSelectorUiState, combatTargetState, gameRuntimeState, pixiWorldRenderState } from "../state/clientRuntimeState.js";
import { gameOptionsUiState } from "../state/gameOptionsState.js";
import { playerState } from "../state/playerState.js";
import { monsterElementsByUid, monstersByUid, npcElementsByUid, npcsByUid } from "../state/worldState.js";
import {
  minimapCanvas,
  minimapFloorDownButton,
  minimapFloorLevel,
  minimapFloorUpButton,
  minimapZoomInButton,
  minimapZoomLevel,
  minimapZoomOutButton,
  playerMinimap,
} from "../ui/domRefs.js";
import { getWorldChunkForTilePosition, getWorldLayerGidAtTile, getTilePosition } from "../world/worldCoordinates.js";
import { getCurrentWorldMap } from "../world/worldRuntime.js";
import { isMinimapTileDiscovered, revealMinimapAroundPlayer } from "./minimapExploration.js";

const getMinimapTileColor = (worldMap, col, row) => {
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!chunk) {
    return "#050505";
  }
  if (getWorldLayerGidAtTile(worldMap, "ground", col, row) <= 0) {
    return "#0b0a09";
  }
  if (getWorldLayerGidAtTile(worldMap, "collision", col, row) > 0) {
    return "#312e28";
  }
  if (
    getWorldLayerGidAtTile(worldMap, "walls", col, row) > 0 ||
    getWorldLayerGidAtTile(worldMap, "objects", col, row) > 0
  ) {
    return "#554b3b";
  }
  if (getWorldLayerGidAtTile(worldMap, "groundDetails", col, row) > 0) {
    return "#756b56";
  }
  return "#91846a";
};

export const createMinimapController = ({
  playerNavigationState,
  playerNavigationMode,
  saveGameOptions,
  showStatusMessage,
  startPlayerClickNavigation,
}) => {
  const state = {
    context: minimapCanvas?.getContext("2d") ?? null,
    cellSize: MINIMAP_ZOOM_LEVELS.includes(gameOptionsUiState.values.minimapCellSize)
      ? gameOptionsUiState.values.minimapCellSize
      : MINIMAP_DEFAULT_CELL_SIZE,
    centerCol: null,
    centerRow: null,
    firstCol: null,
    firstRow: null,
    visibleCols: null,
    visibleRows: null,
    isFollowingPlayer: true,
    viewZ: null,
    lastPlayerCol: null,
    lastPlayerRow: null,
    lastZ: null,
    lastViewZ: null,
    lastCenterCol: null,
    lastCenterRow: null,
    lastCellSize: null,
    nextDynamicRenderAt: 0,
    panPointerId: null,
    panStartClientX: null,
    panStartClientY: null,
    panStartCenterCol: null,
    panStartCenterRow: null,
    didPan: false,
  };

  const getWorldMap = () => {
    if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
      return null;
    }
    const viewZ = Number.isInteger(state.viewZ) ? state.viewZ : playerState.z;
    return pixiWorldRenderState.worldMapsByZ.get(viewZ) ?? null;
  };

  const getCanvasPositionForTile = (col, row) => {
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      !Number.isInteger(state.firstCol) ||
      !Number.isInteger(state.firstRow)
    ) {
      return null;
    }
    const localCol = col - state.firstCol;
    const localRow = row - state.firstRow;
    if (localCol < 0 || localRow < 0 || localCol >= state.visibleCols || localRow >= state.visibleRows) {
      return null;
    }
    return {
      x: (localCol + 0.5) * state.cellSize,
      y: (localRow + 0.5) * state.cellSize,
    };
  };

  const drawFog = (context, worldMap) => {
    context.save();
    context.fillStyle = "#000000";
    for (let localRow = 0; localRow < state.visibleRows; localRow++) {
      for (let localCol = 0; localCol < state.visibleCols; localCol++) {
        const col = state.firstCol + localCol;
        const row = state.firstRow + localRow;
        if (!isMinimapTileDiscovered(worldMap.z, col, row)) {
          context.fillRect(localCol * state.cellSize, localRow * state.cellSize, state.cellSize, state.cellSize);
        }
      }
    }
    context.restore();
  };

  const drawGrid = (context) => {
    if (state.cellSize < 8) {
      return;
    }
    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.08)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0.5; x < minimapCanvas.width; x += state.cellSize) {
      context.moveTo(x, 0);
      context.lineTo(x, minimapCanvas.height);
    }
    for (let y = 0.5; y < minimapCanvas.height; y += state.cellSize) {
      context.moveTo(0, y);
      context.lineTo(minimapCanvas.width, y);
    }
    context.stroke();
    context.restore();
  };

  const drawCreatureMarker = (context, creature, fillColor, markerShape = "circle") => {
    if (creature?.z !== state.viewZ) {
      return;
    }
    const position = getCanvasPositionForTile(
      Math.floor(creature.x / TILE_SIZE),
      Math.floor(creature.y / TILE_SIZE),
    );
    if (!position) {
      return;
    }
    const radius = clamp(state.cellSize * 0.38, 1.5, 4);
    context.save();
    context.fillStyle = fillColor;
    context.strokeStyle = "rgba(0, 0, 0, 0.9)";
    context.lineWidth = 1;
    context.beginPath();
    if (markerShape === "diamond") {
      context.moveTo(position.x, position.y - radius);
      context.lineTo(position.x + radius, position.y);
      context.lineTo(position.x, position.y + radius);
      context.lineTo(position.x - radius, position.y);
      context.closePath();
    } else {
      context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
    context.restore();
  };

  const drawNavigationMarker = (context) => {
    if (
      state.viewZ !== playerState.z ||
      playerNavigationState.mode !== playerNavigationMode.click ||
      !playerNavigationState.destinationTile
    ) {
      return;
    }
    const destination = playerNavigationState.destinationTile;
    const position = getCanvasPositionForTile(destination.col, destination.row);
    if (!position) {
      return;
    }
    context.save();
    context.strokeStyle = "#f7d44a";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(position.x, position.y, clamp(state.cellSize * 0.52, 2.5, 6), 0, Math.PI * 2);
    context.stroke();
    context.restore();
  };

  const drawPlayerMarker = (context) => {
    if (state.viewZ !== playerState.z) {
      return;
    }
    const position = getCanvasPositionForTile(
      Math.floor(playerState.x / TILE_SIZE),
      Math.floor(playerState.y / TILE_SIZE),
    );
    if (!position) {
      return;
    }
    const directionByName = {
      up: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    };
    const direction = directionByName[playerState.direction] ?? directionByName.down;
    const perpendicular = { x: -direction.y, y: direction.x };
    const radius = clamp(state.cellSize * 0.62, 2.5, 6);
    context.save();
    context.fillStyle = "#fff2a3";
    context.strokeStyle = "#17130a";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(position.x + direction.x * radius, position.y + direction.y * radius);
    context.lineTo(
      position.x - direction.x * radius * 0.65 + perpendicular.x * radius * 0.7,
      position.y - direction.y * radius * 0.65 + perpendicular.y * radius * 0.7,
    );
    context.lineTo(
      position.x - direction.x * radius * 0.65 - perpendicular.x * radius * 0.7,
      position.y - direction.y * radius * 0.65 - perpendicular.y * radius * 0.7,
    );
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  };

  const drawDynamicMarkers = (context) => {
    drawNavigationMarker(context);
    const playerCol = Math.floor(playerState.x / TILE_SIZE);
    const playerRow = Math.floor(playerState.y / TILE_SIZE);
    for (const monsterUid of monsterElementsByUid.keys()) {
      const monster = monstersByUid.get(monsterUid);
      const monsterCol = Math.floor(monster?.x / TILE_SIZE);
      const monsterRow = Math.floor(monster?.y / TILE_SIZE);
      const distance = Math.max(Math.abs(monsterCol - playerCol), Math.abs(monsterRow - playerRow));
      if (monster?.z === playerState.z && distance <= MINIMAP_MONSTER_REVEAL_RANGE_TILES) {
        drawCreatureMarker(context, monster, "#d94c45");
        if (monster.uid === combatTargetState.monsterUid) {
          const position = getCanvasPositionForTile(monsterCol, monsterRow);
          if (position) {
            context.save();
            context.strokeStyle = "#ffffff";
            context.lineWidth = 1;
            context.beginPath();
            context.arc(position.x, position.y, clamp(state.cellSize * 0.58, 2.5, 6), 0, Math.PI * 2);
            context.stroke();
            context.restore();
          }
        }
      }
    }
    for (const npcUid of npcElementsByUid.keys()) {
      const npc = npcsByUid.get(npcUid);
      if (npc) {
        drawCreatureMarker(context, npc, "#59c6c8", "diamond");
      }
    }
    drawPlayerMarker(context);
  };

  const updateControls = () => {
    const zoomIndex = MINIMAP_ZOOM_LEVELS.indexOf(state.cellSize);
    if (minimapZoomLevel) {
      minimapZoomLevel.textContent = `${Math.round((state.cellSize / MINIMAP_DEFAULT_CELL_SIZE) * 100)}%`;
    }
    if (minimapFloorLevel) {
      minimapFloorLevel.textContent = `Z ${state.viewZ}`;
    }
    if (minimapZoomOutButton) {
      minimapZoomOutButton.disabled = zoomIndex <= 0;
    }
    if (minimapZoomInButton) {
      minimapZoomInButton.disabled = zoomIndex >= MINIMAP_ZOOM_LEVELS.length - 1;
    }
    if (minimapFloorUpButton) {
      minimapFloorUpButton.disabled = !pixiWorldRenderState.worldMapsByZ?.has(state.viewZ + 1);
    }
    if (minimapFloorDownButton) {
      minimapFloorDownButton.disabled = !pixiWorldRenderState.worldMapsByZ?.has(state.viewZ - 1);
    }
  };

  const render = (forceRender = false) => {
    const context = state.context;
    if (!playerMinimap || !minimapCanvas || !context) {
      return;
    }
    const playerCol = Math.floor(playerState.x / TILE_SIZE);
    const playerRow = Math.floor(playerState.y / TILE_SIZE);
    const now = performance.now();
    if (state.lastZ !== null && state.lastZ !== playerState.z) {
      state.isFollowingPlayer = true;
    }
    if (!Number.isInteger(state.viewZ) || state.isFollowingPlayer) {
      state.viewZ = playerState.z;
    }
    const worldMap = getWorldMap();
    if (!worldMap) {
      return;
    }
    const didDiscoverTile = revealMinimapAroundPlayer(getCurrentWorldMap(), playerState);
    if (state.isFollowingPlayer || !Number.isInteger(state.centerCol) || !Number.isInteger(state.centerRow)) {
      state.centerCol = playerCol;
      state.centerRow = playerRow;
    }

    const cellSize = state.cellSize;
    const visibleCols = Math.ceil(minimapCanvas.width / cellSize);
    const visibleRows = Math.ceil(minimapCanvas.height / cellSize);
    const firstCol = state.centerCol - Math.floor(visibleCols / 2);
    const firstRow = state.centerRow - Math.floor(visibleRows / 2);
    if (
      !forceRender &&
      !didDiscoverTile &&
      state.lastPlayerCol === playerCol &&
      state.lastPlayerRow === playerRow &&
      state.lastZ === playerState.z &&
      state.lastViewZ === state.viewZ &&
      state.lastCenterCol === state.centerCol &&
      state.lastCenterRow === state.centerRow &&
      state.lastCellSize === cellSize &&
      now < state.nextDynamicRenderAt
    ) {
      return;
    }

    Object.assign(state, { firstCol, firstRow, visibleCols, visibleRows });
    context.fillStyle = "#050505";
    context.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const didDrawTexturedMap = drawPixiMinimapRegion({
      context,
      worldMap,
      firstCol,
      firstRow,
      visibleCols,
      visibleRows,
      cellSize,
    });
    if (!didDrawTexturedMap) {
      for (let localRow = 0; localRow < visibleRows; localRow++) {
        for (let localCol = 0; localCol < visibleCols; localCol++) {
          context.fillStyle = getMinimapTileColor(worldMap, firstCol + localCol, firstRow + localRow);
          context.fillRect(localCol * cellSize, localRow * cellSize, cellSize, cellSize);
        }
      }
    }

    drawGrid(context);
    drawFog(context, worldMap);
    drawDynamicMarkers(context);
    updateControls();
    Object.assign(state, {
      lastPlayerCol: playerCol,
      lastPlayerRow: playerRow,
      lastZ: playerState.z,
      lastViewZ: state.viewZ,
      lastCenterCol: state.centerCol,
      lastCenterRow: state.centerRow,
      lastCellSize: cellSize,
      nextDynamicRenderAt: now + MINIMAP_DYNAMIC_REFRESH_MS,
    });
  };

  const setZoom = (cellSize, persist = true) => {
    if (!MINIMAP_ZOOM_LEVELS.includes(cellSize)) {
      return false;
    }
    state.cellSize = cellSize;
    if (persist) {
      gameOptionsUiState.values.minimapCellSize = cellSize;
      saveGameOptions();
    }
    render(true);
    return true;
  };

  const adjustZoom = (direction) => {
    const currentIndex = MINIMAP_ZOOM_LEVELS.indexOf(state.cellSize);
    return setZoom(MINIMAP_ZOOM_LEVELS[clamp(currentIndex + direction, 0, MINIMAP_ZOOM_LEVELS.length - 1)]);
  };

  const centerOnPlayer = () => {
    state.isFollowingPlayer = true;
    state.viewZ = playerState.z;
    state.centerCol = Math.floor(playerState.x / TILE_SIZE);
    state.centerRow = Math.floor(playerState.y / TILE_SIZE);
    render(true);
  };

  const changeFloor = (floorDelta) => {
    if (!Number.isInteger(floorDelta) || !(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
      return false;
    }
    const nextZ = state.viewZ + floorDelta;
    if (!pixiWorldRenderState.worldMapsByZ.has(nextZ)) {
      return false;
    }
    state.viewZ = nextZ;
    state.isFollowingPlayer = false;
    render(true);
    return true;
  };

  const navigateFromPointer = (event) => {
    if (!gameRuntimeState.isStarted || characterSelectorUiState.isOpen || !minimapCanvas) {
      return false;
    }
    if (state.viewZ !== playerState.z) {
      showStatusMessage(getGameUiText("minimapWrongFloor"));
      return false;
    }
    const canvasRect = minimapCanvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) {
      return false;
    }
    const canvasX = (event.clientX - canvasRect.left) * (minimapCanvas.width / canvasRect.width);
    const canvasY = (event.clientY - canvasRect.top) * (minimapCanvas.height / canvasRect.height);
    const localCol = Math.floor(canvasX / state.cellSize);
    const localRow = Math.floor(canvasY / state.cellSize);
    if (
      localCol < 0 ||
      localCol >= state.visibleCols ||
      localRow < 0 ||
      localRow >= state.visibleRows ||
      !Number.isInteger(state.firstCol) ||
      !Number.isInteger(state.firstRow)
    ) {
      return false;
    }
    const playerTile = getTilePosition(playerState);
    const destinationTile = { col: state.firstCol + localCol, row: state.firstRow + localRow };
    const distance = Math.max(
      Math.abs(destinationTile.col - playerTile.col),
      Math.abs(destinationTile.row - playerTile.row),
    );
    if (distance > MINIMAP_AUTOWALK_MAX_DISTANCE_TILES) {
      showStatusMessage(getGameUiText("destinationTooFar"));
      return false;
    }
    return startPlayerClickNavigation(destinationTile);
  };

  const startPan = (event) => {
    if (event.button !== 0 || !minimapCanvas) {
      return;
    }
    const playerTile = getTilePosition(playerState);
    Object.assign(state, {
      panPointerId: event.pointerId,
      panStartClientX: event.clientX,
      panStartClientY: event.clientY,
      panStartCenterCol: state.centerCol ?? playerTile.col,
      panStartCenterRow: state.centerRow ?? playerTile.row,
      didPan: false,
    });
    minimapCanvas.setPointerCapture(event.pointerId);
  };

  const updatePan = (event) => {
    if (event.pointerId !== state.panPointerId || !minimapCanvas) {
      return;
    }
    const deltaClientX = event.clientX - state.panStartClientX;
    const deltaClientY = event.clientY - state.panStartClientY;
    if (!state.didPan && Math.abs(deltaClientX) + Math.abs(deltaClientY) < 4) {
      return;
    }
    const canvasRect = minimapCanvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) {
      return;
    }
    state.didPan = true;
    state.isFollowingPlayer = false;
    state.centerCol = state.panStartCenterCol - Math.round(
      (deltaClientX * (minimapCanvas.width / canvasRect.width)) / state.cellSize,
    );
    state.centerRow = state.panStartCenterRow - Math.round(
      (deltaClientY * (minimapCanvas.height / canvasRect.height)) / state.cellSize,
    );
    minimapCanvas.classList.add("minimap-canvas-panning");
    render(true);
  };

  const finishPan = (event, shouldNavigate) => {
    if (event.pointerId !== state.panPointerId || !minimapCanvas) {
      return;
    }
    const didPan = state.didPan;
    if (minimapCanvas.hasPointerCapture(event.pointerId)) {
      minimapCanvas.releasePointerCapture(event.pointerId);
    }
    minimapCanvas.classList.remove("minimap-canvas-panning");
    state.panPointerId = null;
    state.didPan = false;
    if (shouldNavigate && !didPan) {
      navigateFromPointer(event);
    }
  };

  return {
    adjustZoom,
    centerOnPlayer,
    changeFloor,
    finishPan,
    navigateFromPointer,
    render,
    setZoom,
    startPan,
    updatePan,
  };
};
