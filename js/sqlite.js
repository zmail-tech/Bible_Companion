// SQLite database layer using sql.js with IndexedDB persistence

import { hashPasswordForAuth, verifyPassword, encryptApiKey, decryptApiKey, isEncrypted } from "./crypto.js";

const DB_NAME = "bible_companion";
const INDEXEDDB_NAME = "bibleCompanionDb";
const INDEXEDDB_STORE = "database";
const INDEXEDDB_KEY = "sqlitedb";

let SQL = null;
let db = null;
let indexedDBConn = null;

async function loadSqlJs() {
  if (SQL) return SQL;
  await import("../vendor/sql-wasm.js");
  const InitSqlJs = globalThis.initSqlJs;
  if (!InitSqlJs) {
    throw new Error(
      "initSqlJs not found on globalThis after loading sql-wasm.js. " +
      "Ensure the vendor file exposes it on globalThis."
    );
  }
  SQL = await InitSqlJs({
    locateFile: (file) => {
      return "vendor/" + file;
    }
  });
  return SQL;
}

async function ensureIndexedDB() {
  if (indexedDBConn) return;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(INDEXEDDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(INDEXEDDB_STORE)) {
        database.createObjectStore(INDEXEDDB_STORE);
      }
    };
    req.onsuccess = () => {
      indexedDBConn = req.result;
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function initDB() {
  if (db) return db;
  await ensureIndexedDB();
  const sqlLib = await loadSqlJs();
  const saved = await loadDbFromIndexedDB();
  if (saved) {
    db = new sqlLib.Database(saved);
  } else {
    db = new sqlLib.Database();
  }
  runMigrations();
  return db;
}

function runMigrations() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    endpoint TEXT NOT NULL DEFAULT 'https://api.openai.com/v1/chat/completions',
    api_key TEXT,
    model TEXT NOT NULL DEFAULT 'gpt-4o',
    encrypted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id)`);
}

export async function saveDbToIndexedDB() {
  if (!db || !indexedDBConn) return;
  const data = db.export();
  const uint8 = new Uint8Array(data);
  return new Promise((resolve, reject) => {
    const txn = indexedDBConn.transaction([INDEXEDDB_STORE], "readwrite");
    const store = txn.objectStore(INDEXEDDB_STORE);
    store.put(uint8, INDEXEDDB_KEY);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

export async function loadDbFromIndexedDB() {
  if (!indexedDBConn) return null;
  return new Promise((resolve, reject) => {
    const txn = indexedDBConn.transaction([INDEXEDDB_STORE], "readonly");
    const store = txn.objectStore(INDEXEDDB_STORE);
    const req = store.get(INDEXEDDB_KEY);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => resolve(null);
  });
}

export async function createUser(username, password) {
  const stmt = db.prepare(`SELECT id FROM users WHERE username = ?`);
  stmt.bind([username]);
  let exists = false;
  while (stmt.step()) {
    exists = true;
    break;
  }
  stmt.free();

  if (exists) {
    return { success: false, error: "Username already taken." };
  }

  const { hash, salt } = await hashPasswordForAuth(password);
  db.run(`INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)`, [username, hash, salt]);
  const res = db.exec(`SELECT last_insert_rowid() as id`);
  const userId = res[0].values[0][0];
  await saveDbToIndexedDB();
  return { success: true, userId };
}

export async function authenticateUser(username, password) {
  const stmt = db.prepare(`SELECT id, password_hash, salt FROM users WHERE username = ?`);
  stmt.bind([username]);
  let row = null;
  if (stmt.step()) {
    row = stmt.get();
  }
  stmt.free();

  if (!row) {
    return { success: false, error: "Invalid username or password." };
  }

  const [userId, storedHash, salt] = row;
  const valid = await verifyPassword(password, storedHash, salt);
  if (!valid) {
    return { success: false, error: "Invalid username or password." };
  }

  return { success: true, userId, username };
}

export async function saveUserSettings(userId, settingsObj, password) {
  let apiKeyValue = settingsObj.apiKey || "";
  let encrypted = 0;

  if (apiKeyValue && password) {
    try {
      apiKeyValue = await encryptApiKey(apiKeyValue, password);
      encrypted = 1;
    } catch (err) {
      console.warn("Encryption failed, storing unencrypted:", err);
    }
  }

  const stmt = db.prepare(`SELECT id FROM settings WHERE user_id = ?`);
  stmt.bind([userId]);
  let exists = stmt.step();
  stmt.free();

  const endpoint = settingsObj.endpoint || "https://api.openai.com/v1/chat/completions";
  const model = settingsObj.model || "gpt-4o";

  if (exists) {
    db.run(
      `UPDATE settings SET endpoint = ?, api_key = ?, model = ?, encrypted = ? WHERE user_id = ?`,
      [endpoint, apiKeyValue, model, encrypted, userId]
    );
  } else {
    db.run(
      `INSERT INTO settings (user_id, endpoint, api_key, model, encrypted) VALUES (?, ?, ?, ?, ?)`,
      [userId, endpoint, apiKeyValue, model, encrypted]
    );
  }

  await saveDbToIndexedDB();
}

export async function loadUserSettings(userId, password) {
  const stmt = db.prepare(`SELECT endpoint, api_key, model, encrypted FROM settings WHERE user_id = ?`);
  stmt.bind([userId]);
  let row = null;
  if (stmt.step()) {
    row = stmt.get();
  }
  stmt.free();

  if (!row) {
    return {
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "",
      model: "gpt-4o"
    };
  }

  const [endpoint, apiKeyEncrypted, model, encrypted] = row;

  let apiKey = "";
  if (encrypted === 1 && apiKeyEncrypted && password) {
    try {
      if (isEncrypted(apiKeyEncrypted)) {
        apiKey = await decryptApiKey(apiKeyEncrypted, password);
      } else {
        apiKey = apiKeyEncrypted;
      }
    } catch (err) {
      console.warn("Failed to decrypt API key:", err);
      apiKey = "";
    }
  } else if (!encrypted || !password) {
    apiKey = apiKeyEncrypted || "";
  }

  return {
    endpoint: endpoint || "https://api.openai.com/v1/chat/completions",
    apiKey,
    model: model || "gpt-4o"
  };
}

export function hasUsers() {
  const result = db.exec(`SELECT COUNT(*) as count FROM users`);
  if (result.length === 0) return false;
  return (result[0].values[0][0] || 0) > 0;
}

export function getDbInstance() {
  return db;
}

// Auto-save on page unload
window.addEventListener("beforeunload", () => {
  if (db && indexedDBConn) {
    try {
      const data = db.export();
      const uint8 = new Uint8Array(data);
      const txn = indexedDBConn.transaction([INDEXEDDB_STORE], "readwrite");
      txn.objectStore(INDEXEDDB_STORE).put(uint8, INDEXEDDB_KEY);
    } catch (e) {
      // Ignore errors during unload
    }
  }
});
