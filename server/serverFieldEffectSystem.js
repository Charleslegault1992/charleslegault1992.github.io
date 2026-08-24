import { groundEffectsDatabase } from "../src/data/groundEffectsDatabase.js";

const STATUS_TICK_INTERVAL_MS = 2000;

const getStatusEffects = (entity) => {
  if (!entity.statusEffects || typeof entity.statusEffects !== "object") {
    entity.statusEffects = {};
  }
  return entity.statusEffects;
};

export const createServerFieldEffectSystem = ({
  groundEffects,
  players,
  monsters,
  applyDamageTick,
}) => {
  const affectedEntitiesByKey = new Map();

  const getEntityKey = (entityType, uid) => `${entityType}:${uid}`;

  const applyFieldAtEntity = (entity, entityType, now) => {
    if (!entity || entity.hp <= 0) {
      return false;
    }
    const field = groundEffects
      .getAllAt(entity.x, entity.y, entity.z)
      .find((effect) => groundEffectsDatabase[effect.groundEffectId]?.kind === "field");
    const fieldData = groundEffectsDatabase[field?.groundEffectId];
    if (!field || fieldData?.kind !== "field" || field.decayStage >= 2) {
      return false;
    }
    const statusEffects = getStatusEffects(entity);
    const previousStatus = statusEffects[fieldData.statusEffectId];
    const damageScale = field.decayStage === 1 ? 0.5 : 1;
    const nextDamageTicks = fieldData.damageTicks.map((damage) => Math.max(1, Math.floor(damage * damageScale)));
    const previousRemainingDamage = previousStatus?.damageTicks
      ?.slice(previousStatus.nextDamageIndex ?? 0)
      .reduce((total, damage) => total + damage, 0) ?? 0;
    const nextRemainingDamage = nextDamageTicks.reduce((total, damage) => total + damage, 0);
    if (previousRemainingDamage > nextRemainingDamage) {
      return false;
    }
    statusEffects[fieldData.statusEffectId] = {
      active: true,
      statusEffectId: fieldData.statusEffectId,
      damageType: fieldData.damageType,
      damageTicks: nextDamageTicks,
      nextDamageIndex: 0,
      nextTickAt: now + STATUS_TICK_INTERVAL_MS,
      expiresAt: now + STATUS_TICK_INTERVAL_MS * nextDamageTicks.length,
      sourcePlayerUid: typeof field.ownerUid === "string" ? field.ownerUid : null,
    };
    affectedEntitiesByKey.set(getEntityKey(entityType, entity.uid), { entityType, uid: entity.uid });
    return true;
  };

  const removeStatusEffect = (entity, statusEffectId) => {
    if (!entity?.statusEffects?.[statusEffectId]) {
      return false;
    }
    delete entity.statusEffects[statusEffectId];
    return true;
  };

  const update = (now) => {
    const changedPlayers = new Map();
    const changedMonsters = new Map();
    const events = [];

    for (const [entityKey, reference] of affectedEntitiesByKey) {
      const entity = reference.entityType === "player" ? players.get(reference.uid) : monsters.get(reference.uid);
      if (!entity || entity.hp <= 0) {
        affectedEntitiesByKey.delete(entityKey);
        continue;
      }

      let hasActiveStatus = false;
      for (const [statusEffectId, status] of Object.entries(entity.statusEffects ?? {})) {
        if (!Array.isArray(status?.damageTicks)) {
          continue;
        }
        if (status.nextDamageIndex >= status.damageTicks.length) {
          delete entity.statusEffects[statusEffectId];
          continue;
        }
        hasActiveStatus = true;
        if (now < status.nextTickAt) {
          continue;
        }

        const damage = status.damageTicks[status.nextDamageIndex] ?? 0;
        status.nextDamageIndex++;
        status.nextTickAt += STATUS_TICK_INTERVAL_MS;
        if (status.nextDamageIndex >= status.damageTicks.length) {
          status.active = false;
          status.expiresAt = now;
        }
        const damageResult = applyDamageTick({
          entity,
          entityType: reference.entityType,
          damage,
          damageType: status.damageType,
          sourcePlayerUid: status.sourcePlayerUid,
        });
        events.push(...(damageResult?.events ?? []));
        if (reference.entityType === "player") {
          changedPlayers.set(entity.uid, entity);
        } else if (monsters.get(entity.uid)) {
          changedMonsters.set(entity.uid, entity);
        }
        if (entity.hp <= 0) {
          break;
        }
      }

      if (!hasActiveStatus || entity.hp <= 0) {
        affectedEntitiesByKey.delete(entityKey);
      }
    }

    return {
      changedPlayers: [...changedPlayers.values()],
      changedMonsters: [...changedMonsters.values()],
      events,
    };
  };

  return Object.freeze({ applyFieldAtEntity, removeStatusEffect, update });
};
