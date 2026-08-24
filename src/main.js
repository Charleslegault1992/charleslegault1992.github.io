import {
  clearPixiItemUseTargets,
  clearPixiMonsterSelection,
  clearPixiMonsterVisuals,
  clearPixiRemotePlayerVisuals,
  clearPixiWorldItemSelection,
  clearPixiWorldItemVisuals,
  initializePixiRenderer,
  loadPixiWorldEntityTextures,
  playPixiCombatEffect,
  playPixiItemProjectile,
  playPixiRewardChestEffect,
  playPixiSpellEffect,
  removePixiNpcVisual,
  removePixiRemotePlayerVisual,
  removePixiMonsterVisual,
  removePixiWorldItemVisual,
  renderPixiFrame,
  renderPixiVisibleWorldChunks,
  setPixiMonsterSelected,
  setPixiItemUseTargets,
  setPixiWorldItemSelected,
  updatePixiCamera,
  updatePixiLighting,
  updatePixiMonsterTransform,
  updatePixiNpcTransform,
  updatePixiRemotePlayerVisual,
  updatePixiWorldItemTransform,
  upsertPixiMonsterVisual,
  upsertPixiNpcVisual,
  upsertPixiRemotePlayerAppearance,
  upsertPixiWorldItemVisual,
} from "./pixiRendererFacade.js";
import { startClientUpdateMonitor } from "./update/clientUpdateController.js";
import { loadWorldMaps } from "./worldLoader.js";
import {
  createCharacterProfile,
  DEFAULT_CHARACTER_APPEARANCE_COLORS,
  DEFAULT_CHARACTER_APPEARANCE_PARTS,
  deleteCharacterProfile,
  listCharacterProfiles,
  normalizeCharacterAppearanceColors,
  normalizeCharacterAppearanceParts,
  saveCharacterSnapshot,
  setActiveCharacterId,
} from "./characterSaveStore.js";
import {
  GAME_SFX,
  playGameSfx,
  preloadGameSfx,
  setGameAudioSettings,
  startGameMusic,
  stopGameMusic,
  unlockGameAudio,
} from "./audioManager.js";
import { spellsDatabase } from "./spellDatabase.js";
import { createPlayerSpellSystem } from "./spells/playerSpellSystem.js";
import {
  CHUNK_SIZE_TILES,
  CORPSE_DECAY_COOLDOWN_MS,
  DECAY_REFRESH_COOLDOWN_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_ITEM_STACK_SIZE,
  MINIMAP_AUTOWALK_MAX_DISTANCE_TILES,
  MINIMAP_ZOOM_LEVELS,
  MOBILE_SPELL_LONG_PRESS_MS,
  MOBILE_SPELL_PRESS_MOVE_TOLERANCE_PX,
  MONSTER_AI_CONFIG,
  MONSTER_AI_STATE,
  MONSTER_ATTACK_COOLDOWN_MS,
  MONSTER_RESPAWN_CONFIG,
  MOVE_SPEED,
  NPC_DIALOGUE_CONFIG,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_COMBAT_MODES,
  SKILL_EXPERIENCE_GAIN_PER_TRY,
  SPELL_HOTKEY_KEYS,
  SPRITE_SIZE,
  TILE_SIZE,
  TORCH_FUEL_REFRESH_INTERVAL_MS,
  TORCH_PLAYER_REVEAL_RADIUS,
  WORLD_RENDER_LAYER_CREATURE,
  WORLD_RENDER_LAYER_EFFECT,
  WORLD_RENDER_LAYER_ITEM,
} from "./core/gameConstants.js";
import { QUEST_STATUS } from "./data/questsDatabase.js";
import { clamp, getManhattanDistance, getRandomFloat, getRandomInt, isEmpty } from "./core/mathUtils.js";
import { getAtlasSource } from "./core/atlasUtils.js";
import { startFixedStepGameLoop } from "./core/fixedStepGameLoop.js";
import { createClientBootstrap } from "./core/clientBootstrap.js";
import { createGameSystemsOrchestrator } from "./core/gameSystemsOrchestrator.js";
import {
  createAttackMonsterAction,
  createAttackPlayerAction,
  createCastSpellAction,
  createMovePlayerAction,
  createSendChatMessageAction,
  createSetCombatModeAction,
  createSetLanguageAction,
  createSetPvpEnabledAction,
  createSpeakToNpcAction,
  createUseWorldTransitionAction,
  createWorldInteractionAction,
} from "./actions/gameplayActions.js";
import { createChatController } from "./chat/chatController.js";
import {
  createInsertItemsAction,
  createMoveItemAction,
  createSplitItemStackAction,
  INVENTORY_ACTION_REASON,
} from "./inventory/inventoryActions.js";
import { createGameSimulation } from "./simulation/gameSimulation.js";
import { createLocalGameTransport } from "./simulation/localGameTransport.js";
import { createGameActionEffectRouter } from "./simulation/gameActionEffectRouter.js";
import { createWebSocketGameTransport } from "./network/webSocketGameTransport.js";
import { createRemoteGameStateBridge } from "./network/remoteGameStateBridge.js";
import { createGameAccountSession } from "./network/gameAccountSession.js";
import { createUseItemAction } from "./items/itemUseActions.js";
import { applyDamageToPlayer } from "./combat/playerHealth.js";
import { applyDamageToMonsterHealth } from "./combat/monsterHealth.js";
import { canInitiatePlayerPvpAttack } from "./combat/playerPvpState.js";
import { applyPlayerDeathState } from "./player/playerDeath.js";
import { getPlayerMoveCooldown, getPlayerMovementTiming } from "./player/playerMovementTiming.js";
import {
  getActivePlayerStatusIndicators,
  PLAYER_STATUS_INDICATOR,
} from "./player/playerStatusIndicators.js";
import {
  getPlayerTileStackRenderOffset,
  getPlayerTileStackRenderOffsets,
  getTopPlayerAtTile,
} from "./player/playerTileStack.js";
import { createInventoryDragController } from "./inventory/inventoryDragController.js";
import {
  createItemLocationController,
  isValidContainerSlotParent as isValidContainerSlotParentRule,
} from "./inventory/itemLocationController.js";
import { createInventoryMoveService } from "./inventory/inventoryMoveService.js";
import {
  activeLitTorchesByUid,
  decayingItems,
  groundEffectsByUid,
  monsterElementsByUid,
  monstersByUid,
  monsterSpawnDefinitionsById,
  monsterSpawnStateById,
  npcConversationStatesByUid,
  npcElementsByUid,
  npcsByUid,
  openedContainers,
  playersByUid,
  worldItemElementsByUid,
  worldItemsByUid,
} from "./state/worldState.js";
import {
  camera,
  characterSelectorUiState,
  combatTargetState,
  dragState,
  gameRuntimeState,
  gameplayTimingState,
  itemUseState,
  mousePosition,
  pixiWorldRenderState,
  questUiState,
  respawnTimingState,
  spellUiState,
  stackSplitMenuState,
  uiTimingState,
} from "./state/clientRuntimeState.js";
import { playerState } from "./state/playerState.js";
import { createGroundItem, createItemInstance } from "./items/itemFactory.js";
import {
  beginUseCooldown,
  getUseCooldownGroup,
  getUseCooldownRemainingRatio,
  isUseCooldownReady,
} from "./items/itemCooldown.js";
import {
  getItemData,
  getItemRenderData,
  getItemUseData,
  getTorchFuelStage,
  isContainerItem,
  isOpenableContainerItem,
  isValidWorldItem,
} from "./items/itemModel.js";
import {
  calculatePlayerCarriedWeight,
  getItemTotalWeight,
  getPlayerRemainingCapacity,
  updatePlayerCarriedWeight,
} from "./inventory/inventoryWeight.js";
import {
  addItemUidToWorldTileStack,
  canAddItemSurfaceToTile,
  findWorldItemByUid,
  getEntitySurfaceOffsetY,
  getTopWorldItemAtTile,
  getWorldItemStackIndex,
  getWorldItemStackOffsetY,
  getWorldTileStack,
  isWorldItemTopOfTileStack,
  removeItemUidFromWorldTileStack,
  rebuildWorldTileStacks,
} from "./world/worldItemStacks.js";
import { getEntityRenderSortY, getWorldRenderZIndex } from "./render/renderOrder.js";
import { applyItemRenderPartPosition, getAtlasPath, getHpColor } from "./render/domRenderUtils.js";
import { getDirectionRow } from "./render/spriteDirection.js";
import {
  getPlayerFloatingTextElement,
  initializePlayerRenderRefs,
  refreshPlayerHpBar,
  refreshPlayerSkull,
  showPlayerName,
  updatePlayerPosition,
  updatePlayerSprite,
} from "./render/playerRenderer.js";
import { createMonster, getMonsterData } from "./monsters/monsterModel.js";
import { createMonsterAiSystem } from "./monsters/monsterAiSystem.js";
import { createMonsterRespawnSystem } from "./monsters/monsterRespawnSystem.js";
import { createNpcConversationSystem } from "./npcs/npcConversationSystem.js";
import {
  addMonsterToState,
  findMonsterAtPosition,
  getActiveMonstersAroundPlayer,
  getMonstersInChunkRadius,
  isMonsterAtPosition,
  moveMonsterInTileIndex,
  rebuildMonsterSpatialIndexes,
  removeMonsterFromState,
} from "./monsters/monsterIndex.js";
import { getNpcData, getNpcTextureUrlsById } from "./npcs/npcModel.js";
import {
  findNpcAtPosition,
  getNpcsInChunkRadius,
  initializeNpcsForWorldMaps,
  isNpcAtPosition,
  moveNpcInTileIndex,
  rebuildNpcSpatialIndexes,
} from "./npcs/npcIndex.js";
import { applyPlayerStarterKit } from "./player/playerStarterKit.js";
import { createInitialWorldItems } from "./world/initialWorldItems.js";
import {
  calculatePlayerAttackResult,
  calculateRuneAttackResult,
  getCombatModeData,
  getEquippedWeaponCombatData,
  getPlayerAttackRange,
  getPlayerAttackSkillKey,
  getPlayerShieldDefense,
  getPlayerTotalArmor,
  hasPlayerBlockSource,
} from "./combat/playerCombatModel.js";
import {
  getQuestData,
  hasPlayerClaimedInteractableReward,
  recordPlayerInteractableRewardClaim,
  setPlayerQuestStatus,
} from "./quests/questProgress.js";
import {
  getCurrentGameLanguage,
  getGameUiText,
  getLocalizedClassData,
  getLocalizedContentData,
  getLocalizedItemData,
  getLocalizedItemName,
  getLocalizedMonsterData,
  getLocalizedQuestData,
  getLocalizedSkillName,
} from "./localization/gameLocalization.js";
import {
  addOrRefreshGroundEffectState,
  getGroundEffectData,
  removeGroundEffect,
  renderGroundEffect,
  syncGroundEffectRenderForCurrentZ,
  updateGroundEffectDecay,
} from "./world/groundEffects.js";
import {
  canEquipItemInSlot,
  getEquipmentSlotItem,
  setEquipmentSlotItem as setPlayerEquipmentSlotItem,
} from "./player/playerEquipment.js";
import { isNearPlayer } from "./player/playerSpatial.js";
import { advancePlayerRegeneration, startPlayerRegenerationTimers } from "./player/playerRegeneration.js";
import { createCharacterSessionController } from "./player/characterSession.js";
import {
  createPlayerNavigationController,
  keysPressed,
  PLAYER_ACTION_DISTANCE_TYPE,
  PLAYER_ACTION_TYPE,
  PLAYER_NAVIGATION_MODE,
  playerNavigationState,
  resetMovementKeys,
} from "./player/playerNavigationController.js";
import { createContainerWindowController } from "./ui/containerWindowController.js";
import {
  createCharacterSelectorController,
  ENTER_GAME_AFTER_RELOAD_SESSION_KEY,
  OPEN_CHARACTER_SELECTOR_AFTER_RELOAD_SESSION_KEY,
} from "./ui/characterSelectorController.js";
import { createGameOptionsController } from "./ui/gameOptionsController.js";
import { createGameLoadingController } from "./ui/gameLoadingController.js";
import { createLogoutConfirmationController } from "./ui/logoutConfirmationController.js";
import { createMobileJoystickController } from "./ui/mobileJoystickController.js";
import { createQuestWindowController } from "./ui/questWindowController.js";
import { getCurrentWorldMap } from "./world/worldRuntime.js";
import { createMinimapController } from "./minimap/minimapController.js";
import { getRewardTableData } from "./inventory/inventoryTransactions.js";
import {
  applyPlayerCurrentVitalLevelUpGains,
  canUseShieldingBlock,
  getLevelFromExperience,
  getPlayerClassData,
  getPlayerClassRegenerationData,
  getPlayerExperienceProgressData,
  getSkillExperienceGainMultiplier,
  getSkillLevelFromExperience,
  getSkillProgressData,
  isSkillTrainingTimerActive,
  normalizeSkillExperienceGain,
  recordShieldingBlock,
  refreshSkillTrainingTimer,
  syncPlayerDerivedStats,
} from "./player/playerProgression.js";
import {
  DEFAULT_GAME_OPTIONS,
  GAME_OPTIONS_STORAGE_KEY,
  gameOptionsUiState,
  SUPPORTED_GAME_LANGUAGES,
} from "./state/gameOptionsState.js";
import {
  applyPlayerAppearanceBackground,
  clearPlayerAppearanceColorTextureCache,
  DEFAULT_PLAYER_APPEARANCE_ID,
  getPlayerAppearanceData,
  getPlayerAppearanceLayerTextureUrls,
  PLAYER_ANIMATION_FRAMES,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  playerAppearancePartsDatabase,
  playerAppearancesDatabase,
} from "./player/playerAppearance.js";
import {
  getChunkPositionFromWorldPosition,
  getTilePosition,
  getWorldChunkForTilePosition,
  getWorldPosition,
  isTiledCollisionAtTile,
} from "./world/worldCoordinates.js";
import { canStepFromTileToTile } from "./world/worldMovement.js";
import {
  findInteractableAtTile,
  findProtectionZoneAtTile,
  findTransitionAtTile,
  isPlayerNearTiledObject as isPlayerNearTiledObjectState,
} from "./world/tiledWorldObjects.js";
import { applyPlayerWorldTransitionState, setPlayerWorldPositionState } from "./world/worldTransitions.js";
import {
  createPathfinder,
  getCardinalDirectionFromTileDelta,
  getDistanceToClosestTile,
  getNeighbors,
  getPathMovementCost,
  getTileMovementAnimationMultiplier,
  getTileMovementCost,
  hasLineOfSightBetweenTiles,
} from "./world/pathfinding.js";

import {
  panneauGauche,
  panneauDroite,
  boitePrincipale,
  playerMinimap,
  minimapCanvas,
  minimapZoomOutButton,
  minimapZoomInButton,
  minimapCenterButton,
  minimapFloorUpButton,
  minimapFloorDownButton,
  playerStats,
  playerInventory,
  playerQuests,
  gameOptionsWindow,
  playerSpells,
  gameWelcome,
  gameWelcomePlayButton,
  gameWelcomeLanguageButtons,
  characterSelector,
  gameLoading,
  gameLoadingStatus,
  gameLoadingProgressFill,
  gameLoadingRetryButton,
  stackSplitMenu,
  playerContainers,
  player,
  game,
  boiteJeux,
  nav,
  boiteChat,
  chat,
  chatTabs,
  chatInput,
  boiteJeuxInner,
  fpsCounter,
  pingCounter,
  gameStatusMessage,
  logoutConfirmation,
  logoutConfirmationCancelButton,
  logoutConfirmationConfirmButton,
  mobileGameControls,
  mobileJoystickZone,
  mobileJoystick,
  mobileJoystickKnob,
  mobilePanelButtons,
  mobileActionButtons,
  mobileActionMenu,
  mobileActionMenuToggle,
  mobilePlayerName,
  mobilePlayerLevel,
  mobilePlayerHealthFill,
  mobilePlayerHealthValue,
  mobilePlayerManaFill,
  mobilePlayerManaValue,
  mobilePlayerSanityFill,
  mobilePlayerSanityValue,
  mobileTargetHud,
  mobileTargetName,
  mobileTargetValue,
  mobileTargetHealthFill,
  mobileItemUseIndicator,
  mobileItemUseIcon,
  mobileItemUseLabel,
  mobileStanceIcon,
  mobileStanceLabel,
} from "./ui/domRefs.js";
import {
  REMOTE_INTERPOLATED_ENTITY_TYPES,
  remoteEntityInterpolationStore,
} from "./network/remoteEntityInterpolationStore.js";

startClientUpdateMonitor();

/* ==================================================== */
//#region     -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----
/* ==================================================== */
/* ---------- BASE - DIMENSIONS ET ATLAS ---------- */

let GAME_SCALE = 1;

/* ---------- BASE - TILES ---------- */

/* ---------- BASE - UID ET SELECTION ---------- */

/* ---------- BASE - COLLECTIONS MONDE ---------- */
const itemCooldownOverlayElements = new Set();
const playerStatusIndicatorUiState = {
  slot: null,
  signature: null,
  nextRefreshAt: 0,
};
let shouldReloadAfterMobileSessionHide = false;
let mobileSessionReloadRequested = false;
let gameSimulation = null;
let gameTransport = null;
let gameActionEffectRouter = null;
let remoteGameStateBridge = null;
const remotePlayerRenderUids = new Set();
let unsubscribeGameTransportEffects = null;

/* ---------- BASE - ETAT DRAG ---------- */
/* ---------- BASE - SPAWN JOUEUR ---------- */

/* ---------- BASE - CAMERA ET SOURIS ---------- */
const minChatHeight = 120;

const handleGameActionResult = (resultOrPromise, handler) => {
  if (resultOrPromise && typeof resultOrPromise.then === "function") {
    resultOrPromise.then(handler).catch(() => {
      showGameStatusMessage("Connection unavailable.");
    });
    return null;
  }
  handler(resultOrPromise);
  return resultOrPromise;
};
/* ---------- BASE - ETAT ITEM USE ---------- */

const CHARACTER_AUTOSAVE_INTERVAL_MS = 30000;
const ACCOUNT_TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const REMOTE_GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL?.trim() ?? "";
const REMOTE_GAME_AUTH_TOKEN = import.meta.env.VITE_GAME_AUTH_TOKEN?.trim() ?? "";
const ENABLE_REMOTE_INTERPOLATION_DEBUG = import.meta.env.VITE_REMOTE_INTERPOLATION_DEBUG === "true";
remoteEntityInterpolationStore.setDebugEnabled(ENABLE_REMOTE_INTERPOLATION_DEBUG);
const configuredGameApiUrl = import.meta.env.VITE_GAME_API_URL?.trim() ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
const REMOTE_GAME_API_URL =
  configuredGameApiUrl ||
  (() => {
    if (REMOTE_GAME_SERVER_URL === "") {
      return "";
    }
    const apiUrl = new URL(REMOTE_GAME_SERVER_URL);
    apiUrl.protocol = apiUrl.protocol === "wss:" ? "https:" : "http:";
    apiUrl.pathname = "/";
    apiUrl.search = "";
    apiUrl.hash = "";
    return apiUrl.href;
  })();
const gameAccountSession =
  REMOTE_GAME_SERVER_URL !== "" && REMOTE_GAME_AUTH_TOKEN === ""
    ? createGameAccountSession({ apiBaseUrl: REMOTE_GAME_API_URL })
    : null;

//#endregion  -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----

/* ==================================================== */
//#region     -----  CORE - TIMING ET COOLDOWNS  -----
/* ==================================================== */
/* ---------- TIMING - BOUCLE DE JEU ---------- */

/* ---------- TIMING - DECAY ---------- */

const corpseDecayCooldown = CORPSE_DECAY_COOLDOWN_MS;

let characterSessionController = null;
let chatController = null;
let monsterRespawnSystem = null;
let monsterAiSystem = null;
let npcConversationSystem = null;
let playerNavigationController = null;
let playerSpellSystem = null;
let mobileJoystickController = null;
let gameOptionsController = null;
let questWindowController = null;
let characterSelectorController = null;
let gameLoadingController = null;
let logoutConfirmationController = null;
let clientBootstrap = null;
let gameShellPreloadPromise = null;
let gameSystemsOrchestrator = null;
let accountTokenRefreshIntervalId = null;
const createCharacterSaveSnapshot = () => characterSessionController.createSnapshot();
const applyCharacterSavePosition = (characterSnapshot, worldMapsByZ) =>
  characterSessionController.applySavedPosition(characterSnapshot, worldMapsByZ);
const loadInitialCharacterSnapshot = () => characterSessionController.loadInitialSnapshot();
const saveCurrentCharacter = () => characterSessionController.saveCurrent();
const autosaveCurrentCharacter = () => characterSessionController.autosave();
const startCharacterAutosave = () => characterSessionController.startAutosave();

/* ---------- JOUEUR - AFFICHAGE ---------- */

const applyShieldingExperienceFromBlockAttempt = (now) => {
  if (!isSkillTrainingTimerActive(now)) {
    return false;
  }
  const baseExp = SKILL_EXPERIENCE_GAIN_PER_TRY;
  const expMultiplier = getSkillExperienceGainMultiplier("shielding");
  const finalExp = normalizeSkillExperienceGain(baseExp * expMultiplier);
  applyExperienceToPlayerSkill("shielding", finalExp);
  return true;
};

/* ---------- JOUEUR - VIE ET MORT ---------- */

const updatePlayerRegeneration = (now) => {
  if (advancePlayerRegeneration(playerState, getPlayerClassRegenerationData(), now)) {
    refreshPlayerVitalsUi();
  }
};

const createPlayerCorpse = () => {
  const bag = getEquipmentSlotItem("backpack");
  const corpse = createGroundItem("playerCorpse", 1, playerState.x, playerState.y, playerState.z, bag ? [bag] : []);
  if (!corpse || !addWorldItemToState(corpse)) {
    return null;
  }
  playerState.equipment.backpack = null;
  return { corpse, droppedBackpackUid: bag?.uid ?? null };
};

const resolvePlayerDeath = () => {
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(playerState.spawn?.z) ?? null;
  const spawn = findPlayerSpawnInWorldMap(worldMap, playerState.spawn?.spawnId);
  if (!spawn) {
    return { success: false, reason: "spawn-not-found" };
  }
  const corpseResult = createPlayerCorpse();
  const deathResult = applyPlayerDeathState(playerState, {
    x: spawn.col * TILE_SIZE,
    y: spawn.row * TILE_SIZE,
    z: playerState.spawn.z,
  });
  if (!deathResult.success) {
    return deathResult;
  }
  return {
    ...deathResult,
    events: [
      {
        type: "player-death-resolved",
        corpseUid: corpseResult?.corpse.uid ?? null,
        droppedBackpackUid: corpseResult?.droppedBackpackUid ?? null,
      },
    ],
  };
};

const handlePlayerDeathResolvedEffect = (event) => {
  const droppedBackpack = findItemByUid(event.droppedBackpackUid);
  if (droppedBackpack) {
    closeContainerAndChildren(droppedBackpack);
  }
  const corpse = worldItemsByUid.get(event.corpseUid) ?? null;
  if (corpse) {
    renderGroundItems([corpse]);
  }
  refreshItemUiAfterDrag();
  pixiWorldRenderState.currentZ = playerState.z;
  combatTargetState.monsterUid = null;
  combatTargetState.playerUid = null;
  stopPlayerNavigation();
  cancelItemDrag();
  cancelItemUse();
  clearMonsterSelection();
  syncMobileTargetHud();
  clearMonsters();
  clearGroundItemRender();
  updatePixiVisibleChunksAroundPlayer();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  updateWorldRender();
  updatePlayerExperience();
  refreshPlayerVitalsUi();
  closeAllContainer();
};

const playerDead = () => {
  const result = resolvePlayerDeath();
  if (!result.success) {
    return false;
  }
  for (const event of result.events) {
    handlePlayerDeathResolvedEffect(event);
  }
  return true;
};

//#endregion  -----  PLAYER  -----

/* ==================================================== */
//#region     -----  CAMERA  -----
/* ==================================================== */
/* ---------- CAMERA - POSITION ---------- */

const updateCamera = () => {
  camera.x = playerState.renderX + TILE_SIZE / 2 - GAME_WIDTH / 2;
  camera.y = playerState.renderY + TILE_SIZE / 2 - GAME_HEIGHT / 2;
};

const canMoveTo = (fromX, fromY, testX, testY) => {
  if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(testX) || !Number.isFinite(testY)) {
    return false;
  }
  const nextCol = testX / TILE_SIZE;
  const nextRow = testY / TILE_SIZE;
  if (!Number.isInteger(nextCol) || !Number.isInteger(nextRow)) {
    return false;
  }
  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }
  if (isTiledCollisionAtTile(currentWorldMap, nextCol, nextRow)) {
    return false;
  }
  if (!canStepFromTileToTile(fromX, fromY, testX, testY, playerState.z)) {
    return false;
  }
  return true;
};
//#endregion  -----  MAP  -----

/* ==================================================== */
//#region     -----  CORE - OUTILS / HELPERS  -----
/* ==================================================== */
/* ---------- OUTILS - MATH ET DISTANCE ---------- */

let minimapController = null;
const renderPlayerMinimap = (forceRender = false) => minimapController.render(forceRender);
const setMinimapZoom = (cellSize, persist = true) => minimapController.setZoom(cellSize, persist);
const adjustMinimapZoom = (direction) => minimapController.adjustZoom(direction);
const centerMinimapOnPlayer = () => minimapController.centerOnPlayer();
const changeMinimapFloor = (floorDelta) => minimapController.changeFloor(floorDelta);

const handleTransitionContextMenu = (target) => {
  const transition = getTransitionFromPointerTarget(target);
  if (!transition) {
    return false;
  }

  const transitionType = transition.properties?.transitionType;
  if (transitionType !== "ropeUp") {
    return false;
  }

  if (!isNearPlayer(transition, 1)) {
    return true;
  }

  const action = createUseWorldTransitionAction({
    z: playerState.z,
    col: target.tile.col,
    row: target.tile.row,
    transitionType,
    requestedAt: Date.now(),
  });
  const result = gameTransport.send(action);
  handleGameActionResult(result, (resolvedResult) => {
    if (resolvedResult?.success) {
      playGameSfx(GAME_SFX.ropeUse);
    }
  });
  return true;
};

const getTransitionFromPointerTarget = (target) => {
  if (!target?.tile || !target.pointerInsideMap) {
    return null;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return null;
  }

  const transition = findTransitionAtTile(currentWorldMap, target.tile.col, target.tile.row);
  if (!transition) {
    return null;
  }

  return transition;
};

const formatRewardItemsText = (rewardItems) => {
  if (!Array.isArray(rewardItems)) {
    return getGameUiText("rewardFallback");
  }
  const labels = rewardItems.map((rewardItem) => {
    const itemData = getLocalizedItemData(rewardItem.itemId);
    if (!itemData) {
      return rewardItem.itemId;
    }
    return `${rewardItem.quantity > 1 ? `${rewardItem.quantity} ` : ""}${getLocalizedItemName(rewardItem.itemId, rewardItem.quantity)}`;
  });
  return labels.join(", ");
};

const addRewardChestFailureFeedback = (reason) => {
  const messagesByReason = {
    backpack: getGameUiText("backpackRequired"),
    capacity: getGameUiText("notEnoughCapacity"),
    space: getGameUiText("backpackFull"),
    configuration: getGameUiText("invalidReward"),
    commit: getGameUiText("rewardCommitFailed"),
    [INVENTORY_ACTION_REASON.containerNotFound]: getGameUiText("backpackRequired"),
    [INVENTORY_ACTION_REASON.capacityExceeded]: getGameUiText("notEnoughCapacity"),
    [INVENTORY_ACTION_REASON.noRoom]: getGameUiText("backpackFull"),
    [INVENTORY_ACTION_REASON.invalidConfiguration]: getGameUiText("invalidReward"),
    [INVENTORY_ACTION_REASON.commitFailed]: getGameUiText("rewardCommitFailed"),
  };
  const message = messagesByReason[reason] ?? getGameUiText("chestOpenFailed");
  if (
    reason === "backpack" ||
    reason === "capacity" ||
    reason === "space" ||
    reason === INVENTORY_ACTION_REASON.containerNotFound ||
    reason === INVENTORY_ACTION_REASON.capacityExceeded ||
    reason === INVENTORY_ACTION_REASON.noRoom
  ) {
    showGameStatusMessage(message);
  }
  return addLogMessage(message, "error");
};

const addQuestCompletionFeedback = (questData, rewardItems) => {
  const localizedQuestData = getLocalizedQuestData(questData.questId) ?? questData;
  const rewardText = formatRewardItemsText(rewardItems);
  const logMessage = getGameUiText("questCompletionLog")(localizedQuestData.name, rewardText);
  const floatingMessage = getGameUiText("questCompletionFloating")(localizedQuestData.name, rewardText);
  addLogMessage(logMessage, "loot");
  showFloatingTextAboveTarget(floatingMessage, 110, playerState, "quest", 5500);
};

const addRewardChestCompletionEffect = (interactable) => {
  if (
    !Number.isFinite(interactable?.x) ||
    !Number.isFinite(interactable?.y) ||
    !Number.isFinite(interactable?.width) ||
    !Number.isFinite(interactable?.height)
  ) {
    return false;
  }
  return playPixiRewardChestEffect({
    x: interactable.x + interactable.width / 2,
    y: interactable.y + interactable.height / 2,
  });
};

const executeRewardChestInteraction = (interactable, requestedAt) => {
  if (!interactable?.properties || !isPlayerNearTiledObjectState(playerState, interactable, 1)) {
    return { success: false, reason: "out-of-range" };
  }

  const { interactableId, questId, rewardTableId } = interactable.properties;
  const questData = getQuestData(questId);
  const rewardTable = getRewardTableData(rewardTableId);
  if (typeof interactableId !== "string" || interactableId === "" || !questData || !Array.isArray(rewardTable?.items)) {
    return { success: false, reason: "configuration" };
  }

  if (hasPlayerClaimedInteractableReward(playerState, interactableId)) {
    return { success: false, reason: "already-claimed", changes: { questId } };
  }

  const grantResult = grantRewardItemsToPlayer(rewardTable.items);
  if (!grantResult.success) {
    return { success: false, reason: grantResult.reason };
  }

  recordPlayerInteractableRewardClaim(playerState, interactableId, requestedAt);
  setPlayerQuestStatus(playerState, questId, QUEST_STATUS.completed, requestedAt);
  return {
    success: true,
    changes: { interactableId, questId, claimedAt: requestedAt },
    events: [
      {
        type: "reward-chest-completed",
        interactableId,
        questId,
        rewardItems: rewardTable.items,
        position: {
          x: interactable.x,
          y: interactable.y,
          width: interactable.width,
          height: interactable.height,
        },
      },
    ],
  };
};

const handleRewardChestInteraction = (interactable) => {
  const interactableId = interactable?.properties?.interactableId;
  const interactionType = interactable?.properties?.interactableType;
  const col = interactable?.col ?? Math.floor(interactable?.x / TILE_SIZE);
  const row = interactable?.row ?? Math.floor(interactable?.y / TILE_SIZE);
  const action = createWorldInteractionAction({
    interactableId,
    interactionType,
    z: playerState.z,
    col,
    row,
    requestedAt: Date.now(),
  });
  const result = gameTransport.send(action);
  handleGameActionResult(result, (resolvedResult) => {
    if (!resolvedResult?.success) {
      if (resolvedResult?.reason === "already-claimed") {
        const questId = interactable?.properties?.questId;
        const questData = getQuestData(questId);
        const localizedQuestData = getLocalizedQuestData(questId) ?? questData;
        if (localizedQuestData) {
          addLogMessage(getGameUiText("questAlreadyCompleted")(localizedQuestData.name), "system");
        }
      } else {
        addRewardChestFailureFeedback(resolvedResult?.reason);
      }
    }
  });
  return true;
};

const interactableContextMenuHandlers = {
  rewardChest: handleRewardChestInteraction,
};

const getOrCreateMonsterSpawnState = (spawnId) => monsterRespawnSystem.getOrCreateSpawnState(spawnId);
const spawnMonsterFromZone = (worldMap, spawnZone, options) =>
  monsterRespawnSystem.spawnFromZone(worldMap, spawnZone, options);
const decreaseMonsterSpawnAliveCount = (monster) => monsterRespawnSystem.decreaseAliveCount(monster);
const registerMonsterSpawnDefinition = (worldMap, spawnZone) =>
  monsterRespawnSystem.registerSpawnDefinition(worldMap, spawnZone);
const scheduleMonsterRespawnAt = (spawnId, dueAt) => monsterRespawnSystem.scheduleAt(spawnId, dueAt);
const scheduleMonsterRespawn = (spawnId, now) => monsterRespawnSystem.schedule(spawnId, now);
const updateMonsterRespawns = (now) => monsterRespawnSystem.update(now);
const getMonsterSpawnZonesFromWorldMap = (worldMap) => monsterRespawnSystem.getSpawnZones(worldMap);

const getInteractableFromPointerTarget = (target) => {
  if (!target?.tile || !target.pointerInsideMap) {
    return null;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return null;
  }

  return findInteractableAtTile(currentWorldMap, target.tile.col, target.tile.row);
};

const handleInteractableContextMenu = (target) => {
  const interactable = getInteractableFromPointerTarget(target);
  if (!interactable) {
    return false;
  }

  const interactableType = interactable.properties?.interactableType;

  if (interactableType === "lookOnly") {
    const text = interactable.properties?.lookText ?? interactable.properties?.displayName;
    if (text) {
      showFloatingTextAboveTarget(text, 110, playerState, "look");
    }
    return true;
  }

  const handler = interactableContextMenuHandlers[interactableType];
  if (handler) {
    handler(interactable);
    return true;
  }

  return false;
};

const setPlayerWorldPosition = (x, y) => {
  return setPlayerWorldPositionState(playerState, x, y);
};

const executePlayerWorldTransition = (transition) => {
  return applyPlayerWorldTransitionState(playerState, transition, pixiWorldRenderState.worldMapsByZ);
};

const presentPlayerWorldTransition = () => {
  pixiWorldRenderState.currentZ = playerState.z;
  loseSelectedMonsterTarget();
  stopPlayerNavigation();
  clearMonsters();
  clearGroundItemRender();

  pixiWorldRenderState.lastPlayerChunkX = null;
  pixiWorldRenderState.lastPlayerChunkY = null;

  updatePixiVisibleChunksAroundPlayer();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  updateWorldRender();
};

const findPlayerSpawnInWorldMap = (worldMap, spawnId) => {
  if (!(worldMap?.chunksByKey instanceof Map) || typeof spawnId !== "string" || spawnId === "") {
    return null;
  }
  for (const chunk of worldMap.chunksByKey.values()) {
    if (!Array.isArray(chunk.spawns)) {
      continue;
    }
    for (const spawn of chunk.spawns) {
      if (spawn.properties?.spawnType === "player" && spawn.properties?.spawnId === spawnId) {
        return spawn;
      }
    }
  }
  return null;
};

const applyPlayerSpawn = (spawn) => {
  if (!Number.isInteger(spawn?.col) || !Number.isInteger(spawn?.row)) {
    return false;
  }

  const spawnX = spawn.col * TILE_SIZE;
  const spawnY = spawn.row * TILE_SIZE;

  return setPlayerWorldPosition(spawnX, spawnY);
};

/* ---------- OUTILS - SOURIS ---------- */
const isMouseInsideMap = (mousePosition) => {
  if (!mousePosition || !Number.isFinite(mousePosition.worldX) || !Number.isFinite(mousePosition.worldY)) {
    return false;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }

  const col = Math.floor(mousePosition.worldX / TILE_SIZE);
  const row = Math.floor(mousePosition.worldY / TILE_SIZE);

  return getWorldChunkForTilePosition(currentWorldMap, col, row) !== null;
};

const updateMousePositionInfo = (screenX, screenY) => {
  let gameScale = GAME_SCALE;
  if (!Number.isFinite(GAME_SCALE) || GAME_SCALE <= 0) {
    gameScale = 1;
  }

  const gameRect = game.getBoundingClientRect();
  const gameX = (screenX - gameRect.left) / gameScale;
  const gameY = (screenY - gameRect.top) / gameScale;
  const worldX = camera.x + gameX;
  const worldY = camera.y + gameY;
  const col = Math.floor(worldX / TILE_SIZE);
  const row = Math.floor(worldY / TILE_SIZE);

  mousePosition.screenX = screenX;
  mousePosition.screenY = screenY;
  mousePosition.gameX = gameX;
  mousePosition.gameY = gameY;
  mousePosition.worldX = worldX;
  mousePosition.worldY = worldY;
  mousePosition.row = row;
  mousePosition.col = col;
  mousePosition.isInsideMap = isMouseInsideMap(mousePosition);
};

/* ---------- ITEMS - CREATION RENDU ---------- */

const createWorldItemHitbox = (item) => {
  const itemData = getItemData(item.itemId);
  const hitbox = document.createElement("div");
  hitbox.setAttribute("data-item-uid", item.uid);
  hitbox.classList.add("hitbox");
  hitbox.style.width = `${TILE_SIZE}px`;
  hitbox.style.height = `${TILE_SIZE}px`;
  hitbox.style.left = `${item.x - camera.x}px`;
  hitbox.style.top = `${item.y - camera.y}px`;
  hitbox.style.zIndex = `${getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_EFFECT)}`;

  hitbox.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragState.isDragging) {
      inputState.shouldBlockNextContextMenu = true;
      cancelItemDrag();
      return;
    }
    if (shouldBlockContextMenuAction()) {
      return;
    }

    const monster = findMonsterAtPosition(item.x, item.y);
    if (monster) {
      selectMonster(monster);
      return;
    }

    const target = getPointerTargetFromEvent(e);
    if (handleNpcGreetingFromPointerTarget(target)) {
      return;
    }

    if (!itemData) {
      return;
    }
    const topItem = getTopWorldItemAtTile(item.x, item.y, item.z);
    if (!topItem) {
      return;
    }
    const source = {
      locationType: "worldItem",
      itemUid: topItem.uid,
    };
    handleUseItemFromSource(source);
  });
  return hitbox;
};

const renderGroundItemParts = (item) => {
  if (!item || item.z !== playerState.z) {
    return;
  }
  const enrichedParts = getItemRenderData(item);
  if (enrichedParts.length <= 0) {
    return;
  }

  const stackOffsetY = getWorldItemStackOffsetY(item);
  const stackIndex = getWorldItemStackIndex(item);
  upsertPixiWorldItemVisual({
    uid: item.uid,
    parts: enrichedParts,
    x: item.x,
    y: item.y - stackOffsetY,
    zIndex: getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_ITEM + stackIndex),
  });

  const existingRefs = findWorldItemRenderRefs(item.uid);
  const hitbox = existingRefs?.hitbox ?? createWorldItemHitbox(item);
  if (!existingRefs?.hitbox) {
    game.appendChild(hitbox);
  }
  worldItemElementsByUid.set(item.uid, {
    hitbox,
  });
};

const findWorldItemRenderRefs = (itemUid) => {
  return worldItemElementsByUid.get(itemUid) ?? null;
};

const findWorldItemHitboxElement = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  return refs?.hitbox ?? null;
};
/* ---------- ITEMS - AFFICHAGE DOM ---------- */

const renderGroundItems = (items) => {
  for (const item of items) {
    renderGroundItemParts(item);
  }
};

/* ---------- ITEMS - AJOUT ET RETRAIT MONDE ---------- */

const addWorldItemToState = (worldItem) => {
  if (!isValidWorldItem(worldItem) || worldItemsByUid.has(worldItem.uid)) {
    return false;
  }

  worldItemsByUid.set(worldItem.uid, worldItem);

  if (!addItemUidToWorldTileStack(worldItem)) {
    worldItemsByUid.delete(worldItem.uid);
    return false;
  }

  return true;
};

const addGroundItem = (worldItem) => {
  const wasAdded = addWorldItemToState(worldItem);
  if (wasAdded) {
    renderGroundItems([worldItem]);
  }
  return wasAdded;
};

const removeWorldItemFromState = (itemUid) => {
  const worldItem = worldItemsByUid.get(itemUid);
  if (!worldItem) {
    return false;
  }

  removeItemUidFromWorldTileStack(worldItem);
  worldItemsByUid.delete(itemUid);
  return true;
};

const removeGroundItemRender = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  refs?.hitbox?.remove();
  removePixiWorldItemVisual(itemUid);

  worldItemElementsByUid.delete(itemUid);
};

const clearGroundItemRender = () => {
  for (const itemUid of worldItemElementsByUid.keys()) {
    removeGroundItemRender(itemUid);
  }
  clearPixiWorldItemVisuals();
};

const removeGroundItem = (itemUid) => {
  const wasRemoved = removeWorldItemFromState(itemUid);
  if (wasRemoved) {
    removeGroundItemRender(itemUid);
    return true;
  }
  return false;
};

/* ---------- ITEMS - POSITION RENDU DOM ---------- */

const updateItemPosition = () => {
  worldItemsByUid.forEach((item) => {
    if (item.z !== playerState.z) {
      removeGroundItemRender(item.uid);
      return;
    }
    const screenLeft = item.x - camera.x;
    const screenTop = item.y - camera.y;
    if (
      screenLeft + SPRITE_SIZE < -128 ||
      screenLeft > GAME_WIDTH + 128 ||
      screenTop + SPRITE_SIZE < -128 ||
      screenTop > GAME_HEIGHT + 128
    ) {
      return;
    }

    const stackOffsetY = getWorldItemStackOffsetY(item);
    const stackIndex = getWorldItemStackIndex(item);
    updatePixiWorldItemTransform(
      item.uid,
      item.x,
      item.y - stackOffsetY,
      getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_ITEM + stackIndex),
    );

    const itemHitboxElement = findWorldItemHitboxElement(item.uid);
    if (itemHitboxElement) {
      const positionHitbox = {
        left: screenLeft,
        top: screenTop,
        zIndex: getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_EFFECT),
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      };
      applyItemRenderPartPosition(itemHitboxElement, positionHitbox);
    }
  });
};

const refreshGroundItemRender = (item) => {
  const parts = getItemRenderData(item);
  const stackOffsetY = getWorldItemStackOffsetY(item);
  const stackIndex = getWorldItemStackIndex(item);
  upsertPixiWorldItemVisual({
    uid: item.uid,
    parts,
    x: item.x,
    y: item.y - stackOffsetY,
    zIndex: getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_ITEM + stackIndex),
  });
};

/* ---------- ITEMS - TORCHES ---------- */

const syncTorchFuel = (item, now) => {
  if (!item?.isLit || !Number.isFinite(item.fuelRemainingMs) || !Number.isFinite(now)) {
    return false;
  }

  const previousStage = getTorchFuelStage(item);
  if (!Number.isFinite(item.lastFuelUpdateAt) || item.lastFuelUpdateAt <= 0) {
    item.lastFuelUpdateAt = now;
    return false;
  }

  const elapsed = Math.max(0, now - item.lastFuelUpdateAt);
  item.lastFuelUpdateAt = now;
  item.fuelRemainingMs = Math.max(0, item.fuelRemainingMs - elapsed);

  if (item.fuelRemainingMs <= 0) {
    item.isLit = false;
    item.lastFuelUpdateAt = 0;
    activeLitTorchesByUid.delete(item.uid);
  }

  return previousStage !== getTorchFuelStage(item) || !item.isLit;
};

const syncActiveTorchFuel = (now) => {
  for (const item of activeLitTorchesByUid.values()) {
    if (syncTorchFuel(item, now)) {
      refreshAllByUid(item.uid);
    }
  }
};

const updateTorchFuel = (now) => {
  if (!Number.isFinite(now) || now < gameplayTimingState.nextTorchFuelRefresh) {
    return;
  }
  gameplayTimingState.nextTorchFuelRefresh = now + TORCH_FUEL_REFRESH_INTERVAL_MS;
  syncActiveTorchFuel(now);
};

/* ---------- ITEMS - DECAY ---------- */
const getCorpseDecayProfile = (item) => {
  const itemData = getItemData(item.itemId);
  if (!itemData || !itemData.decayType) {
    return null;
  }
  const decayType = itemData.decayType;
  if (!(decayType in corpseDecayCooldown)) {
    return null;
  }
  if (!corpseDecayCooldown[decayType]) {
    return null;
  }
  return corpseDecayCooldown[decayType];
};

const applyCorpseDecayStageOne = (item, profile, now) => {
  if (!item || !profile || !("decayStage" in item) || item.decayStage !== 0) {
    return false;
  }
  item.decayStage = 1;
  item.nextDecayAt = now + profile.stage1;
  refreshAllByUid(item.uid);
  return true;
};

const applyCorpseDecayStageTwo = (item, profile, now) => {
  if (!item || !profile || !("decayStage" in item) || item.decayStage !== 1) {
    return false;
  }
  item.decayStage = 2;
  item.nextDecayAt = now + profile.stage2;
  if (isContainerItem(item)) {
    closeContainerAndChildren(item);
    cancelItemDrag();
    cancelItemUse();
  }
  refreshAllByUid(item.uid);
  return true;
};

const applyCorpseDecayRemoval = (item) => {
  if (!item) {
    return false;
  }
  removeAllByUid(item.uid);
  return true;
};
const updateCorpseDecay = (now) => {
  if (gameplayTimingState.nextDecayRefresh < now) {
    gameplayTimingState.nextDecayRefresh = now + DECAY_REFRESH_COOLDOWN_MS;

    for (let i = decayingItems.length - 1; i >= 0; i--) {
      const item = decayingItems[i];

      if ("nextDecayAt" in item) {
        if (now < item.nextDecayAt) {
          continue;
        }

        const profile = getCorpseDecayProfile(item);
        if (!profile) {
          continue;
        }

        if (item.decayStage === 0) {
          applyCorpseDecayStageOne(item, profile, now);
        } else if (item.decayStage === 1) {
          applyCorpseDecayStageTwo(item, profile, now);
        } else if (item.decayStage === 2) {
          applyCorpseDecayRemoval(item);
        }
      }
    }
  }
};

/* ---------- ITEMS - COLLISION ---------- */

const isBlockingItemAtPosition = (x, y, z = playerState.z) => {
  const tileStack = getWorldTileStack(x, y, z);
  if (!tileStack) {
    return false;
  }

  return tileStack.itemUids.some((itemUid) => {
    const item = worldItemsByUid.get(itemUid);
    if (!item) {
      return false;
    }

    const itemData = getItemData(item.itemId);
    return itemData?.blockMovement === true;
  });
};

const grantRewardItemsToPlayer = (rewardItems) => {
  const backpack = getEquipmentSlotItem("backpack");
  if (!backpack || !isOpenableContainerItem(backpack)) {
    return { success: false, reason: INVENTORY_ACTION_REASON.containerNotFound };
  }

  const action = createInsertItemsAction(backpack.uid, rewardItems);
  const result = gameTransport.send(action);
  if (!result?.success) {
    return result;
  }

  refreshInventoryUi();
  return result;
};

//#endregion  -----  INVENTAIRE - POIDS ET CAPACITE  -----

/* ==================================================== */
//#region     -----  DRAG AND DROP - SOURCES, DESTINATIONS ET REGLES  -----
/* ==================================================== */

/* ---------- DRAG - ETAT ---------- */

let inventoryDragController = null;
let itemLocationController = null;
let inventoryMoveService = null;
const resetDragState = () => inventoryDragController.reset();
const cancelItemDrag = () => inventoryDragController.cancel();
const resetDragStatePending = () => inventoryDragController.resetPending();
const startItemDrag = (source) => inventoryDragController.start(source);
const getDragSourceFromState = () => inventoryDragController.getSource();
const getDragSourceItem = (source) => itemLocationController.getItem(source);

/* ---------- DRAG - MODIFICATION SOURCE ---------- */

const isValidContainerSlotParent = (parentContainer) => isValidContainerSlotParentRule(parentContainer);
const removeItemFromDragSource = (source) => itemLocationController.removeItem(source);
const setEquipmentSlotItem = (itemLocation, item) => setPlayerEquipmentSlotItem(itemLocation, item);

/* ---------- DRAG - DESTINATION ---------- */

const placeItemInContainerSlot = (destination, item) => itemLocationController.placeItem(destination, item);
const placeItemInEquipmentSlot = (destination, item) => itemLocationController.placeItem(destination, item);
const placeItemOnWorldTile = (destination, item) => itemLocationController.placeItem(destination, item);
const placeItemInDragDestination = (destination, item) => itemLocationController.placeItem(destination, item);

const isItemInsideContainer = (containerItem, searchedItemUid) => {
  if (!containerItem || !containerItem.content) {
    return false;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData || !itemData.capacity) {
    return false;
  }
  for (let index = 0; index < itemData.capacity; index++) {
    const item = containerItem.content[index];

    if (!item) {
      continue;
    }
    if (item.uid === searchedItemUid) {
      return true;
    }
    if (isContainerItem(item)) {
      if (isItemInsideContainer(item, searchedItemUid)) {
        return true;
      }
    }
  }
  return false;
};

const setWorldItemPosition = (destination, item) => {
  if (
    !item ||
    !destination ||
    !Number.isInteger(destination.x) ||
    !Number.isInteger(destination.y) ||
    destination.z !== playerState.z
  ) {
    return false;
  }

  const col = destination.x / TILE_SIZE;
  const row = destination.y / TILE_SIZE;

  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    return false;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }

  const worldChunk = getWorldChunkForTilePosition(currentWorldMap, col, row);
  if (!worldChunk) {
    return false;
  }

  if (isTiledCollisionAtTile(currentWorldMap, col, row)) {
    return false;
  }

  const positionedItem = { ...item, z: destination.z };
  if (!canAddItemSurfaceToTile(positionedItem, destination.x, destination.y)) {
    return false;
  }

  item.z = destination.z;
  item.x = destination.x;
  item.y = destination.y;
  return true;
};
/* ---------- DRAG - VALIDATION ACTION COMPLETE ---------- */
const syncOpenedContainerItemReferences = () => {
  for (let index = openedContainers.length - 1; index >= 0; index--) {
    const wrapper = openedContainers[index];
    const containerUid = wrapper?.item?.uid;

    if (!Number.isInteger(containerUid)) {
      openedContainers.splice(index, 1);
      continue;
    }

    const currentLocation = findItemLocationByUid(containerUid);
    const currentItem = currentLocation ? getItemFromLocation(currentLocation) : null;

    if (!currentItem || !isOpenableContainerItem(currentItem)) {
      openedContainers.splice(index, 1);
      continue;
    }

    wrapper.item = currentItem;
  }

  for (const wrapper of openedContainers) {
    const visitedContainerUids = new Set([wrapper.itemUid]);
    let childWrapper = wrapper;
    let parentWrapper = wrapper.parent;

    while (parentWrapper) {
      const parentUid = parentWrapper.itemUid ?? parentWrapper.item?.uid;
      if (!Number.isInteger(parentUid) || visitedContainerUids.has(parentUid)) {
        childWrapper.parent = null;
        childWrapper.parentUid = null;
        break;
      }

      const parentLocation = findItemLocationByUid(parentUid);
      const parentItem = parentLocation ? getItemFromLocation(parentLocation) : null;
      if (!parentItem || !isOpenableContainerItem(parentItem)) {
        childWrapper.parent = null;
        childWrapper.parentUid = null;
        break;
      }

      parentWrapper.itemUid = parentUid;
      parentWrapper.item = parentItem;
      childWrapper.parentUid = parentUid;
      visitedContainerUids.add(parentUid);
      childWrapper = parentWrapper;
      parentWrapper = parentWrapper.parent;
    }
  }
};

const refreshInventoryUi = () => {
  syncOpenedContainerItemReferences();
  updatePlayerCarriedWeight(playerState);
  updatePlayerInventory();
  renderContainerDock();
};

const refreshItemUiAfterDrag = () => {
  relocateInvalidEquippedAmmunition();
  refreshInventoryUi();
  cancelItemDrag();
};

const canPlaceItemInEquipmentSlot = (item, slotName) => canEquipItemInSlot(item, slotName);

const findFirstStackableContainerSlot = (containerItem, itemToAdd) => {
  if (!containerItem?.content || !itemToAdd) {
    return null;
  }
  const itemToAddData = getItemData(itemToAdd.itemId);
  if (!itemToAddData?.stackable) {
    return null;
  }
  const containerData = getItemData(containerItem.itemId);
  if (!containerData?.capacity) {
    return null;
  }
  for (let index = 0; index < containerData.capacity; index++) {
    const slotItem = containerItem.content[index];
    if (!slotItem) {
      continue;
    }
    if (slotItem.itemId === itemToAdd.itemId && slotItem.quantity < 100) {
      return index;
    }
  }

  return null;
};

const findBestContainerSlotForItem = (containerItem, itemToAdd) => {
  return (
    findFirstStackableContainerSlot(containerItem, itemToAdd) ?? findFirstEmptyContainerSlot(containerItem) ?? null
  );
};

const findFirstEmptyContainerSlot = (containerItem) => {
  if (!containerItem || !containerItem.content) {
    return null;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData?.capacity) {
    return null;
  }
  for (let index = 0; index < itemData.capacity; index++) {
    if (!containerItem.content[index]) {
      return index;
    }
  }
  return null;
};

const findContainerSlotForWholeItem = (containerItem, itemToAdd) => {
  if (!containerItem?.content || !itemToAdd) {
    return null;
  }
  const containerData = getItemData(containerItem.itemId);
  const itemData = getItemData(itemToAdd.itemId);
  if (!containerData?.capacity || !itemData) {
    return null;
  }

  if (itemData.stackable) {
    for (let index = 0; index < containerData.capacity; index++) {
      const slotItem = containerItem.content[index];
      if (slotItem?.itemId === itemToAdd.itemId && slotItem.quantity + itemToAdd.quantity <= 100) {
        return { index, shouldStack: true };
      }
    }
  }

  const emptySlot = findFirstEmptyContainerSlot(containerItem);
  if (emptySlot === null) {
    return null;
  }
  return { index: emptySlot, shouldStack: false };
};

const relocateInvalidEquippedAmmunition = () => {
  const ammunition = playerState.equipment.shield;
  const ammunitionData = ammunition ? getItemData(ammunition.itemId) : null;
  if (ammunitionData?.type !== "ammunition") {
    return false;
  }

  const equippedWeapon = playerState.equipment.weapon;
  const equippedWeaponData = equippedWeapon ? getItemData(equippedWeapon.itemId) : null;
  if (equippedWeaponData?.combat?.ammunitionItemId === ammunition.itemId) {
    return false;
  }

  const backpack = playerState.equipment.backpack;
  const backpackDestination = findContainerSlotForWholeItem(backpack, ammunition);
  if (backpackDestination) {
    const destinationItem = backpack.content[backpackDestination.index];
    if (backpackDestination.shouldStack) {
      destinationItem.quantity += ammunition.quantity;
    } else {
      backpack.content[backpackDestination.index] = ammunition;
    }
    playerState.equipment.shield = null;
    return true;
  }

  ammunition.x = playerState.x;
  ammunition.y = playerState.y;
  ammunition.z = playerState.z;
  if (!addGroundItem(ammunition)) {
    return false;
  }
  playerState.equipment.shield = null;
  return true;
};

const canInteractWithWorldItemSource = (source) => {
  if (source?.locationType !== "worldItem") {
    return false;
  }
  const item = getDragSourceItem(source);
  return isWorldItemAvailableForInteraction(item) && isNearPlayer(item, 1);
};

const isWorldItemAvailableForInteraction = (item) => {
  return item?.z === playerState.z && isWorldItemTopOfTileStack(item);
};

const shouldCloseOpenedContainerByDistance = (containerWrapper) => {
  if (!containerWrapper) {
    return false;
  }
  if (containerWrapper.sourceType !== "world") {
    return false;
  }
  if (containerWrapper.item.z !== playerState.z) {
    return true;
  }
  return !isNearPlayer(containerWrapper.item, 1);
};

const closeFarOpenedContainers = () => {
  for (let index = openedContainers.length - 1; index >= 0; index--) {
    const container = openedContainers[index];

    const rootWrapper = getOpenedContainerRootWrapper(container);
    if (!rootWrapper) {
      continue;
    }
    if (shouldCloseOpenedContainerByDistance(rootWrapper)) {
      closeContainerAndChildren(container.item);
    }
  }
};

const getParentContainerFromContainerSlotLocation = (itemLocation) =>
  itemLocationController.getParentContainer(itemLocation);

const rollbackDraggedItem = (rollbackDestination, item) => {
  if (!rollbackDestination || !item) {
    return false;
  }
  const wasRollbackPlaced = placeItemInDragDestination(rollbackDestination, item);
  if (!wasRollbackPlaced) {
    return false;
  }
  return true;
};

const setContainerSlotItem = (itemLocation, item) => itemLocationController.setContainerItem(itemLocation, item);

const updateOpenedContainerSourceType = (item, sourceType) => {
  const openedContainerWrapper = findOpenedContainerWrapperByUid(item.uid);
  if (!openedContainerWrapper) {
    return;
  }
  openedContainerWrapper.sourceType = sourceType;
};

const tryStackItemsDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (destinationItem && sourceItem.itemId === destinationItem.itemId) {
    const itemData = getItemData(sourceItem.itemId);
    let canMoveRestToFreeSlot = true;
    if (itemData && itemData.stackable) {
      const freeStackSpace = 100 - destinationItem.quantity;
      let quantityAllowed = freeStackSpace;
      if (!isItemLocationCarriedByPlayer(source) && isItemLocationCarriedByPlayer(destination)) {
        const freeCapSpace = playerState.capacity - calculatePlayerCarriedWeight(playerState);
        const maxQuantityByCapacity = Math.floor(freeCapSpace / itemData.weight);
        quantityAllowed = Math.min(freeStackSpace, maxQuantityByCapacity);
        const remainingQuantityAfterStack = Math.max(sourceItem.quantity - quantityAllowed, 0);
        canMoveRestToFreeSlot = maxQuantityByCapacity >= remainingQuantityAfterStack;
      }
      if (freeStackSpace <= 0) {
        return false;
      }

      if (quantityAllowed <= 0) {
        cancelItemDrag();
        return true;
      }

      if (sourceItem.quantity <= quantityAllowed) {
        destinationItem.quantity += sourceItem.quantity;
        removeItemFromDragSource(source);
        refreshItemUiAfterDrag();
        return true;
      }

      if (sourceItem.quantity > quantityAllowed) {
        destinationItem.quantity += quantityAllowed;
        sourceItem.quantity -= quantityAllowed;
      }
      if (destination.locationType === "containerSlot" && quantityAllowed === freeStackSpace && canMoveRestToFreeSlot) {
        const parentContainer = getParentContainerFromContainerSlotLocation(destination);

        if (!parentContainer || !parentContainer.content) {
          refreshItemUiAfterDrag();
          return true;
        }

        const freeSlot = findFirstEmptyContainerSlot(parentContainer);
        if (freeSlot !== null) {
          const tempDestination = {
            locationType: "containerSlot",
            parentContainerUid: destination.parentContainerUid,
            slotIndex: freeSlot,
          };

          let rollbackDestination = source;

          if (source.locationType === "worldItem") {
            rollbackDestination = {
              locationType: "worldTile",
              x: sourceItem.x,
              y: sourceItem.y,
              z: sourceItem.z,
            };
          }

          const removedItem = removeItemFromDragSource(source);
          if (!removedItem) {
            cancelItemDrag();
            return true;
          }
          const result = placeItemInDragDestination(tempDestination, removedItem);
          if (!result) {
            const wasRollbackPlaced = rollbackDraggedItem(rollbackDestination, removedItem);
            if (!wasRollbackPlaced) {
              cancelItemDrag();
              return true;
            }
          }
        }
      }
      refreshItemUiAfterDrag();
      return true;
    }
  }

  return false;
};

const tryMoveItemOnContainerItemDuringDrag = (source, sourceItem, destinationItem) => {
  if (destinationItem && isOpenableContainerItem(destinationItem)) {
    if (destinationItem === sourceItem) {
      cancelItemDrag();
      return true;
    }

    const bestSlot = findBestContainerSlotForItem(destinationItem, sourceItem);
    if (bestSlot === null) {
      cancelItemDrag();
      return true;
    }

    const bestSlotItem = destinationItem.content[bestSlot];

    const destinationSlotContainer = {
      locationType: "containerSlot",
      parentContainerUid: destinationItem.uid,
      slotIndex: bestSlot,
    };

    if (bestSlotItem) {
      return tryStackItemsDuringDrag(source, sourceItem, destinationSlotContainer, bestSlotItem);
    }

    if (!isItemCarriedByPlayer(sourceItem.uid) && isItemCarriedByPlayer(destinationItem.uid)) {
      if (getItemTotalWeight(sourceItem) > getPlayerRemainingCapacity(playerState)) {
        cancelItemDrag();
        return true;
      }
    }
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destinationSlotContainer, removedItem);
    if (isContainerItem(removedItem)) {
      updateOpenedContainerSourceType(removedItem, "container");
    }

    refreshItemUiAfterDrag();
    return true;
  }

  return false;
};

const shouldMoveItemToFreeContainerSlotInsteadOfSwap = (source, sourceItem, destination, destinationItem) => {
  if (!source || !sourceItem || !destination || !destinationItem) {
    return false;
  }

  if (destination.locationType !== "containerSlot") {
    return false;
  }

  const sourceIsWorld = source.locationType === "worldItem";
  const sourceIsUncarriedContainerSlot =
    source.locationType === "containerSlot" && !isItemLocationCarriedByPlayer(source);

  if (!sourceIsWorld && !sourceIsUncarriedContainerSlot) {
    return false;
  }

  const sameItem = sourceItem.itemId === destinationItem.itemId;
  const itemData = getItemData(sourceItem.itemId);
  const isStackable = itemData?.stackable === true;

  if (!sameItem) {
    return true;
  }

  return !isStackable;
};

const tryMoveItemToFreeContainerSlotInsteadOfSwapDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (!shouldMoveItemToFreeContainerSlotInsteadOfSwap(source, sourceItem, destination, destinationItem)) {
    return false;
  }

  const parentContainer = getParentContainerFromContainerSlotLocation(destination);
  const bestSlot = findBestContainerSlotForItem(parentContainer, sourceItem);

  if (bestSlot === null) {
    return false;
  }

  const bestSlotItem = parentContainer.content[bestSlot];

  if (bestSlotItem) {
    const bestDestination = {
      locationType: "containerSlot",
      parentContainerUid: destination.parentContainerUid,
      slotIndex: bestSlot,
    };

    return tryStackItemsDuringDrag(source, sourceItem, bestDestination, bestSlotItem);
  }

  let rollbackDestination = source;

  if (source.locationType === "worldItem") {
    rollbackDestination = {
      locationType: "worldTile",
      x: sourceItem.x,
      y: sourceItem.y,
      z: sourceItem.z,
    };
  }

  const removedItem = removeItemFromDragSource(source);
  if (!removedItem) {
    cancelItemDrag();
    return true;
  }

  const freeDestination = {
    locationType: "containerSlot",
    parentContainerUid: destination.parentContainerUid,
    slotIndex: bestSlot,
  };

  const wasPlaced = placeItemInDragDestination(freeDestination, removedItem);
  if (!wasPlaced) {
    const wasRollbackPlaced = rollbackDraggedItem(rollbackDestination, removedItem);
    if (!wasRollbackPlaced) {
      cancelItemDrag();
      return true;
    }
  }

  if (isContainerItem(removedItem)) {
    updateOpenedContainerSourceType(removedItem, "container");
  }

  refreshItemUiAfterDrag();
  return true;
};

const tryMoveItemToEmptySlotDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (
    !destinationItem &&
    (destination.locationType === "containerSlot" ||
      (destination.locationType === "equipmentSlot" &&
        canPlaceItemInEquipmentSlot(sourceItem, destination.equipmentSlotName)))
  ) {
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destination, removedItem);
    if (isContainerItem(removedItem)) {
      if (destination.locationType === "containerSlot") {
        updateOpenedContainerSourceType(removedItem, "container");
      } else if (destination.locationType === "equipmentSlot") {
        updateOpenedContainerSourceType(removedItem, "equipment");
      }
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const tryMoveEquipmentItemToContainerWhenSwapInvalidDuringDrag = (source, destination, destinationItem) => {
  if (
    source.locationType === "equipmentSlot" &&
    destination.locationType === "containerSlot" &&
    destinationItem &&
    !canPlaceItemInEquipmentSlot(destinationItem, source.equipmentSlotName)
  ) {
    const destinationContainer = getParentContainerFromContainerSlotLocation(destination);

    if (!destinationContainer || !destinationContainer.content) {
      cancelItemDrag();
      return true;
    }

    const emptySlot = findFirstEmptyContainerSlot(destinationContainer);
    if (emptySlot === null) {
      cancelItemDrag();
      return true;
    }

    const destinationSlotContainer = {
      locationType: "containerSlot",
      parentContainerUid: destination.parentContainerUid,
      slotIndex: emptySlot,
    };

    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destinationSlotContainer, removedItem);
    if (isContainerItem(removedItem)) {
      updateOpenedContainerSourceType(removedItem, "container");
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const trySwapItemsDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (!isItemLocationCarriedByPlayer(source) || !isItemLocationCarriedByPlayer(destination)) {
    return false;
  }
  if (
    (destination.locationType === "containerSlot" ||
      (destination.locationType === "equipmentSlot" &&
        canPlaceItemInEquipmentSlot(sourceItem, destination.equipmentSlotName))) &&
    (source.locationType === "containerSlot" ||
      (source.locationType === "equipmentSlot" &&
        canPlaceItemInEquipmentSlot(destinationItem, source.equipmentSlotName)))
  ) {
    const removedSource = removeItemFromDragSource(source);
    if (!removedSource) {
      cancelItemDrag();
      return true;
    }
    const removedDestination = removeItemFromDragSource(destination);
    if (!removedDestination) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destination, removedSource);
    if (isContainerItem(removedSource)) {
      if (destination.locationType === "containerSlot") {
        updateOpenedContainerSourceType(removedSource, "container");
      } else if (destination.locationType === "equipmentSlot") {
        updateOpenedContainerSourceType(removedSource, "equipment");
      }
    }
    placeItemInDragDestination(source, removedDestination);
    if (isContainerItem(removedDestination)) {
      if (source.locationType === "containerSlot") {
        updateOpenedContainerSourceType(removedDestination, "container");
      } else if (source.locationType === "equipmentSlot") {
        updateOpenedContainerSourceType(removedDestination, "equipment");
      }
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const tryMoveItemToWorldDuringDrag = (source, sourceItem, destination) => {
  if (destination.locationType === "worldTile") {
    if (!isNearPlayer(destination, WORLD_ITEM_THROW_RANGE)) {
      cancelItemDrag();
      return true;
    }
    if (!hasPlayerLineOfSightToWorldPosition(destination)) {
      showGameStatusMessage(getGameUiText("cannotPlaceItem"));
      cancelItemDrag();
      return true;
    }
    const oldSource = {
      locationType: "worldTile",
      x: sourceItem.x,
      y: sourceItem.y,
      z: sourceItem.z,
    };
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }

    const result = placeItemInDragDestination(destination, removedItem);
    if (result) {
      if (isContainerItem(removedItem)) {
        updateOpenedContainerSourceType(removedItem, "world");
        closeFarOpenedContainers();
      }

      refreshItemUiAfterDrag();

      return true;
    } else {
      showGameStatusMessage(getGameUiText("cannotPlaceItem"));
      if (source.locationType === "worldItem") {
        const wasRollbackPlaced = rollbackDraggedItem(oldSource, removedItem);
        if (!wasRollbackPlaced) {
          cancelItemDrag();
          return true;
        }
        refreshItemUiAfterDrag();
        return true;
      } else {
        const wasRollbackPlaced = rollbackDraggedItem(source, removedItem);
        if (!wasRollbackPlaced) {
          cancelItemDrag();
          return true;
        }
        refreshItemUiAfterDrag();
        return true;
      }
    }
  }
  return false;
};

const isItemCarriedByPlayer = (itemUid) => {
  return Object.values(playerState.equipment).some((equipment) => {
    if (!equipment) {
      return false;
    }
    return isItemInsideItem(equipment, itemUid);
  });
};

const isItemInsideItem = (item, searchedUid) => {
  if (!item) {
    return false;
  }
  if (item.uid === searchedUid) {
    return true;
  }
  if (!isContainerItem(item)) {
    return false;
  }
  return item.content.some((itemInContainer) => {
    return isItemInsideItem(itemInContainer, searchedUid);
  });
};

const isItemLocationCarriedByPlayer = (itemLocation) => {
  if (itemLocation.locationType === "equipmentSlot") {
    return true;
  }
  if (itemLocation.locationType === "worldItem" || itemLocation.locationType === "worldTile") {
    return false;
  }
  if (itemLocation.locationType === "containerSlot") {
    const parentContainer = getParentContainerFromContainerSlotLocation(itemLocation);

    if (!parentContainer) {
      return false;
    }

    return isItemCarriedByPlayer(parentContainer.uid);
  }
  return false;
};

const isExceedCapacity = (source, destination, item) => {
  const sourceCarried = isItemLocationCarriedByPlayer(source);
  const destinationCarried = isItemLocationCarriedByPlayer(destination);
  if (!sourceCarried && destinationCarried) {
    if (playerState.capacity - playerState.carriedWeight < getItemTotalWeight(item)) {
      return true;
    }
  }
  return false;
};

const isSameDragSourceAndDestination = (source, destination) => {
  if (
    source.locationType === "containerSlot" &&
    destination.locationType === "containerSlot" &&
    source.parentContainerUid === destination.parentContainerUid &&
    source.slotIndex === destination.slotIndex
  ) {
    return true;
  }
  if (
    source.locationType === "equipmentSlot" &&
    destination.locationType === "equipmentSlot" &&
    source.equipmentSlotName === destination.equipmentSlotName
  ) {
    return true;
  }
  return false;
};

const isContainerMoveIntoContainerItemItself = (sourceItem, destinationItem) => {
  if (isContainerItem(sourceItem) && destinationItem && isContainerItem(destinationItem)) {
    if (destinationItem.uid === sourceItem.uid) {
      return true;
    }
    if (isItemInsideContainer(sourceItem, destinationItem.uid)) {
      return true;
    }
  }
  return false;
};

const isContainerMoveIntoItself = (sourceItem, destinationContainer) => {
  if (isContainerItem(sourceItem) && destinationContainer) {
    if (destinationContainer.uid === sourceItem.uid || isItemInsideContainer(sourceItem, destinationContainer.uid)) {
      return true;
    }
  }
  return false;
};

const isDropStackToStack = (sourceItem, destinationItem) => {
  if (destinationItem && sourceItem.itemId === destinationItem.itemId) {
    const itemData = getItemData(sourceItem.itemId);
    if (itemData && itemData.stackable === true) {
      return true;
    }
  }
  return false;
};

const getItemFromLocation = (itemLocation) => itemLocationController.getItem(itemLocation);

const findItemLocationInsideContainer = (containerItem, searchedUid) => {
  if (!containerItem || !isContainerItem(containerItem) || !containerItem.content) {
    return null;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData) {
    return null;
  }

  for (let index = 0; index < itemData.capacity; index++) {
    const item = containerItem.content[index];
    if (!item) {
      continue;
    }
    if (item.uid === searchedUid) {
      return {
        locationType: "containerSlot",
        itemUid: item.uid,
        parentContainerUid: containerItem.uid,
        slotIndex: index,
      };
    }
    if (isContainerItem(item)) {
      const result = findItemLocationInsideContainer(item, searchedUid);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

const findItemLocationByUid = (uid) => {
  const worldItem = findWorldItemByUid(uid);
  if (worldItem) {
    return {
      locationType: "worldItem",
      itemUid: worldItem.uid,
    };
  }

  for (const item of worldItemsByUid.values()) {
    if (isContainerItem(item)) {
      const result = findItemLocationInsideContainer(item, uid);
      if (result) {
        return result;
      }
    }
  }

  for (const [slotName, item] of Object.entries(playerState.equipment)) {
    if (!item) {
      continue;
    }
    if (item.uid === uid) {
      return {
        locationType: "equipmentSlot",
        itemUid: item.uid,
        equipmentSlotName: slotName,
      };
    }
    if (isContainerItem(item)) {
      const result = findItemLocationInsideContainer(item, uid);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

const refreshAllByUid = (uid) => {
  const location = findItemLocationByUid(uid);
  if (!location) {
    return;
  }
  const item = getItemFromLocation(location);
  if (!item) {
    return;
  }
  if (location.locationType === "worldItem") {
    refreshGroundItemRender(item);
    return;
  }
  refreshInventoryUi();
};

const closeContainerAndChildren = (containerToClose) => containerWindowController.closeWithChildren(containerToClose);

const removeAllByUid = (uid) => {
  const location = findItemLocationByUid(uid);
  if (!location) {
    return;
  }
  const item = getItemFromLocation(location);
  if (!item) {
    return;
  }

  if (isContainerItem(item)) {
    closeContainerAndChildren(item);
  }

  if ("decayStage" in item) {
    const index = decayingItems.findIndex((corpse) => {
      return item.uid === corpse.uid;
    });
    if (index !== -1) {
      decayingItems.splice(index, 1);
    }
  }

  activeLitTorchesByUid.delete(uid);

  if (location.locationType === "worldItem") {
    const wasRemoved = removeGroundItem(uid);
    if (!wasRemoved) {
      return;
    }
  } else if (location.locationType === "equipmentSlot") {
    const wasRemoved = setEquipmentSlotItem(location, null);

    if (!wasRemoved) {
      return;
    }
  } else if (location.locationType === "containerSlot") {
    const wasRemoved = setContainerSlotItem(location, null);
    if (!wasRemoved) {
      return;
    }
  } else {
    return;
  }
  refreshInventoryUi();
};

const ITEM_INVENTORY_LOCATION_TYPES = new Set(["containerSlot", "equipmentSlot"]);
const WORLD_ITEM_THROW_RANGE = 9;

const createItemDragSfxSnapshot = (source, sourceItem, destination, destinationItem) => {
  return {
    source: { ...source },
    destination: { ...destination },
    sourceItem,
    sourceQuantity: sourceItem.quantity,
    sourceX: sourceItem.x,
    sourceY: sourceItem.y,
    sourceZ: sourceItem.z,
    destinationItem,
    destinationQuantity: destinationItem?.quantity ?? null,
  };
};

const areItemLocationsEqual = (firstLocation, secondLocation) => {
  if (!firstLocation || !secondLocation || firstLocation.locationType !== secondLocation.locationType) {
    return false;
  }
  if (firstLocation.locationType === "equipmentSlot") {
    return firstLocation.equipmentSlotName === secondLocation.equipmentSlotName;
  }
  if (firstLocation.locationType === "containerSlot") {
    return (
      firstLocation.parentContainerUid === secondLocation.parentContainerUid &&
      firstLocation.slotIndex === secondLocation.slotIndex
    );
  }
  if (firstLocation.locationType === "worldItem") {
    return firstLocation.itemUid === secondLocation.itemUid;
  }
  return false;
};

const didItemDragChangeState = (snapshot) => {
  const currentLocation = findItemLocationByUid(snapshot.sourceItem.uid);
  return (
    !areItemLocationsEqual(snapshot.source, currentLocation) ||
    snapshot.sourceItem.quantity !== snapshot.sourceQuantity ||
    snapshot.sourceItem.x !== snapshot.sourceX ||
    snapshot.sourceItem.y !== snapshot.sourceY ||
    snapshot.sourceItem.z !== snapshot.sourceZ ||
    (snapshot.destinationItem?.quantity ?? null) !== snapshot.destinationQuantity
  );
};

const getCompletedItemDragSfx = (snapshot) => {
  if (!didItemDragChangeState(snapshot)) {
    return null;
  }
  if (snapshot.destination.locationType === "equipmentSlot") {
    return GAME_SFX.itemEquip;
  }
  if (
    !ITEM_INVENTORY_LOCATION_TYPES.has(snapshot.source.locationType) &&
    !ITEM_INVENTORY_LOCATION_TYPES.has(snapshot.destination.locationType)
  ) {
    return null;
  }
  if (getItemData(snapshot.sourceItem.itemId)?.type === "currency") {
    return GAME_SFX.moneyMove;
  }
  return GAME_SFX.itemMove;
};

const tryStartItemDragActionNavigation = (source, sourceItem, destination) => {
  if (source.locationType === "worldItem" && !isNearPlayer(sourceItem, 1)) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.itemDrag,
      itemUid: sourceItem.uid,
      source: { ...source },
      destination: { ...destination },
    });
    return true;
  }

  if (destination.locationType === "worldTile" && !isNearPlayer(destination, WORLD_ITEM_THROW_RANGE)) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.itemDrag,
      itemUid: sourceItem.uid,
      source: { ...source },
      destination: { ...destination },
    });
    return true;
  }

  return false;
};

const createInventoryMoveExecutionResult = (dragSfxSnapshot) => {
  if (!didItemDragChangeState(dragSfxSnapshot)) {
    return { success: false, reason: INVENTORY_ACTION_REASON.moveRejected };
  }
  const sfx = getCompletedItemDragSfx(dragSfxSnapshot);
  return {
    success: true,
    changes: {
      itemUid: dragSfxSnapshot.sourceItem.uid,
      location: findItemLocationByUid(dragSfxSnapshot.sourceItem.uid),
      quantity: dragSfxSnapshot.sourceItem.quantity,
    },
    events: sfx ? [{ type: "inventory-move-completed", sfx }] : [],
  };
};

const executeInventoryMoveRequest = ({ source, destination, itemUid }) => {
  const sourceItem = getDragSourceItem(source);
  const destinationItem = getDragSourceItem(destination);
  const dragSfxSnapshot = sourceItem
    ? createItemDragSfxSnapshot(source, sourceItem, destination, destinationItem)
    : null;
  const result = inventoryMoveService.execute({ source, destination, itemUid });

  if (result.success) {
    refreshItemUiAfterDrag();
    const sfx = dragSfxSnapshot ? getCompletedItemDragSfx(dragSfxSnapshot) : null;
    return {
      ...result,
      events: sfx ? [{ type: "inventory-move-completed", sfx }] : [],
    };
  }
  if (result.reason === INVENTORY_ACTION_REASON.capacityExceeded) {
    showGameStatusMessage(getGameUiText("notEnoughCapacity"));
  } else if (result.reason === INVENTORY_ACTION_REASON.notTopOfStack) {
    showGameStatusMessage(getGameUiText("itemNotTopOfStack"));
  } else if (
    result.reason === INVENTORY_ACTION_REASON.invalidDestination ||
    result.reason === INVENTORY_ACTION_REASON.moveRejected
  ) {
    showGameStatusMessage(getGameUiText("cannotPlaceItem"));
  }
  cancelItemDrag();
  return result;
};

const completeItemDrag = (destination) => {
  if (!dragState.isDragging || !destination || !dragState.item) {
    cancelItemDrag();
    return null;
  }
  const source = getDragSourceFromState();
  const sourceItem = getDragSourceItem(source);
  if (!sourceItem || tryStartItemDragActionNavigation(source, sourceItem, destination)) {
    cancelItemDrag();
    return null;
  }
  const action = createMoveItemAction(source, destination, dragState.item.uid);
  if (!action) {
    cancelItemDrag();
    return null;
  }
  const result = gameTransport.send(action);
  if (result && typeof result.then === "function") {
    cancelItemDrag();
    handleGameActionResult(result, (resolvedResult) => {
      if (!resolvedResult?.success) {
        const messageKeyByReason = {
          [INVENTORY_ACTION_REASON.capacityExceeded]: "notEnoughCapacity",
          [INVENTORY_ACTION_REASON.notTopOfStack]: "itemNotTopOfStack",
        };
        showGameStatusMessage(getGameUiText(messageKeyByReason[resolvedResult?.reason] ?? "cannotPlaceItem"));
        return;
      }

      renderContainerDock();
    });
  }
  return result;
};

const renderItemIcon = (parentElement, item, slotSize) => {
  parentElement.innerHTML = "";
  if (!item) {
    return;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return;
  }
  const atlasPath = getAtlasPath(itemData.render.atlas);
  const enrichedParts = getItemRenderData(item);
  let totalWidth = 0;
  let totalHeight = 0;
  let minX = null;
  let maxX = null;
  let minY = null;
  let maxY = null;
  enrichedParts.forEach((enrichedPart) => {
    if (minX === null || minX > enrichedPart.offsetX) {
      minX = enrichedPart.offsetX;
    }
    if (maxX === null || maxX < enrichedPart.offsetX + enrichedPart.sourceWidth) {
      maxX = enrichedPart.offsetX + enrichedPart.sourceWidth;
    }
    if (minY === null || minY > enrichedPart.offsetY) {
      minY = enrichedPart.offsetY;
    }
    if (maxY === null || maxY < enrichedPart.offsetY + enrichedPart.sourceHeight) {
      maxY = enrichedPart.offsetY + enrichedPart.sourceHeight;
    }
    totalWidth = maxX - minX;
    totalHeight = maxY - minY;
  });
  const biggestDimension = Math.max(totalWidth, totalHeight);
  const scale = slotSize / biggestDimension;
  const renderWidth = totalWidth * scale;
  const renderHeight = totalHeight * scale;
  const paddingLeft = (slotSize - renderWidth) / 2;
  const paddingTop = (slotSize - renderHeight) / 2;
  enrichedParts.forEach((enrichedPart) => {
    const div = document.createElement("div");
    div.classList.add("item-icon-part");
    div.style.backgroundImage = `url("${atlasPath}")`;
    div.style.backgroundPosition = `-${enrichedPart.sourceX}px -${enrichedPart.sourceY}px`;
    div.style.left = `${paddingLeft + (enrichedPart.offsetX - minX) * scale}px`;
    div.style.top = `${paddingTop + (enrichedPart.offsetY - minY) * scale}px`;
    div.style.width = `${enrichedPart.sourceWidth}px`;
    div.style.height = `${enrichedPart.sourceHeight}px`;
    div.style.transform = `scale(${scale})`;
    div.style.transformOrigin = "top left";

    parentElement.appendChild(div);
  });
  if (itemData.stackable && item.quantity > 1) {
    const quantity = document.createElement("p");
    quantity.innerHTML = `${item.quantity}`;
    quantity.classList.add("item-quantity");
    parentElement.appendChild(quantity);
  }
  if (itemData.type === "rune" && itemData.use?.cooldownGroup) {
    const cooldownOverlay = document.createElement("div");
    cooldownOverlay.classList.add("item-cooldown-overlay");
    cooldownOverlay.dataset.cooldownGroup = itemData.use.cooldownGroup;
    cooldownOverlay.setAttribute("aria-hidden", "true");
    parentElement.appendChild(cooldownOverlay);
    itemCooldownOverlayElements.add(cooldownOverlay);
    updateItemCooldownOverlayElement(cooldownOverlay, Date.now());
  }
};

const renderEquipmentSlots = () => {
  const equipmentsElement = document.querySelectorAll("[data-equipment-slot]");
  const equippedWeapon = getEquipmentSlotItem("weapon");
  const equippedWeaponData = equippedWeapon ? getItemData(equippedWeapon.itemId) : null;
  const weaponUsesAmmunition = typeof equippedWeaponData?.combat?.ammunitionItemId === "string";
  equipmentsElement.forEach((equipmentElement) => {
    const slotName = equipmentElement.getAttribute("data-equipment-slot");
    const item = getEquipmentSlotItem(slotName);
    const slotSize = equipmentElement.classList.contains("equipment-small-slot") ? 24 : 48;
    equipmentElement.classList.toggle("equipment-slot-ammunition-mode", slotName === "shield" && weaponUsesAmmunition);
    renderItemIcon(equipmentElement, item, slotSize);
    if (item) {
      equipmentElement.classList.add("equipment-slot-filled");
      equipmentElement.classList.remove("equipment-slot-empty");

      equipmentElement.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragState.isDragging) {
          inputState.shouldBlockNextContextMenu = true;
          cancelItemDrag();
          return;
        }
        if (shouldBlockContextMenuAction()) {
          return;
        }
        const itemData = getItemData(item.itemId);
        if (!itemData) {
          return;
        }
        const source = {
          locationType: "equipmentSlot",
          equipmentSlotName: slotName,
        };
        handleUseItemFromSource(source);
      });
    }
    if (!item) {
      equipmentElement.classList.remove("equipment-slot-filled");
      equipmentElement.classList.add("equipment-slot-empty");
    }
  });
};

const getPlayerStatusIndicatorLabel = (statusIndicator) => {
  const labelKeyByIndicator = {
    [PLAYER_STATUS_INDICATOR.whiteSkull]: "statusWhiteSkull",
    [PLAYER_STATUS_INDICATOR.redSkull]: "statusRedSkull",
    [PLAYER_STATUS_INDICATOR.poison]: "statusPoisoned",
    [PLAYER_STATUS_INDICATOR.fire]: "statusBurning",
    [PLAYER_STATUS_INDICATOR.energy]: "statusElectrified",
    [PLAYER_STATUS_INDICATOR.ice]: "statusFrozen",
    [PLAYER_STATUS_INDICATOR.combat]: "statusCombatLocked",
    [PLAYER_STATUS_INDICATOR.protection]: "statusProtectionZone",
  };
  return getGameUiText(labelKeyByIndicator[statusIndicator]);
};

const isPlayerInProtectionZone = () => {
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(playerState.z) ?? null;
  if (!worldMap || !Number.isInteger(playerState.x) || !Number.isInteger(playerState.y)) {
    return false;
  }
  return Boolean(findProtectionZoneAtTile(worldMap, playerState.x / TILE_SIZE, playerState.y / TILE_SIZE));
};

const refreshPlayerStatusIndicators = (now = Date.now(), forceRefresh = false) => {
  if (!forceRefresh && now < playerStatusIndicatorUiState.nextRefreshAt) {
    return;
  }
  playerStatusIndicatorUiState.nextRefreshAt = now + 200;

  let statusSlot = playerStatusIndicatorUiState.slot;
  if (!statusSlot?.isConnected) {
    statusSlot = playerInventory?.querySelector('[data-equipment-small-slot="status"]') ?? null;
    playerStatusIndicatorUiState.slot = statusSlot;
    playerStatusIndicatorUiState.signature = null;
  }
  if (!statusSlot) {
    return;
  }

  const indicators = getActivePlayerStatusIndicators(playerState, now, {
    isInProtectionZone: isPlayerInProtectionZone(),
  });
  const signature = indicators.join(":");
  if (!forceRefresh && signature === playerStatusIndicatorUiState.signature) {
    return;
  }

  playerStatusIndicatorUiState.signature = signature;
  statusSlot.replaceChildren();
  for (const indicator of indicators) {
    const indicatorElement = document.createElement("span");
    const label = getPlayerStatusIndicatorLabel(indicator);
    indicatorElement.classList.add("player-status-indicator", `player-status-indicator-${indicator}`);
    indicatorElement.setAttribute("role", "img");
    indicatorElement.setAttribute("aria-label", label);
    indicatorElement.title = label;
    statusSlot.appendChild(indicatorElement);
  }
};

const refreshLocalizedWorldLabels = () => {
  for (const [monsterUid, refs] of monsterElementsByUid.entries()) {
    const monster = findMonsterByUid(monsterUid);
    const nameElement = refs.root?.querySelector(".monster-name");
    const monsterData = getLocalizedMonsterData(monster?.monsterId);
    if (nameElement && monsterData) {
      nameElement.textContent = monsterData.name;
    }
  }
  renderContainerDock();
};

const applyGameLanguageUi = () => gameOptionsController.applyLanguageUi();
const saveGameOptions = () => gameOptionsController.save();
const applyGameOptions = () => gameOptionsController.apply();
const refreshGameLanguageDependentUi = () => gameOptionsController.refreshLanguageDependentUi();
const setGameLanguage = (language) => gameOptionsController.setLanguage(language);
const renderOptionsWindow = () => {
  const optionsWindowParent = isMobileGameLayout() ? mobileGameControls : game;
  if (optionsWindowParent && gameOptionsWindow?.parentElement !== optionsWindowParent) {
    optionsWindowParent.appendChild(gameOptionsWindow);
  }
  gameOptionsController.render();
};
const toggleOptionsWindow = () => gameOptionsController.toggle();

const refreshPvpButtonState = () => {
  const pvpButton = playerInventory?.querySelector('[data-ui-action="show-pvp-status"]');
  const pvpEnabled = playerState.pvp?.enabled === true;
  const skullType = playerState.pvp?.skullType ?? "none";
  pvpButton?.classList.toggle("equipment-ui-button-pvp-active", pvpEnabled);
  pvpButton?.classList.toggle("equipment-ui-button-pvp-skull-white", skullType === "white");
  pvpButton?.classList.toggle("equipment-ui-button-pvp-skull-red", skullType === "red");
  pvpButton?.setAttribute("aria-pressed", String(pvpEnabled));
  refreshPlayerSkull(skullType);
  const mobilePvpButton = document.querySelector('[data-mobile-action="toggle-pvp"]');
  mobilePvpButton?.classList.toggle("mobile-panel-button-active", pvpEnabled);
  mobilePvpButton?.classList.toggle("mobile-pvp-skull-active", skullType !== "none");
  mobilePvpButton?.setAttribute("aria-pressed", String(pvpEnabled));
};

const togglePvpMode = () => {
  const enabled = playerState.pvp?.enabled !== true;
  const action = createSetPvpEnabledAction(enabled, Date.now());
  handleGameActionResult(gameTransport.send(action), (result) => {
    if (!result?.success) {
      const messageKey = result?.reason === "pvp-locked-by-skull" ? "pvpLockedBySkull" : "pvpChangeFailed";
      showGameStatusMessage(getGameUiText(messageKey));
      return;
    }
    playerState.pvp.enabled = enabled;
    refreshPvpButtonState();
    showGameStatusMessage(getGameUiText(enabled ? "pvpEnabled" : "pvpDisabled"));
  });
};

const logoutCurrentCharacter = () => {
  if (!saveCurrentCharacterBeforeSwitch()) {
    return false;
  }

  gameRuntimeState.isSwitchingCharacter = true;
  try {
    sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
  } catch {
    // The welcome screen is still the default destination without session storage.
  }
  stopGameMusic();
  window.location.reload();
  return true;
};

const requestLogoutCurrentCharacter = () => logoutConfirmationController?.open();

const bindEquipmentMenuButtons = () => {
  const pvpButton = playerInventory.querySelector('[data-ui-action="show-pvp-status"]');
  const hotkeyButton = playerInventory.querySelector('[data-ui-action="toggle-spells"]');
  const optionsButton = playerInventory.querySelector('[data-ui-action="toggle-options"]');
  const logoutButton = playerInventory.querySelector('[data-ui-action="logout"]');
  pvpButton?.addEventListener("click", togglePvpMode);
  hotkeyButton?.addEventListener("click", toggleSpellWindow);
  optionsButton?.addEventListener("click", toggleOptionsWindow);
  logoutButton?.addEventListener("click", requestLogoutCurrentCharacter);
  refreshPvpButtonState();
};

/* ---------- UI - SORTS ET HOTKEYS ---------- */

const isPlayerSpellLearned = (spellId) => playerSpellSystem.isLearned(spellId);
const getLearnedPlayerSpells = () => playerSpellSystem.getLearned();
const assignPlayerSpellToHotkey = (hotkeyIndex, spellId) => playerSpellSystem.assignToHotkey(hotkeyIndex, spellId);

const renderSpellWindow = () => {
  if (!playerSpells) {
    return;
  }

  const mobileLayout = isMobileGameLayout();
  const spellWindowParent = mobileLayout ? mobileGameControls : game;
  if (spellWindowParent && playerSpells.parentElement !== spellWindowParent) {
    spellWindowParent.appendChild(playerSpells);
  }
  const mobileAssignHotkeyIndex = Number.isInteger(spellUiState.mobileAssignHotkeyIndex)
    ? spellUiState.mobileAssignHotkeyIndex
    : null;
  const isMobileAssigning = mobileLayout && mobileAssignHotkeyIndex !== null;
  const shouldFocusSpellWindow = !mobileLayout && playerSpells.hidden && spellUiState.isOpen;
  playerSpells.hidden = !spellUiState.isOpen;
  playerSpells.innerHTML = "";
  playerSpells.classList.toggle("spell-window-mobile-bar", mobileLayout);
  playerSpells.classList.toggle("spell-window-mobile-assigning", isMobileAssigning);
  playerSpells.setAttribute("role", mobileLayout ? "region" : "dialog");
  if (mobileLayout) {
    playerSpells.removeAttribute("aria-modal");
  } else {
    playerSpells.setAttribute("aria-modal", "true");
  }
  playerSpells.setAttribute("aria-labelledby", "spell-window-title");
  playerSpells.setAttribute("aria-describedby", "spell-window-help");
  const mobileSpellButton = document.querySelector('[data-mobile-action="toggle-spells"]');
  mobileSpellButton?.classList.toggle("mobile-panel-button-active", spellUiState.isOpen);
  mobileSpellButton?.setAttribute("aria-expanded", spellUiState.isOpen ? "true" : "false");
  if (!spellUiState.isOpen) {
    return;
  }

  const wrapperElement = document.createElement("div");
  wrapperElement.classList.add("boite-boite");
  const headerElement = document.createElement("div");
  headerElement.classList.add("spell-window-header");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.id = "spell-window-title";
  titleElement.textContent = getGameUiText("spells");
  const closeButtonElement = document.createElement("button");
  closeButtonElement.classList.add("spell-window-close-button");
  closeButtonElement.type = "button";
  closeButtonElement.textContent = "\u00d7";
  closeButtonElement.title = getGameUiText("closeSpells");
  closeButtonElement.setAttribute("aria-label", getGameUiText("closeSpells"));
  closeButtonElement.addEventListener("click", () => {
    spellUiState.isOpen = false;
    spellUiState.selectedSpellId = null;
    spellUiState.mobileAssignHotkeyIndex = null;
    updatePlayerInventory();
  });
  headerElement.append(titleElement, closeButtonElement);

  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const hotkeyTitleElement = document.createElement("div");
  hotkeyTitleElement.id = "spell-hotkey-title";
  hotkeyTitleElement.classList.add("spell-list-title", "spell-hotkey-title");
  hotkeyTitleElement.textContent = getGameUiText("spellBar");
  const helpElement = document.createElement("div");
  helpElement.id = "spell-window-help";
  helpElement.classList.add("spell-window-help");
  helpElement.setAttribute("aria-live", "polite");
  const selectedSpellData = spellUiState.selectedSpellId ? getLocalizedSpellData(spellUiState.selectedSpellId) : null;
  if (isMobileAssigning) {
    helpElement.textContent = getGameUiText("mobileSpellAssignPrompt")(SPELL_HOTKEY_KEYS[mobileAssignHotkeyIndex]);
  } else if (mobileLayout) {
    helpElement.textContent = getGameUiText("mobileSpellBarHelp");
  } else {
    helpElement.textContent = selectedSpellData
      ? getGameUiText("spellAssignPrompt")(selectedSpellData.name)
      : getGameUiText("spellWindowHelp");
  }
  const hotkeyGridElement = document.createElement("div");
  hotkeyGridElement.classList.add("spell-hotkey-grid");
  hotkeyGridElement.setAttribute("role", "group");
  hotkeyGridElement.setAttribute("aria-labelledby", "spell-hotkey-title");

  for (let hotkeyIndex = 0; hotkeyIndex < SPELL_HOTKEY_KEYS.length; hotkeyIndex++) {
    const spellId = playerState.spellbook.hotkeySpellIds[hotkeyIndex];
    const spellData = spellId ? getLocalizedSpellData(spellId) : null;
    const slotElement = document.createElement("div");
    slotElement.classList.add("spell-hotkey-slot");
    slotElement.classList.toggle("spell-hotkey-slot-assigning", mobileAssignHotkeyIndex === hotkeyIndex);
    const castButtonElement = document.createElement("button");
    castButtonElement.classList.add("spell-hotkey-cast-button");
    castButtonElement.type = "button";
    castButtonElement.innerHTML = `<span class="spell-hotkey-key">${SPELL_HOTKEY_KEYS[hotkeyIndex]}</span><span class="spell-hotkey-name">${spellData?.name ?? "-"}</span>`;
    castButtonElement.setAttribute(
      "aria-label",
      getGameUiText("spellSlotLabel")(
        SPELL_HOTKEY_KEYS[hotkeyIndex],
        spellData?.name ?? getGameUiText("emptySpellSlot"),
      ),
    );
    if (!mobileLayout && !spellId && !spellUiState.selectedSpellId) {
      castButtonElement.disabled = true;
    }
    let mobileLongPressTimeoutId = null;
    let mobilePressStartX = null;
    let mobilePressStartY = null;
    let mobilePressCancelled = false;
    let suppressNextClick = false;

    const clearMobileLongPressTimeout = () => {
      if (mobileLongPressTimeoutId !== null) {
        clearTimeout(mobileLongPressTimeoutId);
        mobileLongPressTimeoutId = null;
      }
    };

    castButtonElement.addEventListener("pointerdown", (e) => {
      if (!mobileLayout || e.pointerType === "mouse") {
        return;
      }
      mobilePressStartX = e.clientX;
      mobilePressStartY = e.clientY;
      mobilePressCancelled = false;
      clearMobileLongPressTimeout();
      mobileLongPressTimeoutId = setTimeout(() => {
        mobileLongPressTimeoutId = null;
        spellUiState.mobileAssignHotkeyIndex = hotkeyIndex;
        spellUiState.selectedSpellId = null;
        renderSpellWindow();
      }, MOBILE_SPELL_LONG_PRESS_MS);
    });

    castButtonElement.addEventListener("pointermove", (e) => {
      if (mobileLongPressTimeoutId === null || mobilePressStartX === null || mobilePressStartY === null) {
        return;
      }
      const moveDistance = Math.abs(e.clientX - mobilePressStartX) + Math.abs(e.clientY - mobilePressStartY);
      if (moveDistance > MOBILE_SPELL_PRESS_MOVE_TOLERANCE_PX) {
        mobilePressCancelled = true;
        clearMobileLongPressTimeout();
      }
    });

    castButtonElement.addEventListener("pointerup", (e) => {
      if (!mobileLayout || e.pointerType === "mouse") {
        return;
      }
      e.preventDefault();
      const shouldCastSpell = mobileLongPressTimeoutId !== null && !mobilePressCancelled && Boolean(spellId);
      clearMobileLongPressTimeout();
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 100);
      if (shouldCastSpell) {
        castLearnedPlayerSpellById(spellId);
      }
    });

    castButtonElement.addEventListener("pointercancel", () => {
      mobilePressCancelled = true;
      clearMobileLongPressTimeout();
    });

    castButtonElement.addEventListener("click", () => {
      if (suppressNextClick) {
        return;
      }
      if (spellUiState.selectedSpellId) {
        assignPlayerSpellToHotkey(hotkeyIndex, spellUiState.selectedSpellId);
      } else if (spellId) {
        castLearnedPlayerSpellById(spellId);
      }
    });
    slotElement.appendChild(castButtonElement);
    if (spellId) {
      const clearButtonElement = document.createElement("button");
      clearButtonElement.classList.add("spell-hotkey-clear-button");
      clearButtonElement.type = "button";
      clearButtonElement.textContent = "x";
      clearButtonElement.title = getGameUiText("clearHotkey");
      clearButtonElement.setAttribute("aria-label", getGameUiText("clearSpellSlot")(SPELL_HOTKEY_KEYS[hotkeyIndex]));
      clearButtonElement.addEventListener("click", () => {
        assignPlayerSpellToHotkey(hotkeyIndex, null);
      });
      slotElement.appendChild(clearButtonElement);
    }
    hotkeyGridElement.appendChild(slotElement);
  }

  const learnedTitleElement = document.createElement("div");
  learnedTitleElement.classList.add("spell-list-title");
  learnedTitleElement.textContent = getGameUiText("learnedSpells");
  learnedTitleElement.hidden = mobileLayout && !isMobileAssigning;
  const learnedListElement = document.createElement("div");
  learnedListElement.classList.add("spell-list");
  learnedListElement.setAttribute("role", "list");
  learnedListElement.hidden = mobileLayout && !isMobileAssigning;
  const learnedSpells = getLearnedPlayerSpells();

  if (learnedSpells.length === 0) {
    const emptyElement = document.createElement("div");
    emptyElement.classList.add("spell-list-empty");
    emptyElement.textContent = getGameUiText("noLearnedSpells");
    learnedListElement.appendChild(emptyElement);
  } else {
    for (const spellData of learnedSpells) {
      const rowElement = document.createElement("div");
      rowElement.classList.add("spell-list-row");
      rowElement.classList.toggle("spell-list-row-selected", spellUiState.selectedSpellId === spellData.spellId);
      rowElement.setAttribute("role", "listitem");
      const detailsElement = document.createElement("div");
      detailsElement.classList.add("spell-list-details");
      const nameElement = document.createElement("strong");
      nameElement.textContent = spellData.name;
      const statsElement = document.createElement("span");
      statsElement.textContent = `${spellData.incantation} | ML ${spellData.requiredMagicLevel} | ${spellData.manaCost} MP`;
      detailsElement.append(nameElement, statsElement);
      const actionsElement = document.createElement("div");
      actionsElement.classList.add("spell-list-actions");
      const castButtonElement = document.createElement("button");
      castButtonElement.classList.add("spell-list-cast-button");
      castButtonElement.type = "button";
      castButtonElement.textContent = getGameUiText("castSpell");
      castButtonElement.hidden = mobileLayout;
      castButtonElement.setAttribute("aria-label", `${getGameUiText("castSpell")}: ${spellData.name}`);
      castButtonElement.addEventListener("click", () => castLearnedPlayerSpellById(spellData.spellId));
      const assignButtonElement = document.createElement("button");
      assignButtonElement.classList.add("spell-list-assign-button");
      assignButtonElement.type = "button";
      assignButtonElement.textContent = getGameUiText("assignSpell");
      assignButtonElement.setAttribute(
        "aria-pressed",
        spellUiState.selectedSpellId === spellData.spellId ? "true" : "false",
      );
      assignButtonElement.setAttribute("aria-label", `${getGameUiText("assignSpell")}: ${spellData.name}`);
      assignButtonElement.addEventListener("click", () => {
        if (isMobileAssigning) {
          assignPlayerSpellToHotkey(mobileAssignHotkeyIndex, spellData.spellId);
          return;
        }
        spellUiState.selectedSpellId = spellUiState.selectedSpellId === spellData.spellId ? null : spellData.spellId;
        renderSpellWindow();
      });
      actionsElement.append(castButtonElement, assignButtonElement);
      rowElement.append(detailsElement, actionsElement);
      learnedListElement.appendChild(rowElement);
    }
  }

  wrapperElement.append(
    headerElement,
    separatorElement,
    hotkeyTitleElement,
    helpElement,
    hotkeyGridElement,
    learnedTitleElement,
    learnedListElement,
  );
  playerSpells.appendChild(wrapperElement);
  if (shouldFocusSpellWindow) {
    requestAnimationFrame(() => closeButtonElement.focus());
  }
};

const toggleSpellWindow = () => {
  spellUiState.isOpen = !spellUiState.isOpen;
  spellUiState.selectedSpellId = null;
  spellUiState.mobileAssignHotkeyIndex = null;
  if (spellUiState.isOpen) {
    questUiState.isOpen = false;
    gameOptionsUiState.isOpen = false;
    setOpenMobilePanel(null);
  }
  updatePlayerInventory();
};

/* ---------- UI - QUETES ---------- */

const renderQuestWindow = () => questWindowController.render();
const toggleQuestWindow = () => questWindowController.toggle();
const bindQuestUiButton = () => questWindowController.bindButton();

const closeCharacterSelector = () => characterSelectorController.close();
const openCharacterSelector = () => characterSelectorController.open();
const saveCurrentCharacterBeforeSwitch = () => characterSelectorController.saveBeforeSwitch();
const renderCharacterSelector = () => characterSelectorController.render();
const toggleCharacterSelector = () => characterSelectorController.toggle();
const initializeGameWelcome = () => characterSelectorController.initializeWelcome();

const togglePlayerFollow = () => {
  playerNavigationState.followEnabled = !playerNavigationState.followEnabled;

  if (playerNavigationState.followEnabled) {
    startPlayerFollowNavigation();
  } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
    stopPlayerNavigation();
  }

  updatePlayerInventory();
};

const bindPlayerFollowButton = () => {
  const followButton = playerInventory.querySelector('[data-ui-action="toggle-follow"]');
  if (!followButton) {
    return;
  }
  followButton.addEventListener("click", togglePlayerFollow);
};

const updatePlayerInventory = () => {
  let html = `<div class="boite-boite">
              <div class="equipment-panel">
                <div class="mobile-panel-window-header">
                  <div class="boite-jeux-titre">${getGameUiText("equipments")}</div>
                  <button class="mobile-window-close-button" type="button" data-mobile-panel-close="inventory" aria-label="${getGameUiText("closePanel")}" title="${getGameUiText("closePanel")}">&times;</button>
                </div>
                <div class="separateur-panneau"></div>

                <div id="equipment-area" class="equipment-area">
                  <div class="equipment-grid">
                    <div class="equipment-column">
                      <div class="equipment-slot" data-equipment-slot="necklace"></div>
                      <div class="equipment-slot" data-equipment-slot="weapon"></div>
                      <div class="equipment-slot" data-equipment-slot="ring"></div>
                      <div class="equipment-small-slot" data-equipment-small-slot="status"></div>
                    </div>

                    <div class="equipment-column">
                      <div class="equipment-slot" data-equipment-slot="helmet"></div>
                      <div class="equipment-slot" data-equipment-slot="armor"></div>
                      <div class="equipment-slot" data-equipment-slot="legs"></div>
                      <div class="equipment-slot" data-equipment-slot="boots"></div>
                    </div>

                    <div class="equipment-column">
                      <div class="equipment-slot" data-equipment-slot="backpack"></div>
                      <div class="equipment-slot" data-equipment-slot="shield"></div>
                      <div class="equipment-slot" data-equipment-slot="ammo"></div>
                      <div class="equipment-small-slot equipment-cap-slot">${getGameUiText("capacityShort")}:<br />${getPlayerRemainingCapacity(playerState)}</div>
                    </div>
                  </div>

                  <div class="equipment-right-bar">
                    <button class="equipment-ui-button${playerNavigationState.followEnabled ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-follow" aria-pressed="${playerNavigationState.followEnabled}">${getGameUiText("follow")}</button>
                    <button class="equipment-ui-button" data-ui-action="show-pvp-status">PVP</button>
                    <button class="equipment-ui-button${spellUiState.isOpen ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-spells" aria-haspopup="dialog" aria-controls="player-spells" aria-expanded="${spellUiState.isOpen}">${getGameUiText("hotkeys")}</button>
                    <button class="equipment-ui-button${questUiState.isOpen ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-quests">${getGameUiText("quests")}</button>
                    <button class="equipment-ui-button${gameOptionsUiState.isOpen ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-options">${getGameUiText("options")}</button>
                    <button class="equipment-ui-button" data-ui-action="logout">${getGameUiText("logout")}</button>
                  </div>
                </div>
               <div class="stance-bar">
                  <button class="stance-button" data-combat-mode="fullAttack">${getGameUiText("fullAttack")}</button>
                  <button class="stance-button stance-button-active" data-combat-mode="balanced">${getGameUiText("balanced")}</button>
                  <button class="stance-button" data-combat-mode="fullDefense">${getGameUiText("fullDefense")}</button>
                </div>
              </div>
            </div>`;

  playerInventory.innerHTML = html;
  playerStatusIndicatorUiState.slot = playerInventory.querySelector('[data-equipment-small-slot="status"]');
  playerStatusIndicatorUiState.signature = null;
  playerStatusIndicatorUiState.nextRefreshAt = 0;
  renderEquipmentSlots();
  refreshPlayerStatusIndicators(Date.now(), true);
  bindCombatModeButtons();
  bindPlayerFollowButton();
  bindQuestUiButton();
  bindEquipmentMenuButtons();
  refreshCombatModeButtons();
  renderQuestWindow();
  renderOptionsWindow();
  renderSpellWindow();
  syncMobileBackpackButton();
  syncMobileFollowButton();
  syncMobileWindowButtons();
  syncItemUseSourceFeedback();
};

const getLocalizedSpellData = (spellId) => {
  const spellData = spellsDatabase[spellId] ?? null;
  if (!spellData) {
    return null;
  }
  if (getCurrentGameLanguage() === "fr") {
    return {
      ...spellData,
      name: spellData.nameFr ?? spellData.name,
      description: spellData.descriptionFr ?? spellData.description,
    };
  }
  return spellData;
};
//#endregion  -----  UI - EQUIPMENT / INVENTAIRE  -----

/* ==================================================== */
//#region     -----  UI - CONTENEURS  -----
/* ==================================================== */
/* ---------- CONTENEURS - SLOTS ET FENETRES ---------- */

let containerWindowController = null;
const renderContainerSlots = (containerBody, containerItem) =>
  containerWindowController.renderSlots(containerBody, containerItem);
const renderContainerDock = () => containerWindowController.render();
const closeAllContainer = () => containerWindowController.closeAll();
const closeContainer = (containerItem) => containerWindowController.close(containerItem);
const openContainer = (containerItem, title, source, parent) =>
  containerWindowController.open(containerItem, title, source, parent);
const findOpenedContainerItemByUid = (containerUid) => containerWindowController.findItemByUid(containerUid);
const findOpenedContainerIndexByUid = (containerUid) => containerWindowController.findIndexByUid(containerUid);
const toggleContainerMinimized = (containerItem) => containerWindowController.toggleMinimized(containerItem);
//#endregion  -----  UI - CONTENEURS  -----

/* ==================================================== */
//#region     -----  ITEMS - UTILISATION ET COOLDOWNS  -----
/* ==================================================== */

const consumeOneChargeFromRune = (item, source) => {
  if (!item || !source || !item.charges) {
    return false;
  }
  if (item.charges >= 1) {
    item.charges -= 1;
  }
  if (item.charges <= 0) {
    const wasRemoved = removeItemFromDragSource(source);
    if (!wasRemoved) {
      return false;
    }
  }
  return true;
};

const updateItemCooldownOverlayElement = (element, now) => {
  const cooldownGroup = element?.dataset.cooldownGroup;
  if (!cooldownGroup) {
    return;
  }
  const remainingRatio = getUseCooldownRemainingRatio(cooldownGroup, now);
  element.style.setProperty("--item-cooldown-angle", `${remainingRatio * 360}deg`);
  element.classList.toggle("item-cooldown-overlay-active", remainingRatio > 0);
};

const updateItemCooldownOverlays = (now) => {
  for (const element of itemCooldownOverlayElements) {
    if (!element.isConnected) {
      itemCooldownOverlayElements.delete(element);
      continue;
    }
    updateItemCooldownOverlayElement(element, now);
  }
};

/* ---------- ITEM USE - ETAT / ROUTAGE ET ACTIONS ---------- */
const addUseCursorClass = () => {
  resetMobileJoystick();
  boitePrincipale.classList.add("item-use-cursor");
};

const removeUseCursorClass = () => {
  boitePrincipale.classList.remove("item-use-cursor");
};

const cancelItemUse = () => {
  clearItemUseSourceFeedback();
  itemUseState.isUsingItem = false;
  itemUseState.source = null;
  itemUseState.item = null;
  itemUseState.useData = null;
  itemUseState.startedAt = null;
  clearPixiItemUseTargets();
  removeUseCursorClass();
  resetInputComboState();
};

const startItemUse = (source, item, useData) => {
  if (!source || !item || !useData) {
    cancelItemUse();
    return;
  }
  itemUseState.isUsingItem = true;
  addUseCursorClass();
  itemUseState.source = source;
  itemUseState.item = item;
  itemUseState.useData = useData;
  itemUseState.startedAt = Date.now();
  syncItemUseSourceFeedback();
  syncItemUseTargetIndicators();
};

const getItemUseSourceElement = (source) => {
  if (source?.locationType === "containerSlot") {
    return document.querySelector(
      `[data-container-uid="${source.parentContainerUid}"][data-container-slot-index="${source.slotIndex}"]`,
    );
  }
  if (source?.locationType === "equipmentSlot") {
    return document.querySelector(`[data-equipment-slot="${source.equipmentSlotName}"]`);
  }
  return null;
};

const clearItemUseSourceFeedback = () => {
  for (const sourceElement of document.querySelectorAll(".item-use-source-active")) {
    sourceElement.classList.remove("item-use-source-active");
  }
  if (isMobileGameLayout() && itemUseState.source?.locationType === "worldItem") {
    setPixiWorldItemSelected(itemUseState.source.itemUid, false);
  }
  if (mobileItemUseIcon) {
    mobileItemUseIcon.textContent = "";
  }
  if (mobileItemUseLabel) {
    mobileItemUseLabel.textContent = "";
  }
  mobileItemUseIndicator?.toggleAttribute("hidden", true);
};

const syncItemUseSourceFeedback = () => {
  clearItemUseSourceFeedback();
  if (!isMobileGameLayout() || !itemUseState.isUsingItem || !itemUseState.item) {
    return;
  }

  getItemUseSourceElement(itemUseState.source)?.classList.add("item-use-source-active");
  if (itemUseState.source?.locationType === "worldItem") {
    setPixiWorldItemSelected(itemUseState.source.itemUid, true);
  }
  if (mobileItemUseIcon) {
    renderItemIcon(mobileItemUseIcon, itemUseState.item, 28);
  }
  if (mobileItemUseLabel) {
    mobileItemUseLabel.textContent = getLocalizedItemName(itemUseState.item.itemId);
  }
  mobileItemUseIndicator?.toggleAttribute("hidden", false);
};

const isUsingItem = () => {
  return itemUseState.isUsingItem;
};

const getItemUseTargetRenderPosition = (entity) => {
  if (!entity) {
    return null;
  }
  const renderX = Number.isFinite(entity.renderX) ? entity.renderX : entity.x;
  const renderY = Number.isFinite(entity.renderY) ? entity.renderY : entity.y;
  if (!Number.isFinite(renderX) || !Number.isFinite(renderY)) {
    return null;
  }
  return {
    x: renderX,
    y: renderY - getEntitySurfaceOffsetY(entity),
  };
};

const isMonsterValidRuneTarget = (monster, useData) => {
  return (
    monster?.hp > 0 &&
    monster.z === playerState.z &&
    useData?.action === "attackRune" &&
    Number.isFinite(useData.range) &&
    isNearPlayer(monster, useData.range)
  );
};

const isPlayerValidRuneTarget = (targetPlayer, useData, now = Date.now()) => {
  return (
    targetPlayer?.uid !== playerState.uid &&
    targetPlayer?.hp > 0 &&
    targetPlayer.z === playerState.z &&
    useData?.action === "attackRune" &&
    Number.isFinite(useData.range) &&
    isNearPlayer(targetPlayer, useData.range) &&
    canInitiatePlayerPvpAttack(playerState, targetPlayer, now)
  );
};

const isPlayerValidHealingRuneTarget = (targetPlayer, useData) => {
  return (
    targetPlayer?.hp > 0 &&
    targetPlayer.hp < targetPlayer.maxHp &&
    targetPlayer.z === playerState.z &&
    useData?.action === "healRune" &&
    Number.isFinite(useData.range) &&
    isNearPlayer(targetPlayer, useData.range)
  );
};

const getRuneItemUseTargetIndicators = (useData) => {
  const chunkRadius = Math.ceil(useData.range / CHUNK_SIZE_TILES);
  const nearbyMonsters = getMonstersInChunkRadius(playerState.x, playerState.y, playerState.z, chunkRadius);
  const indicators = [];

  for (const monster of nearbyMonsters) {
    if (!isMonsterValidRuneTarget(monster, useData)) {
      continue;
    }
    const renderPosition = getItemUseTargetRenderPosition(monster);
    if (!renderPosition) {
      continue;
    }
    indicators.push({
      key: `monster:${monster.uid}`,
      x: renderPosition.x,
      y: renderPosition.y,
      color: 0xe4a75b,
    });
  }

  const now = Date.now();
  for (const targetPlayer of playersByUid.values()) {
    if (!isPlayerValidRuneTarget(targetPlayer, useData, now)) {
      continue;
    }
    const renderPosition = getItemUseTargetRenderPosition(targetPlayer);
    if (!renderPosition) {
      continue;
    }
    indicators.push({
      key: `player:${targetPlayer.uid}`,
      x: renderPosition.x,
      y: renderPosition.y,
      color: 0xe45b5b,
    });
  }

  return indicators;
};

const getHealingRuneTargetIndicators = (useData) => {
  const indicators = [];
  for (const targetPlayer of [playerState, ...playersByUid.values()]) {
    if (!isPlayerValidHealingRuneTarget(targetPlayer, useData)) {
      continue;
    }
    const renderPosition = getItemUseTargetRenderPosition(targetPlayer);
    if (!renderPosition) {
      continue;
    }
    indicators.push({
      key: `player:${targetPlayer.uid}`,
      x: renderPosition.x,
      y: renderPosition.y,
      color: 0x62d47d,
    });
  }
  return indicators;
};

const syncItemUseTargetIndicators = () => {
  if (!itemUseState.isUsingItem || !itemUseState.useData) {
    clearPixiItemUseTargets();
    return;
  }

  if (itemUseState.useData.action === "drinkPotion") {
    const renderPosition = getItemUseTargetRenderPosition(playerState);
    if (!renderPosition) {
      clearPixiItemUseTargets();
      return;
    }
    setPixiItemUseTargets([
      {
        key: "player:self",
        x: renderPosition.x,
        y: renderPosition.y,
        color: 0x72d6b1,
      },
    ]);
    return;
  }

  if (itemUseState.useData.action === "attackRune") {
    setPixiItemUseTargets(getRuneItemUseTargetIndicators(itemUseState.useData));
    return;
  }

  if (itemUseState.useData.action === "healRune") {
    setPixiItemUseTargets(getHealingRuneTargetIndicators(itemUseState.useData));
    return;
  }

  clearPixiItemUseTargets();
};

const getOpenedContainerRootWrapper = (containerWrapper) => containerWindowController.getRootWrapper(containerWrapper);
const findOpenedContainerWrapperByUid = (containerUid) => containerWindowController.findWrapperByUid(containerUid);

const handleOpenContainerUse = (source, item, itemData, context = {}) => {
  if (source.locationType === "equipmentSlot") {
    openContainer(item, getLocalizedItemName(item.itemId), "equipment", null);
    return;
  } else if (source.locationType === "worldItem") {
    openContainer(item, getLocalizedItemName(item.itemId), "world", null);
    return;
  } else if (source.locationType === "containerSlot") {
    const parentWrapper = findOpenedContainerWrapperByUid(source.parentContainerUid);
    if (!parentWrapper) {
      return;
    }

    if (!itemData) {
      return;
    }

    if (findOpenedContainerItemByUid(item.uid)) {
      openContainer(item, getLocalizedItemName(item.itemId), parentWrapper.sourceType, parentWrapper);
      return;
    } else {
      closeContainer(parentWrapper.item);
      openContainer(item, getLocalizedItemName(item.itemId), parentWrapper.sourceType, parentWrapper);
    }
  }
};

const handleUseItemFromSource = (source) => {
  const item = getDragSourceItem(source);
  if (!item) {
    return;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return;
  }
  const useData = getItemUseData(item);
  const cooldownGroup = itemData.type === "rune" ? getUseCooldownGroup(useData) : null;
  if (itemData.type === "rune" && !isUseCooldownReady(cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    return;
  }
  if (source.locationType === "worldItem" && !canInteractWithWorldItemSource(source)) {
    if (isWorldItemAvailableForInteraction(item) && (useData || isOpenableContainerItem(item))) {
      startPlayerActionNavigation({
        type: PLAYER_ACTION_TYPE.useWorldItem,
        itemUid: item.uid,
      });
    }
    return;
  }
  if (!useData) {
    if (isOpenableContainerItem(item)) {
      handleOpenContainerUse(source, item, itemData);
      return;
    }
  }
  if (!useData || !useData.mode) {
    return;
  }

  if (useData.mode === "direct") {
    executeDirectItemUse(item, source);
  }
  if (useData.mode === "target") {
    startItemUse(source, item, useData);
  }
};

const potionRestoreStats = {
  hp: {
    maxStat: "maxHp",
    floatingTextType: "heal",
    fullMessageKey: "fullHealth",
  },
  mana: {
    maxStat: "maxMana",
    floatingTextType: "mana",
    fullMessageKey: "fullMana",
  },
};

const replacePotionWithEmptyBottle = (item, emptyItemId) => {
  const emptyItemData = getItemData(emptyItemId);
  if (!item || !emptyItemData || emptyItemData.use) {
    return false;
  }

  item.itemId = emptyItemId;
  return true;
};

const createFluidPuddle = (groundEffectId, x, y, z, decayStage = 0) => {
  if (!getGroundEffectData(groundEffectId) || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
    return null;
  }

  const col = x / TILE_SIZE;
  const row = y / TILE_SIZE;
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(z) ?? null;
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !getWorldChunkForTilePosition(worldMap, col, row) ||
    isTiledCollisionAtTile(worldMap, col, row)
  ) {
    return null;
  }

  return addOrRefreshGroundEffectState(groundEffectId, x, y, z, decayStage);
};

const restorePlayerVitalFromPotion = (item, useData) => {
  const restoreData = potionRestoreStats[useData?.restoreStat] ?? null;
  if (!restoreData || !Number.isFinite(useData.restoreAmount) || useData.restoreAmount <= 0) {
    return { success: false, reason: "invalid-potion" };
  }

  const currentAmount = playerState[useData.restoreStat];
  const maximumAmount = playerState[restoreData.maxStat];
  if (!Number.isFinite(currentAmount) || !Number.isFinite(maximumAmount)) {
    return { success: false, reason: "invalid-player-vital" };
  }
  if (currentAmount >= maximumAmount) {
    return { success: false, reason: restoreData.fullMessageKey };
  }

  const restoredAmount = Math.min(useData.restoreAmount, maximumAmount - currentAmount);
  if (!replacePotionWithEmptyBottle(item, useData.emptyItemId)) {
    return { success: false, reason: "invalid-empty-bottle" };
  }

  playerState[useData.restoreStat] += restoredAmount;
  return {
    success: true,
    restoredAmount,
    restoreStat: useData.restoreStat,
    floatingTextType: restoreData.floatingTextType,
  };
};

const pourPotionOnTile = (item, useData, tile) => {
  const fluidPuddle = createFluidPuddle(useData?.groundEffectId, tile?.x, tile?.y, playerState.z);
  if (!fluidPuddle) {
    return { success: false, reason: "cannot-pour-potion" };
  }

  if (!replacePotionWithEmptyBottle(item, useData.emptyItemId)) {
    return { success: false, reason: "invalid-empty-bottle" };
  }
  return { success: true, groundEffectUid: fluidPuddle.uid };
};

const dispatchItemUseAction = (source, item, target = null) => {
  const action = createUseItemAction({
    source,
    itemUid: item?.uid,
    target,
    requestedAt: Date.now(),
  });
  return action ? gameTransport.send(action) : null;
};

const presentItemUseFailure = (result) => {
  if (result?.success !== false) {
    return;
  }
  const messageKeyByReason = {
    cooldown: "exhausted",
    fullHealth: "fullHealth",
    fullMana: "fullMana",
    "cannot-pour-potion": "cannotPourPotion",
    "target-out-of-range": "targetOutOfRange",
    "line-of-sight-blocked": "runeBlockedByWall",
    "torch-burned-out": "torchBurnedOut",
    "torch-needs-placement": "torchNeedsPlacement",
    "sanity-full": "alreadyFull",
    "field-not-found": "fieldNotFound",
  };
  const messageKey = messageKeyByReason[result?.reason];
  if (messageKey) {
    showGameStatusMessage(getGameUiText(messageKey));
  }
};

const handleDrinkPotionUse = (source, item, useData, target) => {
  let result = null;
  if (target.player) {
    result = dispatchItemUseAction(source, item, {
      targetType: "self",
      playerUid: playerState.uid,
    });
  } else if (target.tile) {
    if (!isNearPlayer(target.tile, useData.range)) {
      startPlayerActionNavigation({
        type: PLAYER_ACTION_TYPE.targetItemUse,
        itemUid: item.uid,
        targetType: "tile",
        targetTile: { ...target.tile, z: playerState.z },
      });
    } else {
      result = dispatchItemUseAction(source, item, {
        targetType: "tile",
        x: target.tile.x,
        y: target.tile.y,
        z: playerState.z,
      });
    }
  }

  handleGameActionResult(result, presentItemUseFailure);
  cancelItemUse();
};

const handleRuneUse = (source, item, useData, target) => {
  const isHealingRune = useData.action === "healRune";
  const targetEntity = isHealingRune ? (target.player ?? null) : (target.monster ?? target.player ?? null);
  const targetType = isHealingRune
    ? target.player === playerState
      ? "self"
      : target.player
        ? "player"
        : null
    : target.monster
      ? "monster"
      : target.player
        ? "player"
        : null;
  let result = null;
  if (targetEntity?.hp > 0 && targetEntity.z === playerState.z && !isNearPlayer(targetEntity, useData.range)) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.targetItemUse,
      itemUid: item.uid,
      targetType,
      targetUid: targetEntity.uid,
    });
  } else if (targetEntity) {
    result = dispatchItemUseAction(
      source,
      item,
      targetType === "monster"
        ? { targetType, monsterUid: targetEntity.uid }
        : { targetType, playerUid: targetEntity.uid },
    );
  }
  handleGameActionResult(result, presentItemUseFailure);
  cancelItemUse();
};

const handleGroundRuneUse = (source, item, useData, target) => {
  if (!target.tile) {
    cancelItemUse();
    return;
  }
  let result = null;
  if (!isNearPlayer(target.tile, useData.range)) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.targetItemUse,
      itemUid: item.uid,
      targetType: "tile",
      targetTile: { ...target.tile, z: playerState.z },
    });
  } else {
    result = dispatchItemUseAction(source, item, {
      targetType: "tile",
      x: target.tile.x,
      y: target.tile.y,
      z: playerState.z,
    });
  }
  handleGameActionResult(result, presentItemUseFailure);
  cancelItemUse();
};

const completeItemUseFromEvent = (e) => {
  const target = getPointerTargetFromEvent(e);
  if (!target.pointerInsideMap) {
    cancelItemUse();
    return;
  }

  const item = itemUseState.item;
  const useData = itemUseState.useData;
  const source = itemUseState.source;
  if (source?.locationType === "worldItem" && !canInteractWithWorldItemSource(source)) {
    cancelItemUse();
    return;
  }
  if (useData.action === "drinkPotion") {
    handleDrinkPotionUse(source, item, useData, target);
  }
  if (useData.action === "attackRune") {
    handleRuneUse(source, item, useData, target);
  }
  if (useData.action === "healRune") {
    handleRuneUse(source, item, useData, target);
  }
  if (useData.action === "createField" || useData.action === "dispelField") {
    handleGroundRuneUse(source, item, useData, target);
  }
};
/* ---------- ITEM USE - ACTIONS DIRECTES ---------- */

const consumeOneItemFromSource = (source, item) => {
  if (!source || !item) {
    return false;
  }
  if (!item.quantity || item.quantity <= 1) {
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      return false;
    }
    return true;
  } else if (item.quantity > 1) {
    item.quantity -= 1;
    return true;
  }
  return false;
};

const closeStackSplitMenu = () => {
  stackSplitMenuState.source = null;
  stackSplitMenuState.itemUid = null;
  stackSplitMenu?.replaceChildren();
  stackSplitMenu?.toggleAttribute("hidden", true);
};

const executeLocalSplitItemStack = ({ source, itemUid: expectedItemUid, splitQuantity }) => {
  const item = getDragSourceItem(source);
  const itemData = getItemData(item?.itemId);
  if (
    !itemData?.stackable ||
    item.uid !== expectedItemUid ||
    !Number.isInteger(splitQuantity) ||
    splitQuantity <= 0 ||
    splitQuantity >= item.quantity
  ) {
    return { success: false, reason: INVENTORY_ACTION_REASON.itemChanged };
  }

  let splitItem = null;
  if (source.locationType === "containerSlot") {
    const parentContainer = getParentContainerFromContainerSlotLocation(source);
    const emptySlotIndex = findFirstEmptyContainerSlot(parentContainer);
    if (emptySlotIndex === null) {
      return { success: false, reason: INVENTORY_ACTION_REASON.noRoom };
    }
    splitItem = createItemInstance(item.itemId, splitQuantity);
    if (!splitItem) {
      return { success: false, reason: INVENTORY_ACTION_REASON.invalidConfiguration };
    }
    parentContainer.content[emptySlotIndex] = splitItem;
  } else if (source.locationType === "worldItem") {
    if (!canInteractWithWorldItemSource(source)) {
      return { success: false, reason: INVENTORY_ACTION_REASON.invalidSource };
    }
    splitItem = createGroundItem(item.itemId, splitQuantity, item.x, item.y, item.z);
    if (!splitItem || !addGroundItem(splitItem)) {
      return { success: false, reason: INVENTORY_ACTION_REASON.moveRejected };
    }
  } else {
    return { success: false, reason: INVENTORY_ACTION_REASON.invalidSource };
  }

  item.quantity -= splitQuantity;
  refreshItemUiAfterDrag();
  autosaveCurrentCharacter();
  return {
    success: true,
    changes: { itemUid: item.uid, splitItemUid: splitItem.uid },
    events: [{ type: "inventory-stack-split", itemUid: item.uid, splitItemUid: splitItem.uid }],
  };
};

const splitItemStack = (source, expectedItemUid, splitQuantity) => {
  const action = createSplitItemStackAction(source, expectedItemUid, splitQuantity);
  if (!action) {
    return false;
  }

  handleGameActionResult(gameTransport.send(action), (result) => {
    if (result?.success) {
      closeStackSplitMenu();
      return;
    }
    if (result?.reason === INVENTORY_ACTION_REASON.noRoom) {
      showGameStatusMessage(getGameUiText("splitStackNeedsSpace"));
    } else {
      showGameStatusMessage(getGameUiText("cannotPlaceItem"));
    }
  });
  return true;
};

const openStackSplitMenu = (item, source) => {
  if (!stackSplitMenu || !source || !getItemData(item?.itemId)?.stackable || item.quantity <= 1) {
    return false;
  }

  stackSplitMenuState.source = structuredClone(source);
  stackSplitMenuState.itemUid = item.uid;

  const windowElement = document.createElement("form");
  windowElement.classList.add("boite-panneau", "stack-split-window");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre", "stack-split-title");
  titleElement.textContent = getGameUiText("splitStack");
  const itemElement = document.createElement("div");
  itemElement.classList.add("stack-split-item");
  itemElement.textContent = `${getLocalizedItemName(item.itemId, item.quantity)} (${item.quantity})`;
  const inputRowElement = document.createElement("label");
  inputRowElement.classList.add("stack-split-input-row");
  inputRowElement.textContent = getGameUiText("splitAmount");
  const numberInputElement = document.createElement("input");
  numberInputElement.classList.add("stack-split-number");
  numberInputElement.type = "number";
  numberInputElement.min = "1";
  numberInputElement.max = String(item.quantity - 1);
  numberInputElement.step = "1";
  numberInputElement.value = String(Math.max(1, Math.floor(item.quantity / 2)));
  const rangeInputElement = document.createElement("input");
  rangeInputElement.classList.add("stack-split-range");
  rangeInputElement.type = "range";
  rangeInputElement.min = numberInputElement.min;
  rangeInputElement.max = numberInputElement.max;
  rangeInputElement.value = numberInputElement.value;
  const actionsElement = document.createElement("div");
  actionsElement.classList.add("stack-split-actions");
  const cancelButtonElement = document.createElement("button");
  cancelButtonElement.type = "button";
  cancelButtonElement.textContent = getGameUiText("cancel");
  const confirmButtonElement = document.createElement("button");
  confirmButtonElement.type = "submit";
  confirmButtonElement.textContent = getGameUiText("splitConfirm");

  inputRowElement.appendChild(numberInputElement);
  actionsElement.append(cancelButtonElement, confirmButtonElement);
  windowElement.append(titleElement, itemElement, inputRowElement, rangeInputElement, actionsElement);
  stackSplitMenu.replaceChildren(windowElement);
  stackSplitMenu.toggleAttribute("hidden", false);

  rangeInputElement.addEventListener("input", () => {
    numberInputElement.value = rangeInputElement.value;
  });
  numberInputElement.addEventListener("input", () => {
    const quantity = clamp(Number(numberInputElement.value), 1, item.quantity - 1);
    rangeInputElement.value = String(quantity);
  });
  cancelButtonElement.addEventListener("click", closeStackSplitMenu);
  windowElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const sourceSnapshot = stackSplitMenuState.source;
    const itemUid = stackSplitMenuState.itemUid;
    const quantity = Number(numberInputElement.value);
    splitItemStack(sourceSnapshot, itemUid, quantity);
  });
  return true;
};

stackSplitMenu?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (event.target === stackSplitMenu) {
    closeStackSplitMenu();
  }
});
stackSplitMenu?.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

const executeEatFoodUse = (item, source, useData, requestedAt) => {
  if (!item || !source || !Number.isFinite(useData?.sanity) || useData.sanity <= 0) {
    return { success: false, reason: "invalid-food" };
  }

  const nextSanity = playerState.sanity + useData.sanity;
  if (nextSanity > playerState.maxSanity) {
    return { success: false, reason: "sanity-full" };
  }

  if (!consumeOneItemFromSource(source, item)) {
    return { success: false, reason: "item-consume-failed" };
  }

  const wasRegenerationInactive = playerState.sanity <= 0 || playerState.regeneration.nextHealthRegenAt === 0;
  playerState.sanity = nextSanity;
  if (wasRegenerationInactive) {
    startPlayerRegenerationTimers(playerState, getPlayerClassRegenerationData(), requestedAt);
  }

  return {
    success: true,
    changes: { itemUid: item.uid, sanity: playerState.sanity },
    events: [{ type: "item-use-resolved", action: "eat", itemUid: item.uid, sfx: GAME_SFX.eat }],
  };
};

const canLightTorchFromSource = (source) => {
  return ["worldItem", "equipmentSlot", "containerSlot"].includes(source?.locationType);
};

const executeToggleTorchUse = (item, source, requestedAt) => {
  const itemData = getItemData(item?.itemId);
  if (!itemData?.lightSource || !Number.isFinite(item.fuelRemainingMs)) {
    return { success: false, reason: "invalid-torch" };
  }

  if (item.isLit) {
    syncTorchFuel(item, requestedAt);
    item.isLit = false;
    item.lastFuelUpdateAt = 0;
    activeLitTorchesByUid.delete(item.uid);
    return {
      success: true,
      changes: { itemUid: item.uid, isLit: false, fuelRemainingMs: item.fuelRemainingMs },
      events: [{ type: "item-use-resolved", action: "toggleTorch", itemUid: item.uid }],
    };
  }

  if (item.fuelRemainingMs <= 0) {
    return { success: false, reason: "torch-burned-out" };
  }
  if (!canLightTorchFromSource(source)) {
    return { success: false, reason: "torch-needs-placement" };
  }

  item.isLit = true;
  item.lastFuelUpdateAt = requestedAt;
  activeLitTorchesByUid.set(item.uid, item);
  return {
    success: true,
    changes: { itemUid: item.uid, isLit: true, fuelRemainingMs: item.fuelRemainingMs },
    events: [{ type: "item-use-resolved", action: "toggleTorch", itemUid: item.uid, sfx: GAME_SFX.torchOn }],
  };
};

const executeDirectItemUse = (item, source) => {
  if (!item) {
    return;
  }
  const useData = getItemUseData(item);
  if (!useData || !useData.action) {
    return;
  }
  if (useData.action === "splitCurrencyStack") {
    openStackSplitMenu(item, source);
    return;
  }
  const result = dispatchItemUseAction(source, item);
  handleGameActionResult(result, presentItemUseFailure);
};
//#endregion  -----  ITEMS - UTILISATION ET COOLDOWNS  -----

/* ==================================================== */
//#region     -----  UI - COMBAT MODE  -----
/* ==================================================== */

/* ---------- UI - COMBAT MODE ---------- */

const setPlayerCombatMode = (combatMode) => {
  const action = createSetCombatModeAction(combatMode, Date.now());
  if (!action || combatMode === playerState.combatMode) {
    return false;
  }
  const previousCombatMode = playerState.combatMode;
  playerState.combatMode = combatMode;
  refreshCombatModeButtons();
  handleGameActionResult(gameTransport.send(action), (result) => {
    if (result?.success) {
      return;
    }
    if (playerState.combatMode === combatMode) {
      playerState.combatMode = previousCombatMode;
      refreshCombatModeButtons();
    }
  });
  return true;
};

const MOBILE_COMBAT_MODE_ORDER = PLAYER_COMBAT_MODES;
const MOBILE_COMBAT_MODE_SHORT_LABELS = {
  fullAttack: "ATK",
  balanced: "BAL",
  fullDefense: "DEF",
};

const syncMobileStanceButton = () => {
  const combatMode = playerState.combatMode;
  if (!MOBILE_COMBAT_MODE_ORDER.includes(combatMode)) {
    return;
  }
  const stanceButton = mobileStanceLabel?.closest(".mobile-stance-button");
  if (mobileStanceIcon) {
    mobileStanceIcon.textContent = MOBILE_COMBAT_MODE_SHORT_LABELS[combatMode];
  }
  if (mobileStanceLabel) {
    mobileStanceLabel.textContent = getGameUiText(combatMode);
  }
  stanceButton?.setAttribute("data-combat-mode", combatMode);
  stanceButton?.setAttribute("aria-label", getGameUiText(combatMode));
};

const cycleMobileCombatMode = () => {
  const currentIndex = MOBILE_COMBAT_MODE_ORDER.indexOf(playerState.combatMode);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % MOBILE_COMBAT_MODE_ORDER.length;
  setPlayerCombatMode(MOBILE_COMBAT_MODE_ORDER[nextIndex]);
};

const refreshCombatModeButtons = () => {
  const combatMode = playerState.combatMode;
  const stanceButtonElement = document.querySelectorAll(".stance-button");
  if (!combatMode) {
    return;
  }
  stanceButtonElement.forEach((stanceButton) => {
    stanceButton.classList.remove("stance-button-active");
    const buttonStance = stanceButton.getAttribute("data-combat-mode");
    if (buttonStance === combatMode) {
      stanceButton.classList.add("stance-button-active");
    }
  });
  syncMobileStanceButton();
};

const bindCombatModeButtons = () => {
  const stanceButtonElement = document.querySelectorAll(".stance-button");
  if (!stanceButtonElement) {
    return;
  }
  stanceButtonElement.forEach((stanceButton) => {
    stanceButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const combatMode = stanceButton.getAttribute("data-combat-mode");
      setPlayerCombatMode(combatMode);
    });
  });
};
//#endregion  -----  UI - COMBAT MODE  -----

/* ==================================================== */
//#region     -----  UI - STATS, SCALE ET TEXTES FLOTTANTS  -----
/* ==================================================== */
/* ---------- UI - STATS JOUEUR ---------- */
const refreshPlayerVitalsUi = () => {
  updatePlayerStats();
  refreshPlayerHpBar();
};

const playerStatsUi = {
  root: null,
  rows: {
    name: null,
    level: null,
    hp: null,
    mana: null,
    sanity: null,
    experience: null,
    magic: null,
    fist: null,
    sword: null,
    mace: null,
    axe: null,
    distance: null,
    shielding: null,
  },
};

const updateSkillStatRow = (skillKey) => {
  if (!skillKey) {
    return;
  }
  const row = playerStatsUi.rows[skillKey];
  const skill = playerState.skills[skillKey];
  const skillProgressData = getSkillProgressData(skillKey);
  if (!row || !skill || !Number.isInteger(skill.experience) || !skillProgressData) {
    return;
  }

  row.valueElement.textContent = skillProgressData.level;
  setProgressBarValue(row.progressBarRefs, skillProgressData.progressRatio);
  setProgressTooltipText(
    row.tooltipElement,
    getGameUiText("xpRemaining")(skillProgressData.experienceNeededForNextLevel),
  );
};

const createProgressBarRefs = () => {
  const progressBarElement = document.createElement("div");
  progressBarElement.classList.add("stat-progress-bar");
  const progressFillElement = document.createElement("div");
  progressFillElement.classList.add("stat-progress-fill");
  progressBarElement.appendChild(progressFillElement);
  return { root: progressBarElement, fill: progressFillElement };
};

const setProgressBarValue = (progressBarRefs, progressRatio) => {
  if (!progressBarRefs || !Number.isFinite(progressRatio) || !("fill" in progressBarRefs)) {
    return;
  }
  const safeRatio = clamp(progressRatio, 0, 1);
  const ratioPercent = safeRatio * 100;
  progressBarRefs.fill.style.width = `${ratioPercent}%`;
};

const createProgressTooltipElement = () => {
  const toolTipElement = document.createElement("div");
  toolTipElement.classList.add("tooltip");
  return toolTipElement;
};

const createValueElement = (statKey) => {
  if (!statKey) {
    return null;
  }
  const valueElement = document.createElement("div");
  valueElement.classList.add("stat-value");
  return valueElement;
};

const createLabelElement = (label) => {
  if (!label) {
    return null;
  }
  const labelElement = document.createElement("div");
  labelElement.classList.add("stat-label");
  labelElement.textContent = label;
  return labelElement;
};

const createStatWrapperElement = (statKey) => {
  if (!statKey) {
    return null;
  }
  const statWrapper = document.createElement("div");
  statWrapper.setAttribute("data-stat-key", statKey);
  statWrapper.classList.add("stat-wrapper");
  return statWrapper;
};

const setProgressTooltipText = (tooltipElement, tooltipText) => {
  if (!tooltipElement) {
    return;
  }
  const tooltipTextString = String(tooltipText);
  tooltipElement.textContent = tooltipTextString;
};

const createProgressStatRowElement = (statKey, label) => {
  if (!statKey || !label) {
    return null;
  }
  const statWrapper = createStatWrapperElement(statKey);
  const labelElement = createLabelElement(label);
  const valueElement = createValueElement(statKey);
  const progressBarRefs = createProgressBarRefs();
  const tooltipElement = createProgressTooltipElement();

  if (!statWrapper || !labelElement || !valueElement || !progressBarRefs || !tooltipElement) {
    return null;
  }

  statWrapper.append(labelElement, valueElement, progressBarRefs.root, tooltipElement);
  playerStatsUi.rows[statKey] = {
    statWrapper,
    labelElement,
    valueElement,
    progressBarRefs,
    tooltipElement,
  };
  return statWrapper;
};

const createSimpleStatRowElement = (statKey, label) => {
  if (!statKey || !label) {
    return null;
  }
  const statWrapper = createStatWrapperElement(statKey);
  const labelElement = createLabelElement(label);
  const valueElement = createValueElement(statKey);

  if (!statWrapper || !labelElement || !valueElement) {
    return null;
  }

  statWrapper.append(labelElement, valueElement);
  playerStatsUi.rows[statKey] = {
    statWrapper,
    labelElement,
    valueElement,
  };
  return statWrapper;
};

const createPlayerStatsUi = () => {
  const statsWrapperElement = document.createElement("div");
  statsWrapperElement.classList.add("boite-boite");
  const headerElement = document.createElement("div");
  headerElement.classList.add("mobile-panel-window-header");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.textContent = getGameUiText("stats");
  const closeButtonElement = document.createElement("button");
  closeButtonElement.classList.add("mobile-window-close-button");
  closeButtonElement.type = "button";
  closeButtonElement.dataset.mobilePanelClose = "stats";
  closeButtonElement.textContent = "\u00d7";
  closeButtonElement.title = getGameUiText("closePanel");
  closeButtonElement.setAttribute("aria-label", getGameUiText("closePanel"));
  headerElement.append(titleElement, closeButtonElement);
  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const nameElement = createSimpleStatRowElement("name", getGameUiText("nameLabel"));
  const hpElement = createProgressStatRowElement("hp", getGameUiText("healthLabel"));
  const manaElement = createProgressStatRowElement("mana", getGameUiText("manaLabel"));
  const sanityElement = createProgressStatRowElement("sanity", getGameUiText("sanityLabel"));
  const experienceElement = createProgressStatRowElement("experience", getGameUiText("experienceLabel"));
  const levelElement = createProgressStatRowElement("level", getGameUiText("levelLabel"));
  const magicElement = createProgressStatRowElement("magic", getGameUiText("magicLabel"));
  const fistElement = createProgressStatRowElement("fist", getGameUiText("fistLabel"));
  const swordElement = createProgressStatRowElement("sword", getGameUiText("swordLabel"));
  const maceElement = createProgressStatRowElement("mace", getGameUiText("maceLabel"));
  const axeElement = createProgressStatRowElement("axe", getGameUiText("axeLabel"));
  const distanceElement = createProgressStatRowElement("distance", getGameUiText("distanceLabel"));
  const shieldingElement = createProgressStatRowElement("shielding", getGameUiText("shieldingLabel"));
  if (
    !nameElement ||
    !hpElement ||
    !manaElement ||
    !sanityElement ||
    !experienceElement ||
    !levelElement ||
    !magicElement ||
    !fistElement ||
    !swordElement ||
    !maceElement ||
    !axeElement ||
    !distanceElement ||
    !shieldingElement
  ) {
    return;
  }
  statsWrapperElement.append(
    headerElement,
    separatorElement,
    nameElement,
    hpElement,
    manaElement,
    sanityElement,
    experienceElement,
    levelElement,
    magicElement,
    fistElement,
    swordElement,
    maceElement,
    axeElement,
    distanceElement,
    shieldingElement,
  );
  playerStats.innerHTML = "";
  playerStats.appendChild(statsWrapperElement);
  playerStatsUi.root = statsWrapperElement;
};

const updatePlayerStatsUi = () => {
  const progressData = getPlayerExperienceProgressData();
  if (!progressData) {
    return;
  }
  const rows = playerStatsUi.rows;
  if (!rows.name || !rows.hp || !rows.mana || !rows.sanity || !rows.experience || !rows.level) {
    return;
  }

  rows.name.valueElement.textContent = playerState.name;
  rows.hp.valueElement.textContent = `${playerState.hp}/${playerState.maxHp}`;
  rows.mana.valueElement.textContent = `${playerState.mana}/${playerState.maxMana}`;
  rows.sanity.valueElement.textContent = `${playerState.sanity}/${playerState.maxSanity}`;
  setProgressBarValue(rows.hp.progressBarRefs, playerState.hp / playerState.maxHp);
  setProgressBarValue(rows.mana.progressBarRefs, playerState.maxMana > 0 ? playerState.mana / playerState.maxMana : 0);
  setProgressBarValue(
    rows.sanity.progressBarRefs,
    playerState.maxSanity > 0 ? playerState.sanity / playerState.maxSanity : 0,
  );
  setProgressTooltipText(
    rows.hp.tooltipElement,
    `${playerState.hp}/${playerState.maxHp} ${getGameUiText("healthLabel").replace(":", "").toLowerCase()}`,
  );
  setProgressTooltipText(rows.mana.tooltipElement, `${playerState.mana}/${playerState.maxMana} mana`);
  setProgressTooltipText(
    rows.sanity.tooltipElement,
    `${playerState.sanity}/${playerState.maxSanity} ${getGameUiText("sanityLabel").replace(":", "").toLowerCase()}`,
  );
  rows.experience.valueElement.textContent = playerState.experience;
  setProgressBarValue(rows.experience.progressBarRefs, progressData.progressRatio);
  setProgressTooltipText(
    rows.experience.tooltipElement,
    getGameUiText("xpRemaining")(progressData.experienceNeededForNextLevel),
  );
  rows.level.valueElement.textContent = progressData.level;
  const level = rows.level;
  setProgressBarValue(level.progressBarRefs, progressData.progressRatio);
  setProgressTooltipText(level.tooltipElement, getGameUiText("xpRemaining")(progressData.experienceNeededForNextLevel));
  for (const skillKey of Object.keys(playerState.skills)) {
    updateSkillStatRow(skillKey);
  }
  syncMobilePlayerHud();
};

const updatePlayerStats = () => {
  if (!playerStatsUi.root) {
    createPlayerStatsUi();
  }
  updatePlayerStatsUi();
};

const updatePlayerSkillLevel = (skillKey) => {
  if (!skillKey || !(skillKey in playerState.skills)) {
    return;
  }
  const currentSkillLevel = playerState.skills[skillKey].level;
  const skillLevelByExperience = getSkillLevelFromExperience(playerState.skills[skillKey].experience, currentSkillLevel);
  if (playerState.skills[skillKey].level < skillLevelByExperience) {
    addSkillLevelUpFeedback(skillKey, skillLevelByExperience);
  }
  playerState.skills[skillKey].level = skillLevelByExperience;
  updateSkillStatRow(skillKey);
};

const updateAllPlayerSkillLevels = () => {
  for (const [skillKey, skill] of Object.entries(playerState.skills)) {
    skill.level = getSkillLevelFromExperience(skill.experience, skill.level);
    updateSkillStatRow(skillKey);
  }
};

const applyExperienceToPlayerSkill = (skillKey, experienceAmount) => {
  if (!skillKey || experienceAmount <= 0 || !(skillKey in playerState.skills)) {
    return;
  }
  playerState.skills[skillKey].experience += experienceAmount;
  updatePlayerSkillLevel(skillKey);
};

const updatePlayerExperience = () => {
  const progressData = getPlayerExperienceProgressData();
  if (!progressData) {
    return;
  }
  const didLevelUp = playerState.level < progressData.level;
  const previousMaxHp = playerState.maxHp;
  const previousMaxMana = playerState.maxMana;
  if (didLevelUp) {
    addLevelUpFeedback(progressData.level);
  }
  playerState.level = progressData.level;
  syncPlayerDerivedStats();
  if (didLevelUp) {
    applyPlayerCurrentVitalLevelUpGains(previousMaxHp, previousMaxMana);
  }
  refreshPlayerVitalsUi();
};

const addLevelUpFeedback = (newLevel) => {
  if (!Number.isFinite(newLevel)) {
    return false;
  }
  const logMessage = getGameUiText("levelAdvanced")(newLevel);
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
  playGameSfx(GAME_SFX.levelUp);
};

const addLevelUpFeedbackFromExperienceReward = (experienceReward) => {
  if (!Number.isFinite(experienceReward) || experienceReward <= 0) {
    return;
  }

  const currentExperience = Number.isFinite(playerState.experience) ? playerState.experience : 0;
  const previousExperience = Math.max(0, currentExperience - experienceReward);
  const previousLevel = getLevelFromExperience(previousExperience);
  const currentLevel = getLevelFromExperience(currentExperience);

  if (currentLevel <= previousLevel) {
    return;
  }

  for (let level = previousLevel + 1; level <= currentLevel; level++) {
    addLevelUpFeedback(level);
  }
};

const addSkillLevelUpFeedback = (skillKey, newLevel) => {
  const logMessage = getGameUiText("skillAdvanced")(getLocalizedSkillName(skillKey), newLevel);
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
};

const presentSkillProgression = (skillProgression) => {
  if (
    !skillProgression ||
    !(skillProgression.skillKey in playerState.skills) ||
    !Number.isInteger(skillProgression.previousLevel) ||
    !Number.isInteger(skillProgression.nextLevel) ||
    skillProgression.nextLevel <= skillProgression.previousLevel
  ) {
    return false;
  }

  for (let level = skillProgression.previousLevel + 1; level <= skillProgression.nextLevel; level++) {
    addSkillLevelUpFeedback(skillProgression.skillKey, level);
  }
  return true;
};

/* ---------- UI - SCALE DU JEU ---------- */

const MOBILE_GAME_LAYOUT_QUERY = "(max-width: 900px), (max-width: 1024px) and (pointer: coarse)";
const MOBILE_JOYSTICK_DIAGONAL_HOLD_MS = 500;
const MOBILE_ACTIONS_KEEP_MENU_OPEN = new Set(["cycle-stance", "toggle-torch", "toggle-pvp"]);
const mobileGameLayoutMedia = window.matchMedia(MOBILE_GAME_LAYOUT_QUERY);

const mobileGameUiState = {
  openPanel: null,
  isActionMenuOpen: false,
  joystickPointerId: null,
  joystickWasMoving: false,
  joystickDiagonalCandidate: null,
  joystickDiagonalReady: false,
  joystickDiagonalTimeoutId: null,
  joystickClientX: null,
  joystickClientY: null,
  joystickCenterX: null,
  joystickCenterY: null,
  joystickMaxDistance: null,
  joystickDeadZone: null,
};

const isMobileGameLayout = () => {
  return mobileGameLayoutMedia.matches;
};

const updateGameScale = () => {
  boitePrincipale.style.height = `calc(100vh - ${nav.clientHeight}px)`;
  const mobileLayout = isMobileGameLayout();
  if (mobileLayout) {
    const mobileViewportHeight = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--mobile-viewport-height", `${mobileViewportHeight}px`);
  }
  const freeWidthSpace = mobileLayout
    ? boiteJeux.clientWidth
    : boiteJeux.clientWidth - panneauGauche.clientWidth - panneauDroite.clientWidth;
  const freeHeightSpace = mobileLayout ? boiteJeux.clientHeight : boitePrincipale.clientHeight - minChatHeight;
  const logicWidthSpace = GAME_WIDTH;
  const logicHeightSpace = GAME_HEIGHT;
  const scaleWidth = freeWidthSpace / logicWidthSpace;
  const scaleHeight = freeHeightSpace / logicHeightSpace;
  const scale = mobileLayout ? Math.max(scaleWidth, scaleHeight) : Math.min(scaleWidth, scaleHeight);
  GAME_SCALE = scale;
  document.documentElement.style.setProperty("--game-scale", scale);
  const visualGameHeight = GAME_HEIGHT * scale;
  const gameTop = (boiteJeux.clientHeight - visualGameHeight) / 2;
  boiteJeuxInner.style.top = `${gameTop}px`;
};

const getMobilePanelElement = (panelName) => {
  const panelElementsByName = {
    map: playerMinimap,
    stats: playerStats,
    inventory: playerInventory,
    chat: boiteChat,
  };
  return panelElementsByName[panelName] ?? null;
};

const setMobileActionMenuOpen = (isOpen) => {
  const nextIsOpen = isMobileGameLayout() && isOpen === true;
  mobileGameUiState.isActionMenuOpen = nextIsOpen;
  mobileActionMenu?.toggleAttribute("hidden", !nextIsOpen);
  mobileActionMenuToggle?.classList.toggle("mobile-panel-button-active", nextIsOpen);
  mobileActionMenuToggle?.setAttribute("aria-expanded", String(nextIsOpen));
};

const syncMobilePanelChrome = () => {
  const hasOpenPanel = mobileGameUiState.openPanel !== null;
  const hasOpenQuestWindow = questUiState.isOpen === true;
  const hasOpenMobileSurface = isMobileGameLayout() && (hasOpenPanel || hasOpenQuestWindow);
  mobileGameControls?.classList.toggle("mobile-game-controls-panel-open", hasOpenMobileSurface);
  mobileGameControls?.classList.toggle(
    "mobile-game-controls-chat-open",
    hasOpenPanel && mobileGameUiState.openPanel === "chat",
  );
};

const setOpenMobilePanel = (panelName = null) => {
  setMobileActionMenuOpen(false);
  const nextPanelName = mobileGameUiState.openPanel === panelName ? null : panelName;
  mobileGameUiState.openPanel = nextPanelName;
  syncMobilePanelChrome();

  for (const name of ["map", "stats", "inventory", "chat"]) {
    getMobilePanelElement(name)?.classList.toggle("mobile-panel-open", name === nextPanelName);
  }
  for (const button of mobilePanelButtons) {
    const isActive = button.dataset.mobilePanel === nextPanelName;
    button.classList.toggle("mobile-panel-button-active", isActive);
    button.setAttribute("aria-expanded", String(isActive));
  }

  if (nextPanelName !== "chat" && document.activeElement === chatInput) {
    blurChatInput();
  }
};

const setMobileHudProgress = (fillElement, valueElement, value, maximumValue) => {
  if (!fillElement || !valueElement || !Number.isFinite(value) || !Number.isFinite(maximumValue)) {
    return;
  }
  const safeMaximumValue = Math.max(maximumValue, 0);
  const progressRatio = safeMaximumValue > 0 ? clamp(value / safeMaximumValue, 0, 1) : 0;
  fillElement.style.width = `${progressRatio * 100}%`;
  valueElement.textContent = `${Math.max(Math.floor(value), 0)}/${Math.floor(safeMaximumValue)}`;
};

const syncMobilePlayerHud = () => {
  if (!mobilePlayerName || !mobilePlayerLevel) {
    return;
  }
  mobilePlayerName.textContent = playerState.name;
  const mobileLevelText = getGameUiText("mobileLevel");
  mobilePlayerLevel.textContent = typeof mobileLevelText === "function"
    ? mobileLevelText(playerState.level)
    : String(playerState.level);
  setMobileHudProgress(mobilePlayerHealthFill, mobilePlayerHealthValue, playerState.hp, playerState.maxHp);
  setMobileHudProgress(mobilePlayerManaFill, mobilePlayerManaValue, playerState.mana, playerState.maxMana);
  setMobileHudProgress(mobilePlayerSanityFill, mobilePlayerSanityValue, playerState.sanity, playerState.maxSanity);
};

const syncMobileTargetHud = () => {
  if (!mobileTargetName || !mobileTargetValue || !mobileTargetHealthFill) {
    return;
  }
  const remotePlayer =
    combatTargetState.playerUid === null ? null : (playersByUid.get(combatTargetState.playerUid) ?? null);
  if (remotePlayer && remotePlayer.z === playerState.z) {
    const hpRatio = clamp(remotePlayer.hp / remotePlayer.maxHp, 0, 1);
    mobileTargetName.textContent = remotePlayer.name;
    mobileTargetValue.textContent = `${Math.max(remotePlayer.hp, 0)}/${remotePlayer.maxHp}`;
    mobileTargetHealthFill.style.width = `${hpRatio * 100}%`;
    mobileTargetHealthFill.style.setProperty(
      "--mobile-target-hp-color",
      getHpColor(remotePlayer.hp, remotePlayer.maxHp),
    );
    mobileTargetHud.toggleAttribute("hidden", false);
    return;
  }
  const monster =
    combatTargetState.monsterUid === null ? null : (monstersByUid.get(combatTargetState.monsterUid) ?? null);
  if (!monster || monster.z !== playerState.z) {
    mobileTargetHud?.toggleAttribute("hidden", true);
    return;
  }

  const monsterData = getMonsterData(monster.monsterId);
  const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
  if (!monsterData || !localizedMonsterData || !mobileTargetName || !mobileTargetValue || !mobileTargetHealthFill) {
    mobileTargetHud?.toggleAttribute("hidden", true);
    return;
  }

  const hpRatio = clamp(monster.hp / monsterData.maxHp, 0, 1);
  mobileTargetName.textContent = localizedMonsterData.name;
  mobileTargetValue.textContent = `${Math.max(monster.hp, 0)}/${monsterData.maxHp}`;
  mobileTargetHealthFill.style.width = `${hpRatio * 100}%`;
  mobileTargetHealthFill.style.setProperty("--mobile-target-hp-color", getHpColor(monster.hp, monsterData.maxHp));
  mobileTargetHud.toggleAttribute("hidden", false);
};

const syncMobileBackpackButton = () => {
  const backpackButton = document.querySelector('[data-mobile-action="toggle-backpack"]');
  const backpack = getEquipmentSlotItem("backpack");
  const isOpen = backpack ? findOpenedContainerWrapperByUid(backpack.uid) !== null : false;
  backpackButton?.classList.toggle("mobile-panel-button-active", isOpen);
  backpackButton?.setAttribute("aria-expanded", String(isOpen));
  backpackButton?.toggleAttribute("disabled", !backpack);
};

const syncMobileFollowButton = () => {
  const followButton = document.querySelector('[data-mobile-action="toggle-follow"]');
  const isActive = playerNavigationState.followEnabled;
  followButton?.classList.toggle("mobile-panel-button-active", isActive);
  followButton?.setAttribute("aria-pressed", String(isActive));
};

const syncMobileWindowButtons = () => {
  const windowStatesByAction = {
    "toggle-spells": spellUiState.isOpen,
    "toggle-quests": questUiState.isOpen,
    "toggle-options": gameOptionsUiState.isOpen,
  };
  for (const [action, isOpen] of Object.entries(windowStatesByAction)) {
    const button = document.querySelector(`[data-mobile-action="${action}"]`);
    button?.classList.toggle("mobile-panel-button-active", isOpen);
    button?.setAttribute("aria-expanded", String(isOpen));
  }
  syncMobilePanelChrome();
};

const syncMobileTorchButton = () => {
  const torchButton = document.querySelector('[data-mobile-action="toggle-torch"]');
  const torch = getEquipmentSlotItem("ammo");
  const isTorch = Boolean(getItemData(torch?.itemId)?.lightSource);
  torchButton?.toggleAttribute("disabled", !isTorch);
  torchButton?.classList.toggle("mobile-panel-button-active", isTorch && torch.isLit === true);
  torchButton?.setAttribute("aria-pressed", String(isTorch && torch.isLit === true));
};

const toggleMobileTorch = () => {
  const torch = getEquipmentSlotItem("ammo");
  if (!getItemData(torch?.itemId)?.lightSource) {
    syncMobileTorchButton();
    return;
  }
  executeDirectItemUse(torch, {
    locationType: "equipmentSlot",
    equipmentSlotName: "ammo",
  });
};

const toggleMobileBackpack = () => {
  const backpack = getEquipmentSlotItem("backpack");
  if (!backpack || !isOpenableContainerItem(backpack)) {
    showGameStatusMessage(getGameUiText("backpackRequired"));
    syncMobileBackpackButton();
    return;
  }

  const openedBackpack = findOpenedContainerWrapperByUid(backpack.uid);
  if (openedBackpack) {
    closeContainer(backpack);
    return;
  }

  openContainer(backpack, getLocalizedItemName(backpack.itemId), "equipment", null);
};

const syncMobileGameLayout = () => {
  const mobileLayout = isMobileGameLayout();
  const mobileGameUiIsActive = mobileLayout && document.body.classList.contains("game-session-active");
  mobileGameControls?.setAttribute("aria-hidden", String(!mobileGameUiIsActive));
  if (!mobileLayout) {
    setOpenMobilePanel(null);
    setMobileActionMenuOpen(false);
    spellUiState.mobileAssignHotkeyIndex = null;
  }
  syncMobilePlayerHud();
  syncMobileTargetHud();
  syncMobileTorchButton();
  refreshPvpButtonState();
  syncMobileBackpackButton();
  syncMobileFollowButton();
  syncMobileWindowButtons();
  syncMobileStanceButton();
  syncItemUseSourceFeedback();
  if (gameOptionsController) {
    renderOptionsWindow();
  }
  renderSpellWindow();
  updateGameScale();
};

const setGameSessionUiActive = (isActive) => {
  document.body.classList.toggle("game-session-active", isActive === true);
  syncMobileGameLayout();
};

/* ---------- UI - MESSAGE DE STATUT ---------- */
const showGameStatusMessage = (text, durationMs = 2500) => {
  if (!gameStatusMessage || typeof text !== "string" || text === "") {
    return false;
  }

  if (uiTimingState.gameStatusMessageTimeoutId !== null) {
    clearTimeout(uiTimingState.gameStatusMessageTimeoutId);
  }

  gameStatusMessage.textContent = text;
  gameStatusMessage.classList.add("game-status-message-visible");
  uiTimingState.gameStatusMessageTimeoutId = setTimeout(() => {
    gameStatusMessage.textContent = "";
    gameStatusMessage.classList.remove("game-status-message-visible");
    uiTimingState.gameStatusMessageTimeoutId = null;
  }, durationMs);
  return true;
};

/* ---------- UI - TEXTE FLOTTANT ---------- */
const floatingTextState = {
  queuesByTargetKey: new Map(),
  combatEntries: new Set(),
};

const getFloatingTextTargetKey = (target) => {
  if (!target) {
    return null;
  }
  if (typeof target.speechAnchorKey === "string") {
    return `speech:${target.speechAnchorKey}`;
  }
  if (target === playerState) {
    return "player:self";
  }
  if ("uid" in target) {
    return "entity:" + target.uid;
  }
  if ("x" in target && "y" in target) {
    return "position:" + target.x + ":" + target.y;
  }
  return null;
};

const createSpeechFloatingTextTarget = (target) => {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return null;
  }

  const worldX = Number.isFinite(target.renderX) ? target.renderX : target.x;
  const worldY = Number.isFinite(target.renderY) ? target.renderY : target.y;
  const speakerUid = target === playerState ? playerState.uid : (target.uid ?? target.name);
  const speakerName = target === playerState ? playerState.name : target.name;
  return {
    x: worldX,
    y: worldY,
    z: target.z,
    fixedSurfaceOffsetY: getEntitySurfaceOffsetY(target),
    speechSpeakerName: speakerName,
    speechAnchorKey: `${speakerUid}:${worldX}:${worldY}:${target.z}`,
  };
};

const getFloatingTextQueueForTarget = (target) => {
  const targetKey = getFloatingTextTargetKey(target);
  if (!targetKey) {
    return null;
  }
  if (floatingTextState.queuesByTargetKey.has(targetKey)) {
    return floatingTextState.queuesByTargetKey.get(targetKey);
  } else {
    const queue = {
      target: target,
      queuesByType: new Map(),
      wrappersByType: new Map(),
    };
    floatingTextState.queuesByTargetKey.set(targetKey, queue);
    return queue;
  }
};

const getFloatingTextQueueForType = (targetQueue, textType) => {
  if (!targetQueue || !textType) {
    return null;
  }
  if (targetQueue.queuesByType.has(textType)) {
    return targetQueue.queuesByType.get(textType);
  } else {
    const textQueue = [];
    targetQueue.queuesByType.set(textType, textQueue);
    return textQueue;
  }
};

const getFloatingTextWrapperForType = (targetQueue, textType) => {
  if (!targetQueue || !textType) {
    return null;
  }
  if (targetQueue.wrappersByType.has(textType)) {
    return targetQueue.wrappersByType.get(textType);
  } else {
    const wrapper = document.createElement("div");
    wrapper.classList.add("floating-text-wrapper");
    wrapper.style.display = "none";
    game.appendChild(wrapper);
    targetQueue.wrappersByType.set(textType, wrapper);
    return wrapper;
  }
};

const createFloatingTextEntry = (text, offsetY, textType, durationMs) => {
  if (!text || !textType || isEmpty(text)) {
    return null;
  }
  let verifiedDurationMs = durationMs;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    verifiedDurationMs = 2000;
  }
  let verifiedOffsetY = offsetY;
  if (!Number.isFinite(offsetY)) {
    verifiedOffsetY = 95;
  }
  const createdAt = Date.now();
  const expiresAt = createdAt + verifiedDurationMs;
  return {
    text,
    offsetY: verifiedOffsetY,
    textType,
    durationMs: verifiedDurationMs,
    createdAt,
    expiresAt,
  };
};

const getFloatingTextScreenPosition = (target, offsetY) => {
  let left = 0;
  let top = 0;
  if (target) {
    const surfaceOffsetY = Number.isFinite(target.fixedSurfaceOffsetY)
      ? target.fixedSurfaceOffsetY
      : getEntitySurfaceOffsetY(target);
    if ("renderX" in target && "renderY" in target) {
      left = target.renderX - camera.x + TILE_SIZE / 2;
      top = target.renderY - camera.y - offsetY - surfaceOffsetY;
    } else {
      left = target.x - camera.x + TILE_SIZE / 2;
      top = target.y - camera.y - offsetY - surfaceOffsetY;
    }
  }
  return {
    left,
    top,
  };
};

const createFloatingTextElement = (entry) => {
  const div = document.createElement("div");
  div.classList.add("floating-text");
  div.classList.add(`floating-text-${entry.textType}`);
  div.style.setProperty("--floating-text-duration", entry.durationMs + "ms");
  div.textContent = `${entry.text}`;
  return div;
};

const getFloatingTextQueueHeaderText = (targetQueue, textType) => {
  if (!textType || !targetQueue || textType !== "speech") {
    return "";
  }
  if (targetQueue.target === playerState) {
    return `${playerState.name}:`;
  }
  if (targetQueue.target?.speechSpeakerName) {
    return `${targetQueue.target.speechSpeakerName}:`;
  }
  if (targetQueue.target?.npcId && targetQueue.target.name) {
    return `${targetQueue.target.name}:`;
  }
  return "";
};

const renderFloatingTextQueue = (targetQueue, textType) => {
  const textQueue = getFloatingTextQueueForType(targetQueue, textType);
  const wrapper = getFloatingTextWrapperForType(targetQueue, textType);
  if (!wrapper) {
    return;
  }
  if (isEmpty(textQueue)) {
    wrapper.textContent = "";
    wrapper.style.display = "none";
    return;
  }

  const topLeftPosition = getFloatingTextScreenPosition(targetQueue.target, textQueue[0].offsetY);

  wrapper.style.left = `${topLeftPosition.left}px`;
  wrapper.style.top = `${topLeftPosition.top}px`;
  wrapper.textContent = "";
  const headerText = getFloatingTextQueueHeaderText(targetQueue, textType);
  if (!isEmpty(headerText)) {
    const headerElement = document.createElement("div");
    headerElement.classList.add("floating-text-header");
    headerElement.textContent = headerText;
    wrapper.appendChild(headerElement);
  }

  for (const entry of textQueue) {
    const textElement = createFloatingTextElement(entry);
    if (textElement) {
      wrapper.appendChild(textElement);
    }
  }
  wrapper.style.display = "block";
};

const removeExpiredFloatingTextEntries = (targetQueue, textType, now) => {
  const textQueue = getFloatingTextQueueForType(targetQueue, textType);
  if (!textQueue) {
    return;
  }
  for (let i = textQueue.length - 1; i >= 0; i--) {
    const entry = textQueue[i];
    if (entry.expiresAt <= now) {
      textQueue.splice(i, 1);
    }
  }
  renderFloatingTextQueue(targetQueue, textType);
};

const updateCombatFloatingTextEntryPosition = (combatEntry) => {
  const element = combatEntry?.element;
  if (!element) {
    return;
  }

  if (Number.isInteger(combatEntry.z) && combatEntry.z !== playerState.z) {
    element.style.display = "none";
    return;
  }

  if (!Number.isFinite(combatEntry.worldX) || !Number.isFinite(combatEntry.worldY)) {
    element.style.display = "none";
    return;
  }

  element.style.left = `${combatEntry.worldX - camera.x}px`;
  element.style.top = `${combatEntry.worldY - camera.y}px`;
  element.style.display = "block";
};

const updateCombatFloatingTextPositions = () => {
  for (const combatEntry of floatingTextState.combatEntries) {
    updateCombatFloatingTextEntryPosition(combatEntry);
  }
};

const updateFloatingTextPositions = () => {
  for (const targetQueue of floatingTextState.queuesByTargetKey.values()) {
    for (const [textType, wrapper] of targetQueue.wrappersByType.entries()) {
      const textQueue = getFloatingTextQueueForType(targetQueue, textType);
      if (!wrapper || !Array.isArray(textQueue) || textQueue.length === 0) {
        continue;
      }
      if (Number.isInteger(targetQueue.target?.z) && targetQueue.target.z !== playerState.z) {
        wrapper.style.display = "none";
        continue;
      }
      const position = getFloatingTextScreenPosition(targetQueue.target, textQueue[0].offsetY);
      wrapper.style.left = `${position.left}px`;
      wrapper.style.top = `${position.top}px`;
      wrapper.style.display = "block";
    }
  }
  updateCombatFloatingTextPositions();
};

const showFloatingTextAboveTarget = (text, offsetY, target, textType = "look", durationMs = 2000) => {
  const floatingTextTarget = textType === "speech" ? createSpeechFloatingTextTarget(target) : target;
  const targetQueue = getFloatingTextQueueForTarget(floatingTextTarget);
  if (!targetQueue) {
    return;
  }
  const textQueue = getFloatingTextQueueForType(targetQueue, textType);
  if (!textQueue) {
    return;
  }
  const entry = createFloatingTextEntry(text, offsetY, textType, durationMs);
  if (!entry) {
    return;
  }
  if (textType === "look") {
    textQueue.length = 0;
    textQueue.push(entry);
  } else {
    textQueue.push(entry);
  }
  renderFloatingTextQueue(targetQueue, textType);
  setTimeout(() => {
    const now = Date.now();
    removeExpiredFloatingTextEntries(targetQueue, textType, now);
  }, entry.durationMs);
};

const showLookFloatingText = (lookInfo) => {
  if (!lookInfo) {
    return;
  }
  if ("customText" in lookInfo) {
    showFloatingTextAboveTarget(lookInfo.customText, 110, lookInfo.target, "look");
    return;
  }

  let text = "";
  let offsetY = 120;
  const isCarriedItem = lookInfo.sourceType === "equipmentSlot" || lookInfo.sourceType === "containerSlot";
  const isNearbyWorldItem =
    lookInfo.sourceType === "worldItem" && lookInfo.target.z === playerState.z && isNearPlayer(lookInfo.target, 1);

  if (lookInfo.weight !== undefined && (isCarriedItem || isNearbyWorldItem)) {
    offsetY = 105;
    let suffixName = lookInfo.suffix;
    let name = lookInfo.name;
    let weightText = getGameUiText("itemWeight")(lookInfo.weight);

    if (lookInfo.quantity && lookInfo.quantity > 1) {
      suffixName = lookInfo.quantity;
      name = lookInfo.pluralName ?? `${name}s`;
      weightText = getGameUiText("itemsWeight")(lookInfo.weight);
    }
    const detailLines = [];
    if (lookInfo.desc) {
      detailLines.push(lookInfo.desc);
    }
    const combatStats = [];
    if (Number.isFinite(lookInfo.attack)) {
      combatStats.push(`${getGameUiText("attack")}: ${lookInfo.attack}`);
    }
    if (Number.isFinite(lookInfo.defense)) {
      combatStats.push(`${getGameUiText("defense")}: ${lookInfo.defense}`);
    }
    if (combatStats.length > 0) {
      detailLines.push(combatStats.join(" | "));
    }
    if (lookInfo.charges) {
      detailLines.push(getGameUiText("itemCharges")(lookInfo.charges));
    }
    detailLines.push(weightText);
    text = `${getGameUiText("youSee")(suffixName, name)}\n${detailLines.join("\n")}`;
  } else {
    offsetY = 120;
    text = getGameUiText("youSee")(lookInfo.suffix, lookInfo.name);
  }
  showFloatingTextAboveTarget(text, offsetY, playerState);
};

const createFloatingCombatTextAtWorldPosition = ({ worldX, worldY, z, text, type, durationMs = 1300 }) => {
  if (!game || !Number.isFinite(worldX) || !Number.isFinite(worldY) || !Number.isInteger(z)) {
    return false;
  }

  const textElement = document.createElement("div");
  textElement.classList.add("floating-combat-text");
  textElement.classList.add(`floating-combat-text-${type}`);
  textElement.textContent = `${text}`;
  game.appendChild(textElement);

  const combatEntry = {
    element: textElement,
    worldX,
    worldY,
    z,
  };

  floatingTextState.combatEntries.add(combatEntry);
  updateCombatFloatingTextEntryPosition(combatEntry);

  setTimeout(() => {
    floatingTextState.combatEntries.delete(combatEntry);
    textElement.remove();
  }, durationMs);

  return true;
};

const getMonsterCombatTextWorldPosition = (monster) => {
  if (!monster || !Number.isInteger(monster.z)) {
    return null;
  }

  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return null;
  }

  if (!Number.isFinite(monster.x) || !Number.isFinite(monster.y)) {
    return null;
  }

  const surfaceOffsetY = getEntitySurfaceOffsetY(monster);

  return {
    worldX: monster.x + (monsterData.drawOffsetX ?? 0) + (monsterData.drawWidth ?? TILE_SIZE) / 2,
    worldY: monster.y + (monsterData.drawOffsetY ?? 0) - surfaceOffsetY,
    z: monster.z,
  };
};

const showFloatingTextAboveMonster = (monster, text, type) => {
  const position = getMonsterCombatTextWorldPosition(monster);
  if (!position) {
    return false;
  }

  return createFloatingCombatTextAtWorldPosition({
    worldX: position.worldX,
    worldY: position.worldY,
    z: position.z,
    text,
    type,
  });
};

const getPlayerCombatTextWorldPosition = (target = playerState) => {
  if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y) || !Number.isInteger(target?.z)) {
    return null;
  }

  const surfaceOffsetY = getEntitySurfaceOffsetY(target);

  return {
    worldX: target.x + TILE_SIZE / 2,
    worldY: target.y - surfaceOffsetY,
    z: target.z,
  };
};

const showFloatingTextAbovePlayer = (text, type, target = playerState) => {
  const position = getPlayerCombatTextWorldPosition(target);
  if (!position) {
    return false;
  }

  return createFloatingCombatTextAtWorldPosition({
    worldX: position.worldX,
    worldY: position.worldY,
    z: position.z,
    text,
    type,
  });
};

//#endregion  -----  UI - STATS, SCALE ET TEXTES FLOTTANTS  -----

/* ==================================================== */
//#region     -----  LIGHT - PIXI  -----
/* ==================================================== */
const PIXI_LIGHT_SOURCE_STRIDE = 3;
const PIXI_LIGHT_INITIAL_CAPACITY = 64;
const pixiLightingFrame = {
  isOutdoor: true,
  playerScreenX: 0,
  playerScreenY: 0,
  playerRevealRadius: TORCH_PLAYER_REVEAL_RADIUS,
  spellRadius: 0,
  torchCount: 0,
  torchData: new Float32Array(PIXI_LIGHT_INITIAL_CAPACITY * PIXI_LIGHT_SOURCE_STRIDE),
};

const getTorchLightRadius = (item) => {
  const itemData = getItemData(item?.itemId);
  const fuelStage = getTorchFuelStage(item);
  return itemData?.lightSource?.radiusByStage?.[fuelStage] ?? 0;
};

const getActivePlayerSpellLightRadius = (now) => {
  const lightEffect = playerState.spellEffects.light;
  if (!Number.isFinite(now) || lightEffect.expiresAt <= now) {
    return 0;
  }
  return lightEffect.radius;
};

const ensurePixiLightingCapacity = (requiredCount) => {
  const requiredLength = requiredCount * PIXI_LIGHT_SOURCE_STRIDE;
  if (requiredLength <= pixiLightingFrame.torchData.length) {
    return;
  }
  let nextLength = pixiLightingFrame.torchData.length;
  while (nextLength < requiredLength) {
    nextLength *= 2;
  }
  const nextTorchData = new Float32Array(nextLength);
  nextTorchData.set(pixiLightingFrame.torchData);
  pixiLightingFrame.torchData = nextTorchData;
};

const appendPixiTorchLight = (screenX, screenY, radius, torchCount) => {
  if (
    screenX + radius < 0 ||
    screenX - radius > GAME_WIDTH ||
    screenY + radius < 0 ||
    screenY - radius > GAME_HEIGHT
  ) {
    return torchCount;
  }
  ensurePixiLightingCapacity(torchCount + 1);
  const dataIndex = torchCount * PIXI_LIGHT_SOURCE_STRIDE;
  pixiLightingFrame.torchData[dataIndex] = screenX;
  pixiLightingFrame.torchData[dataIndex + 1] = screenY;
  pixiLightingFrame.torchData[dataIndex + 2] = radius;
  return torchCount + 1;
};

const updateLight = (source) => {
  const playerX = Number.isFinite(source?.renderX) ? source.renderX : source?.x;
  const playerY = Number.isFinite(source?.renderY) ? source.renderY : source?.y;
  const playerSurfaceOffsetY = getEntitySurfaceOffsetY(source);
  pixiLightingFrame.isOutdoor = playerState.z >= 0;
  pixiLightingFrame.playerScreenX = playerX - camera.x + TILE_SIZE / 2;
  pixiLightingFrame.playerScreenY = playerY - camera.y + TILE_SIZE / 2 - playerSurfaceOffsetY;
  pixiLightingFrame.spellRadius = pixiLightingFrame.isOutdoor ? 0 : getActivePlayerSpellLightRadius(Date.now());
  pixiLightingFrame.torchCount = 0;

  if (!pixiLightingFrame.isOutdoor) {
    let torchCount = 0;
    for (const item of activeLitTorchesByUid.values()) {
      if (!item.isLit || item.fuelRemainingMs <= 0) {
        continue;
      }

      const radius = getTorchLightRadius(item);
      if (radius <= 0) {
        continue;
      }

      if (playerState.equipment.ammo === item) {
        torchCount = appendPixiTorchLight(
          pixiLightingFrame.playerScreenX,
          pixiLightingFrame.playerScreenY,
          radius,
          torchCount,
        );
        continue;
      }

      if (worldItemsByUid.get(item.uid) !== item || item.z !== playerState.z) {
        continue;
      }
      const itemX = Number.isFinite(item.renderX) ? item.renderX : item.x;
      const itemY = Number.isFinite(item.renderY) ? item.renderY : item.y;
      torchCount = appendPixiTorchLight(
        itemX - camera.x + TILE_SIZE / 2,
        itemY - camera.y + TILE_SIZE / 2 - getWorldItemStackOffsetY(item),
        radius,
        torchCount,
      );
    }
    for (const remotePlayer of playersByUid.values()) {
      if (remotePlayer.z !== playerState.z) {
        continue;
      }
      const remoteX = Number.isFinite(remotePlayer.renderX) ? remotePlayer.renderX : remotePlayer.x;
      const remoteY = Number.isFinite(remotePlayer.renderY) ? remotePlayer.renderY : remotePlayer.y;
      const screenX = remoteX - camera.x + TILE_SIZE / 2;
      const screenY = remoteY - camera.y + TILE_SIZE / 2 - getEntitySurfaceOffsetY(remotePlayer);
      const equippedRadius = remotePlayer.light?.equippedRadius;
      if (Number.isFinite(equippedRadius) && equippedRadius > 0) {
        torchCount = appendPixiTorchLight(screenX, screenY, equippedRadius, torchCount);
      }
      const spellRadius = remotePlayer.light?.spellRadius;
      if (Number.isFinite(spellRadius) && spellRadius > 0) {
        torchCount = appendPixiTorchLight(screenX, screenY, spellRadius, torchCount);
      }
    }
    pixiLightingFrame.torchCount = torchCount;
  }

  updatePixiLighting(pixiLightingFrame);
};
//#endregion  -----  LIGHT - PIXI  -----

/* ==================================================== */
//#region     -----  JOUEUR - MOUVEMENT  -----
/* ==================================================== */
const resetMobileJoystickDiagonalHold = () => mobileJoystickController.resetDiagonalHold();
const resetMobileJoystick = () => mobileJoystickController.reset();
const placeMobileJoystickAtPointer = (clientX, clientY) => mobileJoystickController.placeAtPointer(clientX, clientY);
const updateMobileJoystickFromPointer = (clientX, clientY) =>
  mobileJoystickController.updateFromPointer(clientX, clientY);

const cancelPlayerNavigationForManualMovement = () => {
  const hasFollowTarget =
    playerNavigationState.followTargetUid !== null ||
    combatTargetState.monsterUid !== null ||
    combatTargetState.playerUid !== null;
  const shouldCancelFollow =
    playerNavigationState.followEnabled &&
    (hasFollowTarget || playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow);
  if (shouldCancelFollow) {
    playerNavigationState.followEnabled = false;
  }
  stopPlayerNavigation();

  if (shouldCancelFollow) {
    updatePlayerInventory();
  }
};
/* ---------- JOUEUR - COOLDOWN ET DIRECTION ---------- */

const getWantedMovement = () => {
  const deltaCol = Number(keysPressed.right) - Number(keysPressed.left);

  const deltaRow = Number(keysPressed.down) - Number(keysPressed.up);

  if (deltaCol === 0 && deltaRow === 0) {
    return null;
  }

  return {
    deltaCol,
    deltaRow,
    direction: getCardinalDirectionFromTileDelta(deltaCol, deltaRow, playerState.direction),
  };
};

/* ---------- JOUEUR - MISE A JOUR MOUVEMENT ---------- */

const updateMovement = (now) => {
  const keyboardMovement = getWantedMovement();
  const navigationMovement = keyboardMovement ? null : getPlayerNavigationMovement(now);
  const movement = keyboardMovement ?? navigationMovement;
  const isNavigationMovement = navigationMovement !== null;

  if (!movement) {
    playerState.walkFrame = 1;
    updatePlayerSprite();
    return;
  }

  if (gameRuntimeState.isRemoteSession && gameTransport?.getConnectionState?.() !== "ready") {
    playerState.walkFrame = 1;
    updatePlayerSprite();
    return;
  }

  if (now < gameplayTimingState.nextPlayerMoveTime) {
    return;
  }

  const nextX = playerState.x + movement.deltaCol * MOVE_SPEED;
  const nextY = playerState.y + movement.deltaRow * MOVE_SPEED;

  if (!canMoveTo(playerState.x, playerState.y, nextX, nextY)) {
    if (isNavigationMovement) {
      handleBlockedPlayerNavigationStep(now);
    }

    playerState.oldX = playerState.x;
    playerState.oldY = playerState.y;
    playerState.renderX = playerState.x;
    playerState.renderY = playerState.y;
    playerState.moveStartTime = 0;
    playerState.moveDuration = 0;
    updatePlayerSprite();

    return;
  }

  const moveAction = createMovePlayerAction({
    fromX: playerState.x,
    fromY: playerState.y,
    fromZ: playerState.z,
    toX: nextX,
    toY: nextY,
    direction: movement.direction,
    isNavigationMovement,
    requestedAt: now,
  });
  const moveResult = gameTransport.send(moveAction);
  const isPendingRemoteMove = moveResult && typeof moveResult.then === "function";
  const didSubmitMove = isPendingRemoteMove || moveResult?.success;

  if (isPendingRemoteMove) {
    const moveTiming = getSimulationPlayerMoveTiming(moveAction.payload);
    gameplayTimingState.nextPlayerMoveTime = now + (moveTiming?.cooldown ?? getPlayerMoveCooldown(playerState));
    handleGameActionResult(moveResult, (resolvedResult) => {
      if (!resolvedResult?.success && isNavigationMovement) {
        handleBlockedPlayerNavigationStep(Date.now());
      }
    });
  }

  if (didSubmitMove) {
    if (isNavigationMovement) {
      completePlayerNavigationStep();
    }

    if (moveResult?.events?.some((event) => event.type === "player-world-transitioned")) {
      resetMovementKeys();
      updatePlayerSprite();
      return;
    }

    updatePixiVisibleChunksAroundPlayer();

    playerState.walkFrame++;

    if (playerState.walkFrame >= PLAYER_ANIMATION_FRAMES) {
      playerState.walkFrame = 0;
    }
  } else if (isNavigationMovement) {
    handleBlockedPlayerNavigationStep(now);
  }

  updatePlayerSprite();
  closeFarOpenedContainers();
};
//#endregion  -----  JOUEUR - MOUVEMENT  -----

/* ==================================================== */
//#region     -----  INPUTS - CLAVIER / SOURIS / RESIZE  -----
/* ==================================================== */
/* ---------- INPUTS - ETAT CENTRAL ---------- */

const inputState = {
  isLeftClickDown: false,
  isRightClickDown: false,
  isLookComboTriggered: false,
  lastDetectedTarget: null,
  shouldBlockNextContextMenu: false,
  shouldBlockNextWorldClick: false,
};

const updateInputStateOnMouseDown = (e) => {
  if (e.button === 2) {
    inputState.isRightClickDown = true;
  }
  if (e.button === 0) {
    inputState.isLeftClickDown = true;
    inputState.shouldBlockNextWorldClick = false;
  }
  if (inputState.isLeftClickDown && inputState.isRightClickDown && !dragState.isDragging) {
    inputState.isLookComboTriggered = true;
    inputState.shouldBlockNextContextMenu = true;
  }
  inputState.lastDetectedTarget = getPointerTargetFromEvent(e);
};

const updateInputStateOnMouseUp = (e) => {
  if (e.button === 2) {
    inputState.isRightClickDown = false;
  }
  if (e.button === 0) {
    inputState.isLeftClickDown = false;
  }
  if (!inputState.isLeftClickDown || !inputState.isRightClickDown) {
    inputState.isLookComboTriggered = false;
  }
  if (!inputState.isLeftClickDown && !inputState.isRightClickDown) {
    inputState.lastDetectedTarget = null;
  }
};

const shouldBlockContextMenuAction = () => {
  if (inputState.shouldBlockNextContextMenu) {
    inputState.shouldBlockNextContextMenu = false;
    return true;
  } else {
    return false;
  }
};

const resetInputComboState = () => {
  inputState.isLookComboTriggered = false;
  inputState.shouldBlockNextContextMenu = false;
  inputState.lastDetectedTarget = null;
};

/* ---------- INPUTS - TOUCHE APPUYEE ---------- */

document.addEventListener("keydown", (e) => {
  if (stackSplitMenu && !stackSplitMenu.hidden) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeStackSplitMenu();
    }
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    if (!e.repeat && !gameRuntimeState.isStarting) {
      toggleCharacterSelector();
    }
    return;
  }
  if (characterSelectorUiState.isOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCharacterSelector();
      return;
    }
    if (isTextInputFocused()) {
      return;
    }
    e.preventDefault();
    return;
  }
  if (!gameRuntimeState.isStarted) {
    e.preventDefault();
    return;
  }
  if (e.key === "Escape" && spellUiState.isOpen) {
    e.preventDefault();
    spellUiState.isOpen = false;
    spellUiState.selectedSpellId = null;
    spellUiState.mobileAssignHotkeyIndex = null;
    updatePlayerInventory();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrentCharacter();
    return;
  }
  if (isTextInputFocused()) {
    return;
  }
  e.preventDefault();
  if (e.repeat) {
    return;
  }
  if (castPlayerSpellFromHotkeyKey(e.key)) {
    return;
  }
  const key = e.key.toLowerCase();
  if (key === "arrowright" || key === "d") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.right = true;
  } else if (key === "arrowleft" || key === "a") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.left = true;
  } else if (key === "arrowup" || key === "w") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.up = true;
  } else if (key === "arrowdown" || key === "s") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.down = true;
  } else if (key === "enter") {
    if (!isChatInputFocused()) {
      e.preventDefault();

      focusChatInput();
      return;
    } else {
      return;
    }
  }
});

/* ---------- INPUTS - TOUCHE RELACHEE ---------- */

document.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "arrowright" || key === "d") {
    keysPressed.right = false;
  } else if (key === "arrowleft" || key === "a") {
    keysPressed.left = false;
  } else if (key === "arrowup" || key === "w") {
    keysPressed.up = false;
  } else if (key === "arrowdown" || key === "s") {
    keysPressed.down = false;
  } else {
    return;
  }
  if (!isTextInputFocused()) {
    e.preventDefault();
  }
});

/* ---------- INPUTS - SAUVEGARDE AUTOMATIQUE ---------- */

const prepareMobileSessionExit = () => {
  if (!isMobileGameLayout() || !gameRuntimeState.isStarted || gameRuntimeState.isSwitchingCharacter) {
    return false;
  }

  shouldReloadAfterMobileSessionHide = true;
  resetMobileJoystick();
  resetMovementKeys();
  stopPlayerNavigation();
  setGameSessionUiActive(false);
  try {
    sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
    sessionStorage.setItem(OPEN_CHARACTER_SELECTOR_AFTER_RELOAD_SESSION_KEY, "true");
  } catch {
    // The socket still closes even when private browsing blocks sessionStorage.
  }
  gameTransport?.disconnect?.();
  requestMobileSessionReload();
  return true;
};

const requestMobileSessionReload = () => {
  if (!shouldReloadAfterMobileSessionHide || mobileSessionReloadRequested) {
    return false;
  }
  mobileSessionReloadRequested = true;
  try {
    window.location.replace(window.location.href);
  } catch {
    mobileSessionReloadRequested = false;
    return false;
  }
  return true;
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    resetMobileJoystick();
    autosaveCurrentCharacter();
    prepareMobileSessionExit();
    return;
  }
  requestMobileSessionReload();
});

window.addEventListener("blur", resetMobileJoystick);
window.addEventListener("focus", requestMobileSessionReload);
window.addEventListener("pageshow", requestMobileSessionReload);

window.addEventListener("pagehide", () => {
  autosaveCurrentCharacter();
  if (gameRuntimeState.isStarted) {
    gameTransport?.disconnect?.();
    setGameSessionUiActive(false);
  }
});

/* ---------- INPUTS - RESIZE FENETRE ---------- */

window.addEventListener("resize", () => {
  updateGameScale();
});
window.visualViewport?.addEventListener("resize", updateGameScale);
window.addEventListener("orientationchange", () => {
  resetMobileJoystick();
  requestAnimationFrame(updateGameScale);
});

/* ---------- INPUTS - SOURIS ---------- */
document.addEventListener("mousemove", (e) => {
  updateMousePositionInfo(e.clientX, e.clientY);
  handleItemUiMouseMove(e);
});

/* ---------- INPUTS - ACTIONS SOURIS ---------- */
const lookAtPointerTarget = (target) => {
  let lookInfo = {};

  if (target.monster) {
    const monsterData = getLocalizedMonsterData(target.monster.monsterId);
    if (!monsterData) {
      return null;
    }
    lookInfo = {
      name: monsterData.name,
      desc: monsterData.desc,
      suffix: monsterData.suffix,
      target: target.monster,
    };
    return lookInfo;
  } else if (target.player) {
    const customText = getPlayerLookDescription();
    if (isEmpty(customText)) {
      return null;
    }
    lookInfo = {
      customText,
      target: playerState,
    };
    return lookInfo;
  } else if (target.npc) {
    const npcData = getNpcData(target.npc.npcId);
    if (!npcData) {
      return null;
    }
    return {
      customText: getGameUiText("youSeeProperName")(npcData.name),
      target: playerState,
    };
  } else if (target.item) {
    const itemData = getLocalizedItemData(target.item.itemId);
    if (!itemData) {
      return null;
    }
    lookInfo = {
      name: itemData.name,
      pluralName: itemData.pluralName,
      desc: itemData.desc,
      suffix: itemData.suffix,
      quantity: target.item.quantity,
      weight: getItemTotalWeight(target.item),
      target: target.item,
      sourceType: target.itemSlotInfo.itemLocation.locationType,
      charges: target.item.charges,
      attack: itemData.combat?.attack,
      defense: itemData.combat?.defense,
    };
    return lookInfo;
  } else if (target.interactable) {
    const interactable = target.interactable;
    const isFrench = getCurrentGameLanguage() === "fr";
    const displayName =
      (isFrench ? interactable.properties?.displayNameFr : interactable.properties?.displayName) ??
      interactable.properties?.displayName;
    const lookText =
      (isFrench ? interactable.properties?.lookTextFr : interactable.properties?.lookText) ??
      interactable.properties?.lookText;

    if (!displayName && !lookText) {
      return null;
    }

    let customText = "";
    if (displayName) {
      customText += getGameUiText("youSeeProperName")(displayName);
    }
    if (lookText) {
      customText += `\n${lookText}`;
    }

    lookInfo = {
      customText,
      target: playerState,
    };
    return lookInfo;
  } else if (target.tile) {
    lookInfo = {
      name: getGameUiText("tileName"),
      desc: getGameUiText("tileDescription"),
      suffix: getCurrentGameLanguage() === "fr" ? "une" : "a",
      target: target.tile,
    };
    return lookInfo;
  } else {
    return null;
  }
};

const getPlayerLookDescription = () => {
  const level = playerState.level;
  const classData = getPlayerClassData();
  if (!Number.isFinite(level) || !classData) {
    return null;
  }
  if (!("classId" in playerState) || playerState.classId === "noClass") {
    return getGameUiText("youSeeYourself")(level);
  } else {
    const localizedClassData = getLocalizedClassData(playerState.classId) ?? classData;
    return getGameUiText("youSeeYourselfClass")(localizedClassData.name, level);
  }
};

const handleLookCombo = () => {
  const target = inputState.lastDetectedTarget;
  if (!target) {
    return false;
  }
  const lookInfo = lookAtPointerTarget(target);
  if (!lookInfo) {
    return false;
  }
  showLookFloatingText(lookInfo);
  return true;
};

/* ---------- INPUTS - DRAG ITEM UI ---------- */
const isTextInputFocused = () => {
  const activeElement = document.activeElement;
  return activeElement === chatInput || activeElement?.matches("input, textarea") === true;
};

const blurActiveTextInput = () => {
  const activeElement = document.activeElement;
  if (activeElement?.matches("input, textarea")) {
    activeElement.blur();
    if (gameRuntimeState.isStarted && !characterSelectorUiState.isOpen) {
      game.focus({ preventScroll: true });
    }
  }
};

const getContainerSourceFromSlotElement = (slotElement) => {
  if (!slotElement) {
    return null;
  }
  const containerUid = Number(slotElement.getAttribute("data-container-uid"));
  const slotIndex = Number(slotElement.getAttribute("data-container-slot-index"));
  if (!Number.isInteger(containerUid) || !Number.isInteger(slotIndex)) {
    return null;
  }
  return {
    locationType: "containerSlot",
    parentContainerUid: containerUid,
    slotIndex,
  };
};

const getEquipmentSourceFromSlotElement = (slotElement) => {
  if (!slotElement) {
    return null;
  }
  const slotName = slotElement.getAttribute("data-equipment-slot");
  if (!slotName || !(slotName in playerState.equipment)) {
    return null;
  }
  return {
    locationType: "equipmentSlot",
    equipmentSlotName: slotName,
  };
};

const getWorldSourceFromItemElement = (itemElement) => {
  if (!itemElement) {
    return null;
  }
  const itemUid = Number(itemElement.getAttribute("data-item-uid"));
  if (!Number.isInteger(itemUid)) {
    return null;
  }
  return {
    locationType: "worldItem",
    itemUid: itemUid,
  };
};

const getWorldDestinationFromMousePosition = () => {
  if (!isMouseInsideMap(mousePosition)) {
    return null;
  }
  const x = mousePosition.col * TILE_SIZE;
  const y = mousePosition.row * TILE_SIZE;
  return {
    locationType: "worldTile",
    x,
    y,
    z: playerState.z,
  };
};

const getItemSlotInfoFromEvent = (e) => {
  const containerSlotElement = e.target.closest(".container-slot");
  if (containerSlotElement) {
    const itemLocation = getContainerSourceFromSlotElement(containerSlotElement);
    return {
      slotElement: containerSlotElement,
      itemLocation,
    };
  }
  const equipmentSlotElement = e.target.closest("[data-equipment-slot]");
  if (equipmentSlotElement) {
    const itemLocation = getEquipmentSourceFromSlotElement(equipmentSlotElement);
    return {
      slotElement: equipmentSlotElement,
      itemLocation,
    };
  }
  const worldSlotElement = e.target.closest(".hitbox");
  if (worldSlotElement) {
    const clickedLocation = getWorldSourceFromItemElement(worldSlotElement);
    const clickedItem = getDragSourceItem(clickedLocation);
    if (!clickedItem) {
      return null;
    }
    const topItem = getTopWorldItemAtTile(clickedItem.x, clickedItem.y, clickedItem.z);
    if (!topItem) {
      return null;
    }
    const itemLocation = {
      locationType: "worldItem",
      itemUid: topItem.uid,
    };
    return {
      slotElement: worldSlotElement,
      itemLocation,
    };
  }
  return null;
};

const getPointerTargetFromEvent = (e) => {
  updateMousePositionInfo(e.clientX, e.clientY);
  const itemSlotInfo = getItemSlotInfoFromEvent(e);
  let item = null;
  if (itemSlotInfo && itemSlotInfo.itemLocation) {
    item = getDragSourceItem(itemSlotInfo.itemLocation);
  }
  if (
    itemSlotInfo &&
    (itemSlotInfo.itemLocation.locationType === "equipmentSlot" ||
      itemSlotInfo.itemLocation.locationType === "containerSlot")
  ) {
    return {
      itemSlotInfo: itemSlotInfo,
      item,
      player: null,
      monster: null,
      npc: null,
      interactable: null,
      tile: null,
      pointerInsideMap: false,
    };
  }
  const row = mousePosition.row;
  const col = mousePosition.col;
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const pointerInsideMap = mousePosition.isInsideMap;
  let tile = null;
  let monster = null;
  let npc = null;
  let player = null;
  let interactable = null;
  const currentWorldMap = getCurrentWorldMap();
  if (pointerInsideMap) {
    interactable = findInteractableAtTile(currentWorldMap, col, row);
    tile = { row, col, x, y };
    monster = findMonsterAtPosition(x, y);
    npc = findNpcAtClientPosition(e.clientX, e.clientY) ?? findNpcAtPosition(x, y);
    player = getTopPlayerAtTile([playerState, ...playersByUid.values()], x, y, playerState.z);
  }

  return {
    itemSlotInfo: itemSlotInfo,
    item,
    player,
    monster: monster,
    npc,
    interactable,
    tile,
    pointerInsideMap,
  };
};

const handleItemUiMouseDown = (e) => {
  if (e.button !== 0) {
    return;
  }
  const info = getItemSlotInfoFromEvent(e);
  if (!info || !info.itemLocation || !info.slotElement) {
    return;
  }
  e.preventDefault();
  dragState.pendingSourceLocation = info.itemLocation;
  dragState.pendingSlotElement = info.slotElement;
  dragState.startScreenX = e.clientX;
  dragState.startScreenY = e.clientY;
};

const handleItemUiMouseMove = (e) => {
  if (!dragState.pendingSourceLocation || !inputState.isLeftClickDown || inputState.isLookComboTriggered) {
    return;
  }
  const mouseMoveDistance = Math.abs(dragState.startScreenX - e.clientX) + Math.abs(dragState.startScreenY - e.clientY);
  if (mouseMoveDistance < 5) {
    return;
  }
  const item = getDragSourceItem(dragState.pendingSourceLocation);
  if (
    !item ||
    (dragState.pendingSourceLocation.locationType === "worldItem" && !isWorldItemAvailableForInteraction(item))
  ) {
    resetDragState();
    resetDragStatePending();
    return;
  }
  startItemDrag(dragState.pendingSourceLocation);
  if (dragState.isDragging === true) {
    if (dragState.pendingSourceLocation.locationType === "worldItem") {
      const itemUid = dragState.pendingSourceLocation.itemUid;
      setPixiWorldItemSelected(itemUid, true);
    } else {
      dragState.pendingSlotElement.classList.add("container-slot-dragging");
    }
  }
  resetDragStatePending();
};

const handleItemUiMouseUp = (e) => {
  if (e.button !== 0 || !dragState.isDragging) {
    return;
  }

  const info = getItemSlotInfoFromEvent(e);
  if (!info && e.target.closest(".jeux-gauche, .jeux-droite, .navbar, .entete-jeux, #boite-chat")) {
    cancelItemDrag();
    return;
  }

  if (info && info.itemLocation && info.slotElement) {
    if (["containerSlot", "equipmentSlot"].includes(info.itemLocation.locationType)) {
      e.preventDefault();
      completeItemDrag(info.itemLocation);
      return;
    }

    if (info.itemLocation.locationType === "worldItem") {
      const worldDestination = getWorldDestinationFromMousePosition();
      if (worldDestination) {
        e.preventDefault();
        completeItemDrag(worldDestination);
        return;
      }
    }
  }

  const worldDestination = getWorldDestinationFromMousePosition();
  if (worldDestination) {
    e.preventDefault();
    completeItemDrag(worldDestination);
    return;
  }

  cancelItemDrag();
};

document.addEventListener("mousedown", (e) => {
  updateInputStateOnMouseDown(e);
  if (inputState.isLookComboTriggered) {
    e.preventDefault();
    inputState.shouldBlockNextWorldClick = true;
    handleLookCombo();
    return;
  }

  if (dragState.isDragging && e.button === 2) {
    e.preventDefault();
    inputState.shouldBlockNextContextMenu = true;
    cancelItemDrag();
    return;
  }
  if (itemUseState.isUsingItem) {
    if (inputState.isLookComboTriggered || inputState.isRightClickDown || dragState.isDragging) {
      inputState.shouldBlockNextContextMenu = true;
      cancelItemUse();
      return;
    }
    if (inputState.isLeftClickDown) {
      inputState.shouldBlockNextWorldClick = true;
      completeItemUseFromEvent(e);
      return;
    }

    return;
  }
  handleItemUiMouseDown(e);
});

document.addEventListener("mouseup", (e) => {
  handleItemUiMouseUp(e);
  updateInputStateOnMouseUp(e);
});

/* ---------- INPUTS - MOBILE TACTILE ---------- */

const mobileTouchInputState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  didMove: false,
  didLongPress: false,
  longPressTimeoutId: null,
};

const isMobileTouchGameTarget = (target) => {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest("button, input, textarea, select, #mobile-game-controls, #boite-chat, .minimap-panel")) {
    return false;
  }
  return target.closest("#game, .container-slot, .equipment-slot") !== null;
};

const resetMobileTouchInput = () => {
  if (mobileTouchInputState.longPressTimeoutId !== null) {
    clearTimeout(mobileTouchInputState.longPressTimeoutId);
  }
  mobileTouchInputState.pointerId = null;
  mobileTouchInputState.didMove = false;
  mobileTouchInputState.didLongPress = false;
  mobileTouchInputState.longPressTimeoutId = null;
  inputState.isLeftClickDown = false;
  inputState.lastDetectedTarget = null;
};

const createTouchReleaseEvent = (pointerEvent) => {
  return {
    button: 0,
    clientX: pointerEvent.clientX,
    clientY: pointerEvent.clientY,
    target: document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY) ?? pointerEvent.target,
    preventDefault: () => pointerEvent.preventDefault(),
    stopPropagation: () => pointerEvent.stopPropagation(),
  };
};

const getMobileWorldContainerSourceAtTarget = (target) => {
  if (!target?.tile || target.monster) {
    return null;
  }

  const item = getTopWorldItemAtTile(target.tile.x, target.tile.y, playerState.z);
  if (!item || !isOpenableContainerItem(item)) {
    return null;
  }

  const source = {
    locationType: "worldItem",
    itemUid: item.uid,
  };
  return canInteractWithWorldItemSource(source) ? source : null;
};

document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      event.pointerType !== "touch" ||
      !isMobileGameLayout() ||
      !gameRuntimeState.isStarted ||
      characterSelectorUiState.isOpen ||
      mobileTouchInputState.pointerId !== null ||
      !isMobileTouchGameTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    mobileTouchInputState.pointerId = event.pointerId;
    mobileTouchInputState.startX = event.clientX;
    mobileTouchInputState.startY = event.clientY;
    mobileTouchInputState.didMove = false;
    mobileTouchInputState.didLongPress = false;
    updateMousePositionInfo(event.clientX, event.clientY);
    updateInputStateOnMouseDown(event);

    if (itemUseState.isUsingItem) {
      inputState.shouldBlockNextWorldClick = true;
      completeItemUseFromEvent(event);
      resetMobileTouchInput();
      return;
    }

    handleItemUiMouseDown(event);
    mobileTouchInputState.longPressTimeoutId = setTimeout(() => {
      if (
        mobileTouchInputState.pointerId !== event.pointerId ||
        mobileTouchInputState.didMove ||
        dragState.isDragging
      ) {
        return;
      }
      if (handleNpcGreetingFromPointerTarget(inputState.lastDetectedTarget) || handleLookCombo()) {
        mobileTouchInputState.didLongPress = true;
        inputState.shouldBlockNextWorldClick = true;
        navigator.vibrate?.(12);
      }
    }, 450);
  },
  { passive: false },
);

document.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerId !== mobileTouchInputState.pointerId) {
      return;
    }

    event.preventDefault();
    updateMousePositionInfo(event.clientX, event.clientY);
    const distance =
      Math.abs(event.clientX - mobileTouchInputState.startX) + Math.abs(event.clientY - mobileTouchInputState.startY);
    if (distance >= 5) {
      mobileTouchInputState.didMove = true;
      if (mobileTouchInputState.longPressTimeoutId !== null) {
        clearTimeout(mobileTouchInputState.longPressTimeoutId);
        mobileTouchInputState.longPressTimeoutId = null;
      }
    }
    handleItemUiMouseMove(event);
  },
  { passive: false },
);

const finishMobileTouchInput = (event) => {
  if (event.pointerId !== mobileTouchInputState.pointerId) {
    return;
  }

  event.preventDefault();
  const releaseEvent = createTouchReleaseEvent(event);
  const pendingSource = dragState.pendingSourceLocation;
  const target = mobileTouchInputState.didMove ? null : getPointerTargetFromEvent(releaseEvent);

  if (mobileTouchInputState.didLongPress) {
    cancelItemDrag();
  } else if (dragState.isDragging) {
    handleItemUiMouseUp(releaseEvent);
  } else if (target?.monster) {
    resetDragStatePending();
    selectMonster(target.monster);
  } else if (target?.player && target.player.uid !== playerState.uid) {
    resetDragStatePending();
    selectRemotePlayer(target.player);
  } else if (pendingSource && !mobileTouchInputState.didMove) {
    resetDragStatePending();
    handleUseItemFromSource(pendingSource);
  } else if (!mobileTouchInputState.didMove) {
    const worldContainerSource = getMobileWorldContainerSourceAtTarget(target);
    if (worldContainerSource) {
      handleUseItemFromSource(worldContainerSource);
    } else if (handleInteractableContextMenu(target) || handleTransitionContextMenu(target)) {
      inputState.shouldBlockNextWorldClick = true;
    } else if (target?.pointerInsideMap && target.tile) {
      startPlayerClickNavigation(target.tile);
    }
  }

  resetDragStatePending();
  resetMobileTouchInput();
};

document.addEventListener("pointerup", finishMobileTouchInput, { passive: false });
document.addEventListener(
  "pointercancel",
  (event) => {
    if (event.pointerId !== mobileTouchInputState.pointerId) {
      return;
    }
    cancelItemDrag();
    resetDragStatePending();
    resetMobileTouchInput();
  },
  { passive: false },
);

mobileJoystickZone?.addEventListener("pointerdown", (event) => {
  if (itemUseState.isUsingItem || (event.pointerType !== "touch" && event.pointerType !== "pen")) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  mobileGameUiState.joystickPointerId = event.pointerId;
  mobileJoystickZone.setPointerCapture(event.pointerId);
  placeMobileJoystickAtPointer(event.clientX, event.clientY);
  updateMobileJoystickFromPointer(event.clientX, event.clientY);
});

mobileJoystickZone?.addEventListener("pointermove", (event) => {
  if (event.pointerId !== mobileGameUiState.joystickPointerId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  updateMobileJoystickFromPointer(event.clientX, event.clientY);
});

const finishMobileJoystickInput = (event) => {
  if (event.pointerId !== mobileGameUiState.joystickPointerId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  resetMobileJoystick();
};

mobileJoystickZone?.addEventListener("pointerup", finishMobileJoystickInput);
mobileJoystickZone?.addEventListener("pointercancel", finishMobileJoystickInput);

boitePrincipale.addEventListener("contextmenu", (event) => {
  if (!isMobileGameLayout()) {
    return;
  }
  event.preventDefault();
});

for (const button of mobilePanelButtons) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMobileActionMenuOpen(false);
    setOpenMobilePanel(button.dataset.mobilePanel);
  });
}

for (const button of mobileActionButtons) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mobileAction = button.dataset.mobileAction;
    if (mobileAction === "toggle-menu") {
      const shouldOpenMenu = !mobileGameUiState.isActionMenuOpen;
      setMobileActionMenuOpen(shouldOpenMenu);
      return;
    }
    if (!MOBILE_ACTIONS_KEEP_MENU_OPEN.has(mobileAction)) {
      setMobileActionMenuOpen(false);
    }
    if (mobileAction === "toggle-backpack") {
      toggleMobileBackpack();
    } else if (mobileAction === "toggle-follow") {
      togglePlayerFollow();
      syncMobileFollowButton();
    } else if (mobileAction === "cycle-stance") {
      cycleMobileCombatMode();
    } else if (mobileAction === "toggle-spells") {
      toggleSpellWindow();
    } else if (mobileAction === "toggle-quests") {
      setOpenMobilePanel(null);
      toggleQuestWindow();
    } else if (mobileAction === "toggle-torch") {
      toggleMobileTorch();
    } else if (mobileAction === "toggle-pvp") {
      togglePvpMode();
    } else if (mobileAction === "toggle-options") {
      toggleOptionsWindow();
    } else if (mobileAction === "logout") {
      requestLogoutCurrentCharacter();
    }
  });
}

document.addEventListener(
  "pointerdown",
  (event) => {
    const targetElement = event.target instanceof Element ? event.target : null;
    if (
      !mobileGameUiState.isActionMenuOpen ||
      targetElement?.closest("#mobile-action-menu") ||
      targetElement?.closest(".mobile-primary-actions")
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setMobileActionMenuOpen(false);
  },
  { capture: true },
);

mobileItemUseIndicator?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  cancelItemUse();
});

document.addEventListener("click", (event) => {
  const targetElement = event.target instanceof Element ? event.target : null;
  const closeButton = targetElement?.closest("[data-mobile-panel-close]");
  if (!closeButton || !isMobileGameLayout()) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (mobileGameUiState.openPanel === closeButton.dataset.mobilePanelClose) {
    setOpenMobilePanel(null);
  }
});

mobileGameLayoutMedia.addEventListener("change", syncMobileGameLayout);
syncMobileGameLayout();

const hasPlayerLineOfSightToEntity = (entity) => {
  return hasPlayerLineOfSightToWorldPosition(entity);
};

const hasPlayerLineOfSightToWorldPosition = (worldPosition) => {
  if (!worldPosition || worldPosition.z !== playerState.z) {
    return false;
  }
  const worldMap = getCurrentWorldMap();
  if (!worldMap) {
    return false;
  }
  return hasLineOfSightBetweenTiles(worldMap, getTilePosition(playerState), getTilePosition(worldPosition));
};

const isTilePathTraversable = (row, col, fromTile = null) => {
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return false;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }

  const worldChunk = getWorldChunkForTilePosition(currentWorldMap, col, row);
  if (!worldChunk) {
    return false;
  }

  if (isTiledCollisionAtTile(currentWorldMap, col, row)) {
    return false;
  }

  const tileX = col * TILE_SIZE;
  const tileY = row * TILE_SIZE;

  if (isBlockingItemAtPosition(tileX, tileY)) {
    return false;
  }

  if (fromTile) {
    const fromWorld = getWorldPosition(fromTile);
    const toWorld = getWorldPosition({ row, col });

    if (!canStepFromTileToTile(fromWorld.tileX, fromWorld.tileY, toWorld.tileX, toWorld.tileY, playerState.z)) {
      return false;
    }
  }

  return true;
};

const isTileOccupiedByCreature = (row, col) => {
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return false;
  }

  const tileX = col * TILE_SIZE;
  const tileY = row * TILE_SIZE;

  return isMonsterAtPosition(tileX, tileY) || isNpcAtPosition(tileX, tileY) || isPlayerAtPosition(tileX, tileY);
};

const { findPath, findPathToAnyTarget, getPathTraversableAdjacentTiles, isWalkableTile } = createPathfinder({
  isTilePathTraversable,
  isTileOccupiedByCreature,
});

/* ---------- PATHFINDING - NAVIGATION JOUEUR ---------- */

const stopPlayerNavigation = () => playerNavigationController.stop();
const startPlayerClickNavigation = (destinationTile) => playerNavigationController.startClick(destinationTile);
const handleMinimapNavigationClick = (event) => minimapController.navigateFromPointer(event);
const startMinimapPan = (event) => minimapController.startPan(event);
const updateMinimapPan = (event) => minimapController.updatePan(event);
const finishMinimapPan = (event, shouldNavigate) => minimapController.finishPan(event, shouldNavigate);

const startPlayerFollowNavigation = (targetType = null, targetUid = null) =>
  playerNavigationController.startFollow(targetType, targetUid);
const updatePlayerFollowNavigation = (now, forceRefresh = false) =>
  playerNavigationController.updateFollow(now, forceRefresh);
const isPlayerWithinActionRange = (target, range, distanceType = PLAYER_ACTION_DISTANCE_TYPE.square) =>
  playerNavigationController.isPlayerWithinActionRange(target, range, distanceType);
const startPlayerActionNavigation = (action) => playerNavigationController.startAction(action);
const updatePlayerActionNavigation = (now) => playerNavigationController.updateAction(now);
const getPlayerNavigationMovement = (now) => playerNavigationController.getMovement(now);
const completePlayerNavigationStep = () => playerNavigationController.completeStep();
const handleBlockedPlayerNavigationStep = (now) => playerNavigationController.handleBlockedStep(now);

const findNpcAtClientPosition = (clientX, clientY) => {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  let frontNpc = null;
  let frontNpcSortY = Number.NEGATIVE_INFINITY;
  for (const [npcUid, refs] of npcElementsByUid.entries()) {
    const npc = npcsByUid.get(npcUid);
    const rootElement = refs?.root;
    if (!npc || npc.z !== playerState.z || !rootElement) {
      continue;
    }
    const bounds = rootElement.getBoundingClientRect();
    const isInsideBounds =
      clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
    if (!isInsideBounds) {
      continue;
    }
    const npcSortY = getEntityRenderSortY(npc);
    if (npcSortY >= frontNpcSortY) {
      frontNpc = npc;
      frontNpcSortY = npcSortY;
    }
  }
  return frontNpc;
};

/* ---------- NPCS - RENDU ---------- */

const updateNpcSprite = (npc) => {
  const npcData = getNpcData(npc?.npcId);
  if (!npcData) {
    return false;
  }

  const directionRow = getDirectionRow(npc.direction);
  const surfaceOffsetY = getEntitySurfaceOffsetY(npc);
  return upsertPixiNpcVisual({
    uid: npc.uid,
    npcId: npc.npcId,
    sourceX: npc.walkFrame * PLAYER_FRAME_WIDTH,
    sourceY: directionRow * PLAYER_FRAME_HEIGHT,
    sourceWidth: PLAYER_FRAME_WIDTH,
    sourceHeight: PLAYER_FRAME_HEIGHT,
    width: npcData.drawWidth,
    height: npcData.drawHeight,
    x: npc.renderX,
    y: npc.renderY - TILE_SIZE - surfaceOffsetY,
    zIndex: getWorldRenderZIndex(getEntityRenderSortY(npc), WORLD_RENDER_LAYER_CREATURE),
  });
};

const isNpcInsideVisibleChunkRange = (npc) => {
  if (!npc || npc.z !== pixiWorldRenderState.currentZ) {
    return false;
  }
  const playerChunk = getChunkPositionFromWorldPosition(playerState.x, playerState.y);
  const npcChunk = getChunkPositionFromWorldPosition(npc.x, npc.y);
  if (!playerChunk || !npcChunk) {
    return false;
  }
  return (
    Math.abs(npcChunk.chunkX - playerChunk.chunkX) <= pixiWorldRenderState.visibleRadiusChunks &&
    Math.abs(npcChunk.chunkY - playerChunk.chunkY) <= pixiWorldRenderState.visibleRadiusChunks
  );
};

const renderNpc = (npc) => {
  if (!isNpcInsideVisibleChunkRange(npc) || npcElementsByUid.has(npc.uid)) {
    return;
  }

  if (updateEntityRenderPosition(npc, Date.now(), "npcs")) {
    npc.walkFrame = 1;
  }

  const npcData = getNpcData(npc.npcId);
  if (!npcData) {
    return;
  }

  const rootElement = document.createElement("div");
  rootElement.classList.add("npc");
  rootElement.style.width = `${npcData.drawWidth}px`;
  rootElement.style.height = `${npcData.drawHeight}px`;
  const nameElement = document.createElement("div");
  nameElement.classList.add("npc-name");
  nameElement.textContent = npcData.name;
  const hpContainerElement = document.createElement("div");
  hpContainerElement.classList.add("hp-bar");
  const hpElement = document.createElement("div");
  hpElement.classList.add("hp-red");
  hpElement.style.width = `${(npc.hp / npcData.maxHp) * 100}%`;
  hpElement.style.setProperty("--hp-color", getHpColor(npc.hp, npcData.maxHp));
  hpContainerElement.appendChild(hpElement);
  rootElement.append(nameElement, hpContainerElement);
  game.appendChild(rootElement);
  npcElementsByUid.set(npc.uid, { root: rootElement, name: nameElement, hp: hpElement });
  updateNpcSprite(npc);
};

const removeNpcRender = (npcUid) => {
  const refs = npcElementsByUid.get(npcUid);
  refs?.root?.remove();
  npcElementsByUid.delete(npcUid);
  removePixiNpcVisual(npcUid);
};

const syncVisibleNpcRendersAroundPlayer = () => {
  const visibleNpcUids = new Set();
  const visibleNpcs = getNpcsInChunkRadius(
    playerState.x,
    playerState.y,
    pixiWorldRenderState.currentZ,
    pixiWorldRenderState.visibleRadiusChunks,
  );
  for (const npc of visibleNpcs) {
    visibleNpcUids.add(npc.uid);
    renderNpc(npc);
  }
  for (const npcUid of npcElementsByUid.keys()) {
    if (!visibleNpcUids.has(npcUid)) {
      removeNpcRender(npcUid);
    }
  }
};

const updateNpcPosition = () => {
  for (const [npcUid, refs] of npcElementsByUid.entries()) {
    const npc = npcsByUid.get(npcUid);
    if (!npc) {
      removeNpcRender(npcUid);
      continue;
    }
    const surfaceOffsetY = getEntitySurfaceOffsetY(npc);
    const renderY = npc.renderY - TILE_SIZE - surfaceOffsetY;
    const zIndex = getWorldRenderZIndex(getEntityRenderSortY(npc), WORLD_RENDER_LAYER_CREATURE);
    updatePixiNpcTransform(npc.uid, npc.renderX, renderY, zIndex);
    if (refs?.root) {
      const nextLeft = `${npc.renderX - camera.x}px`;
      const nextTop = `${renderY - camera.y}px`;
      if (refs.lastLeft !== nextLeft) {
        refs.root.style.left = nextLeft;
        refs.lastLeft = nextLeft;
      }
      if (refs.lastTop !== nextTop) {
        refs.root.style.top = nextTop;
        refs.lastTop = nextTop;
      }
      if (refs.lastZIndex !== zIndex) {
        refs.root.style.zIndex = zIndex;
        refs.lastZIndex = zIndex;
      }
    }
  }
};

const updateNpcDirectionToPlayer = (npc) => {
  const npcTile = getTilePosition(npc);
  const playerTile = getTilePosition(playerState);
  npc.direction = getCardinalDirectionFromTileDelta(
    playerTile.col - npcTile.col,
    playerTile.row - npcTile.row,
    npc.direction,
  );
  updateNpcSprite(npc);
};

/* ---------- JOUEURS DISTANTS - RENDU ---------- */

const getRemotePlayerAppearanceKey = (remotePlayer) => {
  const parts = normalizeCharacterAppearanceParts(remotePlayer.appearanceParts);
  const colors = normalizeCharacterAppearanceColors(remotePlayer.appearanceColors);
  return `${parts.headId}:${parts.bodyId}:${parts.legsId}:${parts.bootsId}:${colors.hair}:${colors.clothes}:${colors.pants}:${colors.shoes}`;
};

const updateRemotePlayerVisual = (remotePlayer, tileStackRenderOffsets = null) => {
  if (!remotePlayer || remotePlayer.z !== pixiWorldRenderState.currentZ) {
    return false;
  }
  const surfaceOffsetY = getEntitySurfaceOffsetY(remotePlayer);
  const sourceX = remotePlayer.walkFrame * PLAYER_FRAME_WIDTH;
  const sourceY = getDirectionRow(remotePlayer.direction) * PLAYER_FRAME_HEIGHT;
  return updatePixiRemotePlayerVisual({
    uid: remotePlayer.uid,
    name: remotePlayer.name,
    hp: remotePlayer.hp,
    maxHp: remotePlayer.maxHp,
    sourceX,
    sourceY,
    sourceWidth: PLAYER_FRAME_WIDTH,
    sourceHeight: PLAYER_FRAME_HEIGHT,
    x: remotePlayer.renderX,
    y: remotePlayer.renderY - TILE_SIZE - surfaceOffsetY,
    zIndex:
      getWorldRenderZIndex(getEntityRenderSortY(remotePlayer), WORLD_RENDER_LAYER_CREATURE) +
      (tileStackRenderOffsets?.get(remotePlayer.uid) ??
        getPlayerTileStackRenderOffset(remotePlayer, [playerState, ...playersByUid.values()])),
    selected: remotePlayer.uid === combatTargetState.playerUid,
    pvp: remotePlayer.pvp,
  });
};

const renderRemotePlayer = async (remotePlayer) => {
  if (!remotePlayer || remotePlayer.z !== pixiWorldRenderState.currentZ) {
    return false;
  }
  const appearanceKey = getRemotePlayerAppearanceKey(remotePlayer);
  const textureUrlsByLayer = await getPlayerAppearanceLayerTextureUrls(
    remotePlayer.appearanceParts,
    remotePlayer.appearanceColors,
  );
  const loaded = await upsertPixiRemotePlayerAppearance({
    uid: remotePlayer.uid,
    appearanceKey,
    textureUrlsByLayer,
  });
  if (playersByUid.get(remotePlayer.uid) !== remotePlayer || remotePlayer.z !== pixiWorldRenderState.currentZ) {
    removePixiRemotePlayerVisual(remotePlayer.uid);
    remotePlayerRenderUids.delete(remotePlayer.uid);
    return false;
  }
  if (loaded) {
    remotePlayerRenderUids.add(remotePlayer.uid);
  }
  return loaded ? updateRemotePlayerVisual(remotePlayer) : false;
};

const syncVisibleRemotePlayerRenders = () => {
  const visiblePlayerUids = new Set();
  for (const remotePlayer of playersByUid.values()) {
    if (remotePlayer.z !== pixiWorldRenderState.currentZ) {
      continue;
    }
    visiblePlayerUids.add(remotePlayer.uid);
    renderRemotePlayer(remotePlayer);
  }
  for (const remotePlayerUid of [...remotePlayerRenderUids]) {
    if (!visiblePlayerUids.has(remotePlayerUid)) {
      if (combatTargetState.playerUid === remotePlayerUid) {
        combatTargetState.playerUid = null;
        syncMobileTargetHud();
      }
      removePixiRemotePlayerVisual(remotePlayerUid);
      remotePlayerRenderUids.delete(remotePlayerUid);
    }
  }
};

const clearRemotePlayerSelection = () => {
  const selectedPlayerUid = combatTargetState.playerUid;
  combatTargetState.playerUid = null;
  if (selectedPlayerUid) {
    const remotePlayer = playersByUid.get(selectedPlayerUid);
    if (remotePlayer) {
      updateRemotePlayerVisual(remotePlayer);
    }
  }
};

const selectRemotePlayer = (remotePlayer) => {
  if (!remotePlayer || remotePlayer.uid === playerState.uid) {
    return false;
  }
  if (!canInitiatePlayerPvpAttack(playerState, remotePlayer, Date.now())) {
    if (playerNavigationState.followEnabled) {
      clearRemotePlayerSelection();
      clearMonsterSelection();
      combatTargetState.monsterUid = null;
      syncMobileTargetHud();
      startPlayerFollowNavigation("player", remotePlayer.uid);
      syncMobileFollowButton();
      return true;
    }
    clearRemotePlayerSelection();
    syncMobileTargetHud();
    showGameStatusMessage(getGameUiText("pvpRequiresBothPlayers"));
    return false;
  }
  const wasSelected = combatTargetState.playerUid === remotePlayer.uid;
  clearRemotePlayerSelection();
  clearMonsterSelection();
  combatTargetState.monsterUid = null;
  if (!wasSelected) {
    combatTargetState.playerUid = remotePlayer.uid;
    updateRemotePlayerVisual(remotePlayer);
    if (playerNavigationState.followEnabled) {
      startPlayerFollowNavigation("player", remotePlayer.uid);
    }
  } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
    stopPlayerNavigation();
  }
  syncMobileTargetHud();
  return true;
};

const loseSelectedPlayerTarget = () => {
  if (combatTargetState.playerUid === null) {
    return false;
  }
  clearRemotePlayerSelection();
  syncMobileTargetHud();
  const wasFollowing =
    playerNavigationState.followEnabled || playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow;
  playerNavigationState.followEnabled = false;
  stopPlayerNavigation();
  if (wasFollowing) {
    updatePlayerInventory();
  }
  showGameStatusMessage(getGameUiText("targetLost"));
  return true;
};

/* ---------- NPCS - MOUVEMENT ---------- */

const getRandomNpcWanderTile = (npc) => {
  const npcData = getNpcData(npc?.npcId);
  if (!npcData?.movement?.enabled) {
    return null;
  }

  const npcTile = getTilePosition(npc);
  const spawnCol = npc.spawnX / TILE_SIZE;
  const spawnRow = npc.spawnY / TILE_SIZE;
  const possibleTiles = getNeighbors(npcTile).filter((tile) => {
    const isCardinalStep = getTileMovementCost(npcTile, tile) === 1;
    const isInsideRoamRange =
      Math.abs(tile.col - spawnCol) <= npcData.movement.roamRadiusTiles &&
      Math.abs(tile.row - spawnRow) <= npcData.movement.roamRadiusTiles;
    return isCardinalStep && isInsideRoamRange && isWalkableTile(tile.row, tile.col, npcTile);
  });

  if (possibleTiles.length === 0) {
    return null;
  }
  return possibleTiles[getRandomInt(0, possibleTiles.length - 1)];
};

const moveNpcToTile = (npc, tile, now) => {
  const npcData = getNpcData(npc?.npcId);
  if (!npcData?.movement || !tile || !Number.isFinite(now)) {
    return false;
  }

  const npcTile = getTilePosition(npc);
  if (!isWalkableTile(tile.row, tile.col, npcTile)) {
    return false;
  }

  const { tileX, tileY } = getWorldPosition(tile);
  if (!moveNpcInTileIndex(npc, tileX, tileY)) {
    return false;
  }

  npc.direction = getCardinalDirectionFromTileDelta(tile.col - npcTile.col, tile.row - npcTile.row, npc.direction);
  npc.walkFrame = (npc.walkFrame + 1) % npcData.animationFrames;
  npc.oldX = npc.x;
  npc.oldY = npc.y;
  npc.moveStartTime = now;
  npc.moveDuration = npcData.movement.moveCooldownMs;
  npc.x = tileX;
  npc.y = tileY;
  updateNpcSprite(npc);
  return true;
};

const updateNpcMovement = (now) => {
  const nearbyNpcs = getNpcsInChunkRadius(
    playerState.x,
    playerState.y,
    playerState.z,
    pixiWorldRenderState.visibleRadiusChunks,
  );
  for (const npc of nearbyNpcs) {
    const npcData = getNpcData(npc.npcId);
    const conversationState = npcConversationStatesByUid.get(npc.uid);
    if (
      npc.z !== playerState.z ||
      !npcData?.movement?.enabled ||
      conversationState?.activePlayerUid !== null ||
      now < npc.nextWanderAt
    ) {
      continue;
    }

    npc.nextWanderAt = now + getRandomInt(npcData.movement.intervalMinMs, npcData.movement.intervalMaxMs);
    const nextTile = getRandomNpcWanderTile(npc);
    if (nextTile) {
      moveNpcToTile(npc, nextTile, now);
    }
  }
};

/* ---------- NPCS - CONVERSATIONS ---------- */

const getPlayerEntityByUid = (playerUid) => {
  return playerState.uid === playerUid ? playerState : null;
};

const isPlayerWithinNpcTalkRange = (player, npc) => npcConversationSystem.isPlayerWithinTalkRange(player, npc);
const sayGreetingToNpc = (npc, player, now = Date.now()) => npcConversationSystem.sayGreeting(npc, player, now);
const handleNpcGreetingFromPointerTarget = (target) => npcConversationSystem.handleGreetingFromPointerTarget(target);
const getNpcReplySuggestions = (suggestions) => npcConversationSystem.getReplySuggestions(suggestions);
const showNpcConversationChat = () => {
  if (isMobileGameLayout() && mobileGameUiState.openPanel !== "chat") {
    setOpenMobilePanel("chat");
  }
  chatController.showChannel("local");
};
const handleNpcPlayerSpeech = (text, player, now) => {
  const action = createSpeakToNpcAction(text, player?.uid, now);
  const result = gameTransport.send(action);
  if (result && typeof result.then === "function") {
    handleGameActionResult(result, (resolvedResult) => {
      if (!resolvedResult?.success && resolvedResult?.reason !== "npc-not-in-range") {
        showGameStatusMessage(resolvedResult?.reason ?? "NPC interaction failed.");
      }
    });
    return true;
  }
  return result?.success === true;
};

const handleRemoteNpcSpeechEffect = (event) => {
  if (event.playerUid !== playerState.uid) {
    return;
  }
  const npc = npcsByUid.get(event.npcUid) ?? null;
  if (npc) {
    npcConversationSystem.presentSpeech(
      npc,
      event.text,
      event.suggestions ?? [],
      event.openChat !== false,
      event.conversationActive,
    );
  }
};

const handleChatMessageEffect = (event) => {
  if (!["local", "global", "trade"].includes(event.channelId) || typeof event.text !== "string") {
    return;
  }
  const speaker = {
    uid: event.playerUid,
    name: event.speakerName,
    level: event.speakerLevel,
    x: event.x,
    y: event.y,
    z: event.z,
  };
  addChatMessage(event.channelId, "player", event.text, speaker);
  if (event.channelId === chatController.getActiveChannelId()) {
    renderActiveChatMessages();
  }
  if (event.channelId === "local" && event.z === playerState.z) {
    showFloatingTextAboveTarget(event.text, 70, speaker, "speech", 4000);
  }
};

const handleChatSystemMessageEffect = (event) => {
  const channelId = ["global", "logs"].includes(event.channelId) ? event.channelId : "logs";
  if (typeof event.text !== "string" || event.text === "") {
    return;
  }
  addChatMessage(channelId, "system", event.text);
  if (channelId === chatController.getActiveChannelId()) {
    renderActiveChatMessages();
  }
  if (event.visibility === "global") {
    showGameStatusMessage(event.text);
  }
};
const updateNpcConversations = (now) => npcConversationSystem.updateConversations(now);

//#endregion  -----  NPCS  -----

/* ==================================================== */
//#region     -----  MONSTRES  -----
/* ==================================================== */
/* ---------- MONSTRES - CREATION ET AFFICHAGE ---------- */

const monsterHpRefresh = (monster) => {
  const monsterHp = findMonsterHpElement(monster.uid);
  if (monsterHp) {
    const monsterData = getMonsterData(monster.monsterId);
    monsterHp.style.width = `${(monster.hp / monsterData.maxHp) * 100}%`;
    monsterHp.style.setProperty("--hp-color", getHpColor(monster.hp, monsterData.maxHp));
  }
  if (monster?.uid === combatTargetState.monsterUid) {
    syncMobileTargetHud();
  }
};

const renderMonsters = (monstersList) => {
  for (let i = 0; i < monstersList.length; i++) {
    const monster = monstersList[i];
    if (!isMonsterInsideVisibleChunkRange(monster) || monsterElementsByUid.has(monster.uid)) {
      continue;
    }
   
    const div = document.createElement("div");
    const monsterData = getMonsterData(monster.monsterId);
    div.classList.add("monster");
    div.style.width = `${monsterData.drawWidth}px`;
    div.style.height = `${monsterData.drawHeight}px`;
    const monsterText = document.createElement("div");
    monsterText.classList.add("monster-floating-text-layer");
    const monsterName = document.createElement("div");
    monsterName.classList.add("monster-name");
    const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
    monsterName.textContent = localizedMonsterData.name;
    const hpContainer = document.createElement("div");
    hpContainer.classList.add("hp-bar");
    const hpRed = document.createElement("div");
    hpRed.classList.add("hp-red");
    hpRed.style.width = `${(monster.hp / monsterData.maxHp) * 100}%`;
    hpRed.style.setProperty("--hp-color", getHpColor(monster.hp, monsterData.maxHp));
    div.setAttribute("data-monster-uid", monster.uid);
    hpRed.setAttribute("data-monster-uid", monster.uid);
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (shouldBlockContextMenuAction()) {
        return;
      }

      selectMonster(monster);
    });
    const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
    div.style.left = `${monster.x - camera.x + monsterData.drawOffsetX}px`;
    div.style.top = `${monster.y - camera.y + monsterData.drawOffsetY - surfaceOffsetY}px`;
    div.style.zIndex = getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE);
    hpContainer.appendChild(hpRed);
    div.appendChild(monsterText);
    div.appendChild(monsterName);
    div.appendChild(hpContainer);
    monsterElementsByUid.set(monster.uid, {
      root: div,
      hp: hpRed,
      floatingText: monsterText,
    });
    game.appendChild(div);
    updateMonsterSprite(monster);
  }
};

const updateMonsterSprite = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  const col = monsterData.atlasCol + monster.walkFrame;
  const row = monsterData.atlasRow + getDirectionRow(monster.direction);
  const source = getAtlasSource(col, row, monsterData.spriteSize);
  const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
  upsertPixiMonsterVisual({
    uid: monster.uid,
    sourceX: source.sourceX,
    sourceY: source.sourceY,
    sourceWidth: source.sourceWidth,
    sourceHeight: source.sourceHeight,
    width: monsterData.drawWidth,
    height: monsterData.drawHeight,
    x: monster.renderX + monsterData.drawOffsetX,
    y: monster.renderY + monsterData.drawOffsetY - surfaceOffsetY,
    zIndex: getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE),
    selected: monster.uid === combatTargetState.monsterUid,
  });
};

const isMonsterInsideVisibleChunkRange = (monster) => {
  if (!monster || monster.z !== pixiWorldRenderState.currentZ) {
    return false;
  }

  const playerChunk = getChunkPositionFromWorldPosition(playerState.x, playerState.y);
  const monsterChunk = getChunkPositionFromWorldPosition(monster.x, monster.y);
  if (!playerChunk || !monsterChunk) {
    return false;
  }

  return (
    Math.abs(monsterChunk.chunkX - playerChunk.chunkX) <= pixiWorldRenderState.visibleRadiusChunks &&
    Math.abs(monsterChunk.chunkY - playerChunk.chunkY) <= pixiWorldRenderState.visibleRadiusChunks
  );
};

const syncMonsterRenderVisibility = (monster) => {
  if (!monster) {
    return;
  }

  if (isMonsterInsideVisibleChunkRange(monster)) {
    renderMonsters([monster]);
    return;
  }

  removeMonsterRender(monster.uid);
};

const syncVisibleMonsterRendersAroundPlayer = () => {
  const visibleMonsters = getMonstersInChunkRadius(
    playerState.x,
    playerState.y,
    pixiWorldRenderState.currentZ,
    pixiWorldRenderState.visibleRadiusChunks,
  );
  const visibleMonsterUids = new Set(visibleMonsters.map((monster) => monster.uid));

  for (const monsterUid of monsterElementsByUid.keys()) {
    if (!visibleMonsterUids.has(monsterUid)) {
      removeMonsterRender(monsterUid);
    }
  }

  renderMonsters(visibleMonsters);
};

const selectMonster = (monster) => {
  if (!monster) {
    return;
  }
  clearMonsterSelection();
  clearRemotePlayerSelection();
  if (monster.uid === combatTargetState.monsterUid) {
    combatTargetState.monsterUid = null;
    if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
      stopPlayerNavigation();
    }
    syncMobileTargetHud();
    return;
  }
  combatTargetState.monsterUid = monster.uid;
  selectMonsterElement(combatTargetState.monsterUid);
  syncMobileTargetHud();
  if (playerNavigationState.followEnabled) {
    startPlayerFollowNavigation("monster", monster.uid);
  }
};

const loseSelectedMonsterTarget = () => {
  if (combatTargetState.monsterUid === null) {
    return false;
  }

  combatTargetState.monsterUid = null;
  clearMonsterSelection();
  syncMobileTargetHud();

  const wasFollowing =
    playerNavigationState.followEnabled || playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow;

  playerNavigationState.followEnabled = false;
  stopPlayerNavigation();

  if (wasFollowing) {
    updatePlayerInventory();
  }

  showGameStatusMessage(getGameUiText("targetLost"));
  return true;
};

const isPlayerAtPosition = (x, y, z = pixiWorldRenderState.currentZ) => {
  return playerState.z === z && playerState.x === x && playerState.y === y;
};

const removeMonsterRender = (monsterUid) => {
  const monsterElement = findMonsterElement(monsterUid);
  if (monsterElement) {
    monsterElement.remove();
  }
  removePixiMonsterVisual(monsterUid);
  monsterElementsByUid.delete(monsterUid);
};
const clearMonsters = () => {
  for (const refs of monsterElementsByUid.values()) {
    refs?.root?.remove();
  }
  monsterElementsByUid.clear();
  clearPixiMonsterVisuals();
};

const updateMonsterDirection = (monster, tile) => {
  if (!monster || !tile) {
    return;
  }

  const monsterTile = getTilePosition(monster);
  const deltaCol = tile.col - monsterTile.col;
  const deltaRow = tile.row - monsterTile.row;

  monster.direction = getCardinalDirectionFromTileDelta(deltaCol, deltaRow, monster.direction);
};

/* ---------- MONSTRES - SELECTION ET MORT ---------- */

const clearMonsterSelection = () => {
  clearPixiMonsterSelection();
};

const createMonsterCorpse = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData || !monsterData.corpseItemId) {
    return null;
  }
  const lootContent = generateMonsterLoot(monsterData);
  const corpse = createGroundItem(monsterData.corpseItemId, 1, monster.x, monster.y, monster.z, lootContent);
  if (!corpse || !addWorldItemToState(corpse)) {
    return null;
  }
  return { corpse, lootContent };
};

const clearSelectedMonsterIfNeeded = (monster) => {
  if (!monster || combatTargetState.monsterUid === null) {
    return;
  }
  if (combatTargetState.monsterUid === monster.uid) {
    combatTargetState.monsterUid = null;
    if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
      stopPlayerNavigation();
    }
    syncMobileTargetHud();
  }
};

const handleMonsterDeath = (monster, now) => {
  setMonsterDeadState(monster);
  const corpseResult = createMonsterCorpse(monster);
  if (decreaseMonsterSpawnAliveCount(monster)) {
    scheduleMonsterRespawn(monster.spawnId, now);
  }
  removeMonsterFromState(monster.uid);
  return {
    corpseUid: corpseResult?.corpse.uid ?? null,
    lootContent: corpseResult?.lootContent ?? [],
  };
};

const spawnInitialMonstersForWorldMap = (worldMap) => {
  const spawnZones = getMonsterSpawnZonesFromWorldMap(worldMap);

  for (const spawnZone of spawnZones) {
    const spawnDefinition = registerMonsterSpawnDefinition(worldMap, spawnZone);
    if (!spawnDefinition) {
      continue;
    }

    for (let i = 0; i < spawnDefinition.maxCount; i++) {
      const monster = spawnMonsterFromZone(worldMap, spawnZone);
      if (!monster) {
        scheduleMonsterRespawnAt(spawnDefinition.spawnId, Date.now() + MONSTER_RESPAWN_CONFIG.blockedRetryMs);
      }
    }
  }
};

const spawnInitialMonstersForWorldMaps = (worldMapsByZ) => {
  if (!(worldMapsByZ instanceof Map)) {
    return;
  }

  for (const worldMap of worldMapsByZ.values()) {
    spawnInitialMonstersForWorldMap(worldMap);
  }
};

const setMonsterDeadState = (monster) => {
  monster.hp = 0;
};

const findMonsterByUid = (monsterUid) => {
  return monstersByUid.get(monsterUid) ?? null;
};

const selectMonsterElement = (monsterUid) => {
  setPixiMonsterSelected(monsterUid, true);
};

const findMonsterElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;

  return refs?.root ?? null;
};

const findMonsterHpElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;
  return refs?.hp ?? null;
};

const generateMonsterLoot = (monsterData) => {
  const lootContent = [];
  if (!monsterData.loot || !Array.isArray(monsterData.loot)) {
    return lootContent;
  }
  monsterData.loot.forEach((loot) => {
    const random = getRandomInt(1, 100);
    if (random <= loot.chance) {
      const quantity = getRandomInt(loot.minQuantity, loot.maxQuantity);
      const item = createItemInstance(loot.itemId, quantity);
      if (item) {
        lootContent.push(item);
      }
    }
  });
  return lootContent;
};

const formatLootItemText = (lootItem) => {
  if (!lootItem) {
    return getGameUiText("unknownItem");
  }
  const itemData = getLocalizedItemData(lootItem.itemId);
  if (!itemData) {
    return getGameUiText("unknownItem");
  }
  if ("quantity" in lootItem && lootItem.quantity > 1) {
    return `${lootItem.quantity} ${getLocalizedItemName(lootItem.itemId, lootItem.quantity)}`;
  } else {
    return `${itemData.name}`;
  }
};

const formatLootLogMessage = (lootItems, sourceName = null) => {
  if (!lootItems || isEmpty(lootItems)) {
    if (sourceName != null) {
      return getGameUiText("lootFromNothing")(sourceName);
    } else {
      return getGameUiText("lootNothing");
    }
  }

  const lootItemsList = [];
  for (const lootItem of lootItems) {
    lootItemsList.push(formatLootItemText(lootItem));
  }
  const itemsText = lootItemsList.join(", ");
  return sourceName != null
    ? getGameUiText("lootFromList")(sourceName, itemsText)
    : getGameUiText("lootList")(itemsText);
};

const addLootLogMessage = (lootItems, sourceName = null) => {
  const logMessage = formatLootLogMessage(lootItems, sourceName);
  addLogMessage(logMessage, "loot");
};

/* ---------- MONSTRES - COMBAT POSITION MOUVEMENT ---------- */
const updateMonsterActivityState = (monster) => monsterAiSystem.updateActivityState(monster);
const getMonsterTarget = (monster) => monsterAiSystem.getTarget(monster);
const setMonsterTarget = (monster, target) => monsterAiSystem.setTarget(monster, target);
const clearMonsterTarget = (monster) => monsterAiSystem.clearTarget(monster);
const updateMonsterCombat = (now, activeMonsters) => {
  activeMonsters.forEach((monster) => {
    if (
      !monster.isAwake ||
      monster.state !== MONSTER_AI_STATE.combat ||
      monster.targetUid !== playerState.uid ||
      monster.z !== playerState.z
    ) {
      return;
    }

    if (!isNearPlayer(monster, 1)) {
      monster.state = MONSTER_AI_STATE.chase;
      return;
    }

    if (now < monster.nextAttackTime) {
      return;
    }

    const monsterData = getMonsterData(monster.monsterId);
    if (!monsterData) {
      return;
    }

    monster.nextAttackTime = now + MONSTER_ATTACK_COOLDOWN_MS;

    const attackResult = calculateDamageTakenByPlayer(monsterData.combat, now);

    if (attackResult.finalDamage > 0) {
      applyDamageToPlayer(playerState, attackResult.finalDamage);
      const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
      const logMessage = getGameUiText("damageTaken")(attackResult.finalDamage, localizedMonsterData.name);
      addLogMessage(logMessage, "combat");
    }

    showFloatingTextAbovePlayer(attackResult.text, attackResult.textType);
    if (attackResult.textType === "block") {
      playGameSfx(GAME_SFX.block);
    } else if (attackResult.textType === "absorb") {
      playGameSfx(GAME_SFX.armorBlock);
    }
    refreshPlayerVitalsUi();

    if (playerState.hp <= 0) {
      refreshPlayerVitalsUi();
      playerDead();
    }
  });
};

const updateMonsterPosition = () => {
  for (const [monsterUid, refs] of monsterElementsByUid.entries()) {
    const monster = monstersByUid.get(monsterUid);
    if (!monster) {
      removeMonsterRender(monsterUid);
      continue;
    }
    // Refresh sprite when direction or walkFrame changed (e.g. from replicated server state)
    if (refs.lastDirection !== monster.direction || refs.lastWalkFrame !== monster.walkFrame) {
      updateMonsterSprite(monster);
      refs.lastDirection = monster.direction;
      refs.lastWalkFrame = monster.walkFrame;
    }
    const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
    const monsterData = getMonsterData(monster.monsterId);
    const monsterElement = refs.root;
    const renderX = monster.renderX + monsterData.drawOffsetX;
    const renderY = monster.renderY + monsterData.drawOffsetY - surfaceOffsetY;
    const zIndex = getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE);

    updatePixiMonsterTransform(monster.uid, renderX, renderY, zIndex);

    if (monsterElement) {
      const nextLeft = `${renderX - camera.x}px`;
      const nextTop = `${renderY - camera.y}px`;
      if (refs.lastLeft !== nextLeft) {
        monsterElement.style.left = nextLeft;
        refs.lastLeft = nextLeft;
      }
      if (refs.lastTop !== nextTop) {
        monsterElement.style.top = nextTop;
        refs.lastTop = nextTop;
      }
      if (refs.lastZIndex !== zIndex) {
        monsterElement.style.zIndex = zIndex;
        refs.lastZIndex = zIndex;
      }
    }
  }
};

const updateMonsterMovement = (now, activeMonsters) => monsterAiSystem.updateMovement(now, activeMonsters);
//#endregion  -----  MONSTRES  -----

/* ==================================================== */
//#region     -----  RENDER - POSITIONS VISUELLES ET UPDATE MONDE  -----
/* ==================================================== */
/* ---------- RENDER - INITIALISATION DU MONDE ---------- */

const renderInitialWorld = () => {
  updateRenderCamera();
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  syncVisibleRemotePlayerRenders();
  updateWorldRender();
};

/* ---------- RENDER - INTERPOLATION VISUELLE ---------- */

const isValidRemoteRenderState = (renderState) => {
  return (
    renderState &&
    Number.isFinite(renderState.renderX) &&
    Number.isFinite(renderState.renderY) &&
    Number.isInteger(renderState.z)
  );
};

const snapEntityRenderToLogicalPosition = (entity) => {
  if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) {
    return false;
  }

  entity.renderX = entity.x;
  entity.renderY = entity.y;
  entity.oldX = entity.x;
  entity.oldY = entity.y;
  entity.moveStartTime = 0;
  entity.moveDuration = 0;

  return true;
};

const isValidRemoteEntityUid = (uid) => Number.isInteger(uid) || (typeof uid === "string" && uid !== "");

const getRemoteEntityAnimationFrameCount = (entity, entityType) => {
  if (entityType === "monsters") {
    const monsterData = getMonsterData(entity?.monsterId);

    if (Number.isInteger(monsterData?.animationFrames) && monsterData.animationFrames > 0) {
      return monsterData.animationFrames;
    }

    return 1;
  }

  if (entityType === "players" || entityType === "npcs") {
    return PLAYER_ANIMATION_FRAMES;
  }

  return 1;
};

const updateRemoteNetworkWalkFrame = (entity, entityType) => {
  if (!entity || !Number.isFinite(entity.networkMoveProgress)) {
    return false;
  }

  const frameCount = getRemoteEntityAnimationFrameCount(entity, entityType);

  if (!Number.isInteger(frameCount) || frameCount <= 1) {
    if (entity.walkFrame !== 0) {
      entity.walkFrame = 0;
      return true;
    }

    return false;
  }

  const progress = clamp(entity.networkMoveProgress, 0, 0.999);
  const nextWalkFrame = Math.min(frameCount - 1, Math.floor(progress * frameCount));

  if (entity.walkFrame === nextWalkFrame) {
    return false;
  }

  entity.walkFrame = nextWalkFrame;
  return true;
};

const applyRemoteInterpolatedRenderState = (entity, entityType, now) => {
  if (
    !gameRuntimeState.isRemoteSession ||
    !REMOTE_INTERPOLATED_ENTITY_TYPES.has(entityType) ||
    !isValidRemoteEntityUid(entity?.uid)
  ) {
    return false;
  }

  const wasApplied = remoteEntityInterpolationStore.applyRenderState(entityType, entity, now);

  if (!wasApplied) {
    return false;
  }

  if (!Number.isFinite(entity.renderX) || !Number.isFinite(entity.renderY) || !Number.isInteger(entity.z)) {
    snapEntityRenderToLogicalPosition(entity);
    return true;
  }

  const didChangeWalkFrame = updateRemoteNetworkWalkFrame(entity, entityType);

  if (didChangeWalkFrame) {
    if (entityType === "monsters") {
      updateMonsterSprite(entity);
    } else if (entityType === "npcs") {
      updateNpcSprite(entity);
    }
  }

  return true;
};

const updateEntityRenderPosition = (entity, now, entityType = null) => {
  if (entityType && applyRemoteInterpolatedRenderState(entity, entityType, now)) {
    return false;
  }

  if (entity.moveDuration <= 0) {
    snapEntityRenderToLogicalPosition(entity);
    return false;
  } else {
    const rawProgress = (now - entity.moveStartTime) / entity.moveDuration;
    const progress = clamp(rawProgress, 0, 1);
    const distanceX = entity.x - entity.oldX;
    const distanceY = entity.y - entity.oldY;
    entity.renderX = entity.oldX + distanceX * progress;
    entity.renderY = entity.oldY + distanceY * progress;

    if (progress >= 1) {
      entity.moveDuration = 0;
      return true;
    }
  }

  return false;
};

const updateRenderPositions = (now) => {
  updateEntityRenderPosition(playerState, now);

  for (const monsterUid of monsterElementsByUid.keys()) {
    const monster = monstersByUid.get(monsterUid);
    if (monster) {
      const didFinishMoving = updateEntityRenderPosition(monster, now, "monsters");

      if (didFinishMoving && monster.walkFrame !== 1) {
        monster.walkFrame = 1;
        updateMonsterSprite(monster);
      }
    }
  }

  for (const npcUid of npcElementsByUid.keys()) {
    const npc = npcsByUid.get(npcUid);
    if (npc) {
      const didFinishMoving = updateEntityRenderPosition(npc, now, "npcs");

      if (didFinishMoving && npc.walkFrame !== 1) {
        npc.walkFrame = 1;
        updateNpcSprite(npc);
      }
    }
  }

  for (const remotePlayer of playersByUid.values()) {
    const didFinishMoving = updateEntityRenderPosition(remotePlayer, now, "players");

    if (didFinishMoving) {
      remotePlayer.walkFrame = 1;
    } else if (remotePlayer.moveDuration > 0) {
      const progress = clamp((now - remotePlayer.moveStartTime) / remotePlayer.moveDuration, 0, 0.999);
      remotePlayer.walkFrame = Math.floor(progress * PLAYER_ANIMATION_FRAMES);
    }
  }
};

/* ---------- RENDER - GROUPES DE MISE A JOUR ---------- */

const updateRenderCamera = () => {
  updateCamera();
  updatePixiCamera(camera.x, camera.y);
  if (mousePosition.screenX !== null && mousePosition.screenY !== null) {
    updateMousePositionInfo(mousePosition.screenX, mousePosition.screenY);
  }
};

const updateRenderWorldItems = () => {
  updateItemPosition();
};

const creaturePlayerListBuffer = [];
const updateRenderCreatures = () => {
  updateMonsterPosition();
  updateNpcPosition();
  creaturePlayerListBuffer.length = 0;
  creaturePlayerListBuffer.push(playerState);
  for (const remotePlayer of playersByUid.values()) {
    creaturePlayerListBuffer.push(remotePlayer);
  }
  const tileStackRenderOffsets = getPlayerTileStackRenderOffsets(creaturePlayerListBuffer);
  for (const remotePlayer of playersByUid.values()) {
    updateRemotePlayerVisual(remotePlayer, tileStackRenderOffsets);
  }
  updatePlayerPosition(camera, tileStackRenderOffsets.get(playerState.uid) ?? 0);
};

const updateRenderLight = () => {
  updateLight(playerState);
};

const updatePixiVisibleChunksAroundPlayer = async () => {
  if (!(pixiWorldRenderState?.worldMapsByZ instanceof Map)) {
    return;
  }
  const actualMap = pixiWorldRenderState.worldMapsByZ.get(pixiWorldRenderState.currentZ);
  const playerChunkPosition = getChunkPositionFromWorldPosition(playerState.x, playerState.y);
  if (!actualMap || !playerChunkPosition) {
    return;
  }
  if (
    pixiWorldRenderState.currentZ === pixiWorldRenderState.lastPlayerZ &&
    playerChunkPosition.chunkX === pixiWorldRenderState.lastPlayerChunkX &&
    playerChunkPosition.chunkY === pixiWorldRenderState.lastPlayerChunkY
  ) {
    return;
  }

  await renderPixiVisibleWorldChunks(
    actualMap,
    playerChunkPosition.chunkX,
    playerChunkPosition.chunkY,
    pixiWorldRenderState.visibleRadiusChunks,
  );

  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  syncVisibleRemotePlayerRenders();
  pixiWorldRenderState.lastPlayerZ = pixiWorldRenderState.currentZ;
  pixiWorldRenderState.lastPlayerChunkX = playerChunkPosition.chunkX;
  pixiWorldRenderState.lastPlayerChunkY = playerChunkPosition.chunkY;
};

const updateWorldRender = () => {
  updateRenderCamera();
  renderPlayerMinimap();
  updateFloatingTextPositions();
  updateRenderWorldItems();
  updateRenderCreatures();
  if (itemUseState.isUsingItem) {
    syncItemUseTargetIndicators();
  }
  updateRenderLight();
};

const getSkillExperienceGainFromAttack = (attackResult, skillKey, now) => {
  if (!skillKey || !(skillKey in playerState.skills) || !attackResult || !attackResult.didHit) {
    return 0;
  }
  const baseGain = SKILL_EXPERIENCE_GAIN_PER_TRY;
  const expMultiplier = getSkillExperienceGainMultiplier(skillKey);
  const finalExp = normalizeSkillExperienceGain(baseGain * expMultiplier);

  if (attackResult.finalDamage > 0) {
    refreshSkillTrainingTimer(now);
    return finalExp;
  } else {
    if (isSkillTrainingTimerActive(now)) {
      return finalExp;
    }
  }
  return 0;
};

const applySkillExperienceFromAttack = (attackResult, skillKey, now) => {
  const finalExp = getSkillExperienceGainFromAttack(attackResult, skillKey, now);
  if (!finalExp) {
    return false;
  }
  applyExperienceToPlayerSkill(skillKey, finalExp);
  return true;
};

const consumePlayerWeaponAmmunition = () => {
  const weaponCombatData = getEquippedWeaponCombatData();
  const ammunitionItemId = weaponCombatData?.ammunitionItemId;
  if (!ammunitionItemId) {
    return true;
  }

  const ammunition = playerState.equipment.shield;
  if (ammunition?.itemId !== ammunitionItemId || ammunition.quantity <= 0) {
    showGameStatusMessage(getGameUiText("arrowsRequired"));
    return false;
  }

  if (ammunition.quantity > 1) {
    ammunition.quantity -= 1;
  } else {
    playerState.equipment.shield = null;
  }
  refreshInventoryUi();
  return true;
};

const playPlayerWeaponProjectile = (target) => {
  const weaponCombatData = getEquippedWeaponCombatData();
  if (!weaponCombatData?.projectileItemId || !target) {
    return false;
  }
  const projectileParts = getItemRenderData({
    itemId: weaponCombatData.projectileItemId,
    quantity: 1,
  });
  const projectilePart = projectileParts[0];
  const playerRenderPosition = getItemUseTargetRenderPosition(playerState);
  const targetRenderPosition = getItemUseTargetRenderPosition(target);
  if (!projectilePart || !playerRenderPosition || !targetRenderPosition) {
    return false;
  }

  return playPixiItemProjectile({
    sourceX: projectilePart.sourceX,
    sourceY: projectilePart.sourceY,
    sourceWidth: projectilePart.sourceWidth,
    sourceHeight: projectilePart.sourceHeight,
    startX: playerRenderPosition.x + TILE_SIZE / 2,
    startY: playerRenderPosition.y + TILE_SIZE / 2,
    targetX: targetRenderPosition.x + TILE_SIZE / 2,
    targetY: targetRenderPosition.y + TILE_SIZE / 2,
    displaySize: 48,
    rotationOffset: Math.PI / 4,
    speedPixelsPerSecond: 1000,
  });
};

const calculateDamageTakenByPlayer = (attackerCombatData, now) => {
  const combatModeData = getCombatModeData();
  const playerArmor = getPlayerTotalArmor();
  const playerShieldDefense = getPlayerShieldDefense();
  const shielding = playerState.skills.shielding.level;
  //!!!!! CHANCE MONSTRE HIT !!!!
  let hitChance = attackerCombatData.hitChance - shielding * 0.4;
  hitChance = clamp(hitChance, 35, 95);
  const roll = getRandomInt(1, 100);
  if (roll > hitChance)
    return {
      didHit: false,
      wasBlocked: false,
      finalDamage: 0,
      text: "miss",
      textType: "miss",
    };
  //!!!!! BLOCK CHANCE && DAMAGE REDUCTION !!!!
  let attackerAttack = 1;
  if (attackerCombatData && Number.isFinite(attackerCombatData.attack)) {
    attackerAttack = Math.max(1, attackerCombatData.attack);
  }
  const rawDamage = getRandomFloat(1, attackerAttack);
  let wasBlocked = false;
  let blockChance = 10 + shielding * 0.8 + playerShieldDefense * 0.8;
  blockChance *= combatModeData.blockChanceMultiplier;
  blockChance = clamp(blockChance, 5, 70);
  let defensePower = 0;
  let defenseReduction = 0;
  if (hasPlayerBlockSource() && canUseShieldingBlock(now)) {
    recordShieldingBlock(now);
    const shield = playerState.equipment.shield;
    const shieldData = shield ? getItemData(shield.itemId) : null;
    if (Number.isFinite(shieldData?.combat?.shieldDefense)) {
      applyShieldingExperienceFromBlockAttempt(now);
    }
    const rollBlock = getRandomInt(1, 100);
    if (rollBlock <= blockChance) {
      wasBlocked = true;
      defensePower = playerShieldDefense * 0.25 + shielding * 0.1;
      defensePower *= combatModeData.defenseMultiplier;
      defenseReduction = getRandomFloat(defensePower * 0.6, defensePower * 1.2);
    }
  }
  const damageAfterDefense = rawDamage - defenseReduction;
  if (damageAfterDefense <= 0) {
    return {
      didHit: true,
      wasBlocked,
      finalDamage: 0,
      text: "block",
      textType: "block",
    };
  }
  //!!!!! ARMOR REDUCTION !!!!
  const armorPower = playerArmor * combatModeData.armorMultiplier;
  const armorReductionMin = armorPower * 0.2;
  const armorReductionMax = armorPower * 0.45;
  const armorReduction = getRandomFloat(armorReductionMin, armorReductionMax);
  const damageAfterArmor = damageAfterDefense - armorReduction;
  const finalDamage = Math.max(0, Math.floor(damageAfterArmor));
  if (finalDamage <= 0) {
    return {
      didHit: true,
      wasBlocked,
      finalDamage: 0,
      text: "0",
      textType: "absorb",
    };
  } else {
    return {
      didHit: true,
      wasBlocked,
      rawDamage,
      defenseReduction,
      armorReduction,
      finalDamage,
      text: finalDamage,
      textType: "damage",
    };
  }
};

/* ---------- COMBAT - SORTS ---------- */

const getSpellFromChatText = (text) => playerSpellSystem.getFromChatText(text);
const castLearnedPlayerSpellById = (spellId) => {
  const action = createCastSpellAction(spellId, Date.now());
  const result = gameTransport.send(action);
  if (result && typeof result.then === "function") {
    handleGameActionResult(result, (resolvedResult) => playerSpellSystem.presentCastResult(spellId, resolvedResult));
    return true;
  }
  return playerSpellSystem.presentCastResult(spellId, result);
};
const castPlayerSpellFromHotkeyKey = (key) => {
  const spellId = playerSpellSystem.getHotkeySpellId(key);
  return spellId ? castLearnedPlayerSpellById(spellId) : false;
};

const getExperienceRewardFromMonster = (monster) => {
  if (!monster) {
    return 0;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return 0;
  }
  if (!("experience" in monsterData)) {
    return 0;
  }
  return monsterData.experience;
};

const addExperienceGainFeedback = (experienceAmount, sourceName = null) => {
  if (!Number.isFinite(experienceAmount)) {
    return;
  }
  let logMessage = getGameUiText("experienceGained")(experienceAmount);
  if (sourceName != null) {
    logMessage = getGameUiText("experienceGainedFrom")(experienceAmount, sourceName);
  }
  addLogMessage(logMessage, "experience");
};

const applyExperienceToPlayer = (experience) => {
  if (!Number.isFinite(experience) || experience <= 0) {
    return false;
  }

  playerState.experience += experience;
  return true;
};

const applyExperienceToPlayerFromMonster = (monster) => {
  if (!monster) {
    return 0;
  }
  const monsterExperienceReward = getExperienceRewardFromMonster(monster);
  if (monsterExperienceReward <= 0) {
    return 0;
  }
  return applyExperienceToPlayer(monsterExperienceReward) ? monsterExperienceReward : 0;
};

const createMonsterBloodPuddle = (monster, monsterData, decayStage) => {
  if (!monster || typeof monsterData?.bloodEffectId !== "string") {
    return null;
  }
  return createFluidPuddle(monsterData.bloodEffectId, monster.x, monster.y, monster.z, decayStage);
};

const applyDamageToMonster = (monster, attackResult, now) => {
  if (!monster || monster.hp <= 0) {
    return { success: false, reason: "target-lost" };
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return { success: false, reason: "monster-data-not-found" };
  }
  const targetRenderSnapshot = {
    uid: monster.uid,
    monsterId: monster.monsterId,
    x: monster.x,
    y: monster.y,
    z: monster.z,
    renderX: monster.renderX,
    renderY: monster.renderY,
  };
  const healthBeforeDamage = monster.hp;
  const healthResult = applyDamageToMonsterHealth(monster, attackResult?.finalDamage);
  if (!healthResult.success) {
    return { success: false, reason: "no-damage" };
  }
  const bloodDecayStage = healthResult.damageApplied >= healthBeforeDamage ? 0 : 1;
  const bloodPuddle = createMonsterBloodPuddle(monster, monsterData, bloodDecayStage);
  let deathResult = null;
  let experienceReward = 0;
  if (healthResult.didDie) {
    deathResult = handleMonsterDeath(monster, now);
    experienceReward = applyExperienceToPlayerFromMonster(monster);
  }

  return {
    success: true,
    changes: {
      monsterUid: monster.uid,
      damageApplied: healthResult.damageApplied,
      hp: healthResult.hp,
      didDie: healthResult.didDie,
      experienceReward,
      corpseUid: deathResult?.corpseUid ?? null,
    },
    events: [
      {
        type: "monster-damage-resolved",
        monsterUid: monster.uid,
        monsterId: monster.monsterId,
        damageApplied: healthResult.damageApplied,
        textType: attackResult.textType,
        didDie: healthResult.didDie,
        groundEffectUid: bloodPuddle?.uid ?? null,
        corpseUid: deathResult?.corpseUid ?? null,
        lootContent: deathResult?.lootContent ?? [],
        experienceReward,
        targetRenderSnapshot,
      },
    ],
  };
};

/* ---------- COMBAT JOUEUR - ATTAQUE ET MISE A JOUR ---------- */

const playPlayerAttackResultSfx = (attackResult) => {
  if (!attackResult?.didHit) {
    return false;
  }
  if (attackResult.textType === "block") {
    return playGameSfx(GAME_SFX.block);
  }
  if (attackResult.textType === "absorb") {
    return playGameSfx(GAME_SFX.armorBlock);
  }
  if (attackResult.finalDamage <= 0) {
    return false;
  }

  const weaponType = getEquippedWeaponCombatData()?.weaponType ?? "fist";
  const attackSfxByWeaponType = {
    bow: GAME_SFX.arrowAttack,
    sword: GAME_SFX.swordSlice,
    mace: GAME_SFX.maceSlice,
    axe: GAME_SFX.axeSlice,
  };
  const attackSfx = attackSfxByWeaponType[weaponType];
  if (!attackSfx) {
    return false;
  }
  return playGameSfx(attackSfx);
};

const attackMonster = (monster, now) => {
  if (
    playerNavigationState.followEnabled &&
    combatTargetState.monsterUid === monster.uid &&
    playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.follow
  ) {
    startPlayerFollowNavigation();
  }

  if (!consumePlayerWeaponAmmunition()) {
    return { success: false, reason: "ammunition-required" };
  }

  const attackResult = calculatePlayerAttackResult(monster);
  const skillKey = getPlayerAttackSkillKey();
  applySkillExperienceFromAttack(attackResult, skillKey, now);
  const targetRenderSnapshot = {
    x: monster.x,
    y: monster.y,
    z: monster.z,
    renderX: monster.renderX,
    renderY: monster.renderY,
  };

  const damageResult = attackResult.finalDamage > 0 ? applyDamageToMonster(monster, attackResult, now) : null;
  return {
    success: true,
    changes: {
      monsterUid: monster.uid,
      finalDamage: attackResult.finalDamage,
      didHit: attackResult.didHit,
    },
    events: [
      {
        type: "player-attack-resolved",
        monsterUid: monster.uid,
        attackResult,
        targetRenderSnapshot,
      },
      ...(damageResult?.events ?? []),
    ],
  };
};

const updateCombat = (now) => {
  if (combatTargetState.playerUid !== null) {
    const targetPlayer = playersByUid.get(combatTargetState.playerUid) ?? null;
    if (!targetPlayer || targetPlayer.z !== playerState.z || targetPlayer.hp <= 0) {
      clearRemotePlayerSelection();
      syncMobileTargetHud();
      showGameStatusMessage(getGameUiText("targetLost"));
      return;
    }
    if (!canInitiatePlayerPvpAttack(playerState, targetPlayer, now)) {
      clearRemotePlayerSelection();
      syncMobileTargetHud();
      showGameStatusMessage(getGameUiText("pvpRequiresBothPlayers"));
      return;
    }
    if (!isNearPlayer(targetPlayer, getPlayerAttackRange()) || now < gameplayTimingState.nextPlayerAttackTime) {
      return;
    }
    const action = createAttackPlayerAction(targetPlayer.uid, now);
    gameplayTimingState.nextPlayerAttackTime = now + PLAYER_ATTACK_COOLDOWN_MS;
    handleGameActionResult(gameTransport.send(action), (result) => {
      if (!result?.success && result?.reason === "pvp-disabled") {
        showGameStatusMessage(getGameUiText("pvpRequiresBothPlayers"));
      }
    });
    return;
  }
  if (combatTargetState.monsterUid === null) {
    return;
  }
  const monster = findMonsterByUid(combatTargetState.monsterUid);
  if (!monster) {
    loseSelectedMonsterTarget();
    return;
  }
  if (!isNearPlayer(monster, getPlayerAttackRange())) {
    return;
  }
  if (now < gameplayTimingState.nextPlayerAttackTime) {
    return;
  }
  const weaponCombatData = getEquippedWeaponCombatData();
  if (weaponCombatData?.projectileItemId && !hasPlayerLineOfSightToEntity(monster)) {
    return;
  }
  const attackAction = createAttackMonsterAction(monster.uid, now);
  gameplayTimingState.nextPlayerAttackTime = now + PLAYER_ATTACK_COOLDOWN_MS;
  gameTransport.send(attackAction);
};
//#endregion  -----  COMBAT - JOUEUR, MONSTRES ET RUNES  -----

/* ==================================================== */
//#region     -----  CHAT / MESSAGE  -----
/* ==================================================== */

const addChatMessage = (channelId, messageType, text, speakerData = null, speechSuggestions = []) =>
  chatController.addMessage(channelId, messageType, text, speakerData, speechSuggestions);

const renderActiveChatMessages = () => chatController.renderMessages();
const sendPlayerChatMessage = (text) => chatController.sendPlayerMessage(text);
const refreshChatUi = () => chatController.render();
const addChatInputHistoryEntry = (text) => chatController.addHistoryEntry(text);
const navigateChatInputHistory = (direction) => chatController.navigateHistory(direction);
const handleChatInputSubmit = () => chatController.submitInput();
const focusChatInput = () => chatController.focusInput();
const blurChatInput = () => chatController.blurInput();
const isChatInputFocused = () => chatController.isInputFocused();
const addLogMessage = (text, messageType) => chatController.addLogMessage(text, messageType);

//#endregion  -----  CHAT / MESSAGE  -----

/* ==================================================== */
//#region     -----  EVENEMENTS DU JEU  -----
/* ==================================================== */
/* ---------- EVENEMENTS - SOURIS ET MENU CONTEXTE ---------- */

const handlePlayerNavigationClick = (e) => {
  if (
    !gameRuntimeState.isStarted ||
    characterSelectorUiState.isOpen ||
    e.button !== 0 ||
    e.target.closest(".quest-window") ||
    e.target.closest(".options-window")
  ) {
    return false;
  }

  if (inputState.shouldBlockNextWorldClick) {
    inputState.shouldBlockNextWorldClick = false;
    return true;
  }

  if (dragState.isDragging || itemUseState.isUsingItem || inputState.isLookComboTriggered) {
    return false;
  }

  const target = getPointerTargetFromEvent(e);
  if (!target?.pointerInsideMap || !target.tile) {
    return false;
  }

  startPlayerClickNavigation(target.tile);
  return true;
};

boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!gameRuntimeState.isStarted || characterSelectorUiState.isOpen) {
    return;
  }
  if (shouldBlockContextMenuAction()) {
    return;
  }
  const target = getPointerTargetFromEvent(e);
  if (target?.player && target.player.uid !== playerState.uid) {
    selectRemotePlayer(target.player);
    return;
  }
  if (handleNpcGreetingFromPointerTarget(target)) {
    return;
  }
  if (handleInteractableContextMenu(target)) {
    return;
  }
  if (handleTransitionContextMenu(target)) {
    return;
  }
});
boiteJeux.addEventListener("mousedown", (e) => {
  e.preventDefault();
  blurActiveTextInput();
});
boiteJeux.addEventListener("mouseup", (e) => {
  e.preventDefault();
});
game.addEventListener("click", (e) => {
  e.preventDefault();
  handlePlayerNavigationClick(e);
});
minimapCanvas?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  startMinimapPan(e);
});
minimapCanvas?.addEventListener("pointermove", (e) => {
  e.preventDefault();
  e.stopPropagation();
  updateMinimapPan(e);
});
minimapCanvas?.addEventListener("pointerup", (e) => {
  e.preventDefault();
  e.stopPropagation();
  finishMinimapPan(e, true);
});
minimapCanvas?.addEventListener("pointercancel", (e) => {
  e.preventDefault();
  e.stopPropagation();
  finishMinimapPan(e, false);
});
minimapCanvas?.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    adjustMinimapZoom(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);
minimapZoomOutButton?.addEventListener("click", (e) => {
  e.preventDefault();
  adjustMinimapZoom(-1);
});
minimapZoomInButton?.addEventListener("click", (e) => {
  e.preventDefault();
  adjustMinimapZoom(1);
});
minimapCenterButton?.addEventListener("click", (e) => {
  e.preventDefault();
  centerMinimapOnPlayer();
});
minimapFloorUpButton?.addEventListener("click", (e) => {
  e.preventDefault();
  changeMinimapFloor(1);
});
minimapFloorDownButton?.addEventListener("click", (e) => {
  e.preventDefault();
  changeMinimapFloor(-1);
});
boiteJeux.addEventListener("click", (e) => {
  e.preventDefault();
});
characterSelector?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
characterSelector?.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});
characterSelector?.addEventListener("click", (e) => {
  e.stopPropagation();
});
characterSelector?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("click", (e) => {
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
playerSpells?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("pointerup", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("click", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    handleChatInputSubmit();
    blurChatInput();
    return;
  } else if (e.key === "ArrowUp") {
    if (navigateChatInputHistory(-1)) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  } else if (e.key === "ArrowDown") {
    if (navigateChatInputHistory(1)) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    blurChatInput();
    return;
  }
});

document.addEventListener("focusin", (e) => {
  if (e.target?.matches("input, textarea")) {
    resetMovementKeys();
  }
});

document.addEventListener("mouseup", (e) => {
  if (!dragState.isDragging) {
    resetDragStatePending();
    return;
  }

  if (e.target.closest(".container-slot") || e.target.closest("[data-equipment-slot]") || e.target.closest(".hitbox")) {
    return;
  }

  cancelItemDrag();
});

const updateGameLogic = (now) => gameSystemsOrchestrator.update(now);
const renderGameFrame = (now) => gameSystemsOrchestrator.render(now);

//#endregion  -----  BOUCLE DE JEU  -----

/* ==================================================== */
//#region     -----  INITIALISATION DU JEU  -----
/* ==================================================== */
/* ---------- INITIALISATION - DONNEES TEST ---------- */
const setupTestWorld = () => {
  for (const worldItem of createInitialWorldItems(playerState.z)) {
    addGroundItem(worldItem);
  }
};

const setupTestPlayerInventory = () => {
  applyPlayerStarterKit(playerState);
};

/* ---------- INITIALISATION - UI JOUEUR ---------- */
gameSystemsOrchestrator = createGameSystemsOrchestrator({
  createLogicContext: (now) => ({
    now,
    activeMonsters: gameRuntimeState.isRemoteSession ? null : getActiveMonstersAroundPlayer(),
  }),
  logicSystems: [
    ({ now }) => updatePlayerFollowNavigation(now),
    ({ now }) => updatePlayerActionNavigation(now),
    ({ now }) => updateMovement(now),
    ({ now }) => updateCombat(now),
    ({ now }) => !gameRuntimeState.isRemoteSession && updatePlayerRegeneration(now),
    ({ now }) => !gameRuntimeState.isRemoteSession && updateNpcConversations(now),
    ({ now }) => !gameRuntimeState.isRemoteSession && updateNpcMovement(now),
    ({ now, activeMonsters }) => !gameRuntimeState.isRemoteSession && updateMonsterMovement(now, activeMonsters),
    ({ now, activeMonsters }) => !gameRuntimeState.isRemoteSession && updateMonsterCombat(now, activeMonsters),
    ({ now }) => !gameRuntimeState.isRemoteSession && updateMonsterRespawns(now),
    ({ now }) => !gameRuntimeState.isRemoteSession && updateCorpseDecay(now),
    ({ now }) => !gameRuntimeState.isRemoteSession && updateGroundEffectDecay(now),
    ({ now }) => !gameRuntimeState.isRemoteSession && updateTorchFuel(now),
  ],
  renderSystems: [
    ({ now }) => updateRenderPositions(now),
    ({ now }) => {
      if (ENABLE_REMOTE_INTERPOLATION_DEBUG) {
        remoteEntityInterpolationStore.logDebugState(now);
      }
    },
    () => updateWorldRender(),
    ({ now }) => {
      updateItemCooldownOverlays(now);
      refreshPlayerStatusIndicators(now);
    },
  ],
});

questWindowController = createQuestWindowController({
  updatePlayerInventory,
});

gameOptionsController = createGameOptionsController({
  renderCharacterSelector,
  renderPlayerMinimap,
  renderWorldLabels: refreshLocalizedWorldLabels,
  resetPlayerStatsUi: () => {
    playerStatsUi.root = null;
  },
  setAudioSettings: setGameAudioSettings,
  setMinimapZoom,
  refreshChatUi,
  onLanguageChanged: (language) => {
    if (!gameRuntimeState.isStarted || !gameTransport) {
      return;
    }
    const action = createSetLanguageAction(language, Date.now());
    if (action) {
      gameTransport.send(action);
    }
  },
  updatePlayerInventory,
  updatePlayerStats,
});

gameLoadingController = createGameLoadingController({
  overlay: gameLoading,
  statusElement: gameLoadingStatus,
  progressElement: gameLoadingProgressFill,
  retryButton: gameLoadingRetryButton,
  getText: getGameUiText,
  onRetry: () => window.location.reload(),
});

logoutConfirmationController = createLogoutConfirmationController({
  overlay: logoutConfirmation,
  cancelButton: logoutConfirmationCancelButton,
  confirmButton: logoutConfirmationConfirmButton,
  onConfirm: logoutCurrentCharacter,
  onOpen: resetMovementKeys,
});
logoutConfirmationController.bind();

characterSelectorController = createCharacterSelectorController({
  accountSession: gameAccountSession,
  googleClientId: GOOGLE_CLIENT_ID,
  applyGameLanguageUi,
  cancelItemDrag,
  cancelItemUse,
  renderOptionsWindow,
  renderQuestWindow,
  resetMobileJoystick,
  saveBeforeSwitch: () => gameRuntimeState.isRemoteSession || characterSessionController.saveBeforeSwitch(),
  setGameLanguage,
  setOpenMobilePanel,
  showGameStatusMessage,
  startGame: (...args) => startGame(...args),
  stopPlayerNavigation,
  unlockGameAudio,
});

mobileJoystickController = createMobileJoystickController({
  state: mobileGameUiState,
  diagonalHoldMs: MOBILE_JOYSTICK_DIAGONAL_HOLD_MS,
  cancelPlayerNavigation: cancelPlayerNavigationForManualMovement,
});

playerSpellSystem = createPlayerSpellSystem({
  addChatMessage,
  applyExperienceToPlayerSkill,
  autosaveCurrentCharacter,
  beginUseCooldown,
  getActiveChatChannelId: () => chatController.getActiveChannelId(),
  getEntitySurfaceOffsetY,
  getGameUiText,
  getLocalizedSpellData,
  getSkillExperienceGainMultiplier,
  isUseCooldownReady,
  normalizeSkillExperienceGain,
  playGameSfx,
  playPixiSpellEffect,
  refreshPlayerVitalsUi,
  renderActiveChatMessages,
  renderSpellWindow,
  showFloatingTextAbovePlayer,
  showFloatingTextAboveTarget,
  showGameStatusMessage,
  spellUseSfx: GAME_SFX.runeUse,
});

playerNavigationController = createPlayerNavigationController({
  areItemLocationsEqual,
  completeItemDrag,
  findItemLocationByUid,
  findMonsterByUid,
  findPlayerByUid: (playerUid) => playersByUid.get(playerUid) ?? (playerState.uid === playerUid ? playerState : null),
  findPath,
  findPathToAnyTarget,
  getItemFromLocation,
  getPathTraversableAdjacentTiles,
  handleDrinkPotionUse,
  handleRuneUse,
  handleUseItemFromSource,
  isTileOccupiedByCreature,
  isTilePathTraversable,
  isWorldItemAvailableForInteraction,
  loseSelectedMonsterTarget,
  loseSelectedPlayerTarget,
  sayGreetingToNpc,
  showGameStatusMessage,
  startItemDrag,
  updatePlayerInventory,
  worldItemThrowRange: WORLD_ITEM_THROW_RANGE,
});

npcConversationSystem = createNpcConversationSystem({
  addChatMessage,
  autosaveCurrentCharacter,
  getActiveChatChannelId: () => chatController.getActiveChannelId(),
  getLocalizedSpellData,
  getNpcsInChunkRadius,
  getPlayerEntityByUid,
  grantRewardItemsToPlayer,
  isPlayerSpellLearned,
  refreshInventoryUi,
  renderActiveChatMessages,
  renderSpellWindow,
  sendPlayerSpeech: handleNpcPlayerSpeech,
  showNpcConversationChat,
  showFloatingTextAboveTarget,
  showGameStatusMessage,
  startPlayerActionNavigation,
  playerActionType: PLAYER_ACTION_TYPE,
  updateNpcDirectionToPlayer,
});

monsterAiSystem = createMonsterAiSystem({
  findPathToAnyTarget,
  getDistanceToClosestTile,
  getNeighbors,
  getPathMovementCost,
  getPathTraversableAdjacentTiles,
  getTileMovementAnimationMultiplier,
  getTileMovementCost,
  getTilePosition,
  getWorldPosition,
  hasLineOfSightBetweenTiles,
  isNearPlayer,
  isTileOccupiedByCreature,
  isTilePathTraversable,
  isWalkableTile,
  moveMonsterInTileIndex,
  syncMonsterRenderVisibility,
  updateMonsterDirection,
  updateMonsterSprite,
});

monsterRespawnSystem = createMonsterRespawnSystem({
  createMonster,
  addMonsterToState,
  isBlockingItemAtPosition,
  isMonsterAtPosition,
  isNpcAtPosition,
  isPlayerAtPosition,
  refreshMonsterHp: monsterHpRefresh,
  renderMonsters,
});

chatController = createChatController({
  getReplySuggestions: getNpcReplySuggestions,
  getSpellFromText: getSpellFromChatText,
  castLearnedSpell: castLearnedPlayerSpellById,
  showPlayerSpeech: (text) => showFloatingTextAboveTarget(text, 70, playerState, "speech", 4000),
  handleNpcSpeech: handleNpcPlayerSpeech,
  sendChannelMessage: ({ channelId, text }) => {
    if (!gameRuntimeState.isRemoteSession) {
      return false;
    }
    const action = createSendChatMessageAction(channelId, text, Date.now());
    if (!action) {
      return true;
    }
    handleGameActionResult(gameTransport.send(action), (result) => {
      if (!result?.success) {
        showGameStatusMessage(result?.reason ?? "Chat message rejected.");
      }
    });
    if (channelId === "local") {
      handleNpcPlayerSpeech(text, playerState, Date.now());
    }
    return true;
  },
  resetMovementKeys,
});

characterSessionController = createCharacterSessionController({
  syncActiveTorchFuel,
  setPlayerWorldPosition,
  showStatusMessage: showGameStatusMessage,
  getUiText: getGameUiText,
  autosaveIntervalMs: CHARACTER_AUTOSAVE_INTERVAL_MS,
});

minimapController = createMinimapController({
  playerNavigationState,
  playerNavigationMode: PLAYER_NAVIGATION_MODE,
  saveGameOptions,
  showStatusMessage: showGameStatusMessage,
  startPlayerClickNavigation,
});

itemLocationController = createItemLocationController({
  equipment: playerState.equipment,
  findContainerByUid: (containerUid) => {
    const location = findItemLocationByUid(containerUid);
    return location ? itemLocationController.getItem(location) : null;
  },
  findWorldItemByUid,
  removeWorldItem: removeGroundItem,
  addWorldItem: addGroundItem,
  positionWorldItem: setWorldItemPosition,
  canEquipItem: canPlaceItemInEquipmentSlot,
  setEquipmentItem: setEquipmentSlotItem,
});

inventoryMoveService = createInventoryMoveService({
  getItem: itemLocationController.getItem,
  getParentContainer: itemLocationController.getParentContainer,
  removeItem: itemLocationController.removeItem,
  placeItem: itemLocationController.placeItem,
  findItemLocationByUid,
  isLocationCarriedByPlayer: isItemLocationCarriedByPlayer,
  getRemainingCapacity: () => getPlayerRemainingCapacity(playerState),
  getItemTotalWeight,
  canEquipItem: canPlaceItemInEquipmentSlot,
  canInteractWithWorldItem: (_source, item) => {
    if (!isNearPlayer(item, 1)) {
      return false;
    }
    return isWorldItemAvailableForInteraction(item) ? true : INVENTORY_ACTION_REASON.notTopOfStack;
  },
  canPlaceWorldItem: (_source, _item, destination) =>
    isNearPlayer(destination, WORLD_ITEM_THROW_RANGE) && hasPlayerLineOfSightToWorldPosition(destination),
  onItemLocationChanged: (item, destination) => {
    if (!isContainerItem(item)) {
      return;
    }
    const sourceTypeByLocationType = {
      containerSlot: "container",
      equipmentSlot: "equipment",
      worldTile: "world",
    };
    const sourceType = sourceTypeByLocationType[destination.locationType];
    if (sourceType) {
      updateOpenedContainerSourceType(item, sourceType);
    }
    if (sourceType === "world") {
      closeFarOpenedContainers();
    }
  },
});

inventoryDragController = createInventoryDragController({
  dragState,
  inputState,
  resolveItem: getDragSourceItem,
  clearWorldSelection: clearPixiWorldItemSelection,
  resetInputComboState,
});

containerWindowController = createContainerWindowController({
  inputState,
  renderItemIcon,
  shouldBlockContextMenuAction,
  cancelItemDrag,
  handleUseItemFromSource,
  isMobileGameLayout,
  syncMobileBackpackButton,
  syncItemUseSourceFeedback,
  refreshInventoryUi,
  resolveContainerItem: (containerUid) => {
    const location = findItemLocationByUid(containerUid);
    return location ? getItemFromLocation(location) : null;
  },
});

const getSimulationContainerByUid = (containerUid) => {
  const location = findItemLocationByUid(containerUid);
  return location ? itemLocationController.getItem(location) : null;
};

const getSimulationPlayerMoveTiming = (payload) => {
  return getPlayerMovementTiming(playerState, payload);
};

const canSimulationPlayerMove = (payload) => {
  return (
    canMoveTo(payload.fromX, payload.fromY, payload.toX, payload.toY) &&
    !isMonsterAtPosition(payload.toX, payload.toY) &&
    !isNpcAtPosition(payload.toX, payload.toY) &&
    !isBlockingItemAtPosition(payload.toX, payload.toY)
  );
};

const canSimulationPlayerAttackMonster = (attackingPlayer, monster) => {
  if (!isNearPlayer(monster, getPlayerAttackRange())) {
    return false;
  }
  const weaponCombatData = getEquippedWeaponCombatData();
  return !weaponCombatData?.projectileItemId || hasPlayerLineOfSightToEntity(monster);
};

const findSimulationWorldInteractable = (payload) => {
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(payload.z) ?? null;
  const interactable = findInteractableAtTile(worldMap, payload.col, payload.row);
  if (
    interactable?.properties?.interactableId !== payload.interactableId ||
    interactable?.properties?.interactableType !== payload.interactionType
  ) {
    return null;
  }
  return interactable;
};

const findSimulationAutomaticWorldTransition = (movingPlayer) => {
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(movingPlayer.z) ?? null;
  return findTransitionAtTile(worldMap, movingPlayer.x / TILE_SIZE, movingPlayer.y / TILE_SIZE);
};

const findSimulationWorldTransition = (payload) => {
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(payload.z) ?? null;
  const transition = findTransitionAtTile(worldMap, payload.col, payload.row);
  return transition?.properties?.transitionType === payload.transitionType ? transition : null;
};

const executeSimulationWorldInteraction = (interactable, payload) => {
  if (payload.interactionType === "rewardChest") {
    return executeRewardChestInteraction(interactable, payload.requestedAt);
  }
  return { success: false, reason: "unsupported-interaction" };
};

const executeSimulationItemUse = (item, useData, payload) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (cooldownGroup && !isUseCooldownReady(cooldownGroup, payload.requestedAt)) {
    return { success: false, reason: "cooldown" };
  }

  if (useData.action === "eat" && payload.target === null) {
    return executeEatFoodUse(item, payload.source, useData, payload.requestedAt);
  }
  if (useData.action === "toggleTorch" && payload.target === null) {
    return executeToggleTorchUse(item, payload.source, payload.requestedAt);
  }

  if (useData.action === "drinkPotion") {
    let useResult = null;
    if (payload.target?.targetType === "self" && payload.target.playerUid === playerState.uid) {
      useResult = restorePlayerVitalFromPotion(item, useData);
    } else if (payload.target?.targetType === "tile") {
      const targetTile = payload.target;
      if (targetTile.z !== playerState.z || !isNearPlayer(targetTile, useData.range)) {
        return { success: false, reason: "target-out-of-range" };
      }
      useResult = pourPotionOnTile(item, useData, targetTile);
    } else {
      return { success: false, reason: "invalid-target" };
    }
    if (!useResult?.success) {
      return useResult;
    }
    if (!beginUseCooldown(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "invalid-cooldown" };
    }
    return {
      success: true,
      changes: {
        itemUid: item.uid,
        itemId: item.itemId,
        restoredAmount: useResult.restoredAmount ?? 0,
        restoreStat: useResult.restoreStat ?? null,
      },
      events: [
        {
          type: "item-use-resolved",
          action: "drinkPotion",
          itemUid: item.uid,
          restoredAmount: useResult.restoredAmount ?? 0,
          floatingTextType: useResult.floatingTextType ?? null,
          groundEffectUid: useResult.groundEffectUid ?? null,
          cooldownGroup,
          sfx: payload.target.targetType === "self" ? GAME_SFX.drinkPotion : null,
        },
      ],
    };
  }

  if (useData.action === "healRune") {
    const targetPlayer = payload.target?.targetType === "player"
      ? (playersByUid.get(payload.target.playerUid) ?? (payload.target.playerUid === playerState.uid ? playerState : null))
      : payload.target?.targetType === "self"
        ? playerState
        : null;
    if (!isPlayerValidHealingRuneTarget(targetPlayer, useData)) {
      return { success: false, reason: targetPlayer?.hp >= targetPlayer?.maxHp ? "fullHealth" : "target-out-of-range" };
    }
    if (!hasPlayerLineOfSightToEntity(targetPlayer)) {
      return { success: false, reason: "line-of-sight-blocked" };
    }
    if (!consumeOneChargeFromRune(item, payload.source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    const restoredAmount = Math.min(useData.healAmount, targetPlayer.maxHp - targetPlayer.hp);
    targetPlayer.hp += restoredAmount;
    if (!beginUseCooldown(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "invalid-cooldown" };
    }
    return {
      success: true,
      changes: {
        itemUid: item.uid,
        charges: item.charges ?? 0,
        targetPlayerUid: targetPlayer.uid,
        hp: targetPlayer.hp,
        restoredAmount,
      },
      events: [{
        type: "item-use-resolved",
        action: "healRune",
        itemUid: item.uid,
        targetPlayerUid: targetPlayer.uid,
        restoredAmount,
        floatingTextType: "heal",
        cooldownGroup,
        sfx: GAME_SFX.runeUse,
      }],
    };
  }

  if (useData.action === "attackRune") {
    const targetType = payload.target?.targetType;
    const targetEntity = targetType === "monster"
      ? monstersByUid.get(payload.target.monsterUid) ?? null
      : targetType === "player"
        ? playersByUid.get(payload.target.playerUid) ?? null
        : null;
    const isValidTarget = targetType === "monster"
      ? isMonsterValidRuneTarget(targetEntity, useData)
      : targetType === "player"
        ? isPlayerValidRuneTarget(targetEntity, useData, payload.requestedAt)
        : false;
    if (!isValidTarget) {
      return { success: false, reason: "target-out-of-range" };
    }
    if (!hasPlayerLineOfSightToEntity(targetEntity)) {
      return { success: false, reason: "line-of-sight-blocked" };
    }
    if (!consumeOneChargeFromRune(item, payload.source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    const attackResult = calculateRuneAttackResult(useData);
    const targetRenderSnapshot = structuredClone(targetEntity);
    let damageResult = null;
    if (targetType === "monster") {
      damageResult = applyDamageToMonster(targetEntity, attackResult, payload.requestedAt);
    } else {
      const healthResult = applyDamageToPlayer(targetEntity, attackResult.finalDamage);
      damageResult = {
        success: healthResult.success,
        changes: {
          targetPlayerUid: targetEntity.uid,
          hp: targetEntity.hp,
          finalDamage: healthResult.damageApplied,
        },
        events: [
          {
            type: "player-pvp-rune-resolved",
            playerUid: playerState.uid,
            targetPlayerUid: targetEntity.uid,
            attackResult,
            attackKind: "rune",
            damageType: useData.damageType ?? "fire",
            targetRenderSnapshot,
          },
        ],
      };
    }
    if (!damageResult?.success) {
      return damageResult ?? { success: false, reason: "damage-failed" };
    }
    if (!beginUseCooldown(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "invalid-cooldown" };
    }
    return {
      success: true,
      changes: {
        itemUid: item.uid,
        charges: item.charges ?? 0,
        ...(targetType === "monster"
          ? { monsterUid: targetEntity.uid }
          : { targetPlayerUid: targetEntity.uid }),
        finalDamage: attackResult.finalDamage,
      },
      events: [
        {
          type: "item-use-resolved",
          action: "attackRune",
          itemUid: item.uid,
          cooldownGroup,
          sfx: GAME_SFX.runeUse,
        },
        ...(damageResult.events ?? []).map((event) => ({
          ...event,
          attackKind: "rune",
          damageType: useData.damageType ?? "fire",
        })),
      ],
    };
  }

  if (useData.action === "createField" && payload.target?.targetType === "tile") {
    if (
      payload.target.z !== playerState.z ||
      !isNearPlayer(payload.target, useData.range) ||
      !hasPlayerLineOfSightToWorldPosition(payload.target)
    ) {
      return { success: false, reason: "target-out-of-range" };
    }
    const field = createFluidPuddle(useData.groundEffectId, payload.target.x, payload.target.y, payload.target.z);
    if (!field || !consumeOneChargeFromRune(item, payload.source)) {
      return { success: false, reason: "target-out-of-range" };
    }
    if (!beginUseCooldown(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "invalid-cooldown" };
    }
    field.ownerUid = playerState.uid;
    return {
      success: true,
      changes: { itemUid: item.uid, charges: item.charges ?? 0, groundEffectUid: field.uid },
      events: [{
        type: "item-use-resolved",
        action: "createField",
        itemUid: item.uid,
        groundEffectUid: field.uid,
        damageType: getGroundEffectData(useData.groundEffectId)?.damageType,
        x: field.x,
        y: field.y,
        z: field.z,
      }],
    };
  }

  if (useData.action === "dispelField" && payload.target?.targetType === "tile") {
    if (
      payload.target.z !== playerState.z ||
      !isNearPlayer(payload.target, useData.range) ||
      !hasPlayerLineOfSightToWorldPosition(payload.target)
    ) {
      return { success: false, reason: "target-out-of-range" };
    }
    const field = [...groundEffectsByUid.values()].find(
      (effect) =>
        effect.x === payload.target.x &&
        effect.y === payload.target.y &&
        effect.z === payload.target.z &&
        getGroundEffectData(effect.groundEffectId)?.kind === "field",
    );
    if (!field) {
      return { success: false, reason: "field-not-found" };
    }
    if (!removeGroundEffect(field.uid) || !consumeOneChargeFromRune(item, payload.source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    if (!beginUseCooldown(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "invalid-cooldown" };
    }
    return {
      success: true,
      changes: { itemUid: item.uid, charges: item.charges ?? 0, removedGroundEffectUid: field.uid },
      events: [{ type: "item-use-resolved", action: "dispelField", itemUid: item.uid }],
    };
  }

  return { success: false, reason: "unsupported-item-action" };
};

const playCombatEffectAtTarget = (effectId, variant, target) => {
  const targetPosition = getItemUseTargetRenderPosition(target);
  if (!targetPosition) {
    return false;
  }
  const targetX = targetPosition.x + TILE_SIZE / 2;
  const targetY = targetPosition.y + TILE_SIZE / 2;
  return playPixiCombatEffect({ effectId, variant, startX: targetX, startY: targetY });
};

const playRuneCombatEffect = (event, target) => {
  if (event.attackKind !== "rune" || !event.damageType) {
    return false;
  }
  const attacker = getPlayerEntityByUid(event.playerUid);
  const attackerPosition = getItemUseTargetRenderPosition(attacker);
  const targetPosition = getItemUseTargetRenderPosition(target);
  if (!attackerPosition || !targetPosition) {
    return false;
  }
  return playPixiCombatEffect({
    effectId: event.damageType,
    variant: "projectile",
    startX: attackerPosition.x + TILE_SIZE / 2,
    startY: attackerPosition.y + TILE_SIZE / 2,
    targetX: targetPosition.x + TILE_SIZE / 2,
    targetY: targetPosition.y + TILE_SIZE / 2,
  });
};

const playAttackResolutionEffect = (event, target) => {
  if (event.attackResult?.textType === "miss") {
    return playCombatEffectAtTarget("miss", "impact", target);
  }
  if (["block", "absorb"].includes(event.attackResult?.textType)) {
    return playCombatEffectAtTarget("block", "impact", target);
  }
  if (["sword", "axe", "mace"].includes(event.weaponType) && event.attackResult?.finalDamage > 0) {
    return playCombatEffectAtTarget(`${event.weaponType}Attack`, "impact", target);
  }
  return false;
};

const handlePlayerAttackResolvedEffect = (event) => {
  if (event.playerUid === playerState.uid) {
    presentSkillProgression(event.skillProgression);
  }
  playPlayerWeaponProjectile(event.targetRenderSnapshot);
  const monster = findMonsterByUid(event.monsterUid);
  playAttackResolutionEffect(event, monster ?? event.targetRenderSnapshot);
  if (event.attackResult?.finalDamage <= 0 && monster) {
    showFloatingTextAboveMonster(monster, event.attackResult.text, event.attackResult.textType);
  }
  playPlayerAttackResultSfx(event.attackResult);
};

const handlePlayerPvpAttackResolvedEffect = (event) => {
  if (event.playerUid === playerState.uid) {
    presentSkillProgression(event.skillProgression);
  }
  playPlayerWeaponProjectile(event.targetRenderSnapshot);
  const targetPlayer = playersByUid.get(event.targetPlayerUid) ?? event.targetRenderSnapshot ?? null;
  if (targetPlayer) {
    playAttackResolutionEffect(event, targetPlayer);
    showFloatingTextAbovePlayer(
      event.attackResult?.finalDamage > 0 ? event.attackResult.finalDamage : event.attackResult?.text,
      event.attackResult?.textType ?? "damage",
      targetPlayer,
    );
    updateRemotePlayerVisual(targetPlayer);
  }
  const groundEffect = groundEffectsByUid.get(event.groundEffectUid) ?? null;
  if (groundEffect) {
    renderGroundEffect(groundEffect);
  }
  playPlayerAttackResultSfx(event.attackResult);
  syncMobileTargetHud();
};

const handlePlayerPvpRuneResolvedEffect = (event) => {
  const targetPlayer = playersByUid.get(event.targetPlayerUid) ?? event.targetRenderSnapshot ?? null;
  if (targetPlayer) {
    playRuneCombatEffect(event, targetPlayer);
    showFloatingTextAbovePlayer(
      event.attackResult?.finalDamage > 0 ? event.attackResult.finalDamage : event.attackResult?.text,
      event.attackResult?.textType ?? "fire",
      targetPlayer,
    );
    updateRemotePlayerVisual(targetPlayer);
  }
  const groundEffect = groundEffectsByUid.get(event.groundEffectUid) ?? null;
  if (groundEffect) {
    renderGroundEffect(groundEffect);
  }
  syncMobileTargetHud();
};

const handleServerPlayerDeathEffect = (event) => {
  if (event.playerUid === combatTargetState.playerUid) {
    clearRemotePlayerSelection();
    syncMobileTargetHud();
  }
  if (event.playerUid === playerState.uid) {
    combatTargetState.monsterUid = null;
    clearRemotePlayerSelection();
    clearMonsterSelection();
    stopPlayerNavigation();
    closeAllContainer();
    refreshPlayerVitalsUi();
    showGameStatusMessage(getGameUiText("youDied"));
  }
};

const handleMonsterAttackResolvedEffect = (event) => {
  if (event.playerUid !== playerState.uid) {
    return;
  }

  const attackResult = event.attackResult;
  if (!attackResult) {
    return;
  }
  playAttackResolutionEffect(event, playerState);
  presentSkillProgression(event.skillProgression);

  const monster = findMonsterByUid(event.monsterUid);
  const monsterData = getMonsterData(monster?.monsterId);
  const localizedMonsterData = monsterData ? (getLocalizedMonsterData(monster.monsterId) ?? monsterData) : null;

  if (attackResult.finalDamage > 0 && localizedMonsterData) {
    const logMessage = getGameUiText("damageTaken")(attackResult.finalDamage, localizedMonsterData.name);
    addLogMessage(logMessage, "combat");
  }

  showFloatingTextAbovePlayer(
    attackResult.finalDamage > 0 ? attackResult.finalDamage : attackResult.text,
    attackResult.textType,
  );

  if (attackResult.textType === "block") {
    playGameSfx(GAME_SFX.block);
  } else if (attackResult.textType === "absorb") {
    playGameSfx(GAME_SFX.armorBlock);
  }

  refreshPlayerVitalsUi();
};

const handleMonsterDamageResolvedEffect = (event) => {
  const groundEffect = groundEffectsByUid.get(event.groundEffectUid) ?? null;
  if (groundEffect) {
    renderGroundEffect(groundEffect);
  }

  const monsterData = getMonsterData(event.monsterId);
  const localizedMonsterData = getLocalizedMonsterData(event.monsterId) ?? monsterData;
  const wasLocalPlayerAttack = event.playerUid === playerState.uid;
  if (wasLocalPlayerAttack && localizedMonsterData) {
    addLogMessage(getGameUiText("damageDealt")(event.damageApplied, localizedMonsterData.name), "combat");
  }
  const liveMonster = findMonsterByUid(event.monsterUid);
  if (event.attackKind === "fieldTick") {
    playCombatEffectAtTarget(event.damageType, "statusTick", liveMonster ?? event.targetRenderSnapshot);
  } else {
    playRuneCombatEffect(event, liveMonster ?? event.targetRenderSnapshot);
  }
  showFloatingTextAboveMonster(liveMonster ?? event.targetRenderSnapshot, event.damageApplied, event.textType);

  if (!event.didDie) {
    const monster = findMonsterByUid(event.monsterUid);
    if (monster) {
      monsterHpRefresh(monster);
    }
    return;
  }

  const corpse = worldItemsByUid.get(event.corpseUid) ?? null;
  if (corpse) {
    renderGroundItems([corpse]);
  }
  removeMonsterRender(event.monsterUid);
  clearSelectedMonsterIfNeeded(event.targetRenderSnapshot);
  addLootLogMessage(event.lootContent, localizedMonsterData?.name ?? null);
  if (wasLocalPlayerAttack && event.experienceReward > 0) {
    addExperienceGainFeedback(event.experienceReward, localizedMonsterData?.name ?? null);
    const previousLevel = event.levelProgression?.previousLevel ?? playerState.level;
    const nextLevel = event.levelProgression?.nextLevel ?? playerState.level;
    for (let level = previousLevel + 1; level <= nextLevel; level++) {
      addLevelUpFeedback(level);
    }
  }

  const deathSfxByMonsterId = {
    rat: GAME_SFX.ratDeath,
    spider: GAME_SFX.spiderDeath,
  };
  const deathSfx = deathSfxByMonsterId[event.monsterId];
  if (deathSfx) {
    playGameSfx(deathSfx);
  }
};

const handleFieldDamageResolvedEffect = (event) => {
  const targetPlayer = getPlayerEntityByUid(event.targetPlayerUid ?? event.playerUid);
  const target = targetPlayer ?? { x: event.x, y: event.y, z: event.z };
  playCombatEffectAtTarget(event.damageType, "statusTick", target);
  if ((event.targetPlayerUid ?? event.playerUid) === playerState.uid) {
    showFloatingTextAbovePlayer(event.damageApplied, event.damageType);
    refreshPlayerVitalsUi();
  }
};

const handlePlayerPvpFieldResolvedEffect = (event) => {
  const targetPlayer = getPlayerEntityByUid(event.targetPlayerUid) ?? event.targetRenderSnapshot ?? null;
  if (!targetPlayer) {
    return;
  }
  playCombatEffectAtTarget(event.damageType, "statusTick", targetPlayer);
  showFloatingTextAbovePlayer(event.attackResult?.finalDamage ?? 0, event.damageType, targetPlayer);
  updateRemotePlayerVisual(targetPlayer);
  if (targetPlayer.uid === playerState.uid) {
    refreshPlayerVitalsUi();
  }
};

const handleRewardChestCompletedEffect = (event) => {
  const questData = getQuestData(event.questId);
  if (!questData) {
    return;
  }
  renderQuestWindow();
  addQuestCompletionFeedback(questData, event.rewardItems);
  addRewardChestCompletionEffect(event.position);
  playGameSfx(GAME_SFX.openChest);
  setTimeout(() => playGameSfx(GAME_SFX.questDone), 180);
};

const handleItemUseResolvedEffect = (event) => {
  const groundEffect = groundEffectsByUid.get(event.groundEffectUid) ?? null;
  if (groundEffect) {
    renderGroundEffect(groundEffect);
  }
  refreshAllByUid(event.itemUid);
  refreshInventoryUi();
  if (event.restoredAmount > 0 && event.floatingTextType) {
    const targetPlayer = event.targetPlayerUid === playerState.uid
      ? playerState
      : playersByUid.get(event.targetPlayerUid) ?? playerState;
    showFloatingTextAbovePlayer(event.restoredAmount, event.floatingTextType, targetPlayer);
    if (targetPlayer !== playerState) {
      updateRemotePlayerVisual(targetPlayer);
      syncMobileTargetHud();
    }
  }
  refreshPlayerVitalsUi();
  if (event.sfx) {
    playGameSfx(event.sfx);
  }
  updateItemCooldownOverlays(Date.now());
  syncMobileTorchButton();
};

const handleSpellCastResolvedEffect = (event) => {
  if (event.playerUid === playerState.uid) {
    presentSkillProgression(event.skillProgression);
  }
};

gameSimulation = createGameSimulation({
  state: {
    player: playerState,
    playersByUid,
    monstersByUid,
    timing: gameplayTimingState,
  },
  rules: {
    canPlayerAttackMonster: canSimulationPlayerAttackMonster,
    canPlayerAttackPlayer: canSimulationPlayerAttackMonster,
    canInitiatePlayerPvpAttack: (attacker, target, payload) =>
      canInitiatePlayerPvpAttack(attacker, target, payload.requestedAt),
    canPlayerMove: canSimulationPlayerMove,
    canPlayerUseWorldTransition: (movingPlayer, transition) => isNearPlayer(transition, 1),
    canUseWorldItemSource: (source) => canInteractWithWorldItemSource(source),
    getPlayerAttackCooldownMs: () => PLAYER_ATTACK_COOLDOWN_MS,
    getPlayerMoveTiming: getSimulationPlayerMoveTiming,
  },
  commands: {
    executeAttackMonster: (monster, payload) => attackMonster(monster, payload.requestedAt),
    executeAttackPlayer: (targetPlayer) => {
      const attackResult = calculatePlayerAttackResult(targetPlayer);
      if (attackResult.finalDamage > 0) {
        applyDamageToPlayer(targetPlayer, attackResult.finalDamage);
      }
      return {
        success: true,
        changes: { targetPlayerUid: targetPlayer.uid, hp: targetPlayer.hp },
        events: [
          {
            type: "player-pvp-attack-resolved",
            playerUid: playerState.uid,
            targetPlayerUid: targetPlayer.uid,
            attackResult,
            targetRenderSnapshot: structuredClone(targetPlayer),
          },
        ],
      };
    },
    executeSetCombatMode: (combatMode) => {
      playerState.combatMode = combatMode;
      return { success: true, changes: { combatMode } };
    },
    executeSetLanguage: (language) => {
      playerState.language = language;
      return { success: true, changes: { language } };
    },
    executeSetPvpEnabled: (enabled) => {
      playerState.pvp.enabled = enabled;
      return { success: true, changes: { pvp: structuredClone(playerState.pvp) } };
    },
    executeItemUse: executeSimulationItemUse,
    executeMoveItem: executeInventoryMoveRequest,
    executeSplitItemStack: executeLocalSplitItemStack,
    executeNpcSpeech: (payload, speakingPlayer) =>
      npcConversationSystem.handlePlayerSpeech(payload.text, speakingPlayer, payload.requestedAt),
    executeSpell: (payload) => playerSpellSystem.executeLearnedById(payload.spellId, payload.requestedAt),
    executeWorldTransition: (transition) => executePlayerWorldTransition(transition),
    executeWorldInteraction: executeSimulationWorldInteraction,
    findContainerByUid: getSimulationContainerByUid,
    findAutomaticWorldTransition: findSimulationAutomaticWorldTransition,
    findWorldInteractable: findSimulationWorldInteractable,
    findWorldTransition: findSimulationWorldTransition,
    getPlayerByUid: getPlayerEntityByUid,
    getItemFromLocation,
    getItemUseData,
    getRemainingCapacity: () => playerState.capacity - calculatePlayerCarriedWeight(playerState),
    getSpellById: (spellId) => spellsDatabase[spellId] ?? null,
  },
  onListenerError: (error) => console.error("Game action effect failed:", error),
});

gameActionEffectRouter = createGameActionEffectRouter({
  "chat-message": handleChatMessageEffect,
  "chat-system-message": handleChatSystemMessageEffect,
  "inventory-items-inserted": () => refreshInventoryUi(),
  "inventory-move-completed": (event) => playGameSfx(event.sfx),
  "item-use-resolved": handleItemUseResolvedEffect,
  "monster-damage-resolved": handleMonsterDamageResolvedEffect,
  "field-damage-resolved": handleFieldDamageResolvedEffect,
  "monster-attack-resolved": handleMonsterAttackResolvedEffect,
  "npc-spoke": handleRemoteNpcSpeechEffect,
  "player-attack-resolved": handlePlayerAttackResolvedEffect,
  "player-pvp-attack-resolved": handlePlayerPvpAttackResolvedEffect,
  "player-pvp-rune-resolved": handlePlayerPvpRuneResolvedEffect,
  "player-pvp-field-resolved": handlePlayerPvpFieldResolvedEffect,
  "player-died": handleServerPlayerDeathEffect,
  "player-pvp-state-changed": (event) => {
    if (event.playerUid === playerState.uid && event.pvp) {
      playerState.pvp = structuredClone(event.pvp);
      refreshPvpButtonState();
    }
    const remotePlayer = playersByUid.get(event.playerUid) ?? null;
    if (remotePlayer) {
      remotePlayer.pvp = structuredClone(event.pvp);
      updateRemotePlayerVisual(remotePlayer);
    }
  },
  "player-world-transitioned": () => presentPlayerWorldTransition(),
  "reward-chest-completed": handleRewardChestCompletedEffect,
  "spell-cast-resolved": handleSpellCastResolvedEffect,
});

const setGameTransport = (nextTransport, subscribeToActionResults) => {
  unsubscribeGameTransportEffects?.();
  gameTransport = nextTransport;
  unsubscribeGameTransportEffects = subscribeToActionResults ? gameTransport.subscribe(gameActionEffectRouter) : null;
};

const remoteSelfUiSignatures = {
  inventory: null,
  vitals: null,
  experience: null,
  pvp: null,
};

const hasReplicatedEntityChanges = (event, entityType) => {
  return (
    (Array.isArray(event?.payload?.upserts?.[entityType]) && event.payload.upserts[entityType].length > 0) ||
    (Array.isArray(event?.payload?.removals?.[entityType]) && event.payload.removals[entityType].length > 0)
  );
};

const synchronizeRemoteSelfUi = (forceRefresh = false) => {
  const inventorySignature = JSON.stringify({
    equipment: playerState.equipment,
    carriedWeight: playerState.carriedWeight,
    capacity: playerState.capacity,
    combatMode: playerState.combatMode,
  });
  const vitalsSignature = `${playerState.hp}:${playerState.maxHp}:${playerState.mana}:${playerState.maxMana}:${playerState.sanity}:${playerState.maxSanity}`;
  const experienceSignature = JSON.stringify({
    level: playerState.level,
    experience: playerState.experience,
    classId: playerState.classId,
    skills: playerState.skills,
  });
  const pvpSignature = JSON.stringify(playerState.pvp);

  if (forceRefresh || inventorySignature !== remoteSelfUiSignatures.inventory) {
    remoteSelfUiSignatures.inventory = inventorySignature;
    refreshInventoryUi();
  }
  if (forceRefresh || vitalsSignature !== remoteSelfUiSignatures.vitals) {
    remoteSelfUiSignatures.vitals = vitalsSignature;
    refreshPlayerVitalsUi();
  }
  if (forceRefresh || experienceSignature !== remoteSelfUiSignatures.experience) {
    remoteSelfUiSignatures.experience = experienceSignature;
    updatePlayerExperience();
    updateAllPlayerSkillLevels();
  }
  if (forceRefresh || pvpSignature !== remoteSelfUiSignatures.pvp) {
    remoteSelfUiSignatures.pvp = pvpSignature;
    refreshPvpButtonState();
  }
};

const synchronizeRemoteWorldRender = (event) => {
  if (event?.type === "prediction-updated") {
    return;
  }

  const isSnapshot = event?.type === "server.snapshot";
  const didSelfChange = isSnapshot || Boolean(event?.payload?.upserts?.self);
  const didWorldItemsChange = isSnapshot || hasReplicatedEntityChanges(event, "worldItems");
  const didGroundEffectsChange = isSnapshot || hasReplicatedEntityChanges(event, "groundEffects");
  const didMonstersChange = isSnapshot || hasReplicatedEntityChanges(event, "monsters");
  const didNpcsChange = isSnapshot || hasReplicatedEntityChanges(event, "npcs");
  const didRemotePlayersChange = isSnapshot || hasReplicatedEntityChanges(event, "players");
  const previousZ = pixiWorldRenderState.currentZ;
  pixiWorldRenderState.currentZ = playerState.z;
  if (!gameRuntimeState.isStarted) {
    return;
  }
  const didChangeFloor = previousZ !== playerState.z;

  if (didWorldItemsChange || didChangeFloor) {
    rebuildWorldTileStacks();
  }
  if (didMonstersChange || didChangeFloor) {
    rebuildMonsterSpatialIndexes();
  }
  if (didNpcsChange || didChangeFloor) {
    rebuildNpcSpatialIndexes();
  }

  if (didChangeFloor) {
    clearGroundItemRender();
    clearMonsters();
    for (const npcUid of [...npcElementsByUid.keys()]) {
      removeNpcRender(npcUid);
    }
    clearPixiRemotePlayerVisuals();
    remotePlayerRenderUids.clear();
    updatePixiVisibleChunksAroundPlayer();
  }

  if (didWorldItemsChange || didChangeFloor) {
    for (const itemUid of [...worldItemElementsByUid.keys()]) {
      const item = worldItemsByUid.get(itemUid);
      if (!item || item.z !== playerState.z) {
        removeGroundItemRender(itemUid);
      }
    }
    renderGroundItems([...worldItemsByUid.values()].filter((item) => item.z === playerState.z));
  }
  if (didGroundEffectsChange || didChangeFloor) {
    syncGroundEffectRenderForCurrentZ();
  }
  if (didMonstersChange || didChangeFloor) {
    syncVisibleMonsterRendersAroundPlayer();
  }
  if (didNpcsChange || didChangeFloor) {
    syncVisibleNpcRendersAroundPlayer();
  }
  if (didRemotePlayersChange || didChangeFloor) {
    syncVisibleRemotePlayerRenders();
  }
  if (didSelfChange) {
    synchronizeRemoteSelfUi(isSnapshot);
    updatePixiVisibleChunksAroundPlayer();
  }
  const isItemInteractionInProgress =
    dragState.isDragging || dragState.pendingSourceLocation !== null || dragState.pendingSlotElement !== null;

  if (didWorldItemsChange && !isItemInteractionInProgress) {
    renderContainerDock();
  }
};

const initializeRemoteGameSession = async () => {
  if (REMOTE_GAME_SERVER_URL === "") {
    gameRuntimeState.isRemoteSession = false;
    return { remoteSession: false };
  }
  if (gameAccountSession) {
    const refreshResult = await gameAccountSession.refreshToken();
    if (!refreshResult.success) {
      throw new Error("The authenticated account session expired or could not be refreshed.");
    }
  }
  const authToken = gameAccountSession?.getAuthToken() ?? REMOTE_GAME_AUTH_TOKEN;
  if (typeof authToken !== "string" || authToken === "") {
    throw new Error("An authenticated account session is required when VITE_GAME_SERVER_URL is configured.");
  }

  gameRuntimeState.isRemoteSession = true;
  const remoteTransport = createWebSocketGameTransport({
    url: REMOTE_GAME_SERVER_URL,
    socketFactory: (url) => new WebSocket(url),
  });
  setGameTransport(remoteTransport, false);
  remoteGameStateBridge?.disconnect();
  remoteGameStateBridge = createRemoteGameStateBridge({
    transport: remoteTransport,
    playerState,
    entityMaps: {
      players: playersByUid,
      monsters: monstersByUid,
      npcs: npcsByUid,
      worldItems: worldItemsByUid,
      groundEffects: groundEffectsByUid,
    },
    onStateApplied: ({ event }) => synchronizeRemoteWorldRender(event),
    onEvents: (events) => gameActionEffectRouter({ events }),
    onLatencyUpdated: ({ smoothedRoundTripTimeMs }) => {
      if (pingCounter) {
        pingCounter.textContent = Number.isFinite(smoothedRoundTripTimeMs)
          ? `PING: ${smoothedRoundTripTimeMs} ms`
          : "PING: -- ms";
      }
    },
    onConnectionStateChanged: ({ state }) => {
      if (pingCounter && state !== "ready") {
        pingCounter.textContent = "PING: -- ms";
      }
      if (gameRuntimeState.isStarted && state === "reconnecting") {
        showGameStatusMessage("Connection lost. Reconnecting...");
      } else if (gameRuntimeState.isStarting && state === "reconnecting") {
        gameLoadingController.setStage("loadingNetworkRetrying", 0.4);
      }
    },
  });
  await remoteTransport.connect({
    authToken,
    characterId: playerState.uid,
    name: playerState.name,
    language: gameOptionsUiState.values.language,
  });
  if (gameAccountSession && accountTokenRefreshIntervalId === null) {
    accountTokenRefreshIntervalId = window.setInterval(async () => {
      const refreshResult = await gameAccountSession.refreshToken().catch(() => ({ success: false }));
      if (refreshResult.success) {
        remoteTransport.updateAuthenticationToken(gameAccountSession.getAuthToken());
      }
    }, ACCOUNT_TOKEN_REFRESH_INTERVAL_MS);
  }
  return { remoteSession: true };
};

setGameTransport(createLocalGameTransport({ simulation: gameSimulation }), true);

const initializePlayerUi = () => {
  initializePlayerRenderRefs();
  applyGameOptions();
  refreshChatUi();
  updateGameScale();
  showPlayerName(playerState.name);
  updatePlayerSprite();
  refreshInventoryUi();
  syncPlayerDerivedStats();
  refreshPlayerVitalsUi();
};

/* ---------- INITIALISATION - DEMARRAGE ---------- */
const preconnectGameService = (url) => {
  if (typeof url !== "string" || url === "") {
    return;
  }
  try {
    const origin = new URL(url).origin.replace(/^ws/, "http");
    if (document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
      return;
    }
    const linkElement = document.createElement("link");
    linkElement.rel = "preconnect";
    linkElement.href = origin;
    linkElement.crossOrigin = "anonymous";
    document.head.appendChild(linkElement);
  } catch {
    // An invalid optional endpoint will be reported by the real connection attempt.
  }
};

const preloadGameShell = () => {
  if (gameShellPreloadPromise) {
    return gameShellPreloadPromise;
  }
  preconnectGameService(REMOTE_GAME_API_URL);
  preconnectGameService(REMOTE_GAME_SERVER_URL);
  if (GOOGLE_CLIENT_ID !== "") {
    preconnectGameService("https://accounts.google.com");
  }
  gameShellPreloadPromise = (async () => {
    const worldMapsByZ = loadWorldMaps();
    const didInitializeRenderer = await initializePixiRenderer({
      htmlParentElement: game,
      gameWidth: GAME_WIDTH,
      gameHeight: GAME_HEIGHT,
      lightingPresets: {
        playerRevealRadius: TORCH_PLAYER_REVEAL_RADIUS,
        torchRadii: getItemData("torch")?.lightSource?.radiusByStage ?? [],
        spellRadii: Object.values(spellsDatabase)
          .map((spellData) => spellData.lightRadius)
          .filter((radius) => Number.isFinite(radius) && radius > 0),
      },
    });
    if (!didInitializeRenderer) {
      throw new Error("Pixi renderer initialization failed.");
    }
    const didLoadSharedTextures = await loadPixiWorldEntityTextures({
      itemTextureUrl: getAtlasPath("items"),
      monsterTextureUrl: getAtlasPath("monsters"),
      npcTextureUrlsById: getNpcTextureUrlsById(),
    });
    if (!didLoadSharedTextures) {
      throw new Error("Shared world textures could not be loaded.");
    }
    return { worldMapsByZ };
  })().catch((error) => {
    gameShellPreloadPromise = null;
    throw error;
  });
  return gameShellPreloadPromise;
};

const prepareGameData = () => {
  const selectedOnlineCharacter = gameAccountSession?.getActiveCharacter() ?? null;
  if (selectedOnlineCharacter) {
    playerState.uid = selectedOnlineCharacter.characterId;
    playerState.name = selectedOnlineCharacter.name;
    playerState.appearanceId = getPlayerAppearanceData(selectedOnlineCharacter.appearanceId).appearanceId;
    playerState.appearanceParts = normalizeCharacterAppearanceParts(
      selectedOnlineCharacter.appearanceParts,
      playerState.appearanceId,
    );
    playerState.appearanceColors = normalizeCharacterAppearanceColors(selectedOnlineCharacter.appearanceColors);
  }
  const loadedCharacterSnapshot = gameAccountSession ? null : loadInitialCharacterSnapshot();
  if (!loadedCharacterSnapshot && REMOTE_GAME_SERVER_URL === "") {
    setupTestPlayerInventory();
  }
  if (REMOTE_GAME_SERVER_URL === "") {
    setupTestWorld();
  }
  return {
    loadedCharacterSnapshot,
  };
};

const initializeGameRenderer = async () => preloadGameShell();

const loadSelectedPlayerTextures = async () => {
  const playerTextureUrlsByLayer = await getPlayerAppearanceLayerTextureUrls(
    playerState.appearanceParts,
    playerState.appearanceColors,
  );
  const didLoadPlayerTextures = await loadPixiWorldEntityTextures({
    playerTextureUrlsByLayer,
  });
  if (!didLoadPlayerTextures) {
    throw new Error("Player appearance textures could not be loaded.");
  }
};

const initializeGameSession = async () => {
  const [, sessionResult] = await Promise.all([
    loadSelectedPlayerTextures(),
    initializeRemoteGameSession(),
  ]);
  return sessionResult;
};

const initializeGameWorld = async ({ loadedCharacterSnapshot, worldMapsByZ }) => {
  pixiWorldRenderState.worldMapsByZ = worldMapsByZ;
  if (gameRuntimeState.isRemoteSession) {
    pixiWorldRenderState.currentZ = playerState.z;
    rebuildWorldTileStacks();
    rebuildMonsterSpatialIndexes();
    rebuildNpcSpatialIndexes();
    await updatePixiVisibleChunksAroundPlayer();
    return;
  }
  const didRestoreSavedPosition =
    loadedCharacterSnapshot && applyCharacterSavePosition(loadedCharacterSnapshot, worldMapsByZ);
  if (!didRestoreSavedPosition) {
    playerState.z = playerState.spawn.z;
    pixiWorldRenderState.currentZ = playerState.z;
    const worldMap = worldMapsByZ.get(playerState.spawn.z);
    applyPlayerSpawn(findPlayerSpawnInWorldMap(worldMap, playerState.spawn.spawnId));
  }
  initializeNpcsForWorldMaps(worldMapsByZ);
  spawnInitialMonstersForWorldMaps(worldMapsByZ);
  await updatePixiVisibleChunksAroundPlayer();
};

const initializeGameInterface = ({ loadedCharacterSnapshot }) => {
  initializePlayerUi();
  if (!loadedCharacterSnapshot && !gameRuntimeState.isRemoteSession) {
    saveCharacterSnapshot(createCharacterSaveSnapshot());
  }
  renderInitialWorld();
};

clientBootstrap = createClientBootstrap({
  runtimeState: gameRuntimeState,
  phases: [
    { name: "data", run: prepareGameData },
    { name: "renderer", run: initializeGameRenderer },
    { name: "network", run: initializeGameSession },
    { name: "world", run: initializeGameWorld },
    { name: "interface", run: initializeGameInterface },
  ],
  onPhaseStarted: ({ phase, phaseIndex, phaseCount }) => {
    const loadingTextKeyByPhase = {
      data: "loadingData",
      renderer: "loadingRenderer",
      network: "loadingNetwork",
      world: "loadingWorld",
      interface: "loadingInterface",
    };
    gameLoadingController.setStage(loadingTextKeyByPhase[phase.name] ?? "loadingData", phaseIndex / phaseCount);
  },
  onPhaseCompleted: ({ phaseIndex, phaseCount }) => {
    gameLoadingController.setStage("loadingReady", (phaseIndex + 1) / phaseCount);
  },
  onStarted: () => {
    preloadGameSfx();
    startGameMusic();
    if (!gameRuntimeState.isRemoteSession) {
      startCharacterAutosave();
    }
    if (!gameRuntimeState.isLoopRunning) {
      gameRuntimeState.isLoopRunning = startFixedStepGameLoop({
        updateGameLogic,
        renderGameFrame,
        renderPixiFrame,
        fpsCounter,
      });
    }
  },
});

const startGame = async () => {
  setGameSessionUiActive(false);
  gameWelcome.hidden = false;
  if (gameLoadingRetryButton) {
    gameLoadingRetryButton.textContent = getGameUiText("retry");
  }
  gameLoadingController.show();
  try {
    const result = await clientBootstrap.start();
    if (!result.success) {
      return false;
    }
    gameLoadingController.setStage("loadingReady", 1);
    renderPixiFrame(performance.now());
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    characterSelectorController.close();
    gameWelcome.hidden = true;
    gameLoadingController.hide();
    setGameSessionUiActive(true);
    return true;
  } catch (error) {
    console.error("[Startup] Game initialization failed:", error);
    setGameSessionUiActive(false);
    gameLoadingController.fail();
    return false;
  }
};

const shouldEnterGameImmediately = initializeGameWelcome();
void preloadGameShell().catch((error) => {
  console.warn("[Startup] Background preload will retry when the game starts:", error);
});
if (shouldEnterGameImmediately) {
  void startGame();
}

//#endregion  -----  INITIALISATION DU JEU  -----
