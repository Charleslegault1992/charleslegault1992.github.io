const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let googleIdentityScriptPromise = null;

const loadGoogleIdentityScript = () => {
  if (globalThis.google?.accounts?.id) {
    return Promise.resolve(globalThis.google.accounts.id);
  }
  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }
  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (globalThis.google?.accounts?.id) {
        resolve(globalThis.google.accounts.id);
      } else {
        reject(new Error("Google Identity Services did not initialize."));
      }
    };
    script.onerror = () => reject(new Error("Google Identity Services could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => {
    googleIdentityScriptPromise = null;
    throw error;
  });
  return googleIdentityScriptPromise;
};

export const renderGoogleIdentityButton = async ({ clientId, buttonElement, locale, onCredential } = {}) => {
  if (
    typeof clientId !== "string" ||
    clientId === "" ||
    !(buttonElement instanceof HTMLElement) ||
    typeof onCredential !== "function"
  ) {
    return false;
  }
  const googleIdentity = await loadGoogleIdentityScript();
  googleIdentity.initialize({
    client_id: clientId,
    use_fedcm_for_button: true,
    button_auto_select: true,
    callback: (response) => {
      if (typeof response?.credential === "string" && response.credential !== "") {
        onCredential(response.credential);
      }
    },
  });
  googleIdentity.renderButton(buttonElement, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: "continue_with",
    logo_alignment: "left",
    locale: locale === "fr" ? "fr" : "en",
    width: Math.min(360, Math.max(240, buttonElement.clientWidth || 360)),
  });
  return true;
};
