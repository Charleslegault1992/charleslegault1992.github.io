import { clamp, isEmpty } from "../core/mathUtils.js";
import { getGameUiText } from "../localization/gameLocalization.js";
import { characterSelectorUiState, gameRuntimeState } from "../state/clientRuntimeState.js";
import { playerState } from "../state/playerState.js";
import { chat, chatInput, chatTabs, game } from "../ui/domRefs.js";

const CHAT_CHANNELS = {
  local: { channelId: "local", labelKey: "localChannel", canSendMessage: true, maxMessages: 100 },
  global: { channelId: "global", labelKey: "globalChannel", canSendMessage: true, maxMessages: 100 },
  trade: { channelId: "trade", labelKey: "tradeChannel", canSendMessage: true, maxMessages: 100 },
  logs: { channelId: "logs", labelKey: "logsChannel", canSendMessage: false, maxMessages: 100 },
};

export const createChatController = ({
  getReplySuggestions,
  getSpellFromText,
  castLearnedSpell,
  showPlayerSpeech,
  handleNpcSpeech,
  sendChannelMessage = null,
  resetMovementKeys,
}) => {
  const messagesByChannelId = {
    local: [],
    global: [],
    trade: [],
    logs: [],
  };
  const historyState = {
    entries: [],
    cursorIndex: 0,
    draft: "",
    maxEntries: 50,
  };
  let activeChannelId = "local";

  const isValidChannel = (channelId) => channelId in CHAT_CHANNELS;

  const getChannel = (channelId) => {
    if (!channelId || !isValidChannel(channelId)) {
      return null;
    }
    return CHAT_CHANNELS[channelId];
  };

  const setActiveChannel = (channelId) => {
    if (!channelId || !isValidChannel(channelId)) {
      return false;
    }
    activeChannelId = channelId;
    return true;
  };

  const getMessages = (channelId) => {
    if (!channelId || !(channelId in messagesByChannelId)) {
      return [];
    }
    return messagesByChannelId[channelId];
  };

  const createMessage = (channelId, messageType, text, speakerData = null, speechSuggestions = []) => ({
    channelId,
    messageType,
    text,
    speakerName: speakerData?.name ?? null,
    speakerLevel: Number.isFinite(speakerData?.level) ? speakerData.level : null,
    speechSuggestions: getReplySuggestions(speechSuggestions),
    createdAt: Date.now(),
  });

  const addMessage = (channelId, messageType, text, speakerData = null, speechSuggestions = []) => {
    if (!channelId || !isValidChannel(channelId) || isEmpty(text)) {
      return null;
    }
    const channel = getChannel(channelId);
    const messages = getMessages(channelId);
    const message = createMessage(channelId, messageType, text, speakerData, speechSuggestions);
    messages.push(message);
    while (messages.length > channel.maxMessages) {
      messages.shift();
    }
    return message;
  };

  const formatMessageTime = (message) => {
    if (!Number.isFinite(message?.createdAt)) {
      return "XX:XX";
    }
    const date = new Date(message.createdAt);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const formatSpeakerLabel = (message) => {
    if (!message?.speakerName) {
      return "";
    }
    return Number.isFinite(message.speakerLevel)
      ? `${message.speakerName} [${message.speakerLevel}]:`
      : `${message.speakerName}:`;
  };

  const formatMessageText = (message) => {
    const text = !isEmpty(message?.text) ? message.text : "";
    return `${formatMessageTime(message)} ${formatSpeakerLabel(message)} ${text}`;
  };

  const addHistoryEntry = (text) => {
    if (typeof text !== "string" || text === "") {
      return;
    }
    if (historyState.entries.at(-1) !== text) {
      historyState.entries.push(text);
    }
    while (historyState.entries.length > historyState.maxEntries) {
      historyState.entries.shift();
    }
    historyState.cursorIndex = historyState.entries.length;
    historyState.draft = "";
  };

  const sendPlayerMessage = (text) => {
    if (!text || getChannel(activeChannelId)?.canSendMessage !== true) {
      return false;
    }
    if (activeChannelId === "local") {
      const spellData = getSpellFromText(text);
      if (spellData) {
        castLearnedSpell(spellData.spellId);
        return true;
      }
    }
    if (sendChannelMessage?.({ channelId: activeChannelId, text: text.trim() }) === true) {
      return true;
    }
    if (!addMessage(activeChannelId, "player", text, playerState)) {
      return false;
    }
    if (activeChannelId === "local") {
      showPlayerSpeech(text);
      handleNpcSpeech(text, playerState, Date.now());
    }
    render();
    return true;
  };

  const createMessageElement = (message) => {
    if (!message?.messageType) {
      return null;
    }
    const element = document.createElement("div");
    element.classList.add("chat-message", `chat-message-${message.messageType}`);
    const textElement = document.createElement("span");
    textElement.textContent = formatMessageText(message);
    element.appendChild(textElement);

    if (message.speechSuggestions.length > 0) {
      const suggestionsElement = document.createElement("span");
      suggestionsElement.classList.add("npc-dialogue-suggestions");
      const labelElement = document.createElement("span");
      labelElement.classList.add("npc-dialogue-suggestions-label");
      labelElement.textContent = getGameUiText("npcOptionsLabel");
      suggestionsElement.appendChild(labelElement);
      for (const suggestion of message.speechSuggestions) {
        const button = document.createElement("button");
        button.classList.add("npc-dialogue-option");
        button.type = "button";
        button.textContent = suggestion;
        button.setAttribute("aria-label", getGameUiText("sayNpcOption")(suggestion));
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (sendPlayerMessage(suggestion)) {
            addHistoryEntry(suggestion);
          }
        });
        suggestionsElement.appendChild(button);
      }
      element.appendChild(suggestionsElement);
    }
    return element;
  };

  const renderMessages = () => {
    chat.textContent = "";
    for (const message of getMessages(activeChannelId)) {
      const element = createMessageElement(message);
      if (element) {
        chat.appendChild(element);
      }
    }
    chat.scrollTop = chat.scrollHeight;
  };

  const renderTabs = () => {
    chatTabs.textContent = "";
    for (const channel of Object.values(CHAT_CHANNELS)) {
      const button = document.createElement("div");
      button.classList.add("chat-tab-bouton");
      button.textContent = getGameUiText(channel.labelKey);
      button.classList.toggle("chat-tab-bouton-active", channel.channelId === activeChannelId);
      button.addEventListener("click", () => {
        setActiveChannel(channel.channelId);
        render();
      });
      chatTabs.appendChild(button);
    }
  };

  const render = () => {
    renderTabs();
    renderMessages();
  };

  const navigateHistory = (direction) => {
    const history = historyState.entries;
    if (history.length === 0 || (direction !== -1 && direction !== 1)) {
      return false;
    }
    if (historyState.cursorIndex === history.length) {
      historyState.draft = chatInput.value;
    }
    historyState.cursorIndex = clamp(historyState.cursorIndex + direction, 0, history.length);
    chatInput.value = historyState.cursorIndex === history.length ? historyState.draft : history[historyState.cursorIndex];
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    return true;
  };

  const submitInput = () => {
    const text = chatInput.value;
    if (sendPlayerMessage(text)) {
      addHistoryEntry(text);
      chatInput.value = "";
    }
  };

  const focusInput = () => {
    resetMovementKeys();
    chatInput.focus();
  };

  const blurInput = () => {
    chatInput.blur();
    if (gameRuntimeState.isStarted && !characterSelectorUiState.isOpen) {
      game.focus({ preventScroll: true });
    }
  };

  const addLogMessage = (text, messageType) => {
    if (!text || !addMessage("logs", messageType, text)) {
      return false;
    }
    if (activeChannelId === "logs") {
      renderMessages();
    }
    return true;
  };

  return {
    addMessage,
    addLogMessage,
    addHistoryEntry,
    blurInput,
    focusInput,
    getActiveChannelId: () => activeChannelId,
    isInputFocused: () => document.activeElement === chatInput,
    navigateHistory,
    render,
    renderMessages,
    sendPlayerMessage,
    submitInput,
  };
};
