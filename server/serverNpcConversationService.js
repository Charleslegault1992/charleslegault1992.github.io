import { MAX_ITEM_STACK_SIZE, NPC_DIALOGUE_CONFIG, TILE_SIZE } from "../src/core/gameConstants.js";
import { npcsDatabase } from "../src/data/npcsDatabase.js";
import {
  commitPlayerCurrencyValuePlan,
  createPlayerGoldPaymentPlan,
  getPlayerGoldAmount,
  rollbackPlayerCurrencyValuePlan,
} from "../src/inventory/inventoryTransactions.js";
import { spellsDatabase } from "../src/spellDatabase.js";

const normalize = (text) => String(text ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .trim()
  .toLocaleLowerCase();

const getWords = (text) => new Set(normalize(text).match(/[a-z]+/g) ?? []);
const hasAnyWord = (words, choices) => choices.some((choice) => words.has(choice));

const format = (template, player, replacements = {}) => {
  let text = template?.replaceAll("{playerName}", player.name) ?? "";
  for (const [key, value] of Object.entries(replacements)) {
    text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
};

const isInTalkRange = (player, npc) => {
  if (!player || !npc || player.z !== npc.z) {
    return false;
  }
  const distance = (Math.abs(player.x - npc.x) + Math.abs(player.y - npc.y)) / TILE_SIZE;
  return distance <= NPC_DIALOGUE_CONFIG.talkRange;
};

export const createServerNpcConversationService = ({ npcs, playersByUid, getInventory }) => {
  const statesByNpcUid = new Map();

  const getState = (npcUid) => {
    if (!statesByNpcUid.has(npcUid)) {
      statesByNpcUid.set(npcUid, {
        activePlayerUid: null,
        waitingPlayerUids: [],
        pendingAction: null,
        lastInteractionAt: 0,
      });
    }
    return statesByNpcUid.get(npcUid);
  };

  const getDialogue = (player, npcData) => npcData.dialogue?.[player.language] ?? npcData.dialogue?.en;
  const createReply = (npc, player, text, suggestions = [], extraEvents = []) => ({
    success: true,
    changes: { npcUid: npc.uid, conversationActive: true },
    events: [
      { type: "player-spoke", playerUid: player.uid, text },
      { type: "npc-spoke", npcUid: npc.uid, playerUid: player.uid, text, suggestions },
      ...extraEvents,
    ],
  });

  const findNearestNpc = (player) => {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const npc of npcs.values()) {
      if (!isInTalkRange(player, npc)) {
        continue;
      }
      const distance = Math.abs(player.x - npc.x) + Math.abs(player.y - npc.y);
      if (distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    return nearest;
  };

  const findActiveNpc = (player) => {
    for (const npc of npcs.values()) {
      if (getState(npc.uid).activePlayerUid === player.uid) {
        return npc;
      }
    }
    return null;
  };

  const promoteQueue = (npc, state, now) => {
    while (state.waitingPlayerUids.length > 0) {
      const playerUid = state.waitingPlayerUids.shift();
      const player = playersByUid.get(playerUid);
      if (isInTalkRange(player, npc)) {
        state.activePlayerUid = playerUid;
        state.lastInteractionAt = now;
        return player;
      }
    }
    return null;
  };

  const release = (npc, state, now) => {
    state.activePlayerUid = null;
    state.pendingAction = null;
    state.lastInteractionAt = 0;
    return promoteQueue(npc, state, now);
  };

  const executePendingAction = (npc, player, state, dialogue) => {
    const pending = state.pendingAction;
    const inventory = getInventory(player.uid);
    if (!pending || !inventory) {
      return createReply(npc, player, dialogue.cancelled ?? "Cancelled.");
    }
    const paymentPlan = createPlayerGoldPaymentPlan(player, pending.price);
    if (!paymentPlan.success || !commitPlayerCurrencyValuePlan(paymentPlan)) {
      state.pendingAction = null;
      return createReply(npc, player, dialogue.notEnoughGold ?? "You do not have enough gold.");
    }

    let transaction = null;
    if (pending.type === "buy-item") {
      transaction = inventory.insertItems(player.equipment.backpack?.uid, [
        { itemId: pending.itemId, quantity: pending.quantity },
      ]);
    } else if (pending.type === "learn-spell") {
      if (!player.spellbook.learnedSpellIds.includes(pending.spellId)) {
        player.spellbook.learnedSpellIds.push(pending.spellId);
      }
      transaction = { success: true };
    }
    if (!transaction?.success) {
      rollbackPlayerCurrencyValuePlan(paymentPlan);
      return createReply(npc, player, dialogue.noRoom ?? "Make some room first.");
    }

    state.pendingAction = null;
    const completedText = pending.type === "learn-spell"
      ? format(dialogue.learned, player, {
          spellName: spellsDatabase[pending.spellId].name,
          incantation: spellsDatabase[pending.spellId].incantation,
        })
      : format(dialogue.bought, player, {
          quantity: pending.quantity,
          itemName: getItemDataName(pending.itemId),
          price: pending.price,
        });
    return createReply(npc, player, completedText, [], [{ type: "npc-transaction-completed", ...pending }]);
  };

  const getItemDataName = (itemId) => {
    for (const npcData of Object.values(npcsDatabase)) {
      if (npcData.service?.offers?.[itemId]) {
        return itemId;
      }
    }
    return itemId;
  };

  const handleSpeech = (text, player, now) => {
    const words = getWords(text);
    const isGreeting = hasAnyWord(words, ["hi", "hello", "hey", "salut", "bonjour"]);
    let npc = findActiveNpc(player);
    if (!npc && isGreeting) {
      npc = findNearestNpc(player);
    }
    if (!npc || !isInTalkRange(player, npc)) {
      return { success: false, reason: "npc-not-in-range" };
    }
    const state = getState(npc.uid);
    const npcData = npcsDatabase[npc.npcId];
    const dialogue = getDialogue(player, npcData);

    if (state.activePlayerUid && state.activePlayerUid !== player.uid) {
      if (!state.waitingPlayerUids.includes(player.uid)) {
        state.waitingPlayerUids.push(player.uid);
      }
      return {
        success: false,
        reason: "npc-busy",
        changes: { queuePosition: state.waitingPlayerUids.indexOf(player.uid) + 1 },
      };
    }
    state.activePlayerUid = player.uid;
    state.lastInteractionAt = now;

    if (isGreeting) {
      return createReply(npc, player, format(dialogue.greeting, player, {
        bankBalance: player.bank.goldBalance,
      }), dialogue.greetingSuggestions);
    }
    if (hasAnyWord(words, ["bye", "goodbye", "aurevoir"])) {
      const reply = createReply(npc, player, format(dialogue.farewell, player));
      reply.changes.conversationActive = false;
      release(npc, state, now);
      return reply;
    }
    if (state.pendingAction) {
      if (hasAnyWord(words, ["yes", "oui", "sure"])) {
        return executePendingAction(npc, player, state, dialogue);
      }
      if (hasAnyWord(words, ["no", "non", "cancel", "annule"])) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.cancelled);
      }
      return createReply(npc, player, dialogue.confirmRequired, dialogue.confirmationSuggestions);
    }

    if (npcData.service?.type === "itemShop") {
      const quantityMatch = normalize(text).match(/\b(\d{1,3})\b/);
      const quantity = Math.min(Math.max(Number(quantityMatch?.[1] ?? 1), 1), MAX_ITEM_STACK_SIZE);
      const offerEntry = Object.entries(npcData.service.offers).find(([, offer]) =>
        offer.keywords?.some((keyword) => normalize(text).includes(normalize(keyword))),
      );
      if (offerEntry) {
        const [itemId, offer] = offerEntry;
        if (!Number.isInteger(offer.buyPrice) || offer.buyPrice <= 0) {
          return createReply(npc, player, dialogue.unavailable);
        }
        state.pendingAction = { type: "buy-item", itemId, quantity, price: offer.buyPrice * quantity };
        return createReply(
          npc,
          player,
          format(dialogue.confirmBuy, player, { quantity, itemName: itemId, price: state.pendingAction.price }),
          dialogue.confirmationSuggestions,
        );
      }
    }
    if (npcData.service?.type === "spellTeacher") {
      const spellId = npcData.service.spellIds.find((candidate) => {
        const spell = spellsDatabase[candidate];
        return [spell.name, spell.nameFr, ...(spell.learningKeywords ?? [])]
          .filter(Boolean)
          .some((keyword) => normalize(text).includes(normalize(keyword)));
      });
      if (spellId) {
        const spell = spellsDatabase[spellId];
        if (player.spellbook.learnedSpellIds.includes(spellId)) {
          return createReply(npc, player, dialogue.alreadyLearned);
        }
        state.pendingAction = { type: "learn-spell", spellId, price: spell.learnPrice };
        return createReply(
          npc,
          player,
          format(dialogue.confirmLearn, player, { spellName: spell.name, price: spell.learnPrice }),
          dialogue.confirmationSuggestions,
        );
      }
    }
    if (npcData.service?.type === "banker" && hasAnyWord(words, ["balance", "solde"])) {
      return createReply(npc, player, format(dialogue.balance, player, {
        bankBalance: player.bank.goldBalance,
        cashBalance: getPlayerGoldAmount(player),
      }));
    }
    if (hasAnyWord(words, ["name", "nom"])) {
      return createReply(npc, player, dialogue.name);
    }
    if (hasAnyWord(words, ["job", "travail"])) {
      return createReply(npc, player, dialogue.job);
    }
    if (hasAnyWord(words, ["help", "aide"])) {
      return createReply(npc, player, dialogue.help);
    }
    return createReply(npc, player, dialogue.unknown);
  };

  const update = (now) => {
    const events = [];
    for (const npc of npcs.values()) {
      const state = getState(npc.uid);
      const player = playersByUid.get(state.activePlayerUid);
      if (!player) {
        release(npc, state, now);
        continue;
      }
      const timedOut = now - state.lastInteractionAt >= NPC_DIALOGUE_CONFIG.conversationTimeoutMs;
      if (!isInTalkRange(player, npc) || timedOut) {
        const dialogue = getDialogue(player, npcsDatabase[npc.npcId]);
        events.push({
          type: "npc-spoke",
          npcUid: npc.uid,
          playerUid: player.uid,
          text: timedOut ? dialogue.timeoutFarewell : dialogue.rudeDeparture,
          suggestions: [],
        });
        release(npc, state, now);
      }
    }
    return events;
  };

  return Object.freeze({ handleSpeech, statesByNpcUid, update });
};
