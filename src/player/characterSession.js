import {
  loadCharacterSaveDocument,
  normalizeCharacterAppearanceColors,
  normalizeCharacterAppearanceParts,
  saveCharacterSnapshot,
} from "../characterSaveStore.js";
import { TILE_SIZE } from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";
import { hydrateMinimapExploration, serializeMinimapExploration } from "../minimap/minimapExploration.js";
import { getPlayerAppearanceData } from "./playerAppearance.js";
import { removeCurrentEquipmentFromDecayTracking, restoreCharacterItem, serializeCharacterItem } from "./characterItemsPersistence.js";
import { getLevelFromExperience, getSkillLevelFromExperience, syncPlayerDerivedStats } from "./playerProgression.js";
import { resetPlayerRegenerationTimers } from "./playerRegeneration.js";
import { updatePlayerCarriedWeight } from "../inventory/inventoryWeight.js";
import { gameRuntimeState, pixiWorldRenderState } from "../state/clientRuntimeState.js";
import { normalizePlayerSpellbook, playerState } from "../state/playerState.js";
import { getWorldChunkForTilePosition, isTiledCollisionAtTile } from "../world/worldCoordinates.js";

export const createCharacterSessionController = ({
  syncActiveTorchFuel,
  setPlayerWorldPosition,
  showStatusMessage,
  getUiText,
  autosaveIntervalMs,
  windowObject = window,
}) => {
  const createSnapshot = () => {
    syncActiveTorchFuel(Date.now());

    const skills = {};
    for (const [skillKey, skill] of Object.entries(playerState.skills)) {
      skills[skillKey] = {
        experience: skill.experience,
      };
    }

    const equipment = {};
    for (const [slotName, item] of Object.entries(playerState.equipment)) {
      equipment[slotName] = serializeCharacterItem(item);
    }

    return {
      uid: playerState.uid,
      name: playerState.name,
      appearanceId: playerState.appearanceId,
      appearanceParts: normalizeCharacterAppearanceParts(playerState.appearanceParts),
      appearanceColors: normalizeCharacterAppearanceColors(playerState.appearanceColors),
      classId: playerState.classId,
      position: {
        x: playerState.x,
        y: playerState.y,
        z: playerState.z,
        direction: playerState.direction,
      },
      spawn: {
        z: playerState.spawn.z,
        spawnId: playerState.spawn.spawnId,
      },
      vitals: {
        hp: playerState.hp,
        mana: playerState.mana,
        sanity: playerState.sanity,
      },
      progression: {
        experience: playerState.experience,
        skills,
      },
      bank: {
        goldBalance: playerState.bank.goldBalance,
      },
      spellbook: structuredClone(playerState.spellbook),
      progress: {
        questsById: structuredClone(playerState.progress.questsById),
        rewardClaimsByInteractableId: structuredClone(playerState.progress.rewardClaimsByInteractableId),
        minimapExplorationByChunkKey: serializeMinimapExploration(),
      },
      combatMode: playerState.combatMode,
      equipment,
    };
  };

  const applySnapshot = (characterSnapshot) => {
    if (!characterSnapshot?.progression || !characterSnapshot?.equipment) {
      return false;
    }

    removeCurrentEquipmentFromDecayTracking();

    playerState.uid = characterSnapshot.uid;
    playerState.name = characterSnapshot.name;
    playerState.appearanceId = getPlayerAppearanceData(characterSnapshot.appearanceId).appearanceId;
    playerState.appearanceParts = normalizeCharacterAppearanceParts(
      characterSnapshot.appearanceParts,
      playerState.appearanceId,
    );
    playerState.appearanceColors = normalizeCharacterAppearanceColors(characterSnapshot.appearanceColors);
    playerState.classId = characterSnapshot.classId;
    playerState.experience = characterSnapshot.progression.experience;
    playerState.bank = {
      goldBalance:
        Number.isSafeInteger(characterSnapshot.bank?.goldBalance) && characterSnapshot.bank.goldBalance >= 0
          ? characterSnapshot.bank.goldBalance
          : 0,
    };
    playerState.spellbook = normalizePlayerSpellbook(characterSnapshot.spellbook);
    playerState.spawn = structuredClone(characterSnapshot.spawn);
    playerState.progress = {
      questsById: structuredClone(characterSnapshot.progress?.questsById ?? {}),
      rewardClaimsByInteractableId: structuredClone(characterSnapshot.progress?.rewardClaimsByInteractableId ?? {}),
      minimapExplorationByChunkKey: structuredClone(characterSnapshot.progress?.minimapExplorationByChunkKey ?? {}),
    };
    hydrateMinimapExploration(playerState.progress.minimapExplorationByChunkKey);
    playerState.combatMode = characterSnapshot.combatMode;

    for (const [skillKey, skill] of Object.entries(playerState.skills)) {
      const savedSkill = characterSnapshot.progression.skills?.[skillKey];
      if (Number.isFinite(savedSkill?.experience)) {
        skill.experience = savedSkill.experience;
      }
      skill.level = getSkillLevelFromExperience(skill.experience);
    }

    const restoredItemUids = new Set();
    for (const slotName of Object.keys(playerState.equipment)) {
      playerState.equipment[slotName] = restoreCharacterItem(characterSnapshot.equipment[slotName], restoredItemUids);
    }

    playerState.level = getLevelFromExperience(playerState.experience);
    syncPlayerDerivedStats();
    playerState.hp = clamp(characterSnapshot.vitals?.hp ?? playerState.maxHp, 0, playerState.maxHp);
    playerState.mana = clamp(characterSnapshot.vitals?.mana ?? playerState.maxMana, 0, playerState.maxMana);
    playerState.sanity = clamp(characterSnapshot.vitals?.sanity ?? 0, 0, playerState.maxSanity);
    resetPlayerRegenerationTimers();
    updatePlayerCarriedWeight();
    return true;
  };

  const applySavedPosition = (characterSnapshot, worldMapsByZ) => {
    const position = characterSnapshot?.position;
    const worldMap = worldMapsByZ?.get(position?.z);
    if (!worldMap || !Number.isInteger(position.x) || !Number.isInteger(position.y)) {
      return false;
    }

    const col = position.x / TILE_SIZE;
    const row = position.y / TILE_SIZE;
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      !getWorldChunkForTilePosition(worldMap, col, row) ||
      isTiledCollisionAtTile(worldMap, col, row)
    ) {
      return false;
    }

    playerState.z = position.z;
    playerState.direction = position.direction;
    pixiWorldRenderState.currentZ = playerState.z;
    return setPlayerWorldPosition(position.x, position.y);
  };

  const loadInitialSnapshot = () => {
    const loadResult = loadCharacterSaveDocument();
    if (!loadResult.success) {
      if (loadResult.reason === "not-initialized" && loadResult.entry) {
        playerState.uid = loadResult.entry.characterId;
        playerState.name = loadResult.entry.name;
        playerState.appearanceId = getPlayerAppearanceData(loadResult.entry.appearanceId).appearanceId;
        playerState.appearanceParts = normalizeCharacterAppearanceParts(
          loadResult.entry.appearanceParts,
          playerState.appearanceId,
        );
        playerState.appearanceColors = normalizeCharacterAppearanceColors(loadResult.entry.appearanceColors);
      }
      return null;
    }

    const characterSnapshot = loadResult.document.character;
    return applySnapshot(characterSnapshot) ? characterSnapshot : null;
  };

  const saveCurrent = (showFeedback = true) => {
    const saveResult = saveCharacterSnapshot(createSnapshot());
    if (showFeedback) {
      showStatusMessage(saveResult.success ? getUiText("characterSaved") : getUiText("characterSaveFailed"));
    }
    return saveResult.success;
  };

  const autosave = () => {
    if (!gameRuntimeState.isStarted || gameRuntimeState.isSwitchingCharacter) {
      return false;
    }
    return saveCurrent(false);
  };

  const startAutosave = () => {
    if (gameRuntimeState.autosaveIntervalId !== null) {
      return;
    }
    gameRuntimeState.autosaveIntervalId = windowObject.setInterval(autosave, autosaveIntervalMs);
  };

  const stopAutosave = () => {
    if (gameRuntimeState.autosaveIntervalId === null) {
      return;
    }
    windowObject.clearInterval(gameRuntimeState.autosaveIntervalId);
    gameRuntimeState.autosaveIntervalId = null;
  };

  const saveBeforeSwitch = () => {
    const saveResult = saveCharacterSnapshot(createSnapshot());
    if (!saveResult.success) {
      showStatusMessage(getUiText("currentCharacterSaveFailed"));
      return false;
    }
    return true;
  };

  return {
    applySavedPosition,
    applySnapshot,
    autosave,
    createSnapshot,
    loadInitialSnapshot,
    saveBeforeSwitch,
    saveCurrent,
    startAutosave,
    stopAutosave,
  };
};
