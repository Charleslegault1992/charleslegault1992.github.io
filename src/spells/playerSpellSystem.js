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
  beginUseCooldown,
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
      return { success: false, reason: "full-health" };
    }

    const restoredAmount = Math.min(getSpellPowerAmount(spellData), playerState.maxHp - playerState.hp);
    playerState.hp += restoredAmount;
    return { success: true, restoredAmount };
  };

  const castPlayerLightSpell = (spellData, now) => {
    if (!Number.isFinite(spellData?.durationMs) || !Number.isFinite(spellData?.lightRadius)) {
      return { success: false, reason: "invalid-spell" };
    }
    playerState.spellEffects.light.radius = spellData.lightRadius;
    playerState.spellEffects.light.expiresAt = now + spellData.durationMs;
    return { success: true };
  };

  const applyMagicExperienceFromSpell = () => {
    const experienceMultiplier = getSkillExperienceGainMultiplier("magic");
    const experienceAmount = normalizeSkillExperienceGain(SKILL_EXPERIENCE_GAIN_PER_TRY * experienceMultiplier);
    applyExperienceToPlayerSkill("magic", experienceAmount);
  };

  const castPlayerSpell = (spellData, now) => {
    if (!spellData) {
      return { success: false, reason: "spell-not-found" };
    }
    if (Array.isArray(spellData.allowedClassIds) && !spellData.allowedClassIds.includes(playerState.classId)) {
      return { success: false, reason: "wrong-class" };
    }
    if (playerState.skills.magic.level < spellData.requiredMagicLevel) {
      return {
        success: false,
        reason: "magic-level-required",
        changes: { requiredMagicLevel: spellData.requiredMagicLevel },
      };
    }
    if (!isUseCooldownReady(spellData.cooldownGroup, now)) {
      return { success: false, reason: "cooldown" };
    }
    if (playerState.mana < spellData.manaCost) {
      return { success: false, reason: "not-enough-mana" };
    }

    let spellEffectResult = null;
    if (spellData.action === "healSelf") {
      spellEffectResult = castSelfHealingSpell(spellData);
    } else if (spellData.action === "lightSelf") {
      spellEffectResult = castPlayerLightSpell(spellData, now);
    }
    if (!spellEffectResult?.success) {
      return spellEffectResult ?? { success: false, reason: "unsupported-spell-action" };
    }

    playerState.mana -= spellData.manaCost;
    beginUseCooldown(spellData.cooldownGroup, now);
    applyMagicExperienceFromSpell();
    return {
      success: true,
      changes: {
        spellId: spellData.spellId,
        mana: playerState.mana,
        restoredAmount: spellEffectResult.restoredAmount ?? 0,
      },
      events: [{ type: "spell-cast-resolved", spellId: spellData.spellId }],
    };
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

  const executeLearnedPlayerSpellById = (spellId, requestedAt = Date.now()) => {
    const spellData = spellsDatabase[spellId] ?? null;
    if (!spellData || !isPlayerSpellLearned(spellId)) {
      return { success: false, reason: "spell-not-learned" };
    }
    return castPlayerSpell(spellData, requestedAt);
  };

  const presentPlayerSpellResult = (spellId, result) => {
    const spellData = spellsDatabase[spellId] ?? null;
    if (!result?.success) {
      const failureMessageByReason = {
        "spell-not-learned": getGameUiText("spellNotLearned"),
        "wrong-class": getGameUiText("spellWrongClass"),
        "magic-level-required": getGameUiText("spellMagicLevelRequired")(
          result?.changes?.requiredMagicLevel ?? spellData?.requiredMagicLevel ?? 0,
        ),
        cooldown: getGameUiText("exhausted"),
        "not-enough-mana": getGameUiText("spellNotEnoughMana"),
        "full-health": getGameUiText("fullHealth"),
        "status-effect-not-active": getGameUiText("statusEffectNotActive"),
      };
      showGameStatusMessage(failureMessageByReason[result?.reason] ?? getGameUiText("spellNotLearned"));
      playPlayerSpellEffect(spellData, false);
      return false;
    }

    const restoredAmount = result?.changes?.restoredAmount ?? 0;
    if (restoredAmount > 0) {
      showFloatingTextAbovePlayer(restoredAmount, spellData.textType);
    }
    refreshPlayerVitalsUi();
    playGameSfx(spellUseSfx);
    playPlayerSpellEffect(spellData, true);
    announceSuccessfulPlayerSpell(spellData);
    return true;
  };

  const getPlayerSpellIdFromHotkeyKey = (key) => {
    const hotkeyIndex = SPELL_HOTKEY_KEYS.indexOf(key);
    if (hotkeyIndex === -1) {
      return null;
    }
    return playerState.spellbook.hotkeySpellIds[hotkeyIndex] ?? null;
  };


  return {
    assignToHotkey: assignPlayerSpellToHotkey,
    executeLearnedById: executeLearnedPlayerSpellById,
    getHotkeySpellId: getPlayerSpellIdFromHotkeyKey,
    getFromChatText: getSpellFromChatText,
    getLearned: getLearnedPlayerSpells,
    isLearned: isPlayerSpellLearned,
    presentCastResult: presentPlayerSpellResult,
  };
};
