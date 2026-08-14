import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const SCRYPT_KEY_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const deriveKey = promisify(scrypt);

const isValidPassword = (password) =>
  typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;

export const createPasswordService = () => {
  const hashPassword = async (password) => {
    if (!isValidPassword(password)) {
      return null;
    }
    const salt = randomBytes(16);
    const hash = await deriveKey(password, salt, SCRYPT_KEY_LENGTH);
    return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
  };

  const verifyPassword = async (password, storedHash) => {
    if (!isValidPassword(password) || typeof storedHash !== "string") {
      return false;
    }
    const [algorithm, encodedSalt, encodedHash, extraPart] = storedHash.split(":");
    if (algorithm !== "scrypt" || !encodedSalt || !encodedHash || extraPart !== undefined) {
      return false;
    }
    try {
      const salt = Buffer.from(encodedSalt, "base64url");
      const expectedHash = Buffer.from(encodedHash, "base64url");
      const actualHash = await deriveKey(password, salt, expectedHash.length);
      return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
    } catch {
      return false;
    }
  };

  return Object.freeze({ hashPassword, verifyPassword });
};
