import { OAuth2Client } from "google-auth-library";

const GOOGLE_CREDENTIAL_MAX_LENGTH = 16 * 1024;

export const createGoogleIdentityService = ({ clientId, tokenVerifier = null } = {}) => {
  const normalizedClientId = typeof clientId === "string" ? clientId.trim() : "";
  const verifier = tokenVerifier ?? (normalizedClientId ? new OAuth2Client(normalizedClientId) : null);

  const verifyCredential = async (credential) => {
    if (
      !normalizedClientId ||
      !verifier ||
      typeof credential !== "string" ||
      credential.length === 0 ||
      credential.length > GOOGLE_CREDENTIAL_MAX_LENGTH
    ) {
      return null;
    }
    try {
      const ticket = await verifier.verifyIdToken({
        idToken: credential,
        audience: normalizedClientId,
      });
      const payload = ticket.getPayload();
      if (typeof payload?.sub !== "string" || payload.sub === "") {
        return null;
      }
      return {
        provider: "google",
        subject: payload.sub,
        email: typeof payload.email === "string" ? payload.email : "",
        displayName: typeof payload.name === "string" ? payload.name : "",
      };
    } catch {
      return null;
    }
  };

  return Object.freeze({
    isConfigured: () => normalizedClientId !== "" && verifier !== null,
    verifyCredential,
  });
};
