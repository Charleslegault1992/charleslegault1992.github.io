import { clamp, getRandomFloat, getRandomInt } from "../core/mathUtils.js";
import { getItemData } from "../items/itemModel.js";
import { getMonsterData } from "../monsters/monsterModel.js";
import { playerState } from "../state/playerState.js";

const COMBAT_MODE_DATA = Object.freeze({
  fullAttack: Object.freeze({
    attackMultiplier: 1.15,
    defenseMultiplier: 0.8,
    blockChanceMultiplier: 0.8,
    armorMultiplier: 0.95,
  }),
  balanced: Object.freeze({
    attackMultiplier: 1,
    defenseMultiplier: 1,
    blockChanceMultiplier: 1,
    armorMultiplier: 1,
  }),
  fullDefense: Object.freeze({
    attackMultiplier: 0.85,
    defenseMultiplier: 1.35,
    blockChanceMultiplier: 1.3,
    armorMultiplier: 1.1,
  }),
});

const EMPTY_TARGET_COMBAT_DATA = Object.freeze({
  attack: 0,
  armor: 0,
  defense: 0,
  blockChance: 0,
  hitChance: 0,
});

export const getCombatModeData = () => {
  return COMBAT_MODE_DATA[playerState.combatMode] ?? COMBAT_MODE_DATA.balanced;
};

export const getEquippedWeapon = () => {
  return playerState.equipment.weapon ?? null;
};

export const getEquippedWeaponCombatData = () => {
  const weapon = getEquippedWeapon();
  if (!weapon) {
    return null;
  }
  return getItemData(weapon.itemId)?.combat ?? null;
};

export const getPlayerWeaponAttack = () => {
  const weaponCombatData = getEquippedWeaponCombatData();
  return Number.isFinite(weaponCombatData?.attack) ? weaponCombatData.attack : playerState.damage;
};

export const getPlayerAttackRange = () => {
  const range = getEquippedWeaponCombatData()?.range;
  return Number.isFinite(range) && range >= 1 ? range : 1;
};

export const getPlayerAttackSkillKey = () => {
  return getEquippedWeaponCombatData()?.skillName ?? "fist";
};

export const getPlayerAttackSkill = () => {
  return playerState.skills[getPlayerAttackSkillKey()]?.level ?? 1;
};

export const getPlayerTotalArmor = () => {
  let totalArmor = 0;
  for (const equipment of Object.values(playerState.equipment)) {
    const armor = equipment ? getItemData(equipment.itemId)?.combat?.armor : null;
    if (Number.isFinite(armor)) {
      totalArmor += armor;
    }
  }
  return totalArmor;
};

export const getPlayerShieldDefense = () => {
  const shield = playerState.equipment.shield;
  const shieldDefense = shield ? getItemData(shield.itemId)?.combat?.shieldDefense : null;
  if (Number.isFinite(shieldDefense)) {
    return shieldDefense;
  }
  const weaponDefense = getEquippedWeaponCombatData()?.defense;
  return !shield && Number.isFinite(weaponDefense) ? weaponDefense : 0;
};

export const getTargetCombatData = (target) => {
  if (!target?.monsterId) {
    return EMPTY_TARGET_COMBAT_DATA;
  }
  return getMonsterData(target.monsterId)?.combat ?? EMPTY_TARGET_COMBAT_DATA;
};

export const calculatePlayerAttackResult = (target) => {
  const combatModeData = getCombatModeData();
  const targetCombatData = getTargetCombatData(target);
  const weaponCombatData = getEquippedWeaponCombatData();
  const weaponAttack = getPlayerWeaponAttack();
  const attackSkill = getPlayerAttackSkill();
  const hitChanceModifier = Number.isFinite(weaponCombatData?.hitChanceModifier)
    ? weaponCombatData.hitChanceModifier
    : 0;
  let hitChance =
    65 +
    attackSkill * 1.2 +
    weaponAttack * 1.5 -
    targetCombatData.defense * 2 -
    targetCombatData.blockChance * 0.5;
  hitChance = clamp(hitChance * combatModeData.attackMultiplier + hitChanceModifier, 35, 95);

  if (getRandomInt(1, 100) > hitChance) {
    return { didHit: false, wasBlocked: false, finalDamage: 0, text: "miss", textType: "miss" };
  }

  const levelBonus = playerState.level * 0.2;
  const minDamage = (levelBonus + attackSkill * 0.25 + weaponAttack * 0.4) * combatModeData.attackMultiplier;
  const maxDamage = (levelBonus + attackSkill * 0.6 + weaponAttack * 1.1) * combatModeData.attackMultiplier;
  const rawDamage = getRandomFloat(minDamage, maxDamage);
  const blockChance = clamp(targetCombatData.blockChance, 0, 60);
  const wasBlocked = getRandomInt(1, 100) <= blockChance;
  const defenseReduction = wasBlocked ? targetCombatData.defense * getRandomFloat(0.6, 1.2) : 0;
  const damageAfterDefense = rawDamage - defenseReduction;
  if (damageAfterDefense <= 0) {
    return { didHit: true, wasBlocked, finalDamage: 0, text: "block", textType: "block" };
  }

  const armorReduction = getRandomFloat(targetCombatData.armor * 0.45, targetCombatData.armor * 0.9);
  const finalDamage = Math.max(0, Math.floor(damageAfterDefense - armorReduction));
  if (finalDamage <= 0) {
    return { didHit: true, wasBlocked, finalDamage: 0, text: "0", textType: "absorb" };
  }
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
};

export const hasPlayerBlockSource = () => {
  const shield = playerState.equipment.shield;
  if (Number.isFinite(shield ? getItemData(shield.itemId)?.combat?.shieldDefense : null)) {
    return true;
  }
  return Number.isFinite(getEquippedWeaponCombatData()?.defense);
};

export const calculateRuneAttackResult = (useData) => {
  const runeDamage = useData.damage;
  const magicLevel = playerState.skills.magic.level;
  const level = playerState.level;
  const minDamage = runeDamage + magicLevel * 0.35 + level * 0.1;
  const maxDamage = runeDamage + magicLevel * 0.85 + level * 0.25;
  const finalDamage = Math.floor(getRandomFloat(minDamage, maxDamage));
  return { finalDamage, text: finalDamage, textType: "fire" };
};
