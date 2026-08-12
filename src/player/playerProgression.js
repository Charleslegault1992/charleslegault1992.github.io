import {
  SHIELDING_BLOCK_COOLDOWN_MS,
  SHIELDING_MAX_BLOCKS_PER_COOLDOWN,
  SKILL_TRAINING_COOLDOWN_MS,
} from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";
import { playerClassesDatabase } from "../data/playerClassesDatabase.js";
import { playerState } from "../state/playerState.js";

const getLevelFromExperienceByFormula = (experience, getRequiredExperience, baseLevel = 0) => {
  if (!Number.isFinite(experience)) {
    return 0;
  }

  let lowerLevel = Math.max(Math.floor(baseLevel), 0);
  let upperLevel = Math.max(lowerLevel + 1, 1);
  while (getRequiredExperience(upperLevel) <= experience) {
    lowerLevel = upperLevel;
    upperLevel *= 2;
  }

  while (lowerLevel + 1 < upperLevel) {
    const middleLevel = Math.floor((lowerLevel + upperLevel) / 2);
    if (getRequiredExperience(middleLevel) <= experience) {
      lowerLevel = middleLevel;
    } else {
      upperLevel = middleLevel;
    }
  }

  return lowerLevel;
};

export const normalizeSkillExperienceGain = (experienceGain) => {
  if (!Number.isFinite(experienceGain) || experienceGain <= 0) {
    return 0;
  }
  return Math.max(Math.round(experienceGain), 1);
};

export const refreshSkillTrainingTimer = (now) => {
  if (!Number.isInteger(now)) {
    return;
  }
  playerState.skillTraining.lastEffectiveHitAt = now;
};

export const isSkillTrainingTimerActive = (now) => {
  if (!Number.isInteger(now)) {
    return false;
  }

  const lastEffectiveHitAt = playerState.skillTraining.lastEffectiveHitAt;
  if (!lastEffectiveHitAt) {
    return false;
  }

  return now - lastEffectiveHitAt <= SKILL_TRAINING_COOLDOWN_MS;
};

const resetShieldingBlockCooldownIfNeeded = (now) => {
  if (playerState.skillTraining.shieldingBlockCooldownStartedAt === 0) {
    playerState.skillTraining.shieldingBlockCooldownStartedAt = now;
    return;
  }
  if (playerState.skillTraining.shieldingBlockCooldownStartedAt + SHIELDING_BLOCK_COOLDOWN_MS <= now) {
    playerState.skillTraining.shieldingBlockCount = 0;
    playerState.skillTraining.shieldingBlockCooldownStartedAt = now;
  }
};

export const canUseShieldingBlock = (now) => {
  resetShieldingBlockCooldownIfNeeded(now);
  return playerState.skillTraining.shieldingBlockCount < SHIELDING_MAX_BLOCKS_PER_COOLDOWN;
};

export const recordShieldingBlock = (now) => {
  resetShieldingBlockCooldownIfNeeded(now);
  playerState.skillTraining.shieldingBlockCount += 1;
};

export const getPlayerClassData = () => {
  const classId = playerState.classId;
  if (classId in playerClassesDatabase) {
    return playerClassesDatabase[classId];
  }
  return playerClassesDatabase.noClass;
};

export const getPlayerClassRegenerationData = () => {
  const classData = getPlayerClassData();
  return classData?.regeneration ?? playerClassesDatabase.noClass.regeneration;
};

export const getPlayerBaseStats = () => {
  return {
    maxHp: 100,
    maxMana: 0,
    maxSanity: 100,
    capacity: 350,
  };
};

export const getPlayerDerivedStats = () => {
  const baseStats = getPlayerBaseStats();
  const classData = getPlayerClassData();
  if (!classData) {
    return baseStats;
  }
  const level = playerState.level;
  return {
    maxHp: baseStats.maxHp + level * classData.levelUpGains.hp,
    maxMana: baseStats.maxMana + level * classData.levelUpGains.mana,
    maxSanity: baseStats.maxSanity,
    capacity: baseStats.capacity + level * classData.levelUpGains.capacity,
  };
};

export const syncPlayerDerivedStats = () => {
  const playerDerivedStats = getPlayerDerivedStats();
  playerState.maxHp = playerDerivedStats.maxHp;
  playerState.maxMana = playerDerivedStats.maxMana;
  playerState.maxSanity = playerDerivedStats.maxSanity;
  playerState.capacity = playerDerivedStats.capacity;
  playerState.hp = Math.min(playerState.hp, playerState.maxHp);
  playerState.mana = Math.min(playerState.mana, playerState.maxMana);
  playerState.sanity = Math.min(playerState.sanity, playerState.maxSanity);
};

export const getSkillExperienceGainMultiplier = (skillKey) => {
  const classData = getPlayerClassData();
  if (!classData?.skillExperienceMultipliers || !(skillKey in classData.skillExperienceMultipliers)) {
    return 0.2;
  }
  return classData.skillExperienceMultipliers[skillKey];
};

export const getExperienceRequiredForLevel = (level) => {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.floor(80 * level + 8 * level ** 2 + 12 * level ** 1.5);
};

export const getLevelFromExperience = (experience) => {
  return getLevelFromExperienceByFormula(experience, getExperienceRequiredForLevel);
};

export const getExperienceProgressForLevel = (experience, level) => {
  if (!Number.isFinite(level) || !Number.isFinite(experience)) {
    return 0;
  }
  return experience - getExperienceRequiredForLevel(level);
};

export const getExperienceRequiredForNextLevel = (experience, level) => {
  if (!Number.isFinite(level) || !Number.isFinite(experience)) {
    return 0;
  }
  return getExperienceRequiredForLevel(level + 1) - experience;
};

export const getSkillExperienceRequiredForLevel = (skillLevel) => {
  if (!Number.isFinite(skillLevel)) {
    return 0;
  }
  return Math.floor(80 * skillLevel + 8 * skillLevel ** 2 + 12 * skillLevel ** 1.5);
};

export const getSkillLevelFromExperience = (skillExperience, baseLevel = 0) => {
  return getLevelFromExperienceByFormula(skillExperience, getSkillExperienceRequiredForLevel, baseLevel);
};

export const getPlayerExperienceProgressData = () => {
  const experience = playerState.experience;
  const level = getLevelFromExperience(experience);
  const currentLevelExperienceRequired = getExperienceRequiredForLevel(level);
  const nextLevelExperienceRequired = getExperienceRequiredForLevel(level + 1);
  const experienceInCurrentLevel = getExperienceProgressForLevel(experience, level);
  const experienceNeededForNextLevel = getExperienceRequiredForNextLevel(experience, level);
  const totalLevelExperience = nextLevelExperienceRequired - currentLevelExperienceRequired;
  const progressRatio = totalLevelExperience > 0 ? clamp(experienceInCurrentLevel / totalLevelExperience, 0, 1) : 0;
  return {
    experience,
    level,
    currentLevelExperienceRequired,
    nextLevelExperienceRequired,
    experienceInCurrentLevel,
    experienceNeededForNextLevel,
    totalLevelExperience,
    progressRatio,
  };
};

export const getSkillProgressData = (skillKey) => {
  const skill = playerState.skills[skillKey] ?? null;
  if (!skill) {
    return null;
  }
  const experience = skill.experience;
  const level = getSkillLevelFromExperience(experience);
  const currentLevelExperienceRequired = getSkillExperienceRequiredForLevel(level);
  const nextLevelExperienceRequired = getSkillExperienceRequiredForLevel(level + 1);
  const experienceInCurrentLevel = experience - currentLevelExperienceRequired;
  const experienceNeededForNextLevel = nextLevelExperienceRequired - experience;
  const totalLevelExperience = nextLevelExperienceRequired - currentLevelExperienceRequired;
  const progressRatio = totalLevelExperience > 0 ? clamp(experienceInCurrentLevel / totalLevelExperience, 0, 1) : 0;
  return {
    experience,
    level,
    currentLevelExperienceRequired,
    nextLevelExperienceRequired,
    experienceInCurrentLevel,
    experienceNeededForNextLevel,
    totalLevelExperience,
    progressRatio,
  };
};

export const applyPlayerCurrentVitalLevelUpGains = (previousMaxHp, previousMaxMana) => {
  if (!Number.isFinite(previousMaxHp) || !Number.isFinite(previousMaxMana)) {
    return;
  }

  const hpGain = Math.max(playerState.maxHp - previousMaxHp, 0);
  const manaGain = Math.max(playerState.maxMana - previousMaxMana, 0);
  playerState.hp = Math.min(playerState.hp + hpGain, playerState.maxHp);
  playerState.mana = Math.min(playerState.mana + manaGain, playerState.maxMana);
};
