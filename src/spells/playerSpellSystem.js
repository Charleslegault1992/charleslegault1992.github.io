import {
  SKILL_EXPERIENCE_GAIN_PER_TRY,
  SPELL_HOTKEY_KEYS,
  TILE_SIZE,
} from "../core/gameConstants.js";
import { getRandomFloat } from "../core/mathUtils.js";
import { spellsDatabase } from "../spellDatabase.js";
import { spellUiState } from "../state/clientRuntimeState.js";
import { playerState } from "../state/playerState.js";

export const createPlayerSpellSystem = ({
  addChatMessage,
  applyExperienceToPlayerSkill,
  autosaveCurrentCharacter,
  getActiveChatChannelId,
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
  spellUseSfx,
  startUseCooldown,
}) => {
  const isPlayerSpellLearned = (spellId) => {
    return playerState.spellbook.learnedSpellIds.includes(spellId);
  };

  const getLearnedPlayerSpells = () => {
    return playerState.spellbook.learnedSpellIds.map(getLocalizedSpellData).filter(Boolean);
  };

  const assignPlayerSpellToHotkey = (hotkeyIndex, spellId) => {
    if (
      !Number.isInteger(hotkeyIndex) ||
      hotkeyIndex < 0 ||
      hotkeyIndex >= SPELL_HOTKEY_KEYS.length ||
      (spellId !== null && !isPlayerSpellLearned(spellId))
    ) {
      return false;
    }
    playerState.spellbook.hotkeySpellIds[hotkeyIndex] = spellId;
    spellUiState.selectedSpellId = null;
    spellUiState.mobileAssignHotkeyIndex = null;
    autosaveCurrentCharacter();
    renderSpellWindow();
    return true;
  };

  const normalizeSpellIncantation = (text) => {
    if (typeof text !== "string") {
      return "";
    }
    return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  };

  const spellsByIncantation = new Map(
    Object.values(spellsDatabase).map((spellData) => [normalizeSpellIncantation(spellData.incantation), spellData]),
  );

  const getSpellFromChatText = (text) => {
    const normalizedIncantation = normalizeSpellIncantation(text);
    return spellsByIncantation.get(normalizedIncantation) ?? null;
  };

  const getSpellPowerAmount = (spellData) => {
    const power = spellData?.power;
    const magicLevel = playerState.skills.magic.level;
    if (
      !Number.isFinite(power?.min) ||
      !Number.isFinite(power?.max) ||
      !Number.isFinite(power?.magicLevelMultiplier) ||
      !Number.isFinite(power?.levelMultiplier)
    ) {
      return 0;
    }

    const minimumPower = power.min + magicLevel * power.magicLevelMultiplier + playerState.level * power.levelMultiplier;
    const maximumPower = power.max + magicLevel * power.magicLevelMultiplier + playerState.level * power.levelMultiplier;
    return Math.max(1, Math.floor(getRandomFloat(minimumPower, maximumPower)));
  };

  const castSelfHealingSpell = (spellData) => {
    if (playerState.hp >= playerState.maxHp) {
      showGameStatusMessage(getGameUiText("fullHealth"));
      return false;
    }

    const restoredAmount = Math.min(getSpellPowerAmount(spellData), playerState.maxHp - playerState.hp);
    playerState.hp += restoredAmount;
    showFloatingTextAbovePlayer(restoredAmount, spellData.textType);
    return true;
  };

  const castPlayerLightSpell = (spellData) => {
    if (!Number.isFinite(spellData?.durationMs) || !Number.isFinite(spellData?.lightRadius)) {
      return false;
    }
    playerState.spellEffects.light.radius = spellData.lightRadius;
    playerState.spellEffects.light.expiresAt = Date.now() + spellData.durationMs;
    return true;
  };

  const applyMagicExperienceFromSpell = () => {
    const experienceMultiplier = getSkillExperienceGainMultiplier("magic");
    const experienceAmount = normalizeSkillExperienceGain(SKILL_EXPERIENCE_GAIN_PER_TRY * experienceMultiplier);
    applyExperienceToPlayerSkill("magic", experienceAmount);
  };

  const castPlayerSpell = (spellData) => {
    if (!spellData) {
      return false;
    }
    if (Array.isArray(spellData.allowedClassIds) && !spellData.allowedClassIds.includes(playerState.classId)) {
      showGameStatusMessage(getGameUiText("spellWrongClass"));
      return false;
    }
    if (playerState.skills.magic.level < spellData.requiredMagicLevel) {
      showGameStatusMessage(getGameUiText("spellMagicLevelRequired")(spellData.requiredMagicLevel));
      return false;
    }
    if (!isUseCooldownReady(spellData.cooldownGroup)) {
      showGameStatusMessage(getGameUiText("exhausted"));
      return false;
    }
    if (playerState.mana < spellData.manaCost) {
      showGameStatusMessage(getGameUiText("spellNotEnoughMana"));
      return false;
    }

    let didCastSpell = false;
    if (spellData.action === "healSelf") {
      didCastSpell = castSelfHealingSpell(spellData);
    } else if (spellData.action === "lightSelf") {
      didCastSpell = castPlayerLightSpell(spellData);
    }
    if (!didCastSpell) {
      return false;
    }

    playerState.mana -= spellData.manaCost;
    startUseCooldown(spellData.cooldownGroup);
    applyMagicExperienceFromSpell();
    refreshPlayerVitalsUi();
    playGameSfx(spellUseSfx);
    return true;
  };

  const playPlayerSpellEffect = (spellData, success) => {
    const surfaceOffsetY = getEntitySurfaceOffsetY(playerState);
    return playPixiSpellEffect({
      x: playerState.x + TILE_SIZE / 2,
      y: playerState.y + TILE_SIZE / 2 - surfaceOffsetY,
      color: spellData?.effectColor,
      success,
    });
  };

  const announceSuccessfulPlayerSpell = (spellData) => {
    const text = spellData.incantation;
    const message = addChatMessage("local", "player", text, playerState);
    if (!message) {
      return false;
    }
    showFloatingTextAboveTarget(text, 70, playerState, "speech", 4000);
    if (getActiveChatChannelId() === "local") {
      renderActiveChatMessages();
    }
    return true;
  };

  const castLearnedPlayerSpellById = (spellId) => {
    const spellData = spellsDatabase[spellId] ?? null;
    if (!spellData || !isPlayerSpellLearned(spellId)) {
      showGameStatusMessage(getGameUiText("spellNotLearned"));
      playPlayerSpellEffect(spellData, false);
      return false;
    }

    const didCastSpell = castPlayerSpell(spellData);
    playPlayerSpellEffect(spellData, didCastSpell);
    if (!didCastSpell) {
      return false;
    }
    announceSuccessfulPlayerSpell(spellData);
    return true;
  };

  const castPlayerSpellFromHotkeyKey = (key) => {
    const hotkeyIndex = SPELL_HOTKEY_KEYS.indexOf(key);
    if (hotkeyIndex === -1) {
      return false;
    }
    const spellId = playerState.spellbook.hotkeySpellIds[hotkeyIndex];
    if (spellId) {
      castLearnedPlayerSpellById(spellId);
    }
    return true;
  };


  return {
    assignToHotkey: assignPlayerSpellToHotkey,
    castByHotkeyKey: castPlayerSpellFromHotkeyKey,
    castLearnedById: castLearnedPlayerSpellById,
    getFromChatText: getSpellFromChatText,
    getLearned: getLearnedPlayerSpells,
    isLearned: isPlayerSpellLearned,
  };
};
