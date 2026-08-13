import { createHmac, timingSafeEqual } from "node:crypto";

const encodeBase64Url = (value) => Buffer.from(value).toString("base64url");
const sign = (encodedPayload, secret) => createHmac("sha256", secret).update(encodedPayload).digest("base64url");

export const createHmacAuthService = ({ secret, now = () => Date.now() }) => {
  if (typeof secret !== "string" || secret.length < 16 || typeof now !== "function") {
    throw new TypeError("Authentication requires a secret of at least 16 characters.");
  }

  const issueToken = ({ accountId, expiresAt }) => {
    if (
      typeof accountId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,40}$/.test(accountId) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now()
    ) {
      return null;
    }
    const encodedPayload = encodeBase64Url(JSON.stringify({ accountId, expiresAt }));
    return `${encodedPayload}.${sign(encodedPayload, secret)}`;
  };

  const verifyToken = (token) => {
    if (typeof token !== "string") {
      return null;
    }
    const [encodedPayload, providedSignature, extraPart] = token.split(".");
    if (!encodedPayload || !providedSignature || extraPart !== undefined) {
      return null;
    }
    const expectedSignature = sign(encodedPayload, secret);
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null;
    }
    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
      if (
        !/^[a-zA-Z0-9_-]{1,40}$/.test(payload.accountId) ||
        !Number.isSafeInteger(payload.expiresAt) ||
        payload.expiresAt <= now()
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  };

  return Object.freeze({ issueToken, verifyToken });
};
