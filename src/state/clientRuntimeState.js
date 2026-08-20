export const combatTargetState = {
  monsterUid: null,
  playerUid: null,
};

export const renderState = {
  lastCameraX: null,
  lastCameraY: null,
};

export const camera = {
  x: 0,
  y: 0,
};

export const mousePosition = {
  screenX: null,
  screenY: null,
  gameX: null,
  gameY: null,
  worldX: null,
  worldY: null,
  row: null,
  col: null,
  isInsideMap: false,
};

export const pixiWorldRenderState = {
  worldMapsByZ: null,
  currentZ: 0,
  lastPlayerZ: null,
  lastPlayerChunkX: null,
  lastPlayerChunkY: null,
  visibleRadiusChunks: 1,
};

export const dragState = {
  isDragging: false,
  item: null,
  sourceLocationType: null,
  sourceSlotIndex: null,
  sourceEquipmentSlotName: null,
  sourceParentContainerUid: null,
  sourceItemUid: null,
  pendingSourceLocation: null,
  pendingSlotElement: null,
  startScreenX: null,
  startScreenY: null,
};

export const itemUseState = {
  isUsingItem: false,
  source: null,
  item: null,
  useData: null,
  startedAt: null,
};

export const questUiState = {
  isOpen: false,
};

export const stackSplitMenuState = {
  source: null,
  itemUid: null,
};

export const spellUiState = {
  isOpen: false,
  selectedSpellId: null,
  mobileAssignHotkeyIndex: null,
};

export const characterSelectorUiState = {
  isOpen: false,
  view: "auth-choice",
};

export const gameRuntimeState = {
  isStarting: false,
  isStarted: false,
  isLoopRunning: false,
  isSwitchingCharacter: false,
  autosaveIntervalId: null,
  isRemoteSession: false,
};

export const frameTimingState = {
  previousFrameTime: null,
  accumulatedLogicTime: 0,
  fpsFrameCount: 0,
  fpsLastUpdateTime: 0,
  currentFps: 0,
};

export const gameplayTimingState = {
  nextDecayRefresh: 0,
  nextGroundEffectDecayRefresh: 0,
  nextTorchFuelRefresh: 0,
  nextPlayerMoveTime: 0,
  nextPlayerAttackTime: 0,
  nextChatMessageTime: 0,
};

export const respawnTimingState = {
  nextEventOrder: 0,
};

export const uiTimingState = {
  gameStatusMessageTimeoutId: null,
};
