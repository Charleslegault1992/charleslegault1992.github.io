import { MAX_ITEM_STACK_SIZE, NPC_DIALOGUE_CONFIG, TILE_SIZE } from "../src/core/gameConstants.js";
import { npcsDatabase } from "../src/data/npcsDatabase.js";
import {
  commitPlayerCurrencyValuePlan,
  commitPlayerBackpackItemRemovalPlan,
  createPlayerBackpackItemRemovalPlan,
  createPlayerCurrencyValuePlan,
  createPlayerGoldPaymentPlan,
  getPlayerBankGoldAmount,
  getPlayerGoldAmount,
  getPlayerCurrencyValuePlanWeightDifference,
  rollbackPlayerBackpackItemRemovalPlan,
  rollbackPlayerCurrencyValuePlan,
} from "../src/inventory/inventoryTransactions.js";
import { spellsDatabase } from "../src/spellDatabase.js";
import { getLocalizedItemNameForLanguage } from "../src/localization/gameLocalization.js";
import { createItemInstance } from "../src/items/itemFactory.js";

const DAY_DURATION_MS = 24 * 60 * 60 * 1000;

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

  const getPlayerItemName = (player, itemId, quantity = 1) =>
    getLocalizedItemNameForLanguage(itemId, quantity, player?.language);
  const getPlayerSpellName = (player, spell) =>
    player?.language === "fr" ? spell?.nameFr ?? spell?.name : spell?.name;

  const getState = (npcUid) => {
    if (!statesByNpcUid.has(npcUid)) {
      statesByNpcUid.set(npcUid, {
        activePlayerUid: null,
        waitingPlayerUids: [],
        pendingAction: null,
        tradeType: null,
        lastInteractionAt: 0,
      });
    }
    return statesByNpcUid.get(npcUid);
  };

  const getDialogue = (player, npcData) => npcData.dialogue?.[player.language] ?? npcData.dialogue?.en;
  const getShopCategorySuggestions = (npcData, player, tradeType) => {
    const priceField = tradeType === "sell" ? "sellPrice" : "buyPrice";
    const availableCategoryIds = new Set(
      Object.values(npcData.service?.offers ?? {})
        .filter((offer) => Number.isInteger(offer?.[priceField]) && offer[priceField] > 0)
        .map((offer) => offer.category),
    );
    return Object.entries(npcData.service?.categories ?? {})
      .filter(([categoryId]) => availableCategoryIds.has(categoryId))
      .map(([, category]) => category.labels?.[player.language] ?? category.labels?.en)
      .filter(Boolean);
  };

  const getShopOfferSuggestions = (npcData, player, categoryId, tradeType) => {
    const priceField = tradeType === "sell" ? "sellPrice" : "buyPrice";
    return Object.entries(npcData.service?.offers ?? {})
      .filter(([, offer]) => offer.category === categoryId && Number.isInteger(offer[priceField]) && offer[priceField] > 0)
      .map(([itemId]) => getPlayerItemName(player, itemId))
      .filter(Boolean);
  };
  const createReply = (npc, player, text, suggestions = [], extraEvents = []) => ({
    success: true,
    changes: { npcUid: npc.uid, conversationActive: true },
    events: [
      { type: "player-spoke", playerUid: player.uid, text },
      { type: "npc-spoke", npcUid: npc.uid, playerUid: player.uid, text, suggestions, conversationActive: true },
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
    state.tradeType = null;
    state.lastInteractionAt = 0;
    return promoteQueue(npc, state, now);
  };

  const executePendingAction = (npc, player, state, dialogue) => {
    const pending = state.pendingAction;
    const inventory = getInventory(player.uid);
    if (!pending || !inventory) {
      return createReply(npc, player, dialogue.cancelled ?? "Cancelled.");
    }
    let completedText = dialogue.cancelled ?? "Cancelled.";
    let transactionSucceeded = false;

    if (pending.type === "buy-item" || pending.type === "learn-spell") {
      const paymentPlan = createPlayerGoldPaymentPlan(player, pending.price);
      if (!paymentPlan.success || !commitPlayerCurrencyValuePlan(paymentPlan)) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.notEnoughGold ?? "You do not have enough gold.");
      }
      const transaction = pending.type === "buy-item"
        ? inventory.insertItems(player.equipment.backpack?.uid, [{ itemId: pending.itemId, quantity: pending.quantity }])
        : { success: true };
      if (!transaction.success) {
        rollbackPlayerCurrencyValuePlan(paymentPlan);
        inventory.refreshWeight();
        state.pendingAction = null;
        return createReply(npc, player, dialogue.noRoom ?? "Make some room first.");
      }
      if (pending.type === "learn-spell" && !player.spellbook.learnedSpellIds.includes(pending.spellId)) {
        player.spellbook.learnedSpellIds.push(pending.spellId);
      }
      completedText = pending.type === "learn-spell"
        ? format(dialogue.learned, player, {
            spellName: getPlayerSpellName(player, spellsDatabase[pending.spellId]),
            incantation: spellsDatabase[pending.spellId].incantation,
          })
        : format(dialogue.bought, player, {
            quantity: pending.quantity,
            itemName: getPlayerItemName(player, pending.itemId, pending.quantity),
            price: pending.price,
          });
      transactionSucceeded = true;
    } else if (pending.type === "sell-item") {
      const removalPlan = createPlayerBackpackItemRemovalPlan(player, pending.itemId, pending.quantity);
      if (!removalPlan.success || !commitPlayerBackpackItemRemovalPlan(removalPlan)) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.missingItem);
      }
      const currencyPlan = createPlayerCurrencyValuePlan(player, getPlayerGoldAmount(player) + pending.price);
      inventory.refreshWeight();
      const weightDifference = getPlayerCurrencyValuePlanWeightDifference(currencyPlan);
      if (
        !currencyPlan.success ||
        !Number.isFinite(weightDifference) ||
        weightDifference > inventory.getRemainingCapacity() ||
        !commitPlayerCurrencyValuePlan(currencyPlan)
      ) {
        rollbackPlayerBackpackItemRemovalPlan(removalPlan);
        inventory.refreshWeight();
        state.pendingAction = null;
        return createReply(npc, player, dialogue.noRoom);
      }
      completedText = format(dialogue.sold, player, {
        quantity: pending.quantity,
        itemName: getPlayerItemName(player, pending.itemId, pending.quantity),
        price: pending.price,
      });
      transactionSucceeded = true;
    } else if (pending.type === "deposit") {
      const paymentPlan = createPlayerGoldPaymentPlan(player, pending.amount);
      if (!paymentPlan.success || !commitPlayerCurrencyValuePlan(paymentPlan)) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.notEnoughCash);
      }
      player.bank.goldBalance += pending.amount;
      completedText = format(dialogue.deposited, player, {
        amount: pending.amount,
        bankBalance: player.bank.goldBalance,
      });
      transactionSucceeded = true;
    } else if (pending.type === "withdraw") {
      if (getPlayerBankGoldAmount(player) < pending.amount) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.notEnoughBankGold);
      }
      const currencyPlan = createPlayerCurrencyValuePlan(player, getPlayerGoldAmount(player) + pending.amount);
      const weightDifference = getPlayerCurrencyValuePlanWeightDifference(currencyPlan);
      if (!currencyPlan.success) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.noRoom);
      }
      if (!Number.isFinite(weightDifference) || weightDifference > inventory.getRemainingCapacity()) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.notEnoughCapacity);
      }
      if (!commitPlayerCurrencyValuePlan(currencyPlan)) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.unavailable);
      }
      player.bank.goldBalance -= pending.amount;
      completedText = format(dialogue.withdrawn, player, {
        amount: pending.amount,
        bankBalance: player.bank.goldBalance,
      });
      transactionSucceeded = true;
    } else if (pending.type === "exchange") {
      const removalPlan = createPlayerBackpackItemRemovalPlan(player, pending.sourceItemId, pending.sourceQuantity);
      if (!removalPlan.success || !commitPlayerBackpackItemRemovalPlan(removalPlan)) {
        state.pendingAction = null;
        return createReply(npc, player, dialogue.missingCoins);
      }
      const insertion = inventory.insertItems(player.equipment.backpack?.uid, [
        { itemId: pending.outputItemId, quantity: pending.outputQuantity },
      ]);
      if (!insertion.success) {
        rollbackPlayerBackpackItemRemovalPlan(removalPlan);
        inventory.refreshWeight();
        state.pendingAction = null;
        return createReply(npc, player, dialogue.noRoom);
      }
      completedText = format(dialogue.exchanged, player, {
        outputQuantity: pending.outputQuantity,
        outputName: getPlayerItemName(player, pending.outputItemId, pending.outputQuantity),
      });
      transactionSucceeded = true;
    }

    state.pendingAction = null;
    if (!transactionSucceeded) {
      return createReply(npc, player, dialogue.unavailable ?? dialogue.cancelled);
    }
    inventory.refreshWeight();
    return createReply(npc, player, completedText, [], [{ type: "npc-transaction-completed", ...pending }]);
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
    if (isGreeting && state.activePlayerUid === player.uid && state.lastInteractionAt > 0) {
      state.lastInteractionAt = now;
      return { success: true, changes: { npcUid: npc.uid, conversationActive: true }, events: [] };
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
      reply.events.find((event) => event.type === "npc-spoke").conversationActive = false;
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

    if (npcData.service?.type === "newcomerSupport") {
      if (hasAnyWord(words, ["heal", "healing", "soin", "soins", "guerir", "guerison"])) {
        const targetHp = Math.ceil(player.maxHp * 0.5);
        if (player.hp >= targetHp) {
          return createReply(npc, player, dialogue.alreadyHealthy, dialogue.greetingSuggestions);
        }
        const restoredAmount = targetHp - player.hp;
        player.hp = targetHp;
        return createReply(npc, player, dialogue.healed, dialogue.greetingSuggestions, [
          { type: "npc-heal-completed", npcUid: npc.uid, playerUid: player.uid, restoredAmount },
        ]);
      }

      if (hasAnyWord(words, ["bag", "backpack", "sac", "sacs"])) {
        if (player.equipment.backpack) {
          return createReply(npc, player, dialogue.bagAlreadyEquipped, dialogue.greetingSuggestions);
        }
        const inventory = getInventory(player.uid);
        if (!inventory) {
          return createReply(npc, player, dialogue.unavailable, dialogue.greetingSuggestions);
        }
        player.progress.dailyNpcRewardsByNpcId ??= {};
        const currentDay = Math.floor(now / DAY_DURATION_MS);
        let dailyReward = player.progress.dailyNpcRewardsByNpcId[npc.npcId];
        if (!dailyReward || dailyReward.day !== currentDay) {
          dailyReward = { day: currentDay, count: 0 };
          player.progress.dailyNpcRewardsByNpcId[npc.npcId] = dailyReward;
        }
        if (dailyReward.count >= npcData.service.maxDailyBags) {
          return createReply(npc, player, dialogue.dailyBagLimit, dialogue.greetingSuggestions);
        }
        const bag = createItemInstance("bag", 1);
        if (!bag) {
          return createReply(npc, player, dialogue.unavailable, dialogue.greetingSuggestions);
        }
        player.equipment.backpack = bag;
        dailyReward.count++;
        inventory.refreshWeight();
        return createReply(npc, player, dialogue.bagGiven, dialogue.greetingSuggestions, [
          { type: "npc-transaction-completed", transactionType: "free-bag", itemId: "bag", quantity: 1 },
        ]);
      }
    }

    if (npcData.service?.type === "itemShop") {
      const offerEntry = Object.entries(npcData.service.offers).find(([itemId, offer]) => {
        const itemNames = [
          getPlayerItemName(player, itemId),
          getPlayerItemName(player, itemId, 2),
        ];
        return [...(offer.keywords ?? []), ...itemNames]
          .filter(Boolean)
          .some((keyword) => normalize(text).includes(normalize(keyword)));
      });
      const wantsBuy = hasAnyWord(words, ["buy", "purchase", "achat", "acheter", "achete"]);
      const wantsSell = hasAnyWord(words, ["sell", "selling", "vente", "vendre", "vends"]);
      const wantsTrade = hasAnyWord(words, ["trade", "offers", "offres", "commerce"]);
      const categoryEntry = Object.entries(npcData.service.categories ?? {}).find(([, category]) =>
        category.keywords?.some((keyword) => normalize(text).includes(normalize(keyword))),
      );
      if (wantsBuy) {
        state.tradeType = "buy";
      } else if (wantsSell) {
        state.tradeType = "sell";
      }
      if (!offerEntry && (wantsBuy || wantsSell || state.tradeType) && categoryEntry) {
        const [categoryId, category] = categoryEntry;
        const tradeType = state.tradeType ?? (wantsSell ? "sell" : "buy");
        const categoryName = category.labels?.[player.language] ?? category.labels?.en ?? categoryId;
        return createReply(
          npc,
          player,
          format(tradeType === "sell" ? dialogue.sellCategoryMenu : dialogue.buyCategoryMenu, player, { categoryName }),
          getShopOfferSuggestions(npcData, player, categoryId, tradeType),
        );
      }
      if (!offerEntry && (wantsBuy || wantsSell)) {
        const tradeType = state.tradeType;
        return createReply(
          npc,
          player,
          tradeType === "sell" ? dialogue.sellMenu : dialogue.buyMenu,
          getShopCategorySuggestions(npcData, player, tradeType),
        );
      }
      if (wantsTrade) {
        return createReply(npc, player, dialogue.trade, dialogue.greetingSuggestions);
      }
      const quantityMatch = normalize(text).match(/\b(\d{1,3})\b/);
      const quantity = Math.min(Math.max(Number(quantityMatch?.[1] ?? 1), 1), MAX_ITEM_STACK_SIZE);
      if (offerEntry) {
        const [itemId, offer] = offerEntry;
        const isSelling = wantsSell || (!wantsBuy && state.tradeType === "sell");
        state.tradeType = isSelling ? "sell" : "buy";
        const unitPrice = isSelling ? offer.sellPrice : offer.buyPrice;
        if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
          return createReply(npc, player, dialogue.unavailable);
        }
        state.pendingAction = {
          type: isSelling ? "sell-item" : "buy-item",
          itemId,
          quantity,
          price: unitPrice * quantity,
        };
        return createReply(
          npc,
          player,
          format(isSelling ? dialogue.confirmSell : dialogue.confirmBuy, player, {
            quantity,
            itemName: getPlayerItemName(player, itemId, quantity),
            price: state.pendingAction.price,
          }),
          dialogue.confirmationSuggestions,
        );
      }
    }
    if (npcData.service?.type === "spellTeacher") {
      if (hasAnyWord(words, ["spell", "spells", "sort", "sorts", "magic", "magie"])) {
        const suggestions = npcData.service.spellIds
          .map((spellId) => getPlayerSpellName(player, spellsDatabase[spellId]))
          .filter(Boolean);
        return createReply(npc, player, dialogue.spells, suggestions);
      }
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
          format(dialogue.confirmLearn, player, {
            spellName: getPlayerSpellName(player, spell),
            price: spell.learnPrice,
          }),
          dialogue.confirmationSuggestions,
        );
      }
    }
    if (npcData.service?.type === "banker") {
      if (hasAnyWord(words, ["balance", "solde"])) {
        return createReply(npc, player, format(dialogue.balance, player, {
          bankBalance: player.bank.goldBalance,
          cashBalance: getPlayerGoldAmount(player),
        }));
      }
      const amountMatch = normalize(text).match(/\b(\d+)\b/);
      const requestedAmount = Number(amountMatch?.[1] ?? 0);
      if (hasAnyWord(words, ["deposit", "depot", "deposer", "depose"])) {
        const amount = hasAnyWord(words, ["all", "tout"]) ? getPlayerGoldAmount(player) : requestedAmount;
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          return createReply(npc, player, dialogue.depositPrompt, dialogue.depositSuggestions);
        }
        state.pendingAction = { type: "deposit", amount };
        return createReply(npc, player, format(dialogue.confirmDeposit, player, { amount }), dialogue.confirmationSuggestions);
      }
      if (hasAnyWord(words, ["withdraw", "withdrawal", "retrait", "retirer", "retire"])) {
        const amount = hasAnyWord(words, ["all", "tout"]) ? getPlayerBankGoldAmount(player) : requestedAmount;
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          return createReply(npc, player, dialogue.withdrawPrompt, dialogue.withdrawSuggestions);
        }
        state.pendingAction = { type: "withdraw", amount };
        return createReply(npc, player, format(dialogue.confirmWithdraw, player, { amount }), dialogue.confirmationSuggestions);
      }
      if (hasAnyWord(words, ["exchange", "echange", "changer", "change"])) {
        const normalizedText = normalize(text);
        const recipe = npcData.service.exchangeRecipes.find((candidate) => {
          const sourceWords = candidate.sourceItemId === "goldCoin"
            ? ["gold", "or"]
            : candidate.sourceItemId === "azureCoin" ? ["platinum", "platine", "azure"] : ["crystal", "cristal"];
          const outputWords = candidate.outputItemId === "goldCoin"
            ? ["gold", "or"]
            : candidate.outputItemId === "azureCoin" ? ["platinum", "platine", "azure"] : ["crystal", "cristal"];
          const sourceIndex = Math.min(...sourceWords.map((word) => normalizedText.indexOf(word)).filter((index) => index >= 0));
          const outputIndex = Math.max(...outputWords.map((word) => normalizedText.lastIndexOf(word)));
          return Number.isFinite(sourceIndex) && sourceIndex >= 0 && outputIndex > sourceIndex;
        });
        if (!recipe) {
          return createReply(npc, player, dialogue.exchangePrompt, dialogue.exchangeSuggestions);
        }
        state.pendingAction = { type: "exchange", ...recipe };
        return createReply(npc, player, format(dialogue.confirmExchange, player, {
          sourceQuantity: recipe.sourceQuantity,
          sourceName: getPlayerItemName(player, recipe.sourceItemId, recipe.sourceQuantity),
          outputQuantity: recipe.outputQuantity,
          outputName: getPlayerItemName(player, recipe.outputItemId, recipe.outputQuantity),
        }), dialogue.confirmationSuggestions);
      }
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
          openChat: timedOut,
          conversationActive: false,
        });
        release(npc, state, now);
      }
    }
    return events;
  };

  return Object.freeze({ handleSpeech, statesByNpcUid, update });
};
