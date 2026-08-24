const UPDATE_CHECK_INTERVAL_MS = 60_000;
const UPDATE_RELOAD_SESSION_KEY = "nonameyet-update-reload-build";

const getCurrentBuildId = () =>
  typeof __APP_BUILD_ID__ === "string" && __APP_BUILD_ID__ !== "" ? __APP_BUILD_ID__ : "development";

const getVersionUrl = () => {
  const baseUrl = import.meta.env?.BASE_URL || "/";
  return new URL(`${baseUrl}version.json`, window.location.origin);
};

const clearApplicationCaches = async () => {
  if (!("caches" in window)) {
    return;
  }
  const cacheNames = await window.caches.keys();
  await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
};

export const createClientUpdateController = ({
  fetchVersion = (url) => fetch(url, { cache: "no-store", headers: { "cache-control": "no-cache" } }),
  reload = (buildId) => {
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set("build", buildId);
    window.location.replace(targetUrl.href);
  },
} = {}) => {
  let checkPromise = null;
  let intervalId = null;

  const checkForUpdate = async () => {
    if (checkPromise || document.visibilityState === "hidden" || navigator.onLine === false) {
      return checkPromise;
    }
    checkPromise = (async () => {
      const versionUrl = getVersionUrl();
      versionUrl.searchParams.set("time", Date.now().toString());
      const response = await fetchVersion(versionUrl.href);
      if (!response.ok) {
        return false;
      }
      const latestVersion = await response.json();
      const latestBuildId = latestVersion?.buildId;
      if (typeof latestBuildId !== "string" || latestBuildId === "" || latestBuildId === getCurrentBuildId()) {
        sessionStorage.removeItem(UPDATE_RELOAD_SESSION_KEY);
        return false;
      }
      if (sessionStorage.getItem(UPDATE_RELOAD_SESSION_KEY) === latestBuildId) {
        return false;
      }
      sessionStorage.setItem(UPDATE_RELOAD_SESSION_KEY, latestBuildId);
      await clearApplicationCaches();
      reload(latestBuildId);
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        checkPromise = null;
      });
    return checkPromise;
  };

  const handlePageFocus = () => {
    checkForUpdate();
  };

  return Object.freeze({
    start() {
      if (intervalId !== null) {
        return false;
      }
      window.addEventListener("focus", handlePageFocus);
      document.addEventListener("visibilitychange", handlePageFocus);
      intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      window.setTimeout(checkForUpdate, 5_000);
      return true;
    },
    stop() {
      if (intervalId === null) {
        return false;
      }
      window.clearInterval(intervalId);
      intervalId = null;
      window.removeEventListener("focus", handlePageFocus);
      document.removeEventListener("visibilitychange", handlePageFocus);
      return true;
    },
    checkForUpdate,
  });
};

export const startClientUpdateMonitor = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  const controller = createClientUpdateController();
  controller.start();
  return controller;
};
