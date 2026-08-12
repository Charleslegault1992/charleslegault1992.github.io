import {
  MAX_ITEM_STACK_SIZE,
  NPC_DIALOGUE_CONFIG,
  TILE_SIZE,
} from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";
import { INVENTORY_ACTION_REASON } from "../inventory/inventoryActions.js";
import {
  commitPlayerBackpackItemRemovalPlan,
  commitPlayerCurrencyValuePlan,
  createPlayerBackpackItemRemovalPlan,
  createPlayerCurrencyValuePlan,
  createPlayerGoldPaymentPlan,
  getPlayerBankGoldAmount,
  getPlayerCurrencyValuePlanWeightDifference,
  getPlayerGoldAmount,
  rollbackPlayerBackpackItemRemovalPlan,
  rollbackPlayerCurrencyValuePlan,
  spendPlayerGold,
} from "../inventory/inventoryTransactions.js";
import { getPlayerRemainingCapacity } from "../inventory/inventoryWeight.js";
import {
  getCurrentGameLanguage,
  getGameUiText,
  getLocalizedItemName,
} from "../localization/gameLocalization.js";
import { spellsDatabase } from "../spellDatabase.js";
import { playerState } from "../state/playerState.js";
import { npcConversationStatesByUid, npcsByUid } from "../state/worldState.js";
import { getNpcData } from "./npcModel.js";

export const createNpcConversationSystem = ({
  addChatMessage,
  autosaveCurrentCharacter,
  getActiveChatChannelId,
  getLocalizedSpellData,
  getNpcsInChunkRadius,
  getPlayerEntityByUid,
  grantRewardItemsToPlayer,
  isPlayerSpellLearned,
  refreshInventoryUi,
  renderActiveChatMessages,
  renderSpellWindow,
  showFloatingTextAboveTarget,
  showGameStatusMessage,
  startPlayerActionNavigation,
  playerActionType,
  updateNpcDirectionToPlayer,
}) => {
  const isPlayerWithinNpcTalkRange = (player, npc) => {
    if (!player || !npc || player.z !== npc.z) {
      return false;
    }
    const distanceCol = Math.abs(player.x - npc.x) / TILE_SIZE;
    const distanceRow = Math.abs(player.y - npc.y) / TILE_SIZE;
    return distanceCol + distanceRow <= NPC_DIALOGUE_CONFIG.talkRange;
  };

  const sayGreetingToNpc = (npc, player, now = Date.now()) => {
    if (!npc || !player || !isPlayerWithinNpcTalkRange(player, npc)) {
      return false;
    }
    const greeting = getCurrentGameLanguage() === "fr" ? "Salut" : "Hi";
    const message = addChatMessage("local", "player", greeting, player);
    if (!message) {
      return false;
    }
    showFloatingTextAboveTarget(greeting, 70, player, "speech", 4000);
    if (getActiveChatChannelId() === "local") {
      renderActiveChatMessages();
    }
    startNpcConversation(npc, player, now);
    return true;
  };

  const handleNpcGreetingFromPointerTarget = (target) => {
    const npc = target?.npc;
    if (!npc) {
      return false;
    }
    if (isPlayerWithinNpcTalkRange(playerState, npc)) {
      sayGreetingToNpc(npc, playerState);
    } else if (npc.z === playerState.z) {
      startPlayerActionNavigation({
        type: playerActionType.npcGreeting,
        npcUid: npc.uid,
      });
    }
    return true;
  };

  const normalizeNpcSpeechText = (text) => {
    if (typeof text !== "string") {
      return "";
    }
    return text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();
  };

  const getNpcSpeechWords = (text) => {
    return new Set(normalizeNpcSpeechText(text).match(/[\p{L}]+/gu) ?? []);
  };

  const areNpcSpeechWordsEquivalent = (speechWord, keywordWord) => {
    return speechWord === keywordWord || speechWord === `${keywordWord}s` || keywordWord === `${speechWord}s`;
  };

  const hasNpcSpeechKeyword = (speechWords, keywords) => {
    if (!(speechWords instanceof Set) || !Array.isArray(keywords)) {
      return false;
    }
    return keywords.some((keyword) => {
      const keywordWords = getNpcSpeechWords(keyword);
      return (
        keywordWords.size > 0 &&
        [...keywordWords].every((keywordWord) =>
          [...speechWords].some((speechWord) => areNpcSpeechWordsEquivalent(speechWord, keywordWord)),
        )
      );
    });
  };

  const getNpcDialogueData = (npcData) => {
    const language = getCurrentGameLanguage();
    return npcData?.dialogue?.[language] ?? npcData?.dialogue?.en ?? null;
  };

  const formatNpcDialogueText = (text, player, replacements = {}) => {
    let formattedText = text.replaceAll("{playerName}", player.name);
    const dialogueReplacements = {
      bankBalance: getPlayerBankGoldAmount(),
      cashBalance: getPlayerGoldAmount(),
      ...replacements,
    };
    for (const [placeholder, value] of Object.entries(dialogueReplacements)) {
      formattedText = formattedText.replaceAll(`{${placeholder}}`, String(value));
    }
    return formattedText;
  };

  const getNpcReplySuggestions = (suggestions) => {
    if (!Array.isArray(suggestions)) {
      return [];
    }
    return [
      ...new Set(
        suggestions.filter((suggestion) => typeof suggestion === "string").map((suggestion) => suggestion.trim()),
      ),
    ].filter(Boolean);
  };

  const queueNpcReply = (
    npc,
    player,
    text,
    now,
    endConversation = false,
    replacements = {},
    suggestions = [],
  ) => {
    const state = npcConversationStatesByUid.get(npc?.uid);
    if (!state || !player || typeof text !== "string" || state.queuedReplies.length >= NPC_DIALOGUE_CONFIG.maxQueuedReplies) {
      return false;
    }
    state.queuedReplies.push({
      playerUid: player.uid,
      text: formatNpcDialogueText(text, player, replacements),
      endConversation,
      suggestions: getNpcReplySuggestions(suggestions),
    });
    if (state.nextReplyAt === 0) {
      state.nextReplyAt = now + NPC_DIALOGUE_CONFIG.responseDelayMs;
    }
    return true;
  };

  const showNpcSpeech = (npc, text, suggestions = []) => {
    if (npc.z === playerState.z) {
      showFloatingTextAboveTarget(text, 70, npc, "speech", 4000);
    }
    addChatMessage("local", "npc", text, npc, suggestions);
    if (getActiveChatChannelId() === "local") {
      renderActiveChatMessages();
    }
  };

  const promoteNextNpcConversation = (npc, state, now) => {
    while (state.waitingPlayerUids.length > 0) {
      const playerUid = state.waitingPlayerUids.shift();
      const player = getPlayerEntityByUid(playerUid);
      if (!isPlayerWithinNpcTalkRange(player, npc)) {
        continue;
      }
      state.activePlayerUid = playerUid;
      state.activeMenu = null;
      state.activeShopCategory = null;
      state.lastInteractionAt = now;
      const npcData = getNpcData(npc.npcId);
      const dialogue = getNpcDialogueData(npcData);
      queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
      return true;
    }
    return false;
  };

  const releaseNpcConversation = (npc, state, now, reason = "farewell") => {
    const player = getPlayerEntityByUid(state.activePlayerUid);
    const npcData = getNpcData(npc?.npcId);
    const dialogue = getNpcDialogueData(npcData);
    if (player && dialogue && reason === "outOfRange") {
      showNpcSpeech(npc, formatNpcDialogueText(dialogue.rudeDeparture, player));
    } else if (player && dialogue && reason === "timeout") {
      showNpcSpeech(npc, formatNpcDialogueText(dialogue.timeoutFarewell, player));
    }

    state.activePlayerUid = null;
    state.queuedReplies.length = 0;
    state.pendingAction = null;
    state.activeMenu = null;
    state.activeShopCategory = null;
    state.nextReplyAt = 0;
    state.lastInteractionAt = 0;
    promoteNextNpcConversation(npc, state, now);
  };

  const startNpcConversation = (npc, player, now) => {
    const state = npcConversationStatesByUid.get(npc.uid);
    const npcData = getNpcData(npc.npcId);
    const dialogue = getNpcDialogueData(npcData);
    if (!state || !npcData || !dialogue) {
      return false;
    }
    if (state.activePlayerUid !== null && state.activePlayerUid !== player.uid) {
      if (!state.waitingPlayerUids.includes(player.uid)) {
        state.waitingPlayerUids.push(player.uid);
      }
      const queuePosition = state.waitingPlayerUids.indexOf(player.uid) + 1;
      showGameStatusMessage(getGameUiText("npcQueue")(npcData.name, queuePosition));
      return false;
    }
    state.activePlayerUid = player.uid;
    state.activeMenu = null;
    state.activeShopCategory = null;
    state.lastInteractionAt = now;
    updateNpcDirectionToPlayer(npc);
    return queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
  };

  const findNpcTalkingToPlayer = (player) => {
    const nearbyNpcs = getNpcsInChunkRadius(player.x, player.y, player.z, 1);
    for (const npc of nearbyNpcs) {
      const state = npcConversationStatesByUid.get(npc.uid);
      if (state?.activePlayerUid === player.uid && isPlayerWithinNpcTalkRange(player, npc)) {
        return npc;
      }
    }
    return null;
  };

  const findNearestNpcInTalkRange = (player) => {
    let nearestNpc = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const nearbyNpcs = getNpcsInChunkRadius(player.x, player.y, player.z, 1);
    for (const npc of nearbyNpcs) {
      if (!isPlayerWithinNpcTalkRange(player, npc)) {
        continue;
      }
      const distance = (Math.abs(player.x - npc.x) + Math.abs(player.y - npc.y)) / TILE_SIZE;
      if (distance < nearestDistance) {
        nearestNpc = npc;
        nearestDistance = distance;
      }
    }
    return nearestNpc;
  };

  const getNpcTradeQuantity = (text) => {
    const quantityMatch = typeof text === "string" ? text.match(/\b(\d{1,3})\b/) : null;
    return quantityMatch ? clamp(Number(quantityMatch[1]), 1, MAX_ITEM_STACK_SIZE) : 1;
  };

  const findNpcShopOffer = (npcData, speechWords) => {
    const offers = npcData?.service?.offers;
    if (!offers || !(speechWords instanceof Set)) {
      return null;
    }
    for (const [itemId, offer] of Object.entries(offers)) {
      if (offer.keywords?.some((keyword) => hasNpcSpeechKeyword(speechWords, [keyword]))) {
        return { itemId, ...offer };
      }
    }
    return null;
  };

  const getLocalizedNpcShopCategoryName = (categoryData) => {
    const language = getCurrentGameLanguage();
    return categoryData?.labels?.[language] ?? categoryData?.labels?.en ?? null;
  };

  const findNpcShopCategory = (npcData, speechWords) => {
    if (!(speechWords instanceof Set)) {
      return null;
    }
    for (const [categoryId, categoryData] of Object.entries(npcData?.service?.categories ?? {})) {
      if (categoryData.keywords?.some((keyword) => hasNpcSpeechKeyword(speechWords, [keyword]))) {
        return { categoryId, ...categoryData };
      }
    }
    return null;
  };

  const getNpcMenuNavigationSuggestions = () => {
    return getCurrentGameLanguage() === "fr" ? ["Retour", "Bye"] : ["Back", "Bye"];
  };

  const getNpcShopCategorySuggestions = (npcData, tradeType) => {
    const priceKey = tradeType === "sell" ? "sellPrice" : "buyPrice";
    return Object.entries(npcData?.service?.categories ?? {})
      .filter(([categoryId]) =>
        Object.values(npcData?.service?.offers ?? {}).some(
          (offer) => offer.category === categoryId && Number.isInteger(offer[priceKey]) && offer[priceKey] > 0,
        ),
      )
      .map(([, categoryData]) => getLocalizedNpcShopCategoryName(categoryData))
      .filter(Boolean);
  };

  const getNpcShopMenuSuggestions = (npcData, tradeType, categoryId = null) => {
    if (!categoryId) {
      return [...getNpcShopCategorySuggestions(npcData, tradeType), ...getNpcMenuNavigationSuggestions()];
    }
    const priceKey = tradeType === "sell" ? "sellPrice" : "buyPrice";
    const itemSuggestions = Object.entries(npcData?.service?.offers ?? [])
      .filter(
        ([, offer]) =>
          offer.category === categoryId && Number.isInteger(offer?.[priceKey]) && offer[priceKey] > 0,
      )
      .map(([itemId]) => getLocalizedItemName(itemId));
    return [...itemSuggestions, ...getNpcMenuNavigationSuggestions()];
  };

  const getNpcSpellMenuSuggestions = (npcData) => {
    const spellSuggestions = (npcData?.service?.spellIds ?? [])
      .map((spellId) => getLocalizedSpellData(spellId)?.name)
      .filter(Boolean);
    return [...spellSuggestions, ...getNpcMenuNavigationSuggestions()];
  };

  const buyItemFromNpc = (npc, player, npcData, dialogue, offer, quantity, now) => {
    if (!Number.isInteger(offer?.buyPrice) || offer.buyPrice <= 0) {
      return queueNpcReply(npc, player, dialogue.unavailable, now);
    }
    const totalPrice = offer.buyPrice * quantity;
    if (getPlayerGoldAmount() < totalPrice) {
      return queueNpcReply(npc, player, dialogue.notEnoughGold, now);
    }

    const paymentPlan = createPlayerGoldPaymentPlan(totalPrice);
    if (!paymentPlan.success || !commitPlayerCurrencyValuePlan(paymentPlan)) {
      return queueNpcReply(npc, player, dialogue.notEnoughGold, now);
    }
    const grantResult = grantRewardItemsToPlayer([{ itemId: offer.itemId, quantity }]);
    if (!grantResult.success) {
      rollbackPlayerCurrencyValuePlan(paymentPlan);
      return queueNpcReply(npc, player, dialogue.noRoom, now);
    }

    refreshInventoryUi();
    autosaveCurrentCharacter();
    return queueNpcReply(
      npc,
      player,
      dialogue.bought,
      now,
      false,
      {
        quantity,
        itemName: getLocalizedItemName(offer.itemId, quantity),
        price: totalPrice,
      },
      getNpcShopMenuSuggestions(npcData, "buy", offer.category),
    );
  };

  const sellItemToNpc = (npc, player, npcData, dialogue, offer, quantity, now) => {
    if (!Number.isInteger(offer?.sellPrice) || offer.sellPrice <= 0) {
      return queueNpcReply(npc, player, dialogue.unavailable, now);
    }
    const itemRemovalPlan = createPlayerBackpackItemRemovalPlan(offer.itemId, quantity);
    if (!itemRemovalPlan.success || !commitPlayerBackpackItemRemovalPlan(itemRemovalPlan)) {
      return queueNpcReply(npc, player, dialogue.missingItem, now);
    }

    const totalPrice = offer.sellPrice * quantity;
    const grantResult = grantRewardItemsToPlayer([{ itemId: "goldCoin", quantity: totalPrice }]);
    if (!grantResult.success) {
      rollbackPlayerBackpackItemRemovalPlan(itemRemovalPlan);
      return queueNpcReply(npc, player, dialogue.noRoom, now);
    }

    refreshInventoryUi();
    autosaveCurrentCharacter();
    return queueNpcReply(
      npc,
      player,
      dialogue.sold,
      now,
      false,
      {
        quantity,
        itemName: getLocalizedItemName(offer.itemId, quantity),
        price: totalPrice,
      },
      getNpcShopMenuSuggestions(npcData, "sell", offer.category),
    );
  };

  const setNpcItemTradePendingAction = (npc, player, dialogue, offer, quantity, tradeType, now) => {
    const state = npcConversationStatesByUid.get(npc?.uid);
    const unitPrice = tradeType === "buyItem" ? offer?.buyPrice : offer?.sellPrice;
    if (!state || !Number.isInteger(unitPrice) || unitPrice <= 0) {
      return queueNpcReply(npc, player, dialogue.unavailable, now);
    }

    const totalPrice = unitPrice * quantity;
    state.pendingAction = {
      type: tradeType,
      itemId: offer.itemId,
      quantity,
    };
    state.activeMenu = tradeType === "sellItem" ? "sell" : "buy";
    state.activeShopCategory = offer.category ?? null;
    const confirmationText = tradeType === "buyItem" ? dialogue.confirmBuy : dialogue.confirmSell;
    return queueNpcReply(
      npc,
      player,
      confirmationText,
      now,
      false,
      {
        quantity,
        itemName: getLocalizedItemName(offer.itemId, quantity),
        price: totalPrice,
      },
      dialogue.confirmationSuggestions,
    );
  };

  const handleNpcItemShopSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
    const wantsTrade = hasNpcSpeechKeyword(speechWords, ["trade", "shop", "offer", "offers", "offres", "magasin"]);
    const wantsBuy = hasNpcSpeechKeyword(speechWords, ["buy", "purchase", "achat", "acheter", "achete"]);
    const wantsSell = hasNpcSpeechKeyword(speechWords, ["sell", "sale", "vente", "vendre", "vends"]);
    const offer = findNpcShopOffer(npcData, speechWords);
    const category = findNpcShopCategory(npcData, speechWords);
    const state = npcConversationStatesByUid.get(npc.uid);
    const requestedTradeType = wantsSell
      ? "sell"
      : wantsBuy
        ? "buy"
        : state.activeMenu === "buy" || state.activeMenu === "sell"
          ? state.activeMenu
          : null;

    if (!offer && category && requestedTradeType) {
      state.activeMenu = requestedTradeType;
      state.activeShopCategory = category.categoryId;
      const categoryMenuText = requestedTradeType === "sell" ? dialogue.sellCategoryMenu : dialogue.buyCategoryMenu;
      return queueNpcReply(
        npc,
        player,
        categoryMenuText,
        now,
        false,
        { categoryName: getLocalizedNpcShopCategoryName(category).toLocaleLowerCase() },
        getNpcShopMenuSuggestions(npcData, requestedTradeType, category.categoryId),
      );
    }
    if (wantsBuy && !offer) {
      state.activeMenu = "buy";
      state.activeShopCategory = null;
      return queueNpcReply(npc, player, dialogue.buyMenu, now, false, {}, getNpcShopMenuSuggestions(npcData, "buy"));
    }
    if (wantsSell && !offer) {
      state.activeMenu = "sell";
      state.activeShopCategory = null;
      return queueNpcReply(npc, player, dialogue.sellMenu, now, false, {}, getNpcShopMenuSuggestions(npcData, "sell"));
    }
    if (wantsTrade && !wantsBuy && !wantsSell && !offer) {
      state.activeMenu = null;
      state.activeShopCategory = null;
      return queueNpcReply(npc, player, dialogue.trade, now, false, {}, dialogue.greetingSuggestions);
    }
    if (!offer) {
      return wantsBuy || wantsSell ? queueNpcReply(npc, player, dialogue.unavailable, now) : false;
    }
    const quantity = getNpcTradeQuantity(text);
    if (wantsSell || (!wantsBuy && state.activeMenu === "sell")) {
      return setNpcItemTradePendingAction(npc, player, dialogue, offer, quantity, "sellItem", now);
    }
    return setNpcItemTradePendingAction(npc, player, dialogue, offer, quantity, "buyItem", now);
  };

  const findNpcTeacherSpell = (npcData, text) => {
    const speechWords = getNpcSpeechWords(text);
    for (const spellId of npcData?.service?.spellIds ?? []) {
      const spellData = spellsDatabase[spellId];
      const aliases = [spellData?.name, spellData?.nameFr, ...(spellData?.learningKeywords ?? [])].filter(Boolean);
      if (aliases.some((alias) => hasNpcSpeechKeyword(speechWords, [alias]))) {
        return spellData;
      }
    }
    return null;
  };

  const learnPlayerSpell = (spellId) => {
    if (!(spellId in spellsDatabase) || isPlayerSpellLearned(spellId)) {
      return false;
    }
    playerState.spellbook.learnedSpellIds.push(spellId);
    const emptyHotkeyIndex = playerState.spellbook.hotkeySpellIds.indexOf(null);
    if (emptyHotkeyIndex !== -1) {
      playerState.spellbook.hotkeySpellIds[emptyHotkeyIndex] = spellId;
    }
    autosaveCurrentCharacter();
    renderSpellWindow();
    return true;
  };

  const learnSpellFromNpc = (npc, player, npcData, dialogue, spellData, now) => {
    if (!spellData || isPlayerSpellLearned(spellData.spellId)) {
      return queueNpcReply(npc, player, dialogue.alreadyLearned, now);
    }
    if (getPlayerGoldAmount() < spellData.learnPrice) {
      return queueNpcReply(npc, player, dialogue.notEnoughGold, now, false, { price: spellData.learnPrice });
    }
    if (!spendPlayerGold(spellData.learnPrice) || !learnPlayerSpell(spellData.spellId)) {
      return queueNpcReply(npc, player, dialogue.unavailable, now);
    }

    refreshInventoryUi();
    return queueNpcReply(
      npc,
      player,
      dialogue.learned,
      now,
      false,
      {
        spellName: getLocalizedSpellData(spellData.spellId).name.toLocaleLowerCase(),
        incantation: spellData.incantation,
      },
      getNpcSpellMenuSuggestions(npcData),
    );
  };

  const handleNpcSpellTeacherSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
    const asksAboutSpells = hasNpcSpeechKeyword(speechWords, ["spell", "spells", "sort", "sorts", "magic", "magie"]);
    const spellData = findNpcTeacherSpell(npcData, text);
    if (!spellData) {
      if (!asksAboutSpells) {
        return false;
      }
      const state = npcConversationStatesByUid.get(npc.uid);
      state.activeMenu = "spells";
      return queueNpcReply(npc, player, dialogue.spells, now, false, {}, getNpcSpellMenuSuggestions(npcData));
    }
    if (isPlayerSpellLearned(spellData.spellId)) {
      return queueNpcReply(npc, player, dialogue.alreadyLearned, now);
    }

    const state = npcConversationStatesByUid.get(npc.uid);
    state.activeMenu = "spells";
    state.pendingAction = {
      type: "learnSpell",
      spellId: spellData.spellId,
    };
    return queueNpcReply(
      npc,
      player,
      dialogue.confirmLearn,
      now,
      false,
      {
        spellName: getLocalizedSpellData(spellData.spellId).name.toLocaleLowerCase(),
        price: spellData.learnPrice,
      },
      dialogue.confirmationSuggestions,
    );
  };

  const NPC_BANK_CURRENCY_ALIASES = {
    goldCoin: ["gold", "or"],
    azureCoin: ["platinum", "platine", "azure", "azur"],
    crystalCoin: ["crystal", "cristal"],
  };

  const getNpcBankAmount = (text, allAmount) => {
    const speechWords = getNpcSpeechWords(text);
    if (hasNpcSpeechKeyword(speechWords, ["all", "tout", "tous"])) {
      return allAmount;
    }
    const amountMatch = typeof text === "string" ? text.match(/\b(\d+)\b/) : null;
    const amount = amountMatch ? Number(amountMatch[1]) : null;
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  };

  const findNpcBankCurrencyItemId = (text) => {
    const speechWords = getNpcSpeechWords(text);
    for (const [itemId, aliases] of Object.entries(NPC_BANK_CURRENCY_ALIASES)) {
      if (hasNpcSpeechKeyword(speechWords, aliases)) {
        return itemId;
      }
    }
    return null;
  };

  const findNpcBankExchangeRecipe = (npcData, text) => {
    if (typeof text !== "string") {
      return null;
    }
    const normalizedText = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim();
    const exchangeParts = normalizedText.split(/\s+(?:to|into|en|vers|contre)\s+/);
    if (exchangeParts.length !== 2) {
      return null;
    }
    const sourceItemId = findNpcBankCurrencyItemId(exchangeParts[0]);
    const outputItemId = findNpcBankCurrencyItemId(exchangeParts[1]);
    return (
      npcData.service?.exchangeRecipes?.find(
        (recipe) => recipe.sourceItemId === sourceItemId && recipe.outputItemId === outputItemId,
      ) ?? null
    );
  };

  const setNpcBankAmountPendingAction = (npc, player, dialogue, type, amount, now) => {
    const state = npcConversationStatesByUid.get(npc?.uid);
    if (!state || !Number.isSafeInteger(amount) || amount <= 0) {
      return queueNpcReply(npc, player, dialogue.invalidAmount, now, false, {}, dialogue.greetingSuggestions);
    }
    state.pendingAction = { type, amount };
    state.activeMenu = type === "bankDeposit" ? "bankDeposit" : "bankWithdraw";
    const confirmationText = type === "bankDeposit" ? dialogue.confirmDeposit : dialogue.confirmWithdraw;
    return queueNpcReply(
      npc,
      player,
      confirmationText,
      now,
      false,
      { amount },
      dialogue.confirmationSuggestions,
    );
  };

  const setNpcBankExchangePendingAction = (npc, player, dialogue, recipe, now) => {
    const state = npcConversationStatesByUid.get(npc?.uid);
    if (!state || !recipe) {
      return queueNpcReply(npc, player, dialogue.unavailable, now);
    }
    state.pendingAction = { type: "bankExchange", ...recipe };
    state.activeMenu = "bankExchange";
    return queueNpcReply(
      npc,
      player,
      dialogue.confirmExchange,
      now,
      false,
      {
        sourceQuantity: recipe.sourceQuantity,
        sourceName: getLocalizedItemName(recipe.sourceItemId, recipe.sourceQuantity),
        outputQuantity: recipe.outputQuantity,
        outputName: getLocalizedItemName(recipe.outputItemId, recipe.outputQuantity),
      },
      dialogue.confirmationSuggestions,
    );
  };

  const depositPlayerGoldInBank = (npc, player, dialogue, amount, now) => {
    const bankBalance = getPlayerBankGoldAmount();
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > getPlayerGoldAmount() ||
      bankBalance > Number.MAX_SAFE_INTEGER - amount
    ) {
      return queueNpcReply(npc, player, dialogue.notEnoughCash, now, false, {}, dialogue.greetingSuggestions);
    }
    const currencyPlan = createPlayerCurrencyValuePlan(getPlayerGoldAmount() - amount);
    if (!currencyPlan.success || !commitPlayerCurrencyValuePlan(currencyPlan)) {
      return queueNpcReply(npc, player, dialogue.unavailable, now, false, {}, dialogue.greetingSuggestions);
    }
    playerState.bank.goldBalance += amount;
    refreshInventoryUi();
    autosaveCurrentCharacter();
    return queueNpcReply(
      npc,
      player,
      dialogue.deposited,
      now,
      false,
      { amount, bankBalance: getPlayerBankGoldAmount() },
      dialogue.greetingSuggestions,
    );
  };

  const withdrawPlayerGoldFromBank = (npc, player, dialogue, amount, now) => {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > getPlayerBankGoldAmount()) {
      return queueNpcReply(npc, player, dialogue.notEnoughBankGold, now, false, {}, dialogue.greetingSuggestions);
    }
    const currencyPlan = createPlayerCurrencyValuePlan(getPlayerGoldAmount() + amount);
    if (!currencyPlan.success) {
      return queueNpcReply(npc, player, dialogue.noRoom, now, false, {}, dialogue.greetingSuggestions);
    }
    const weightDifference = getPlayerCurrencyValuePlanWeightDifference(currencyPlan);
    if (!Number.isFinite(weightDifference) || weightDifference > getPlayerRemainingCapacity()) {
      return queueNpcReply(npc, player, dialogue.notEnoughCapacity, now, false, {}, dialogue.greetingSuggestions);
    }
    if (!commitPlayerCurrencyValuePlan(currencyPlan)) {
      return queueNpcReply(npc, player, dialogue.unavailable, now, false, {}, dialogue.greetingSuggestions);
    }
    playerState.bank.goldBalance -= amount;
    refreshInventoryUi();
    autosaveCurrentCharacter();
    return queueNpcReply(
      npc,
      player,
      dialogue.withdrawn,
      now,
      false,
      { amount, bankBalance: getPlayerBankGoldAmount() },
      dialogue.greetingSuggestions,
    );
  };

  const exchangePlayerCurrencyAtBank = (npc, player, dialogue, recipe, now) => {
    const removalPlan = createPlayerBackpackItemRemovalPlan(recipe?.sourceItemId, recipe?.sourceQuantity);
    if (!removalPlan.success || !commitPlayerBackpackItemRemovalPlan(removalPlan)) {
      return queueNpcReply(npc, player, dialogue.missingCoins, now, false, {}, dialogue.exchangeSuggestions);
    }
    const grantResult = grantRewardItemsToPlayer([
      { itemId: recipe.outputItemId, quantity: recipe.outputQuantity },
    ]);
    if (!grantResult.success) {
      rollbackPlayerBackpackItemRemovalPlan(removalPlan);
      refreshInventoryUi();
      const failureText =
        grantResult.reason === INVENTORY_ACTION_REASON.capacityExceeded
          ? dialogue.notEnoughCapacity
          : dialogue.noRoom;
      return queueNpcReply(npc, player, failureText, now, false, {}, dialogue.exchangeSuggestions);
    }
    refreshInventoryUi();
    autosaveCurrentCharacter();
    return queueNpcReply(
      npc,
      player,
      dialogue.exchanged,
      now,
      false,
      {
        outputQuantity: recipe.outputQuantity,
        outputName: getLocalizedItemName(recipe.outputItemId, recipe.outputQuantity),
      },
      dialogue.exchangeSuggestions,
    );
  };

  const handleNpcBankerSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
    const state = npcConversationStatesByUid.get(npc.uid);
    const wantsBalance = hasNpcSpeechKeyword(speechWords, ["balance", "solde"]);
    const wantsDeposit = hasNpcSpeechKeyword(speechWords, ["deposit", "depot", "deposer", "depose"]);
    const wantsWithdraw = hasNpcSpeechKeyword(speechWords, ["withdraw", "withdrawal", "retrait", "retirer", "retire"]);
    const wantsExchange = hasNpcSpeechKeyword(speechWords, ["exchange", "change", "echange", "echanger"]);

    if (wantsBalance) {
      state.activeMenu = null;
      return queueNpcReply(npc, player, dialogue.balance, now, false, {}, dialogue.greetingSuggestions);
    }
    if (wantsDeposit || state.activeMenu === "bankDeposit") {
      const amount = getNpcBankAmount(text, getPlayerGoldAmount());
      if (amount === null) {
        state.activeMenu = "bankDeposit";
        return queueNpcReply(npc, player, dialogue.depositPrompt, now, false, {}, dialogue.depositSuggestions);
      }
      return setNpcBankAmountPendingAction(npc, player, dialogue, "bankDeposit", amount, now);
    }
    if (wantsWithdraw || state.activeMenu === "bankWithdraw") {
      const amount = getNpcBankAmount(text, getPlayerBankGoldAmount());
      if (amount === null) {
        state.activeMenu = "bankWithdraw";
        return queueNpcReply(npc, player, dialogue.withdrawPrompt, now, false, {}, dialogue.withdrawSuggestions);
      }
      return setNpcBankAmountPendingAction(npc, player, dialogue, "bankWithdraw", amount, now);
    }

    const exchangeRecipe = findNpcBankExchangeRecipe(npcData, text);
    if (exchangeRecipe) {
      return setNpcBankExchangePendingAction(npc, player, dialogue, exchangeRecipe, now);
    }
    if (wantsExchange || state.activeMenu === "bankExchange") {
      state.activeMenu = "bankExchange";
      return queueNpcReply(npc, player, dialogue.exchangePrompt, now, false, {}, dialogue.exchangeSuggestions);
    }
    return false;
  };

  const isNpcConfirmationSpeech = (speechWords) => {
    return (
      hasNpcSpeechKeyword(speechWords, [
        "yes",
        "yeah",
        "yep",
        "yup",
        "sure",
        "okay",
        "ok",
        "oui",
        "ouais",
        "parfait",
        "absolument",
        "certainement",
        "daccord",
        "certain",
      ]) ||
      (speechWords.has("bien") && speechWords.has("sur")) ||
      (speechWords.has("bien") && speechWords.has("entendu")) ||
      (speechWords.has("d") && speechWords.has("accord")) ||
      (speechWords.has("of") && speechWords.has("course"))
    );
  };

  const isNpcRejectionSpeech = (speechWords) => {
    return hasNpcSpeechKeyword(speechWords, ["no", "nope", "nah", "cancel", "non", "annule", "annuler"]);
  };

  const executeNpcPendingAction = (npc, player, npcData, dialogue, state, now) => {
    const pendingAction = state.pendingAction;
    state.pendingAction = null;
    if (!pendingAction) {
      return false;
    }

    if (pendingAction.type === "buyItem" || pendingAction.type === "sellItem") {
      const offerData = npcData.service?.offers?.[pendingAction.itemId];
      const offer = offerData ? { itemId: pendingAction.itemId, ...offerData } : null;
      if (!offer) {
        return queueNpcReply(npc, player, dialogue.unavailable, now);
      }
      if (pendingAction.type === "buyItem") {
        return buyItemFromNpc(npc, player, npcData, dialogue, offer, pendingAction.quantity, now);
      }
      return sellItemToNpc(npc, player, npcData, dialogue, offer, pendingAction.quantity, now);
    }

    if (pendingAction.type === "learnSpell") {
      const spellData = spellsDatabase[pendingAction.spellId];
      return learnSpellFromNpc(npc, player, npcData, dialogue, spellData, now);
    }
    if (pendingAction.type === "bankDeposit") {
      return depositPlayerGoldInBank(npc, player, dialogue, pendingAction.amount, now);
    }
    if (pendingAction.type === "bankWithdraw") {
      return withdrawPlayerGoldFromBank(npc, player, dialogue, pendingAction.amount, now);
    }
    if (pendingAction.type === "bankExchange") {
      return exchangePlayerCurrencyAtBank(npc, player, dialogue, pendingAction, now);
    }
    return false;
  };

  const handleNpcPendingActionSpeech = (npc, player, npcData, dialogue, state, speechWords, now) => {
    if (!state.pendingAction) {
      return false;
    }
    if (isNpcConfirmationSpeech(speechWords)) {
      return executeNpcPendingAction(npc, player, npcData, dialogue, state, now);
    }
    if (isNpcRejectionSpeech(speechWords)) {
      const pendingAction = state.pendingAction;
      state.pendingAction = null;
      if (pendingAction.type === "buyItem" || pendingAction.type === "sellItem") {
        const tradeType = pendingAction.type === "sellItem" ? "sell" : "buy";
        const categoryId = npcData.service?.offers?.[pendingAction.itemId]?.category ?? null;
        state.activeMenu = tradeType;
        state.activeShopCategory = categoryId;
        return queueNpcReply(
          npc,
          player,
          dialogue.cancelled,
          now,
          false,
          {},
          getNpcShopMenuSuggestions(npcData, tradeType, categoryId),
        );
      }
      if (pendingAction.type === "learnSpell") {
        state.activeMenu = "spells";
        return queueNpcReply(npc, player, dialogue.cancelled, now, false, {}, getNpcSpellMenuSuggestions(npcData));
      }
      if (pendingAction.type.startsWith("bank")) {
        state.activeMenu = null;
        return queueNpcReply(npc, player, dialogue.cancelled, now, false, {}, dialogue.greetingSuggestions);
      }
      return queueNpcReply(npc, player, dialogue.cancelled, now, false, {}, dialogue.greetingSuggestions);
    }
    return queueNpcReply(npc, player, dialogue.confirmRequired, now, false, {}, dialogue.confirmationSuggestions);
  };

  const handleNpcServiceSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
    if (npcData.service?.type === "itemShop") {
      return handleNpcItemShopSpeech(npc, player, npcData, dialogue, text, speechWords, now);
    }
    if (npcData.service?.type === "spellTeacher") {
      return handleNpcSpellTeacherSpeech(npc, player, npcData, dialogue, text, speechWords, now);
    }
    if (npcData.service?.type === "banker") {
      return handleNpcBankerSpeech(npc, player, npcData, dialogue, text, speechWords, now);
    }
    return false;
  };

  const handleNpcPlayerSpeech = (text, player, now) => {
    const speechWords = getNpcSpeechWords(text);
    const isGreeting = hasNpcSpeechKeyword(speechWords, ["hi", "hello", "hey", "salut", "bonjour", "allo"]);
    let npc = findNpcTalkingToPlayer(player);

    if (!npc && isGreeting) {
      npc = findNearestNpcInTalkRange(player);
      if (npc) {
        return startNpcConversation(npc, player, now);
      }
    }
    if (!npc) {
      return false;
    }

    const state = npcConversationStatesByUid.get(npc.uid);
    const npcData = getNpcData(npc.npcId);
    const dialogue = getNpcDialogueData(npcData);
    if (!state || !npcData || !dialogue) {
      return false;
    }
    state.lastInteractionAt = now;
    updateNpcDirectionToPlayer(npc);

    if (isGreeting) {
      state.activeMenu = null;
      state.activeShopCategory = null;
      return queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
    }
    if (hasNpcSpeechKeyword(speechWords, ["bye", "farewell", "ciao", "revoir"])) {
      return queueNpcReply(npc, player, dialogue.farewell, now, true);
    }
    if (state.pendingAction) {
      return handleNpcPendingActionSpeech(npc, player, npcData, dialogue, state, speechWords, now);
    }
    if (hasNpcSpeechKeyword(speechWords, ["back", "retour"])) {
      if (
        npcData.service?.type === "itemShop" &&
        (state.activeMenu === "buy" || state.activeMenu === "sell") &&
        state.activeShopCategory
      ) {
        const tradeType = state.activeMenu;
        state.activeShopCategory = null;
        const menuText = tradeType === "sell" ? dialogue.sellMenu : dialogue.buyMenu;
        return queueNpcReply(npc, player, menuText, now, false, {}, getNpcShopMenuSuggestions(npcData, tradeType));
      }
      state.activeMenu = null;
      state.activeShopCategory = null;
      return queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
    }
    if (hasNpcSpeechKeyword(speechWords, ["name", "nom"])) {
      return queueNpcReply(npc, player, dialogue.name, now);
    }
    if (hasNpcSpeechKeyword(speechWords, ["job", "work", "travail", "metier"])) {
      return queueNpcReply(npc, player, dialogue.job, now);
    }
    if (hasNpcSpeechKeyword(speechWords, ["help", "aide"])) {
      return queueNpcReply(npc, player, dialogue.help, now, false, {}, dialogue.greetingSuggestions);
    }
    if (handleNpcServiceSpeech(npc, player, npcData, dialogue, text, speechWords, now)) {
      return true;
    }
    return queueNpcReply(npc, player, dialogue.unknown, now, false, {}, dialogue.greetingSuggestions);
  };

  const updateNpcConversations = (now) => {
    for (const [npcUid, state] of npcConversationStatesByUid.entries()) {
      if (state.activePlayerUid === null) {
        continue;
      }
      const npc = npcsByUid.get(npcUid);
      const player = getPlayerEntityByUid(state.activePlayerUid);
      if (!npc) {
        state.activePlayerUid = null;
        state.queuedReplies.length = 0;
        state.pendingAction = null;
        state.nextReplyAt = 0;
        state.lastInteractionAt = 0;
        continue;
      }
      if (!isPlayerWithinNpcTalkRange(player, npc)) {
        const farewellReply = state.queuedReplies.find((reply) => reply.endConversation);
        if (farewellReply) {
          showNpcSpeech(npc, farewellReply.text, farewellReply.suggestions);
          releaseNpcConversation(npc, state, now, "farewell");
        } else {
          releaseNpcConversation(npc, state, now, "outOfRange");
        }
        continue;
      }
      if (
        state.queuedReplies.length === 0 &&
        now - state.lastInteractionAt >= NPC_DIALOGUE_CONFIG.conversationTimeoutMs
      ) {
        releaseNpcConversation(npc, state, now, "timeout");
        continue;
      }
      if (state.queuedReplies.length === 0 || now < state.nextReplyAt) {
        continue;
      }

      const reply = state.queuedReplies.shift();
      showNpcSpeech(npc, reply.text, reply.suggestions);
      state.nextReplyAt = state.queuedReplies.length > 0 ? now + NPC_DIALOGUE_CONFIG.lineIntervalMs : 0;
      if (reply.endConversation) {
        releaseNpcConversation(npc, state, now, "farewell");
      }
    }
  };


  return {
    getReplySuggestions: getNpcReplySuggestions,
    handleGreetingFromPointerTarget: handleNpcGreetingFromPointerTarget,
    handlePlayerSpeech: handleNpcPlayerSpeech,
    isPlayerWithinTalkRange: isPlayerWithinNpcTalkRange,
    sayGreeting: sayGreetingToNpc,
    updateConversations: updateNpcConversations,
  };
};
