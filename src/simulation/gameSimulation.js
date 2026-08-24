import { createGameActionDispatcher } from "../actions/gameActionDispatcher.js";
import { registerGameplayActionHandlers } from "../actions/gameplayActions.js";
import { registerInventoryActionHandlers } from "../inventory/inventoryActions.js";
import { registerItemUseActionHandlers } from "../items/itemUseActions.js";
import { canInitiatePlayerPvpAttack } from "../combat/playerPvpState.js";
import { PLAYER_COMBAT_MODES } from "../core/gameConstants.js";

const rejectCommand = (reason) => ({ success: false, reason });

export const createGameSimulation = ({ state, rules, commands, onListenerError = null }) => {
  if (!state?.player || !(state.monstersByUid instanceof Map) || !state.timing || !rules || !commands) {
    throw new TypeError("The game simulation requires state, rules and commands.");
  }

  const dispatcher = createGameActionDispatcher();
  registerInventoryActionHandlers(dispatcher);
  registerGameplayActionHandlers(dispatcher);
  registerItemUseActionHandlers(dispatcher);
  const listeners = new Set();

  const executeMovePlayer = (payload) => {
    const player = state.player;
    const movementCooldownToleranceMs = Math.max(rules.getMovementCooldownToleranceMs?.() ?? 0, 0);
    if (
      player.x !== payload.fromX ||
      player.y !== payload.fromY ||
      player.z !== payload.fromZ ||
      player.hp <= 0 ||
      payload.requestedAt + movementCooldownToleranceMs < state.timing.nextPlayerMoveTime
    ) {
      return rejectCommand("player-state-changed");
    }

    const moveTiming = rules.getPlayerMoveTiming?.(payload) ?? null;
    if (
      !Number.isFinite(moveTiming?.duration) ||
      !Number.isFinite(moveTiming?.cooldown) ||
      moveTiming.duration < 0 ||
      moveTiming.cooldown < 0
    ) {
      return rejectCommand("invalid-movement");
    }
    if (rules.canPlayerMove?.(payload) !== true) {
      return rejectCommand("movement-blocked");
    }

    const movementStartedAt = Math.max(payload.requestedAt, state.timing.nextPlayerMoveTime);
    player.oldX = payload.fromX;
    player.oldY = payload.fromY;
    player.moveStartTime = movementStartedAt;
    player.moveDuration = moveTiming.duration;
    player.x = payload.toX;
    player.y = payload.toY;
    player.direction = payload.direction;
    commands.recordPlayerTileEntry?.(player);
    state.timing.nextPlayerMoveTime = movementStartedAt + moveTiming.cooldown;

    const events = [
      {
        type: "player-moved",
        playerUid: player.uid,
        x: player.x,
        y: player.y,
        z: player.z,
      },
    ];
    const transition = commands.findAutomaticWorldTransition?.(player) ?? null;
    if (transition) {
      const transitionResult = commands.executeWorldTransition?.(transition, {
        requestedAt: payload.requestedAt,
        automatic: true,
      });
      if (transitionResult?.success) {
        events.push(...(transitionResult.events ?? []));
      }
    }

    return {
      success: true,
      changes: {
        playerUid: player.uid,
        fromX: payload.fromX,
        fromY: payload.fromY,
        x: player.x,
        y: player.y,
        z: player.z,
        direction: payload.direction,
        moveDuration: moveTiming.duration,
      },
      events,
    };
  };

  const executeAttackMonster = (payload) => {
    const player = state.player;
    const monster = state.monstersByUid.get(payload.monsterUid) ?? null;
    if (!monster || monster.hp <= 0 || monster.z !== player.z || player.hp <= 0) {
      return rejectCommand("target-lost");
    }
    if (payload.requestedAt < state.timing.nextPlayerAttackTime) {
      return rejectCommand("attack-cooldown");
    }
    if (rules.canPlayerAttackMonster?.(player, monster) !== true) {
      return rejectCommand("target-out-of-range");
    }

    const attackCooldownMs = rules.getPlayerAttackCooldownMs?.();
    if (!Number.isFinite(attackCooldownMs) || attackCooldownMs < 0) {
      return rejectCommand("invalid-attack-cooldown");
    }

    const commandResult = commands.executeAttackMonster?.(monster, payload) ?? rejectCommand("missing-executor");
    if (commandResult?.success === false || commandResult === false) {
      return commandResult;
    }
    state.timing.nextPlayerAttackTime = payload.requestedAt + attackCooldownMs;
    return commandResult === true ? { success: true } : commandResult;
  };

  const executeAttackPlayer = (payload) => {
    const player = state.player;
    const target = state.playersByUid?.get(payload.playerUid) ?? null;
    if (!target || target.uid === player.uid || target.hp <= 0 || target.z !== player.z || player.hp <= 0) {
      return rejectCommand("target-lost");
    }
    const canInitiatePvpAttack =
      rules.canInitiatePlayerPvpAttack?.(player, target, payload) ??
      canInitiatePlayerPvpAttack(player, target, payload.requestedAt);
    if (canInitiatePvpAttack !== true) {
      return rejectCommand("pvp-disabled");
    }
    if (payload.requestedAt < state.timing.nextPlayerAttackTime) {
      return rejectCommand("attack-cooldown");
    }
    if (rules.canPlayerAttackPlayer?.(player, target) !== true) {
      return rejectCommand("target-out-of-range");
    }
    const attackCooldownMs = rules.getPlayerAttackCooldownMs?.();
    if (!Number.isFinite(attackCooldownMs) || attackCooldownMs < 0) {
      return rejectCommand("invalid-attack-cooldown");
    }
    const commandResult = commands.executeAttackPlayer?.(target, payload) ?? rejectCommand("missing-executor");
    if (commandResult?.success === false || commandResult === false) {
      return commandResult;
    }
    state.timing.nextPlayerAttackTime = payload.requestedAt + attackCooldownMs;
    return commandResult === true ? { success: true } : commandResult;
  };

  const executeSetPvpEnabled = (payload) => {
    if (typeof payload.enabled !== "boolean" || state.player.hp <= 0) {
      return rejectCommand("invalid-pvp-state");
    }
    if (payload.enabled === false && rules.canPlayerDisablePvp?.(state.player, payload.requestedAt) === false) {
      return rejectCommand("pvp-locked-by-skull");
    }
    return commands.executeSetPvpEnabled?.(payload.enabled) ?? rejectCommand("missing-executor");
  };

  const executeSetCombatMode = (payload) => {
    if (!PLAYER_COMBAT_MODES.includes(payload.combatMode) || state.player.hp <= 0) {
      return rejectCommand("invalid-combat-mode");
    }
    return commands.executeSetCombatMode?.(payload.combatMode) ?? rejectCommand("missing-executor");
  };

  const executeSpeakToNpc = (payload) => {
    const player = commands.getPlayerByUid?.(payload.playerUid) ?? null;
    if (!player || player.hp <= 0) {
      return rejectCommand("player-not-found");
    }
    return commands.executeNpcSpeech?.(payload, player) ?? rejectCommand("missing-executor");
  };

  const executeWorldInteraction = (payload) => {
    if (payload.z !== state.player.z) {
      return rejectCommand("wrong-floor");
    }
    const interactable = commands.findWorldInteractable?.(payload) ?? null;
    if (!interactable) {
      return rejectCommand("interactable-not-found");
    }
    return commands.executeWorldInteraction?.(interactable, payload) ?? rejectCommand("missing-executor");
  };

  const executeCastSpell = (payload) => {
    if (!commands.getSpellById?.(payload.spellId)) {
      return rejectCommand("spell-not-found");
    }
    return commands.executeSpell?.(payload) ?? rejectCommand("missing-executor");
  };

  const executeSendChatMessage = (payload) => {
    if (state.player.hp <= 0 || payload.requestedAt < (state.timing.nextChatMessageTime ?? 0)) {
      return rejectCommand("chat-cooldown");
    }
    const result = commands.executeChatMessage?.(payload, state.player) ?? rejectCommand("missing-executor");
    if (result?.success !== false) {
      state.timing.nextChatMessageTime = payload.requestedAt + 500;
    }
    return result;
  };

  const executeWorldTransition = (payload) => {
    if (payload.z !== state.player.z) {
      return rejectCommand("wrong-floor");
    }
    const transition = commands.findWorldTransition?.(payload) ?? null;
    if (!transition) {
      return rejectCommand("transition-not-found");
    }
    if (rules.canPlayerUseWorldTransition?.(state.player, transition) !== true) {
      return rejectCommand("transition-out-of-range");
    }
    return commands.executeWorldTransition?.(transition, payload) ?? rejectCommand("missing-executor");
  };

  const executeUseItem = (payload) => {
    const item = commands.getItemFromLocation?.(payload.source) ?? null;
    if (!item || item.uid !== payload.itemUid) {
      return rejectCommand("item-changed");
    }
    if (payload.source.locationType === "worldItem" && rules.canUseWorldItemSource?.(payload.source, item) !== true) {
      return rejectCommand("invalid-source");
    }
    const useData = commands.getItemUseData?.(item) ?? null;
    if (!useData?.action) {
      return rejectCommand("item-not-usable");
    }
    return commands.executeItemUse?.(item, useData, payload) ?? rejectCommand("missing-executor");
  };

  const context = Object.freeze({
    executeAttackMonster,
    executeAttackPlayer,
    executeCastSpell,
    executeMove: commands.executeMoveItem,
    executeSplitItemStack: commands.executeSplitItemStack,
    executeMovePlayer,
    executeSendChatMessage,
    executeSetCombatMode,
    executeSetPvpEnabled,
    executeSpeakToNpc,
    executeUseItem,
    executeWorldInteraction,
    executeWorldTransition,
    findContainerByUid: commands.findContainerByUid,
    getRemainingCapacity: commands.getRemainingCapacity,
  });

  const dispatch = (action) => {
    const result = dispatcher.dispatch(action, context);
    for (const listener of listeners) {
      try {
        listener(structuredClone(result));
      } catch (error) {
        onListenerError?.(error, result);
      }
    }
    return result;
  };

  const subscribe = (listener) => {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return Object.freeze({ dispatch, subscribe });
};
