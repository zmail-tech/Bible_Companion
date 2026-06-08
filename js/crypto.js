// Crypto utilities using the browser Web Crypto API
// Two independent PBKDF2 derivations: "auth" for password verification, "encrypt" for API key encryption

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 256;
const AUTH_HASH_BYTES = 16;
const SESSION_USER_KEY = "bibleCompanion_user";
const SESSION_SETTINGS_KEY = "bibleCompanion_settings";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKeyFromPassword(password, salt, purpose) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedSalt = enc.encode(purpose + ":" + arrayBufferToBase64(salt));

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: derivedSalt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_BYTES },
    false,
    ["encrypt", "decrypt"]
  );
}

async function deriveBitsFromPassword(password, salt, purpose) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedSalt = enc.encode(purpose + ":" + arrayBufferToBase64(salt));

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: derivedSalt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    KEY_BYTES
  );
}

export async function derivePasswordHash(password, saltBuf) {
  const bits = await deriveBitsFromPassword(password, saltBuf, "auth");
  const hashBytes = new Uint8Array(bits).slice(0, AUTH_HASH_BYTES);
  return arrayBufferToBase64(hashBytes.buffer);
}

export async function hashPasswordForAuth(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePasswordHash(password, salt);
  return {
    hash,
    salt: arrayBufferToBase64(salt)
  };
}

export async function verifyPassword(password, storedHash, saltB64) {
  const salt = base64ToArrayBuffer(saltB64);
  const hash = await derivePasswordHash(password, new Uint8Array(salt));
  const storedBytes = new Uint8Array(base64ToArrayBuffer(storedHash));
  const hashBytes = new Uint8Array(base64ToArrayBuffer(hash));
  if (storedBytes.length !== hashBytes.length) return false;
  let result = 0;
  for (let i = 0; i < storedBytes.length; i++) {
    result |= storedBytes[i] ^ hashBytes[i];
  }
  return result === 0;
}

export async function encryptApiKey(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKeyFromPassword(password, salt, "encrypt");

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  return JSON.stringify({
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  });
}

export async function decryptApiKey(encryptedJson, password) {
  const payload = JSON.parse(encryptedJson);
  const salt = base64ToArrayBuffer(payload.salt);
  const iv = base64ToArrayBuffer(payload.iv);
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const key = await deriveKeyFromPassword(password, new Uint8Array(salt), "encrypt");

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

export function saveSession(user, settings) {
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSession() {
  const user = sessionStorage.getItem(SESSION_USER_KEY);
  const settings = sessionStorage.getItem(SESSION_SETTINGS_KEY);
  if (!user || !settings) return null;
  try {
    return {
      user: JSON.parse(user),
      settings: JSON.parse(settings)
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_SETTINGS_KEY);
}

export function isEncrypted(encryptedJson) {
  try {
    const payload = JSON.parse(encryptedJson);
    return !!(payload.salt && payload.iv && payload.ciphertext);
  } catch {
    return false;
  }
}
