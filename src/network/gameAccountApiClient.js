export const createGameAccountApiClient = ({ baseUrl, fetchRequest = globalThis.fetch } = {}) => {
  if (typeof baseUrl !== "string" || baseUrl === "" || typeof fetchRequest !== "function") {
    throw new TypeError("The account API client requires a base URL and fetch implementation.");
  }
  let authToken = null;

  const request = async (path, { method = "GET", body = null, authenticated = false } = {}) => {
    const headers = { accept: "application/json" };
    if (body !== null) {
      headers["content-type"] = "application/json";
    }
    if (authenticated) {
      if (!authToken) {
        return { success: false, reason: "authentication-required" };
      }
      headers.authorization = `Bearer ${authToken}`;
    }
    const response = await fetchRequest(new URL(path, baseUrl), {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({ success: false, reason: "invalid-server-response" }));
    return { ...payload, statusCode: response.status };
  };

  const authenticate = async (path, accountId, password) => {
    const result = await request(path, { method: "POST", body: { accountId, password } });
    if (result.success && typeof result.token === "string") {
      authToken = result.token;
    }
    return result;
  };

  const authenticateWithGoogle = async (credential) => {
    const result = await request("/auth/google", { method: "POST", body: { credential } });
    if (result.success && typeof result.token === "string") {
      authToken = result.token;
    }
    return result;
  };

  return Object.freeze({
    register: (accountId, password) => authenticate("/auth/register", accountId, password),
    login: (accountId, password) => authenticate("/auth/login", accountId, password),
    loginWithGoogle: authenticateWithGoogle,
    refreshToken: async () => {
      const result = await request("/auth/refresh", { method: "POST", authenticated: true });
      if (result.success && typeof result.token === "string") {
        authToken = result.token;
      }
      return result;
    },
    listCharacters: () => request("/characters", { authenticated: true }),
    createCharacter: (character) => request("/characters", { method: "POST", body: character, authenticated: true }),
    deleteCharacter: (characterId) => request(`/characters/${encodeURIComponent(characterId)}`, {
      method: "DELETE",
      authenticated: true,
    }),
    clearToken: () => {
      authToken = null;
    },
    setToken: (token) => {
      authToken = typeof token === "string" && token !== "" ? token : null;
      return authToken !== null;
    },
    getToken: () => authToken,
  });
};
