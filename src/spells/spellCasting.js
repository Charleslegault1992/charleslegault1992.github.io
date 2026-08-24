import { SKILL_EXPERIENCE_GAIN_PER_TRY } from "../core/gameConstants.js";
import { getRandomFloat } from "../core/mathUtils.js";
import { playerClassesDatabase } from "../data/playerClassesDatabase.js";
import { getSkillLevelFromExperience, normalizeSkillExperienceGain } from "../player/playerProgression.js";

export const executePlayerSpellCast = ({ player, spellData, now, cooldowns, random = null }) => {
  if (!player || !spellData || !Number.isFinite(now) || !cooldowns) {
    return { success: false, reason: "invalid-spell" };
  }
  if (!player.spellbook?.learnedSpellIds?.includes(spellData.spellId)) {
    return { success: false, reason: "spell-not-learned" };
  }
  if (Array.isArray(spellData.allowedClassIds) && !spellData.allowedClassIds.includes(player.classId)) {
    return { success: false, reason: "wrong-class" };
  }
  if (player.skills.magic.level < spellData.requiredMagicLevel) {
    return {
      success: false,
      reason: "magic-level-required",
      changes: { requiredMagicLevel: spellData.requiredMagicLevel },
    };
  }
  if (!cooldowns.isReady(spellData.cooldownGroup, now)) {
    return { success: false, reason: "cooldown" };
  }
  if (player.mana < spellData.manaCost) {
    return { success: false, reason: "not-enough-mana" };
  }

  let restoredAmount = 0;
  if (spellData.action === "healSelf") {
    if (player.hp >= player.maxHp) {
      return { success: false, reason: "full-health" };
    }
    const randomFloat = typeof random?.getFloat === "function" ? random.getFloat : getRandomFloat;
    const minimumPower =
      spellData.power.min +
      player.skills.magic.level * spellData.power.magicLevelMultiplier +
      player.level * spellData.power.levelMultiplier;
    const maximumPower =
      spellData.power.max +
      player.skills.magic.level * spellData.power.magicLevelMultiplier +
      player.level * spellData.power.levelMultiplier;
    restoredAmount = Math.min(
      Math.max(1, Math.floor(randomFloat(minimumPower, maximumPower))),
      player.maxHp - player.hp,
    );
    player.hp += restoredAmount;
  } else if (spellData.action === "lightSelf") {
    player.spellEffects.light.radius = spellData.lightRadius;
    player.spellEffects.light.expiresAt = now + spellData.durationMs;
  } else if (spellData.action === "cureStatusEffect") {
    if (!player.statusEffects?.[spellData.statusEffectId]) {
      return { success: false, reason: "status-effect-not-active" };
    }
    delete player.statusEffects[spellData.statusEffectId];
  } else {
    return { success: false, reason: "unsupported-spell-action" };
  }

  player.mana -= spellData.manaCost;
  cooldowns.begin(spellData.cooldownGroup, now);
  const classData = playerClassesDatabase[player.classId] ?? playerClassesDatabase.noClass;
  const magicExperience = normalizeSkillExperienceGain(
    SKILL_EXPERIENCE_GAIN_PER_TRY * (classData.skillExperienceMultipliers.magic ?? 0.2),
  );
  player.skills.magic.experience += magicExperience;
  player.skills.magic.level = getSkillLevelFromExperience(player.skills.magic.experience);

  return {
    success: true,
    changes: {
      spellId: spellData.spellId,
      mana: player.mana,
      hp: player.hp,
      restoredAmount,
      magicSkill: structuredClone(player.skills.magic),
      spellEffects: structuredClone(player.spellEffects),
      statusEffects: structuredClone(player.statusEffects ?? {}),
    },
    events: [{ type: "spell-cast-resolved", playerUid: player.uid, spellId: spellData.spellId, restoredAmount }],
  };
};
