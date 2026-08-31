export const ACCOUNT_ID_PATTERN = /^[a-z0-9_-]{3,40}$/;
export const ACCOUNT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EXTERNAL_PROVIDER_PATTERN = /^[a-z0-9_-]{1,30}$/;

export const EXTERNAL_PASSWORD_HASH = "external-login-only";

export const normalizeAccountId = (accountId) => {
  return String(accountId ?? "").trim().toLocaleLowerCase();
};

export const normalizeAccountEmail = (email) => {
  return String(email ?? "").trim().toLocaleLowerCase();
};