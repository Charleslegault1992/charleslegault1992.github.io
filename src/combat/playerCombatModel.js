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

const DEFAULT_COMBAT_RANDOM = Object.freeze({ getFloat: getRandomFloat, getInt: getRandomInt });

export const getCombatModeData = (player = playerState) => {
  return COMBAT_MODE_DATA[player?.combatMode] ?? COMBAT_MODE_DATA.balanced;
};

export const getEquippedWeapon = (player = playerState) => {
  return player?.equipment?.weapon ?? null;
};

export const getEquippedWeaponCombatData = (player = playerState) => {
  const weapon = getEquippedWeapon(player);
  if (!weapon) {
    return null;
  }
  return getItemData(weapon.itemId)?.combat ?? null;
};

export const getPlayerWeaponAttack = (player = playerState) => {
  const weaponCombatData = getEquippedWeaponCombatData(player);
  return Number.isFinite(weaponCombatData?.attack) ? weaponCombatData.attack : player?.damage ?? 0;
};

export const getPlayerAttackRange = (player = playerState) => {
  const range = getEquippedWeaponCombatData(player)?.range;
  return Number.isFinite(range) && range >= 1 ? range : 1;
};

export const getPlayerAttackSkillKey = (player = playerState) => {
  return getEquippedWeaponCombatData(player)?.skillName ?? "fist";
};

export const getPlayerAttackSkill = (player = playerState) => {
  return player?.skills?.[getPlayerAttackSkillKey(player)]?.level ?? 1;
};

export const getPlayerTotalArmor = (player = playerState) => {
  let totalArmor = 0;
  for (const equipment of Object.values(player?.equipment ?? {})) {
    const armor = equipment ? getItemData(equipment.itemId)?.combat?.armor : null;
    if (Number.isFinite(armor)) {
      totalArmor += armor;
    }
  }
  return totalArmor;
};

export const getPlayerShieldDefense = (player = playerState) => {
  const shield = player?.equipment?.shield;
  const shieldDefense = shield ? getItemData(shield.itemId)?.combat?.shieldDefense : null;
  if (Number.isFinite(shieldDefense)) {
    return shieldDefense;
  }
  const weaponDefense = getEquippedWeaponCombatData(player)?.defense;
  return !shield && Number.isFinite(weaponDefense) ? weaponDefense : 0;
};

export const getTargetCombatData = (target) => {
  if (target?.monsterId) {
    return getMonsterData(target.monsterId)?.combat ?? EMPTY_TARGET_COMBAT_DATA;
  }
  if (target?.equipment && target?.skills) {
    const shielding = target.skills.shielding?.level ?? 0;
    const shieldDefense = getPlayerShieldDefense(target);
    return {
      attack: 0,
      armor: getPlayerTotalArmor(target),
      defense: shieldDefense + shielding * 0.1,
      blockChance: clamp(10 + shielding * 0.8 + shieldDefense * 0.8, 5, 70),
      hitChance: 0,
    };
  }
  return EMPTY_TARGET_COMBAT_DATA;
};

export const calculatePlayerAttackResult = (target, player = playerState, random = DEFAULT_COMBAT_RANDOM) => {
  const randomInt = typeof random?.getInt === "function" ? random.getInt : getRandomInt;
  const randomFloat = typeof random?.getFloat === "function" ? random.getFloat : getRandomFloat;
  const combatModeData = getCombatModeData(player);
  const targetCombatData = getTargetCombatData(target);
  const weaponCombatData = getEquippedWeaponCombatData(player);
  const weaponAttack = getPlayerWeaponAttack(player);
  const attackSkill = getPlayerAttackSkill(player);
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

  if (randomInt(1, 100) > hitChance) {
    return { didHit: false, wasBlocked: false, finalDamage: 0, text: "miss", textType: "miss" };
  }

  const levelBonus = (player?.level ?? 0) * 0.2;
  const minDamage = (levelBonus + attackSkill * 0.25 + weaponAttack * 0.4) * combatModeData.attackMultiplier;
  const maxDamage = (levelBonus + attackSkill * 0.6 + weaponAttack * 1.1) * combatModeData.attackMultiplier;
  const rawDamage = randomFloat(minDamage, maxDamage);
  const blockChance = clamp(targetCombatData.blockChance, 0, 60);
  const wasBlocked = randomInt(1, 100) <= blockChance;
  const defenseReduction = wasBlocked ? targetCombatData.defense * randomFloat(0.6, 1.2) : 0;
  const damageAfterDefense = rawDamage - defenseReduction;
  if (damageAfterDefense <= 0) {
    return { didHit: true, wasBlocked, finalDamage: 0, text: "block", textType: "block" };
  }

  const armorReduction = randomFloat(targetCombatData.armor * 0.45, targetCombatData.armor * 0.9);
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

export const hasPlayerBlockSource = (player = playerState) => {
  const shield = player?.equipment?.shield;
  if (Number.isFinite(shield ? getItemData(shield.itemId)?.combat?.shieldDefense : null)) {
    return true;
  }
  return Number.isFinite(getEquippedWeaponCombatData(player)?.defense);
};

export const calculateRuneAttackResult = (useData, player = playerState, random = DEFAULT_COMBAT_RANDOM) => {
  const runeDamage = useData.damage;
  const magicLevel = player?.skills?.magic?.level ?? 0;
  const level = player?.level ?? 0;
  const minDamage = runeDamage + magicLevel * 0.35 + level * 0.1;
  const maxDamage = runeDamage + magicLevel * 0.85 + level * 0.25;
  const randomFloat = typeof random?.getFloat === "function" ? random.getFloat : getRandomFloat;
  const finalDamage = Math.floor(randomFloat(minDamage, maxDamage));
  return { finalDamage, text: finalDamage, textType: "fire" };
};

export const calculateMonsterAttackResult = (attackerCombatData, player = playerState, random = DEFAULT_COMBAT_RANDOM) => {
  const randomInt = typeof random?.getInt === "function" ? random.getInt : getRandomInt;
  const randomFloat = typeof random?.getFloat === "function" ? random.getFloat : getRandomFloat;
  const combatModeData = getCombatModeData(player);
  const playerArmor = getPlayerTotalArmor(player);
  const playerShieldDefense = getPlayerShieldDefense(player);
  const shielding = player?.skills?.shielding?.level ?? 0;
  const hitChance = clamp((attackerCombatData?.hitChance ?? 0) - shielding * 0.4, 35, 95);
  if (randomInt(1, 100) > hitChance) {
    return { didHit: false, wasBlocked: false, finalDamage: 0, text: "miss", textType: "miss" };
  }

  const rawDamage = randomFloat(1, Math.max(attackerCombatData?.attack ?? 1, 1));
  const blockChance = clamp(
    (10 + shielding * 0.8 + playerShieldDefense * 0.8) * combatModeData.blockChanceMultiplier,
    5,
    70,
  );
  const hasBlockSource = hasPlayerBlockSource(player);
  const wasBlocked = hasBlockSource && randomInt(1, 100) <= blockChance;
  const defensePower = wasBlocked
    ? (playerShieldDefense * 0.25 + shielding * 0.1) * combatModeData.defenseMultiplier
    : 0;
  const defenseReduction = wasBlocked ? randomFloat(defensePower * 0.6, defensePower * 1.2) : 0;
  const damageAfterDefense = rawDamage - defenseReduction;
  if (damageAfterDefense <= 0) {
    return { didHit: true, wasBlocked, finalDamage: 0, text: "block", textType: "block" };
  }

  const armorPower = playerArmor * combatModeData.armorMultiplier;
  const armorReduction = randomFloat(armorPower * 0.2, armorPower * 0.45);
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
