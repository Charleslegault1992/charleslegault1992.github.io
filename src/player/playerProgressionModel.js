import {
  SHIELDING_BLOCK_COOLDOWN_MS,
  SHIELDING_MAX_BLOCKS_PER_COOLDOWN,
  SKILL_EXPERIENCE_GAIN_PER_TRY,
  SKILL_TRAINING_COOLDOWN_MS,
} from "../core/gameConstants.js";
import { playerClassesDatabase } from "../data/playerClassesDatabase.js";
import { getPlayerAttackSkillKey } from "../combat/playerCombatModel.js";
import { getItemData } from "../items/itemModel.js";
import { getLevelFromExperience, getSkillLevelFromExperience } from "./playerProgression.js";

const getPlayerClassData = (player) => playerClassesDatabase[player?.classId] ?? playerClassesDatabase.noClass;

export const applyPlayerLevelProgression = (player) => {
  if (!player || !Number.isFinite(player.experience)) {
    return null;
  }
  const previousLevel = Number.isFinite(player.level) ? player.level : 0;
  const nextLevel = getLevelFromExperience(player.experience);
  if (nextLevel <= previousLevel) {
    return { previousLevel, nextLevel: previousLevel, levelsGained: 0 };
  }

  const levelsGained = nextLevel - previousLevel;
  const gains = getPlayerClassData(player).levelUpGains;
  const hpGain = gains.hp * levelsGained;
  const manaGain = gains.mana * levelsGained;
  const capacityGain = gains.capacity * levelsGained;

  player.level = nextLevel;
  player.maxHp += hpGain;
  player.maxMana += manaGain;
  player.capacity += capacityGain;
  player.hp = Math.min(player.hp + hpGain, player.maxHp);
  player.mana = Math.min(player.mana + manaGain, player.maxMana);

  return { previousLevel, nextLevel, levelsGained, hpGain, manaGain, capacityGain };
};

export const applyPlayerAttackSkillProgression = (player, attackResult, now) => {
  if (!player || !attackResult?.didHit || !Number.isFinite(now)) {
    return null;
  }
  const skillKey = getPlayerAttackSkillKey(player);
  const skill = player.skills?.[skillKey];
  if (!skill) {
    return null;
  }

  const lastEffectiveHitAt = player.skillTraining?.lastEffectiveHitAt ?? 0;
  const trainingIsActive = lastEffectiveHitAt > 0 && now - lastEffectiveHitAt <= SKILL_TRAINING_COOLDOWN_MS;
  if (attackResult.finalDamage <= 0 && !trainingIsActive) {
    return null;
  }
  if (attackResult.finalDamage > 0) {
    player.skillTraining.lastEffectiveHitAt = now;
  }

  const multiplier = getPlayerClassData(player).skillExperienceMultipliers?.[skillKey] ?? 0.2;
  const experienceGain = Math.max(Math.round(SKILL_EXPERIENCE_GAIN_PER_TRY * multiplier), 1);
  const previousLevel = skill.level;
  skill.experience += experienceGain;
  skill.level = getSkillLevelFromExperience(skill.experience, previousLevel);

  return { skillKey, experienceGain, previousLevel, nextLevel: skill.level };
};

export const applyPlayerShieldingSkillProgression = (player, attackResult, now) => {
  if (!player || !attackResult?.didHit || !Number.isFinite(now)) {
    return null;
  }
  const shield = player.equipment?.shield;
  const shieldDefense = shield ? getItemData(shield.itemId)?.combat?.shieldDefense : null;
  const skill = player.skills?.shielding;
  if (!Number.isFinite(shieldDefense) || !skill || !player.skillTraining) {
    return null;
  }

  const trainingStartedAt = player.skillTraining.lastEffectiveHitAt ?? 0;
  if (trainingStartedAt <= 0 || now - trainingStartedAt > SKILL_TRAINING_COOLDOWN_MS) {
    return null;
  }

  const cooldownStartedAt = player.skillTraining.shieldingBlockCooldownStartedAt ?? 0;
  if (cooldownStartedAt === 0 || cooldownStartedAt + SHIELDING_BLOCK_COOLDOWN_MS <= now) {
    player.skillTraining.shieldingBlockCount = 0;
    player.skillTraining.shieldingBlockCooldownStartedAt = now;
  }
  if (player.skillTraining.shieldingBlockCount >= SHIELDING_MAX_BLOCKS_PER_COOLDOWN) {
    return null;
  }
  player.skillTraining.shieldingBlockCount++;

  const multiplier = getPlayerClassData(player).skillExperienceMultipliers?.shielding ?? 0.2;
  const experienceGain = Math.max(Math.round(SKILL_EXPERIENCE_GAIN_PER_TRY * multiplier), 1);
  const previousLevel = skill.level;
  skill.experience += experienceGain;
  skill.level = getSkillLevelFromExperience(skill.experience, previousLevel);

  return { skillKey: "shielding", experienceGain, previousLevel, nextLevel: skill.level };
};
