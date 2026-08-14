import { createGameAccountApiClient } from "./gameAccountApiClient.js";

const ACCOUNT_SESSION_STORAGE_KEY = "no-name-yet:online-account-session";

export const createGameAccountSession = ({ apiBaseUrl, storage = globalThis.sessionStorage, fetchRequest } = {}) => {
  const apiClient = createGameAccountApiClient({ baseUrl: apiBaseUrl, fetchRequest });
  let accountId = null;
  let activeCharacter = null;

  const persist = () => {
    try {
      storage?.setItem(ACCOUNT_SESSION_STORAGE_KEY, JSON.stringify({
        accountId,
        authToken: apiClient.getToken(),
        activeCharacter,
      }));
    } catch {
      // A private browser session can reject storage while the in-memory session stays usable.
    }
  };

  const clear = () => {
    accountId = null;
    activeCharacter = null;
    apiClient.clearToken();
    try {
      storage?.removeItem(ACCOUNT_SESSION_STORAGE_KEY);
    } catch {
      // The in-memory state is already cleared.
    }
  };

  const restore = () => {
    try {
      const savedSession = JSON.parse(storage?.getItem(ACCOUNT_SESSION_STORAGE_KEY) ?? "null");
      if (
        typeof savedSession?.accountId !== "string" ||
        savedSession.accountId === "" ||
        typeof savedSession?.authToken !== "string" ||
        savedSession.authToken === ""
      ) {
        return false;
      }
      accountId = savedSession.accountId;
      activeCharacter = savedSession.activeCharacter ?? null;
      apiClient.setToken(savedSession.authToken);
      return true;
    } catch {
      clear();
      return false;
    }
  };

  const authenticate = async (method, nextAccountId, password) => {
    const result = await apiClient[method](nextAccountId, password);
    if (!result.success) {
      return result;
    }
    accountId = result.accountId;
    activeCharacter = null;
    persist();
    return result;
  };

  const authenticateWithGoogle = async (credential) => {
    const result = await apiClient.loginWithGoogle(credential);
    if (!result.success) {
      return result;
    }
    accountId = result.accountId;
    activeCharacter = null;
    persist();
    return result;
  };

  restore();

  return Object.freeze({
    login: (nextAccountId, password) => authenticate("login", nextAccountId, password),
    register: (nextAccountId, password) => authenticate("register", nextAccountId, password),
    loginWithGoogle: authenticateWithGoogle,
    refreshToken: async () => {
      const result = await apiClient.refreshToken();
      if (result.success) {
        persist();
      } else if (result.statusCode === 401) {
        clear();
      }
      return result;
    },
    listCharacters: async () => {
      const result = await apiClient.listCharacters();
      if (result.statusCode === 401) {
        clear();
      }
      return result;
    },
    createCharacter: (character) => apiClient.createCharacter(character),
    deleteCharacter: (characterId) => apiClient.deleteCharacter(characterId),
    selectCharacter: (character) => {
      if (!character || typeof character.characterId !== "string") {
        return false;
      }
      activeCharacter = structuredClone(character);
      persist();
      return true;
    },
    clear,
    isAuthenticated: () => typeof apiClient.getToken() === "string" && apiClient.getToken() !== "",
    getAccountId: () => accountId,
    getAuthToken: () => apiClient.getToken(),
    getActiveCharacter: () => structuredClone(activeCharacter),
  });
};
