import {
  clearPixiItemUseTargets,
  clearPixiMonsterSelection,
  clearPixiMonsterVisuals,
  clearPixiWorldItemSelection,
  clearPixiWorldItemVisuals,
  initializePixiRenderer,
  loadPixiWorldEntityTextures,
  playPixiItemProjectile,
  playPixiRewardChestEffect,
  playPixiSpellEffect,
  removePixiNpcVisual,
  removePixiMonsterVisual,
  removePixiWorldItemVisual,
  renderPixiFrame,
  renderPixiVisibleWorldChunks,
  setPixiMonsterSelected,
  setPixiItemUseTargets,
  setPixiWorldItemSelected,
  updatePixiCamera,
  updatePixiMonsterTransform,
  updatePixiNpcTransform,
  updatePixiWorldItemTransform,
  upsertPixiMonsterVisual,
  upsertPixiNpcVisual,
  upsertPixiWorldItemVisual,
} from "./pixiRendererFacade.js";
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
  PLAYER_MOVE_COOLDOWN_MS,
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
import {
  clamp,
  getManhattanDistance,
  getRandomFloat,
  getRandomInt,
  isEmpty,
} from "./core/mathUtils.js";
import { getAtlasSource } from "./core/atlasUtils.js";
import { startFixedStepGameLoop } from "./core/fixedStepGameLoop.js";
import { createClientBootstrap } from "./core/clientBootstrap.js";
import { createGameSystemsOrchestrator } from "./core/gameSystemsOrchestrator.js";
import {
  createAttackMonsterAction,
  createCastSpellAction,
  createMovePlayerAction,
  createSpeakToNpcAction,
  createUseWorldTransitionAction,
  createWorldInteractionAction,
} from "./actions/gameplayActions.js";
import { createChatController } from "./chat/chatController.js";
import {
  createInsertItemsAction,
  createMoveItemAction,
  INVENTORY_ACTION_REASON,
} from "./inventory/inventoryActions.js";
import { createGameSimulation } from "./simulation/gameSimulation.js";
import { createLocalGameTransport } from "./simulation/localGameTransport.js";
import { createGameActionEffectRouter } from "./simulation/gameActionEffectRouter.js";
import { applyDamageToPlayer } from "./combat/playerHealth.js";
import { createInventoryDragController } from "./inventory/inventoryDragController.js";
import {
  createItemLocationController,
  isValidContainerSlotParent as isValidContainerSlotParentRule,
} from "./inventory/itemLocationController.js";
import {
  activeLitTorchesByUid,
  decayingItems,
  monsterElementsByUid,
  monstersByUid,
  monsterSpawnDefinitionsById,
  monsterSpawnStateById,
  npcConversationStatesByUid,
  npcElementsByUid,
  npcsByUid,
  openedContainers,
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
} from "./world/worldItemStacks.js";
import { getEntityRenderSortY, getWorldRenderZIndex } from "./render/renderOrder.js";
import { applyItemRenderPartPosition, getAtlasPath, getHpColor } from "./render/domRenderUtils.js";
import { getDirectionRow } from "./render/spriteDirection.js";
import {
  getPlayerFloatingTextElement,
  initializePlayerRenderRefs,
  refreshPlayerHpBar,
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
  removeMonsterFromState,
} from "./monsters/monsterIndex.js";
import { getNpcData, getNpcTextureUrlsById } from "./npcs/npcModel.js";
import {
  findNpcAtPosition,
  getNpcsInChunkRadius,
  initializeNpcsForWorldMaps,
  isNpcAtPosition,
  moveNpcInTileIndex,
} from "./npcs/npcIndex.js";
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
  addOrRefreshGroundEffect,
  getGroundEffectData,
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
} from "./ui/characterSelectorController.js";
import { createGameOptionsController } from "./ui/gameOptionsController.js";
import { createMobileJoystickController } from "./ui/mobileJoystickController.js";
import { createQuestWindowController } from "./ui/questWindowController.js";
import { getCurrentWorldMap } from "./world/worldRuntime.js";
import { createMinimapController } from "./minimap/minimapController.js";
import {
  commitPlayerBackpackItemRemovalPlan,
  commitPlayerCurrencyValuePlan,
  createPlayerBackpackItemRemovalPlan,
  createPlayerCurrencyValuePlan,
  createPlayerGoldPaymentPlan,
  getPlayerBankGoldAmount,
  getPlayerCurrencyValuePlanWeightDifference,
  getPlayerGoldAmount,
  getRewardTableData,
  rollbackPlayerBackpackItemRemovalPlan,
  rollbackPlayerCurrencyValuePlan,
  spendPlayerGold,
} from "./inventory/inventoryTransactions.js";
import {
  applyPlayerCurrentVitalLevelUpGains,
  canUseShieldingBlock,
  getLevelFromExperience,
  getPlayerClassData,
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
  createPathfinder,
  getCardinalDirectionFromTileDelta,
  getDistanceToClosestTile,
  getNeighbors,
  getPathMovementCost,
  getTileMovementAnimationMultiplier,
  getTileMovementCost,
  hasLineOfSightBetweenTiles,
} from "./world/pathfinding.js";

import { panneauGauche, panneauDroite, boitePrincipale, playerMinimap, minimapCanvas, minimapZoomOutButton, minimapZoomInButton, minimapCenterButton, minimapFloorUpButton, minimapFloorDownButton, playerStats, playerInventory, playerQuests, gameOptionsWindow, playerSpells, gameWelcome, gameWelcomePlayButton, gameWelcomeLanguageButtons, characterSelector, stackSplitMenu, playerContainers, player, game, boiteJeux, nav, boiteChat, chat, chatTabs, chatInput, boiteJeuxInner, lightCanvas, fpsCounter, gameStatusMessage, mobileGameControls, mobileJoystickZone, mobileJoystick, mobileJoystickKnob, mobilePanelButtons, mobileActionButtons, mobilePanelCloseButton, mobilePlayerName, mobilePlayerLevel, mobilePlayerHealthFill, mobilePlayerHealthValue, mobilePlayerManaFill, mobilePlayerManaValue, mobilePlayerSanityFill, mobilePlayerSanityValue, mobileTargetHud, mobileTargetName, mobileTargetValue, mobileTargetHealthFill, mobileItemUseIndicator, mobileItemUseIcon, mobileItemUseLabel, mobileStanceIcon, mobileStanceLabel } from "./ui/domRefs.js";


/* ==================================================== */
//#region     -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----
/* ==================================================== */
/* ---------- BASE - DIMENSIONS ET ATLAS ---------- */

let GAME_SCALE = 1;

/* ---------- BASE - TILES ---------- */

/* ---------- BASE - UID ET SELECTION ---------- */


/* ---------- BASE - COLLECTIONS MONDE ---------- */
const itemCooldownOverlayElements = new Set();
let gameSimulation = null;
let gameTransport = null;

/* ---------- BASE - ETAT DRAG ---------- */
/* ---------- BASE - SPAWN JOUEUR ---------- */

/* ---------- BASE - CAMERA ET SOURIS ---------- */
const minChatHeight = 120;
/* ---------- BASE - ETAT ITEM USE ---------- */


const CHARACTER_AUTOSAVE_INTERVAL_MS = 30000;

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
let clientBootstrap = null;
let gameSystemsOrchestrator = null;
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

const resetPlayerPositionToSpawn = () => {
  if (!(pixiWorldRenderState?.worldMapsByZ instanceof Map) || !playerState?.spawn) {
    return;
  }

  if (
    !Number.isInteger(playerState.spawn.z) ||
    typeof playerState.spawn.spawnId !== "string" ||
    playerState.spawn.spawnId === ""
  ) {
    return;
  }
  const worldMap = pixiWorldRenderState.worldMapsByZ.get(playerState.spawn.z);
  if (!worldMap) {
    return;
  }
  const playerSpawn = findPlayerSpawnInWorldMap(worldMap, playerState.spawn.spawnId);
  if (!playerSpawn) {
    return;
  }
  playerState.z = playerState.spawn.z;
  pixiWorldRenderState.currentZ = playerState.z;
  applyPlayerSpawn(playerSpawn);
};

const updatePlayerRegeneration = (now) => {
  if (advancePlayerRegeneration(now)) {
    refreshPlayerVitalsUi();
  }
};

const applyPlayerDeathExperiencePenalty = () => {
  playerState.experience = Math.floor(playerState.experience * 0.9);
  if (playerState.experience < 0) {
    playerState.experience = 0;
  }
};

const dropPlayerCorpse = () => {
  const bag = getEquipmentSlotItem("backpack");
  if (bag) {
    closeContainerAndChildren(bag);
    playerState.equipment.backpack = null;
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y, playerState.z, [bag]));
  } else {
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y, playerState.z));
  }
};

const restoreHp = (creature) => {
  if (!creature || !("hp" in creature) || !("maxHp" in creature)) {
    return;
  }
  creature.hp = creature.maxHp;
};

const playerDead = () => {
  dropPlayerCorpse();
  refreshItemUiAfterDrag();
  applyPlayerDeathExperiencePenalty();
  restoreHp(playerState);
  resetPlayerPositionToSpawn();
  resetAfterDeath();
};

const resetAfterDeath = () => {
  combatTargetState.monsterUid = null;
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
  if (result?.success) {
    playGameSfx(GAME_SFX.ropeUse);
  }
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

const findInteractableAtTile = (worldMap, col, row) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }

  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!chunk || !Array.isArray(chunk.interactables)) {
    return null;
  }

  for (const interactable of chunk.interactables) {
    if (isTileInsideTiledObject(col, row, interactable)) {
      return interactable;
    }
  }

  return null;
};

const isPlayerNearTiledObject = (tiledObject, range = 1) => {
  if (
    !tiledObject ||
    tiledObject.z !== playerState.z ||
    !Number.isFinite(playerState.x) ||
    !Number.isFinite(playerState.y) ||
    !Number.isInteger(range) ||
    range < 0 ||
    !Number.isInteger(tiledObject.col) ||
    !Number.isInteger(tiledObject.row) ||
    !Number.isFinite(tiledObject.width) ||
    !Number.isFinite(tiledObject.height)
  ) {
    return false;
  }

  const widthTiles = Math.max(Math.ceil(tiledObject.width / TILE_SIZE), 1);
  const heightTiles = Math.max(Math.ceil(tiledObject.height / TILE_SIZE), 1);
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const nearestCol = clamp(playerCol, tiledObject.col, tiledObject.col + widthTiles - 1);
  const nearestRow = clamp(playerRow, tiledObject.row, tiledObject.row + heightTiles - 1);
  return Math.abs(playerCol - nearestCol) <= range && Math.abs(playerRow - nearestRow) <= range;
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

const executeRewardChestInteraction = (interactable) => {
  if (!interactable?.properties || !isPlayerNearTiledObject(interactable, 1)) {
    return { success: false, reason: "out-of-range" };
  }

  const { interactableId, questId, rewardTableId } = interactable.properties;
  const questData = getQuestData(questId);
  const rewardTable = getRewardTableData(rewardTableId);
  if (typeof interactableId !== "string" || interactableId === "" || !questData || !Array.isArray(rewardTable?.items)) {
    return { success: false, reason: "configuration" };
  }

  if (hasPlayerClaimedInteractableReward(interactableId)) {
    return { success: false, reason: "already-claimed", changes: { questId } };
  }

  const grantResult = grantRewardItemsToPlayer(rewardTable.items);
  if (!grantResult.success) {
    return { success: false, reason: grantResult.reason };
  }

  const now = Date.now();
  recordPlayerInteractableRewardClaim(interactableId, now);
  setPlayerQuestStatus(questId, QUEST_STATUS.completed, now);
  return {
    success: true,
    changes: { interactableId, questId, claimedAt: now },
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
  if (!result?.success) {
    if (result?.reason === "already-claimed") {
      const questId = interactable?.properties?.questId;
      const questData = getQuestData(questId);
      const localizedQuestData = getLocalizedQuestData(questId) ?? questData;
      if (localizedQuestData) {
        addLogMessage(getGameUiText("questAlreadyCompleted")(localizedQuestData.name), "system");
      }
    } else {
      addRewardChestFailureFeedback(result?.reason);
    }
  }
  return result?.success === true;
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

const findTransitionAtTile = (worldMap, col, row) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }

  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!chunk || !Array.isArray(chunk.transitions)) {
    return null;
  }

  for (const transition of chunk.transitions) {
    if (isTileInsideTiledObject(col, row, transition)) {
      return transition;
    }
  }

  return null;
};

const setPlayerWorldPosition = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  playerState.x = x;
  playerState.y = y;
  playerState.oldX = x;
  playerState.oldY = y;
  playerState.renderX = x;
  playerState.renderY = y;
  playerState.moveStartTime = 0;
  playerState.moveDuration = 0;

  return true;
};

const executePlayerWorldTransition = (transition) => {
  const targetZ = transition?.properties?.targetZ;
  const targetCol = transition?.properties?.targetCol;
  const targetRow = transition?.properties?.targetRow;

  if (!Number.isInteger(targetZ) || !Number.isInteger(targetCol) || !Number.isInteger(targetRow)) {
    return { success: false, reason: "invalid-transition" };
  }

  if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return { success: false, reason: "world-not-loaded" };
  }

  const targetWorldMap = pixiWorldRenderState.worldMapsByZ.get(targetZ);
  if (!targetWorldMap) {
    return { success: false, reason: "target-floor-not-found" };
  }

  const targetX = targetCol * TILE_SIZE;
  const targetY = targetRow * TILE_SIZE;

  const previousZ = playerState.z;
  playerState.z = targetZ;

  if (!setPlayerWorldPosition(targetX, targetY)) {
    playerState.z = previousZ;
    return { success: false, reason: "invalid-target-position" };
  }

  return {
    success: true,
    changes: { x: targetX, y: targetY, z: targetZ, previousZ },
    events: [
      {
        type: "player-world-transitioned",
        playerUid: playerState.uid,
        x: targetX,
        y: targetY,
        z: targetZ,
        previousZ,
      },
    ],
  };
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

const isTileInsideTiledObject = (tileCol, tileRow, tiledObject) => {
  if (
    !Number.isInteger(tileCol) ||
    !Number.isInteger(tileRow) ||
    !Number.isInteger(tiledObject?.col) ||
    !Number.isInteger(tiledObject?.row) ||
    !Number.isFinite(tiledObject?.width) ||
    !Number.isFinite(tiledObject?.height)
  ) {
    return false;
  }

  const widthTiles = Math.ceil(tiledObject.width / TILE_SIZE);
  const heightTiles = Math.ceil(tiledObject.height / TILE_SIZE);

  if (widthTiles <= 0 || heightTiles <= 0) {
    return false;
  }

  return (
    tileCol >= tiledObject.col &&
    tileCol < tiledObject.col + widthTiles &&
    tileRow >= tiledObject.row &&
    tileRow < tiledObject.row + heightTiles
  );
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
        left: item.x - camera.x,
        top: item.y - camera.y,
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
const refreshInventoryUi = () => {
  updatePlayerCarriedWeight();
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
        const freeCapSpace = playerState.capacity - calculatePlayerCarriedWeight();
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
      if (getItemTotalWeight(sourceItem) > getPlayerRemainingCapacity()) {
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

const closeContainerAndChildren = (containerToClose) =>
  containerWindowController.closeWithChildren(containerToClose);

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
  if (!sourceItem || sourceItem.uid !== itemUid) {
    cancelItemDrag();
    return { success: false, reason: INVENTORY_ACTION_REASON.itemChanged };
  }
  if (source.locationType === "worldItem" && !isWorldItemAvailableForInteraction(sourceItem)) {
    cancelItemDrag();
    return { success: false, reason: INVENTORY_ACTION_REASON.invalidSource };
  }

  if (source.locationType === "worldItem" && !canInteractWithWorldItemSource(source)) {
    cancelItemDrag();
    return { success: false, reason: INVENTORY_ACTION_REASON.invalidSource };
  }

  const destinationItem = getDragSourceItem(destination);
  const dragSfxSnapshot = createItemDragSfxSnapshot(source, sourceItem, destination, destinationItem);

  if (tryMoveItemToWorldDuringDrag(source, sourceItem, destination)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  if (!isDropStackToStack(sourceItem, destinationItem)) {
    if (isExceedCapacity(source, destination, sourceItem)) {
      showGameStatusMessage(getGameUiText("notEnoughCapacity"));
      cancelItemDrag();
      return { success: false, reason: INVENTORY_ACTION_REASON.capacityExceeded };
    }
  }

  if (isSameDragSourceAndDestination(source, destination)) {
    cancelItemDrag();
    return { success: false, reason: INVENTORY_ACTION_REASON.moveRejected };
  }

  let destinationContainer = null;
  if (destination.locationType === "containerSlot") {
    destinationContainer = getParentContainerFromContainerSlotLocation(destination);

    if (!isValidContainerSlotParent(destinationContainer)) {
      cancelItemDrag();
      return { success: false, reason: INVENTORY_ACTION_REASON.invalidDestination };
    }
  }

  if (isContainerMoveIntoItself(sourceItem, destinationContainer)) {
    showGameStatusMessage(getGameUiText("cannotPlaceItem"));
    cancelItemDrag();
    return { success: false, reason: INVENTORY_ACTION_REASON.invalidDestination };
  }

  if (tryStackItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  if (isContainerMoveIntoContainerItemItself(sourceItem, destinationItem)) {
    showGameStatusMessage(getGameUiText("cannotPlaceItem"));
    cancelItemDrag();
    return { success: false, reason: INVENTORY_ACTION_REASON.invalidDestination };
  }

  if (tryMoveItemOnContainerItemDuringDrag(source, sourceItem, destinationItem)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  if (tryMoveItemToFreeContainerSlotInsteadOfSwapDuringDrag(source, sourceItem, destination, destinationItem)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  if (tryMoveItemToEmptySlotDuringDrag(source, sourceItem, destination, destinationItem)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  if (tryMoveEquipmentItemToContainerWhenSwapInvalidDuringDrag(source, destination, destinationItem)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  if (trySwapItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    return createInventoryMoveExecutionResult(dragSfxSnapshot);
  }

  showGameStatusMessage(getGameUiText("cannotPlaceItem"));
  cancelItemDrag();
  return { success: false, reason: INVENTORY_ACTION_REASON.moveRejected };
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
  return gameTransport.send(action);
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
    equipmentElement.classList.toggle(
      "equipment-slot-ammunition-mode",
      slotName === "shield" && weaponUsesAmmunition,
    );
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
const renderOptionsWindow = () => gameOptionsController.render();
const toggleOptionsWindow = () => gameOptionsController.toggle();

const showPvpUnavailableMessage = () => {
  showGameStatusMessage(getGameUiText("pvpUnavailable"));
};

const logoutCurrentCharacter = () => {
  if (!saveCurrentCharacterBeforeSwitch()) {
    return;
  }

  gameRuntimeState.isSwitchingCharacter = true;
  try {
    sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
  } catch {
    // The welcome screen is still the default destination without session storage.
  }
  stopGameMusic();
  window.location.reload();
};

const bindEquipmentMenuButtons = () => {
  const pvpButton = playerInventory.querySelector('[data-ui-action="show-pvp-status"]');
  const hotkeyButton = playerInventory.querySelector('[data-ui-action="toggle-spells"]');
  const optionsButton = playerInventory.querySelector('[data-ui-action="toggle-options"]');
  const logoutButton = playerInventory.querySelector('[data-ui-action="logout"]');
  pvpButton?.addEventListener("click", showPvpUnavailableMessage);
  hotkeyButton?.addEventListener("click", toggleSpellWindow);
  optionsButton?.addEventListener("click", toggleOptionsWindow);
  logoutButton?.addEventListener("click", logoutCurrentCharacter);
};

/* ---------- UI - SORTS ET HOTKEYS ---------- */

const isPlayerSpellLearned = (spellId) => playerSpellSystem.isLearned(spellId);
const getLearnedPlayerSpells = () => playerSpellSystem.getLearned();
const assignPlayerSpellToHotkey = (hotkeyIndex, spellId) =>
  playerSpellSystem.assignToHotkey(hotkeyIndex, spellId);

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
  closeButtonElement.textContent = "x";
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
  const selectedSpellData = spellUiState.selectedSpellId
    ? getLocalizedSpellData(spellUiState.selectedSpellId)
    : null;
  if (isMobileAssigning) {
    helpElement.textContent = getGameUiText("mobileSpellAssignPrompt")(
      SPELL_HOTKEY_KEYS[mobileAssignHotkeyIndex],
    );
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
      clearButtonElement.setAttribute(
        "aria-label",
        getGameUiText("clearSpellSlot")(SPELL_HOTKEY_KEYS[hotkeyIndex]),
      );
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
      assignButtonElement.setAttribute("aria-pressed", spellUiState.selectedSpellId === spellData.spellId ? "true" : "false");
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
                <div class="boite-jeux-titre">${getGameUiText("equipments")}</div>
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
                      <div class="equipment-small-slot equipment-cap-slot">${getGameUiText("capacityShort")}:<br />${getPlayerRemainingCapacity()}</div>
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
  renderEquipmentSlots();
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
  refreshItemUiAfterDrag();
  return true;
};

const startUseCooldown = (cooldownGroup) => {
  if (!beginUseCooldown(cooldownGroup)) {
    return;
  }
  updateItemCooldownOverlays(Date.now());
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

  clearPixiItemUseTargets();
};

const getOpenedContainerRootWrapper = (containerWrapper) =>
  containerWindowController.getRootWrapper(containerWrapper);
const findOpenedContainerWrapperByUid = (containerUid) =>
  containerWindowController.findWrapperByUid(containerUid);

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
  refreshAllByUid(item.uid);
  return true;
};

const createFluidPuddle = (groundEffectId, x, y, z, decayStage = 0) => {
  if (
    !getGroundEffectData(groundEffectId) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(z)
  ) {
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

  return addOrRefreshGroundEffect(groundEffectId, x, y, z, decayStage);
};

const restorePlayerVitalFromPotion = (item, useData) => {
  const restoreData = potionRestoreStats[useData?.restoreStat] ?? null;
  if (!restoreData || !Number.isFinite(useData.restoreAmount) || useData.restoreAmount <= 0) {
    return false;
  }

  const currentAmount = playerState[useData.restoreStat];
  const maximumAmount = playerState[restoreData.maxStat];
  if (!Number.isFinite(currentAmount) || !Number.isFinite(maximumAmount)) {
    return false;
  }
  if (currentAmount >= maximumAmount) {
    showGameStatusMessage(getGameUiText(restoreData.fullMessageKey));
    return false;
  }

  const restoredAmount = Math.min(useData.restoreAmount, maximumAmount - currentAmount);
  if (!replacePotionWithEmptyBottle(item, useData.emptyItemId)) {
    return false;
  }

  playerState[useData.restoreStat] += restoredAmount;
  showFloatingTextAbovePlayer(restoredAmount, restoreData.floatingTextType);
  refreshPlayerVitalsUi();
  return true;
};

const pourPotionOnTile = (item, useData, tile) => {
  const fluidPuddle = createFluidPuddle(useData?.groundEffectId, tile?.x, tile?.y, playerState.z);
  if (!fluidPuddle) {
    showGameStatusMessage(getGameUiText("cannotPourPotion"));
    return false;
  }

  if (!replacePotionWithEmptyBottle(item, useData.emptyItemId)) {
    return false;
  }
  return true;
};

const handleDrinkPotionUse = (source, item, useData, target) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (!isUseCooldownReady(cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    cancelItemUse();
    return;
  }
  if (target.player) {
    if (restorePlayerVitalFromPotion(item, useData)) {
      playGameSfx(GAME_SFX.drinkPotion);
      startUseCooldown(cooldownGroup);
    }
  } else if (target.tile) {
    if (!isNearPlayer(target.tile, useData.range)) {
      startPlayerActionNavigation({
        type: PLAYER_ACTION_TYPE.targetItemUse,
        itemUid: item.uid,
        targetType: "tile",
        targetTile: { ...target.tile, z: playerState.z },
      });
    } else if (pourPotionOnTile(item, useData, target.tile)) {
      startUseCooldown(cooldownGroup);
    }
  }

  cancelItemUse();
};

const handleRuneUse = (source, item, useData, target) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (!isUseCooldownReady(cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    cancelItemUse();
    return;
  }
  if (
    target.monster?.hp > 0 &&
    target.monster.z === playerState.z &&
    !isNearPlayer(target.monster, useData.range)
  ) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.targetItemUse,
      itemUid: item.uid,
      targetType: "monster",
      targetUid: target.monster.uid,
    });
  } else if (target.monster && isMonsterValidRuneTarget(target.monster, useData)) {
    if (!hasPlayerLineOfSightToEntity(target.monster)) {
      showGameStatusMessage(getGameUiText("runeBlockedByWall"));
      cancelItemUse();
      return;
    }
    if (!consumeOneChargeFromRune(item, source)) {
      cancelItemUse();
      return;
    }
    const attackResult = calculateRuneAttackResult(useData);
    applyDamageToMonster(target.monster, attackResult);
    playGameSfx(GAME_SFX.runeUse);
    startUseCooldown(cooldownGroup);
  } else if (target.monster) {
    showGameStatusMessage(getGameUiText("targetOutOfRange"));
  }
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
    refreshItemUiAfterDrag();
    return true;
  } else if (item.quantity > 1) {
    item.quantity -= 1;
    refreshItemUiAfterDrag();
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

const splitItemStack = (source, expectedItemUid, splitQuantity) => {
  const item = getDragSourceItem(source);
  const itemData = getItemData(item?.itemId);
  if (
    !itemData?.stackable ||
    item.uid !== expectedItemUid ||
    !Number.isInteger(splitQuantity) ||
    splitQuantity <= 0 ||
    splitQuantity >= item.quantity
  ) {
    return false;
  }

  if (source.locationType === "containerSlot") {
    const parentContainer = getParentContainerFromContainerSlotLocation(source);
    const emptySlotIndex = findFirstEmptyContainerSlot(parentContainer);
    if (emptySlotIndex === null) {
      showGameStatusMessage(getGameUiText("splitStackNeedsSpace"));
      return false;
    }
    const splitItem = createItemInstance(item.itemId, splitQuantity);
    if (!splitItem) {
      return false;
    }
    parentContainer.content[emptySlotIndex] = splitItem;
  } else if (source.locationType === "worldItem") {
    if (!canInteractWithWorldItemSource(source)) {
      return false;
    }
    const splitItem = createGroundItem(item.itemId, splitQuantity, item.x, item.y, item.z);
    if (!splitItem || !addGroundItem(splitItem)) {
      return false;
    }
  } else {
    return false;
  }

  item.quantity -= splitQuantity;
  refreshItemUiAfterDrag();
  autosaveCurrentCharacter();
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
    if (splitItemStack(sourceSnapshot, itemUid, quantity)) {
      closeStackSplitMenu();
    }
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

const handleEatFoodUse = (item, source, useData) => {
  if (!item || !source || !Number.isFinite(useData?.sanity) || useData.sanity <= 0) {
    return false;
  }

  const nextSanity = playerState.sanity + useData.sanity;
  if (nextSanity > playerState.maxSanity) {
    showGameStatusMessage(getGameUiText("alreadyFull"));
    return false;
  }

  if (!consumeOneItemFromSource(source, item)) {
    return false;
  }

  const wasRegenerationInactive = playerState.sanity <= 0 || playerState.regeneration.nextHealthRegenAt === 0;
  playerState.sanity = nextSanity;
  if (wasRegenerationInactive) {
    startPlayerRegenerationTimers(Date.now());
  }

  refreshPlayerVitalsUi();
  playGameSfx(GAME_SFX.eat);
  return true;
};

const canLightTorchFromSource = (source) => {
  return ["worldItem", "equipmentSlot", "containerSlot"].includes(source?.locationType);
};

const handleToggleTorchUse = (item, source) => {
  const itemData = getItemData(item?.itemId);
  if (!itemData?.lightSource || !Number.isFinite(item.fuelRemainingMs)) {
    return false;
  }

  if (item.isLit) {
    syncTorchFuel(item, Date.now());
    item.isLit = false;
    item.lastFuelUpdateAt = 0;
    activeLitTorchesByUid.delete(item.uid);
    refreshAllByUid(item.uid);
    return true;
  }

  if (item.fuelRemainingMs <= 0) {
    showGameStatusMessage(getGameUiText("torchBurnedOut"));
    return false;
  }
  if (!canLightTorchFromSource(source)) {
    showGameStatusMessage(getGameUiText("torchNeedsPlacement"));
    return false;
  }

  item.isLit = true;
  item.lastFuelUpdateAt = Date.now();
  activeLitTorchesByUid.set(item.uid, item);
  refreshAllByUid(item.uid);
  playGameSfx(GAME_SFX.torchOn);
  return true;
};

const executeDirectItemUse = (item, source) => {
  if (!item) {
    return;
  }
  const useData = getItemUseData(item);
  if (!useData || !useData.action) {
    return;
  }
  if (useData.action === "eat") {
    handleEatFoodUse(item, source, useData);
  } else if (useData.action === "toggleTorch") {
    handleToggleTorchUse(item, source);
  } else if (useData.action === "splitCurrencyStack") {
    openStackSplitMenu(item, source);
  }
};
//#endregion  -----  ITEMS - UTILISATION ET COOLDOWNS  -----

/* ==================================================== */
//#region     -----  UI - COMBAT MODE  -----
/* ==================================================== */

/* ---------- UI - COMBAT MODE ---------- */

const setPlayerCombatMode = (combatMode) => {
  playerState.combatMode = combatMode;
};

const MOBILE_COMBAT_MODE_ORDER = ["fullAttack", "balanced", "fullDefense"];
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
  refreshCombatModeButtons();
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
      refreshCombatModeButtons();
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
  setProgressTooltipText(row.tooltipElement, getGameUiText("xpRemaining")(skillProgressData.experienceNeededForNextLevel));
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
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.textContent = getGameUiText("stats");
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
    titleElement,
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
  setProgressTooltipText(rows.hp.tooltipElement, `${playerState.hp}/${playerState.maxHp} HP`);
  setProgressTooltipText(rows.mana.tooltipElement, `${playerState.mana}/${playerState.maxMana} mana`);
  setProgressTooltipText(rows.sanity.tooltipElement, `${playerState.sanity}/${playerState.maxSanity} ${getGameUiText("sanityLabel").replace(":", "").toLowerCase()}`);
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
  const skillLevelByExperience = getSkillLevelFromExperience(playerState.skills[skillKey].experience);
  if (playerState.skills[skillKey].level < skillLevelByExperience) {
    addSkillLevelUpFeedback(skillKey, skillLevelByExperience);
  }
  playerState.skills[skillKey].level = skillLevelByExperience;
  updateSkillStatRow(skillKey);
};

const updateAllPlayerSkillLevels = () => {
  for (const [skillKey, skill] of Object.entries(playerState.skills)) {
    skill.level = getSkillLevelFromExperience(skill.experience);
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

const addSkillLevelUpFeedback = (skillKey, newLevel) => {
  const logMessage = getGameUiText("skillAdvanced")(getLocalizedSkillName(skillKey), newLevel);
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
};

/* ---------- UI - SCALE DU JEU ---------- */

const MOBILE_GAME_LAYOUT_QUERY = "(max-width: 900px), (max-width: 1024px) and (pointer: coarse)";
const MOBILE_JOYSTICK_DIAGONAL_HOLD_MS = 500;
const mobileGameLayoutMedia = window.matchMedia(MOBILE_GAME_LAYOUT_QUERY);

const mobileGameUiState = {
  openPanel: null,
  joystickPointerId: null,
  joystickWasMoving: false,
  joystickDiagonalCandidate: null,
  joystickDiagonalReady: false,
  joystickDiagonalTimeoutId: null,
  joystickClientX: null,
  joystickClientY: null,
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

const setOpenMobilePanel = (panelName = null) => {
  const nextPanelName = mobileGameUiState.openPanel === panelName ? null : panelName;
  mobileGameUiState.openPanel = nextPanelName;
  mobileGameControls?.classList.toggle("mobile-game-controls-panel-open", nextPanelName !== null);
  mobileGameControls?.classList.toggle("mobile-game-controls-chat-open", nextPanelName === "chat");
  mobilePanelCloseButton?.toggleAttribute("hidden", nextPanelName === null);

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
  mobilePlayerLevel.textContent = `Lv ${playerState.level}`;
  setMobileHudProgress(mobilePlayerHealthFill, mobilePlayerHealthValue, playerState.hp, playerState.maxHp);
  setMobileHudProgress(mobilePlayerManaFill, mobilePlayerManaValue, playerState.mana, playerState.maxMana);
  setMobileHudProgress(mobilePlayerSanityFill, mobilePlayerSanityValue, playerState.sanity, playerState.maxSanity);
};

const syncMobileTargetHud = () => {
  const monster = combatTargetState.monsterUid === null ? null : (monstersByUid.get(combatTargetState.monsterUid) ?? null);
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

  setOpenMobilePanel(null);
  openContainer(backpack, getLocalizedItemName(backpack.itemId), "equipment", null);
};

const syncMobileGameLayout = () => {
  const mobileLayout = isMobileGameLayout();
  mobileGameControls?.setAttribute("aria-hidden", String(!mobileLayout));
  if (!mobileLayout) {
    setOpenMobilePanel(null);
    spellUiState.mobileAssignHotkeyIndex = null;
  }
  syncMobilePlayerHud();
  syncMobileTargetHud();
  syncMobileBackpackButton();
  syncMobileFollowButton();
  syncMobileStanceButton();
  syncItemUseSourceFeedback();
  renderSpellWindow();
  updateGameScale();
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
  const target = combatEntry?.target;
  const element = combatEntry?.element;
  if (!target || !element) {
    return;
  }
  if (target.z !== playerState.z) {
    element.style.display = "none";
    return;
  }
  const monsterData = getMonsterData(target.monsterId);
  const renderX = Number.isFinite(target.renderX) ? target.renderX : target.x;
  const renderY = Number.isFinite(target.renderY) ? target.renderY : target.y;
  const drawOffsetX = monsterData?.drawOffsetX ?? 0;
  const drawOffsetY = monsterData?.drawOffsetY ?? 0;
  const drawWidth = monsterData?.drawWidth ?? TILE_SIZE;
  const surfaceOffsetY = getEntitySurfaceOffsetY(target);
  element.style.left = `${renderX + drawOffsetX - camera.x + drawWidth / 2}px`;
  element.style.top = `${renderY + drawOffsetY - camera.y - surfaceOffsetY}px`;
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

const showFloatingTextAboveMonster = (monster, text, type) => {
  if (!monster || !game) {
    return;
  }
  const textElement = document.createElement("div");
  textElement.classList.add("floating-combat-text");
  textElement.classList.add(`floating-combat-text-${type}`);
  textElement.textContent = `${text}`;
  game.appendChild(textElement);
  const combatEntry = {
    target: monster,
    element: textElement,
  };
  floatingTextState.combatEntries.add(combatEntry);
  updateCombatFloatingTextEntryPosition(combatEntry);
  setTimeout(() => {
    floatingTextState.combatEntries.delete(combatEntry);
    textElement.remove();
  }, 1300);
};

const showFloatingTextAbovePlayer = (text, type) => {
  const playerTextElement = getPlayerFloatingTextElement();
  if (!playerTextElement) {
    return;
  }
  const textElement = document.createElement("div");
  textElement.classList.add("floating-combat-text");
  textElement.classList.add(`floating-combat-text-${type}`);
  textElement.textContent = `${text}`;
  playerTextElement.appendChild(textElement);
  setTimeout(() => {
    textElement.remove();
  }, 1300);
};

//#endregion  -----  UI - STATS, SCALE ET TEXTES FLOTTANTS  -----

/* ==================================================== */
//#region     -----  LIGHT - CANVAS  -----
/* ==================================================== */
lightCanvas.width = GAME_WIDTH;
lightCanvas.height = GAME_HEIGHT;
const ctx = lightCanvas.getContext("2d");

/* ---------- LUMIERE - AFFICHAGE ---------- */

const getLightSourceScreenPosition = (source, surfaceOffsetY = 0) => {
  const worldX = Number.isFinite(source?.renderX) ? source.renderX : source?.x;
  const worldY = Number.isFinite(source?.renderY) ? source.renderY : source?.y;
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    return null;
  }
  return {
    screenX: worldX - camera.x + TILE_SIZE / 2,
    screenY: worldY - camera.y + TILE_SIZE / 2 - surfaceOffsetY,
  };
};

const getTorchLightRadius = (item) => {
  const itemData = getItemData(item?.itemId);
  const fuelStage = getTorchFuelStage(item);
  return itemData?.lightSource?.radiusByStage?.[fuelStage] ?? 0;
};

const getActiveTorchLightSources = () => {
  const lightSources = [];
  for (const item of activeLitTorchesByUid.values()) {
    if (!item.isLit || item.fuelRemainingMs <= 0) {
      continue;
    }

    if (playerState.equipment.ammo === item) {
      lightSources.push({ item, source: playerState, surfaceOffsetY: getEntitySurfaceOffsetY(playerState) });
      continue;
    }

    if (worldItemsByUid.get(item.uid) === item && item.z === playerState.z) {
      lightSources.push({ item, source: item, surfaceOffsetY: getWorldItemStackOffsetY(item) });
    }
  }
  return lightSources;
};

const drawDarknessCutout = (screenX, screenY, radius, centerOpacity) => {
  const gradient = ctx.createRadialGradient(screenX, screenY, 12, screenX, screenY, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${centerOpacity})`);
  gradient.addColorStop(0.65, `rgba(0, 0, 0, ${centerOpacity * 0.2})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - radius, screenY - radius, radius * 2, radius * 2);
};

const drawTorchGlow = (screenX, screenY, radius) => {
  const glowRadius = radius * 0.85;
  const gradient = ctx.createRadialGradient(screenX, screenY, 16, screenX, screenY, glowRadius);
  gradient.addColorStop(0, "rgba(255, 246, 169, 0.015)");
  gradient.addColorStop(0.55, "rgba(255, 174, 45, 0.055)");
  gradient.addColorStop(1, "rgba(255, 70, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - glowRadius, screenY - glowRadius, glowRadius * 2, glowRadius * 2);
};

const getActivePlayerSpellLightRadius = (now) => {
  const lightEffect = playerState.spellEffects.light;
  if (!Number.isFinite(now) || lightEffect.expiresAt <= now) {
    return 0;
  }
  return lightEffect.radius;
};

const drawMagicLightGlow = (screenX, screenY, radius) => {
  const glowRadius = radius * 0.75;
  const gradient = ctx.createRadialGradient(screenX, screenY, 12, screenX, screenY, glowRadius);
  gradient.addColorStop(0, "rgba(222, 239, 255, 0.04)");
  gradient.addColorStop(0.6, "rgba(139, 194, 255, 0.025)");
  gradient.addColorStop(1, "rgba(90, 150, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - glowRadius, screenY - glowRadius, glowRadius * 2, glowRadius * 2);
};

const drawOutdoorSunlight = () => {
  const radius = Math.max(GAME_WIDTH, GAME_HEIGHT);
  const gradient = ctx.createRadialGradient(GAME_WIDTH * 0.18, 0, 0, GAME_WIDTH * 0.18, 0, radius);
  gradient.addColorStop(0, "rgba(255, 246, 197, 0.055)");
  gradient.addColorStop(1, "rgba(255, 236, 167, 0.012)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
};

const updateLight = (source) => {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.globalCompositeOperation = "source-over";

  if (playerState.z >= 0) {
    drawOutdoorSunlight();
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.995)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.globalCompositeOperation = "destination-out";

  const playerScreenPosition = getLightSourceScreenPosition(source, getEntitySurfaceOffsetY(source));
  if (playerScreenPosition) {
    drawDarknessCutout(
      playerScreenPosition.screenX,
      playerScreenPosition.screenY,
      TORCH_PLAYER_REVEAL_RADIUS,
      0.18,
    );
  }

  const spellLightRadius = getActivePlayerSpellLightRadius(Date.now());
  if (playerScreenPosition && spellLightRadius > 0) {
    drawDarknessCutout(playerScreenPosition.screenX, playerScreenPosition.screenY, spellLightRadius, 0.7);
  }

  const torchLights = getActiveTorchLightSources();
  for (const torchLight of torchLights) {
    const screenPosition = getLightSourceScreenPosition(torchLight.source, torchLight.surfaceOffsetY);
    const radius = getTorchLightRadius(torchLight.item);
    if (!screenPosition || radius <= 0) {
      continue;
    }
    drawDarknessCutout(screenPosition.screenX, screenPosition.screenY, radius, 0.69);
  }

  ctx.globalCompositeOperation = "source-over";
  for (const torchLight of torchLights) {
    const screenPosition = getLightSourceScreenPosition(torchLight.source, torchLight.surfaceOffsetY);
    const radius = getTorchLightRadius(torchLight.item);
    if (screenPosition && radius > 0) {
      drawTorchGlow(screenPosition.screenX, screenPosition.screenY, radius);
    }
  }
  if (playerScreenPosition && spellLightRadius > 0) {
    drawMagicLightGlow(playerScreenPosition.screenX, playerScreenPosition.screenY, spellLightRadius);
  }
};
//#endregion  -----  LIGHT - CANVAS  -----

/* ==================================================== */
//#region     -----  JOUEUR - MOUVEMENT  -----
/* ==================================================== */
const resetMobileJoystickDiagonalHold = () => mobileJoystickController.resetDiagonalHold();
const resetMobileJoystick = () => mobileJoystickController.reset();
const placeMobileJoystickAtPointer = (clientX, clientY) =>
  mobileJoystickController.placeAtPointer(clientX, clientY);
const updateMobileJoystickFromPointer = (clientX, clientY) =>
  mobileJoystickController.updateFromPointer(clientX, clientY);

const cancelPlayerNavigationForManualMovement = () => {
  const shouldCancelFollow = playerNavigationState.followEnabled && combatTargetState.monsterUid !== null;
  if (shouldCancelFollow) {
    playerNavigationState.followEnabled = false;
  }
  stopPlayerNavigation();

  if (shouldCancelFollow) {
    updatePlayerInventory();
  }
};
/* ---------- JOUEUR - COOLDOWN ET DIRECTION ---------- */

const getPlayerMoveCooldown = () => {
  if (playerState.level < 100) {
    return PLAYER_MOVE_COOLDOWN_MS - playerState.level - playerState.speed;
  } else {
    return PLAYER_MOVE_COOLDOWN_MS - 100 - (playerState.level - 100) / 2 - playerState.speed;
  }
};

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

  if (now < gameplayTimingState.nextPlayerMoveTime) {
    return;
  }

  const nextX = playerState.x + movement.deltaCol * MOVE_SPEED;
  const nextY = playerState.y + movement.deltaRow * MOVE_SPEED;

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

  if (moveResult?.success) {

    if (isNavigationMovement) {
      completePlayerNavigationStep();
    }

    if (moveResult.events.some((event) => event.type === "player-world-transitioned")) {
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    resetMobileJoystick();
    autosaveCurrentCharacter();
  }
});

window.addEventListener("blur", resetMobileJoystick);

window.addEventListener("pagehide", () => {
  autosaveCurrentCharacter();
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
    if (isPlayerAtPosition(x, y)) {
      player = playerState;
    }
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
    (dragState.pendingSourceLocation.locationType === "worldItem" &&
      !isWorldItemAvailableForInteraction(item))
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

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && isMobileGameLayout() && mobileGameUiState.openPanel !== null) {
    const openPanelElement = getMobilePanelElement(mobileGameUiState.openPanel);
    const clickedPanelButton = event.target instanceof Element && event.target.closest(".mobile-panel-buttons");
    const clickedContainerWindow = event.target instanceof Element && event.target.closest("#player-containers");
    if (!openPanelElement?.contains(event.target) && !clickedPanelButton && !clickedContainerWindow) {
      event.preventDefault();
      setOpenMobilePanel(null);
      return;
    }
  }

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
}, { passive: false });

document.addEventListener("pointermove", (event) => {
  if (event.pointerId !== mobileTouchInputState.pointerId) {
    return;
  }

  event.preventDefault();
  updateMousePositionInfo(event.clientX, event.clientY);
  const distance =
    Math.abs(event.clientX - mobileTouchInputState.startX) +
    Math.abs(event.clientY - mobileTouchInputState.startY);
  if (distance >= 5) {
    mobileTouchInputState.didMove = true;
    if (mobileTouchInputState.longPressTimeoutId !== null) {
      clearTimeout(mobileTouchInputState.longPressTimeoutId);
      mobileTouchInputState.longPressTimeoutId = null;
    }
  }
  handleItemUiMouseMove(event);
}, { passive: false });

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
document.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== mobileTouchInputState.pointerId) {
    return;
  }
  cancelItemDrag();
  resetDragStatePending();
  resetMobileTouchInput();
}, { passive: false });

mobileJoystickZone?.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") {
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
    setOpenMobilePanel(button.dataset.mobilePanel);
  });
}

for (const button of mobileActionButtons) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.mobileAction === "toggle-backpack") {
      toggleMobileBackpack();
    } else if (button.dataset.mobileAction === "toggle-follow") {
      togglePlayerFollow();
      syncMobileFollowButton();
    } else if (button.dataset.mobileAction === "cycle-stance") {
      cycleMobileCombatMode();
    } else if (button.dataset.mobileAction === "toggle-spells") {
      toggleSpellWindow();
    }
  });
}

mobileItemUseIndicator?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  cancelItemUse();
});

mobilePanelCloseButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setOpenMobilePanel(null);
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

const startPlayerFollowNavigation = () => playerNavigationController.startFollow();
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

  if (updateEntityRenderPosition(npc, Date.now())) {
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
    refs.root.style.left = `${npc.renderX - camera.x}px`;
    refs.root.style.top = `${renderY - camera.y}px`;
    refs.root.style.zIndex = zIndex;
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

    npc.nextWanderAt =
      now + getRandomInt(npcData.movement.intervalMinMs, npcData.movement.intervalMaxMs);
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

const isPlayerWithinNpcTalkRange = (player, npc) =>
  npcConversationSystem.isPlayerWithinTalkRange(player, npc);
const sayGreetingToNpc = (npc, player, now = Date.now()) =>
  npcConversationSystem.sayGreeting(npc, player, now);
const handleNpcGreetingFromPointerTarget = (target) =>
  npcConversationSystem.handleGreetingFromPointerTarget(target);
const getNpcReplySuggestions = (suggestions) => npcConversationSystem.getReplySuggestions(suggestions);
const handleNpcPlayerSpeech = (text, player, now) => {
  const action = createSpeakToNpcAction(text, player?.uid, now);
  const result = gameTransport.send(action);
  return result?.success === true;
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
    if (updateEntityRenderPosition(monster, Date.now())) {
      monster.walkFrame = 1;
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
    startPlayerFollowNavigation();
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
const removeMonster = (monsterUid) => {
  removeMonsterFromState(monsterUid);
  removeMonsterRender(monsterUid);
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
    return;
  }
  const lootContent = generateMonsterLoot(monsterData);
  const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
  addLootLogMessage(lootContent, localizedMonsterData.name);

  const corpse = createGroundItem(monsterData.corpseItemId, 1, monster.x, monster.y, monster.z, lootContent);
  if (!corpse) {
    return;
  }
  addGroundItem(corpse);
};

const isMonsterDead = (monster) => {
  return monster.hp <= 0;
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

const handleMonsterDeath = (monster) => {
  setMonsterDeadState(monster);
  createMonsterCorpse(monster);
  if (decreaseMonsterSpawnAliveCount(monster)) {
    scheduleMonsterRespawn(monster.spawnId, Date.now());
  }
  removeMonster(monster.uid);
  clearSelectedMonsterIfNeeded(monster);
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
        scheduleMonsterRespawnAt(
          spawnDefinition.spawnId,
          Date.now() + MONSTER_RESPAWN_CONFIG.blockedRetryMs,
        );
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
    const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
    const monsterData = getMonsterData(monster.monsterId);
    const monsterElement = refs.root;
    const renderX = monster.renderX + monsterData.drawOffsetX;
    const renderY = monster.renderY + monsterData.drawOffsetY - surfaceOffsetY;
    const zIndex = getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE);

    updatePixiMonsterTransform(monster.uid, renderX, renderY, zIndex);

    if (monsterElement) {
      monsterElement.style.left = `${renderX - camera.x}px`;
      monsterElement.style.top = `${renderY - camera.y}px`;
      monsterElement.style.zIndex = zIndex;
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
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  updateWorldRender();
};

/* ---------- RENDER - INTERPOLATION VISUELLE ---------- */

const updateEntityRenderPosition = (entity, now) => {
  if (entity.moveDuration <= 0) {
    entity.renderX = entity.x;
    entity.renderY = entity.y;
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
      const didFinishMoving = updateEntityRenderPosition(monster, now);
      if (didFinishMoving && monster.walkFrame !== 1) {
        monster.walkFrame = 1;
        updateMonsterSprite(monster);
      }
    }
  }

  for (const npcUid of npcElementsByUid.keys()) {
    const npc = npcsByUid.get(npcUid);
    if (npc) {
      const didFinishMoving = updateEntityRenderPosition(npc, now);
      if (didFinishMoving && npc.walkFrame !== 1) {
        npc.walkFrame = 1;
        updateNpcSprite(npc);
      }
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

const updateRenderCreatures = () => {
  updateMonsterPosition();
  updateNpcPosition();
  updatePlayerPosition(camera);
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
    return false;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return false;
  }
  const monsterExperienceReward = getExperienceRewardFromMonster(monster);
  if (monsterExperienceReward <= 0) {
    return false;
  }
  if (applyExperienceToPlayer(monsterExperienceReward)) {
    const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
    addExperienceGainFeedback(monsterExperienceReward, localizedMonsterData.name);
    return true;
  }
  return false;
};

const getDamageAppliedToMonster = (monster, attackResult) => {
  if (!monster || !attackResult) {
    return 0;
  }
  return clamp(attackResult.finalDamage, 0, monster.hp);
};

const createMonsterBloodPuddle = (monster, monsterData, decayStage) => {
  if (!monster || typeof monsterData?.bloodEffectId !== "string") {
    return null;
  }
  return createFluidPuddle(monsterData.bloodEffectId, monster.x, monster.y, monster.z, decayStage);
};

const applyDamageToMonster = (monster, attackResult) => {
  if (!monster || monster.hp <= 0) {
    return;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return;
  }
  const damageAmount = getDamageAppliedToMonster(monster, attackResult);

  if (Number.isFinite(damageAmount) && damageAmount > 0) {
    const bloodDecayStage = damageAmount >= monster.hp ? 0 : 1;
    createMonsterBloodPuddle(monster, monsterData, bloodDecayStage);
    monster.hp -= damageAmount;

    const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
    const logMessage = getGameUiText("damageDealt")(damageAmount, localizedMonsterData.name);
    addLogMessage(logMessage, "combat");
    showFloatingTextAboveMonster(monster, damageAmount, attackResult.textType);
    monsterHpRefresh(monster);
    if (isMonsterDead(monster)) {
      handleMonsterKilledByPlayer(monster);
    }
  }
};

const handleMonsterKilledByPlayer = (monster) => {
  if (!monster) {
    return;
  }
  const deathSfxByMonsterId = {
    rat: GAME_SFX.ratDeath,
    spider: GAME_SFX.spiderDeath,
  };
  const deathSfx = deathSfxByMonsterId[monster.monsterId];
  if (deathSfx) {
    playGameSfx(deathSfx);
  }
  handleMonsterDeath(monster);
  if (applyExperienceToPlayerFromMonster(monster)) {
    updatePlayerExperience();
  }
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

  if (attackResult.finalDamage > 0) {
    applyDamageToMonster(monster, attackResult);
  }
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
    ],
  };
};

const updateCombat = (now) => {
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
  addGroundItem(createGroundItem("smallBox", 1, 13 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("smallBox", 1, 14 * TILE_SIZE, 9 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("box", 1, 14 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("fireRune", 1, 14 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("smallBox", 1, 14 * TILE_SIZE, 11 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("smallBox", 1, 15 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
};

const setupTestPlayerInventory = () => {
  playerState.equipment.backpack = createItemInstance("bag", 1);
  playerState.equipment.backpack.content[0] = createItemInstance("apple", 1);
  playerState.equipment.backpack.content[1] = createItemInstance("healthPotion", 1);
  playerState.equipment.backpack.content[2] = createItemInstance("manaPotion", 1);
  playerState.equipment.weapon = createItemInstance("mace", 1);
  playerState.equipment.ammo = createItemInstance("torch", 1);
};

/* ---------- INITIALISATION - UI JOUEUR ---------- */
gameSystemsOrchestrator = createGameSystemsOrchestrator({
  createLogicContext: (now) => ({
    now,
    activeMonsters: getActiveMonstersAroundPlayer(),
  }),
  logicSystems: [
    ({ now }) => updatePlayerFollowNavigation(now),
    ({ now }) => updatePlayerActionNavigation(now),
    ({ now }) => updateMovement(now),
    ({ now }) => updateCombat(now),
    ({ now }) => updatePlayerRegeneration(now),
    ({ now }) => updateNpcConversations(now),
    ({ now }) => updateNpcMovement(now),
    ({ now, activeMonsters }) => updateMonsterMovement(now, activeMonsters),
    ({ now, activeMonsters }) => updateMonsterCombat(now, activeMonsters),
    ({ now }) => updateMonsterRespawns(now),
    ({ now }) => updateCorpseDecay(now),
    ({ now }) => updateGroundEffectDecay(now),
    ({ now }) => updateTorchFuel(now),
  ],
  renderSystems: [
    ({ now }) => updateRenderPositions(now),
    () => updateWorldRender(),
    ({ now }) => updateItemCooldownOverlays(now),
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
  updatePlayerInventory,
  updatePlayerStats,
});

characterSelectorController = createCharacterSelectorController({
  applyGameLanguageUi,
  cancelItemDrag,
  cancelItemUse,
  renderOptionsWindow,
  renderQuestWindow,
  resetMobileJoystick,
  saveBeforeSwitch: () => characterSessionController.saveBeforeSwitch(),
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
  setOpenMobilePanel,
  syncMobileBackpackButton,
  syncItemUseSourceFeedback,
  refreshInventoryUi,
});

const getSimulationContainerByUid = (containerUid) => {
  const location = findItemLocationByUid(containerUid);
  return location ? itemLocationController.getItem(location) : null;
};

const getSimulationPlayerMoveTiming = (payload) => {
  const currentTile = getTilePosition({ x: payload.fromX, y: payload.fromY });
  const nextTile = getTilePosition({ x: payload.toX, y: payload.toY });
  const movementCost = getTileMovementCost(currentTile, nextTile);
  const animationMultiplier = getTileMovementAnimationMultiplier(currentTile, nextTile);
  if (!Number.isFinite(movementCost) || !Number.isFinite(animationMultiplier)) {
    return null;
  }
  const baseMoveCooldown = getPlayerMoveCooldown();
  return {
    duration: baseMoveCooldown * animationMultiplier,
    cooldown: baseMoveCooldown * movementCost,
  };
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
    return executeRewardChestInteraction(interactable);
  }
  return { success: false, reason: "unsupported-interaction" };
};

const handlePlayerAttackResolvedEffect = (event) => {
  playPlayerWeaponProjectile(event.targetRenderSnapshot);
  const monster = findMonsterByUid(event.monsterUid);
  if (event.attackResult?.finalDamage <= 0 && monster) {
    showFloatingTextAboveMonster(monster, event.attackResult.text, event.attackResult.textType);
  }
  playPlayerAttackResultSfx(event.attackResult);
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

gameSimulation = createGameSimulation({
  state: {
    player: playerState,
    monstersByUid,
    timing: gameplayTimingState,
  },
  rules: {
    canPlayerAttackMonster: canSimulationPlayerAttackMonster,
    canPlayerMove: canSimulationPlayerMove,
    canPlayerUseWorldTransition: (movingPlayer, transition) => isNearPlayer(transition, 1),
    getPlayerAttackCooldownMs: () => PLAYER_ATTACK_COOLDOWN_MS,
    getPlayerMoveTiming: getSimulationPlayerMoveTiming,
  },
  commands: {
    executeAttackMonster: (monster, payload) => attackMonster(monster, payload.requestedAt),
    executeMoveItem: executeInventoryMoveRequest,
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
    getRemainingCapacity: () => playerState.capacity - calculatePlayerCarriedWeight(),
    getSpellById: (spellId) => spellsDatabase[spellId] ?? null,
  },
  onListenerError: (error) => console.error("Game action effect failed:", error),
});

gameTransport = createLocalGameTransport({ simulation: gameSimulation });
gameTransport.subscribe(
  createGameActionEffectRouter({
    "inventory-items-inserted": () => refreshInventoryUi(),
    "inventory-move-completed": (event) => playGameSfx(event.sfx),
    "player-attack-resolved": handlePlayerAttackResolvedEffect,
    "player-world-transitioned": () => presentPlayerWorldTransition(),
    "reward-chest-completed": handleRewardChestCompletedEffect,
  }),
);

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
const prepareGameData = () => {
  const loadedCharacterSnapshot = loadInitialCharacterSnapshot();
  if (!loadedCharacterSnapshot) {
    setupTestPlayerInventory();
  }
  setupTestWorld();
  return {
    loadedCharacterSnapshot,
    worldMapsByZ: loadWorldMaps(),
  };
};

const initializeGameRenderer = async () => {
  await initializePixiRenderer({
    htmlParentElement: game,
    gameWidth: GAME_WIDTH,
    gameHeight: GAME_HEIGHT,
  });
  const playerTextureUrlsByLayer = await getPlayerAppearanceLayerTextureUrls(
    playerState.appearanceParts,
    playerState.appearanceColors,
  );
  await loadPixiWorldEntityTextures({
    playerTextureUrlsByLayer,
    itemTextureUrl: getAtlasPath("items"),
    monsterTextureUrl: getAtlasPath("monsters"),
    npcTextureUrlsById: getNpcTextureUrlsById(),
  });
};

const initializeGameWorld = async ({ loadedCharacterSnapshot, worldMapsByZ }) => {
  pixiWorldRenderState.worldMapsByZ = worldMapsByZ;
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
  if (!loadedCharacterSnapshot) {
    saveCharacterSnapshot(createCharacterSaveSnapshot());
  }
  renderInitialWorld();
};

clientBootstrap = createClientBootstrap({
  runtimeState: gameRuntimeState,
  phases: [
    { name: "data", run: prepareGameData },
    { name: "renderer", run: initializeGameRenderer },
    { name: "world", run: initializeGameWorld },
    { name: "interface", run: initializeGameInterface },
  ],
  onStarted: () => {
    preloadGameSfx();
    startGameMusic();
    startCharacterAutosave();
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
  const result = await clientBootstrap.start();
  return result.success;
};

const shouldEnterGameImmediately = initializeGameWelcome();
if (shouldEnterGameImmediately) {
  startGame();
}

//#endregion  -----  INITIALISATION DU JEU  -----
