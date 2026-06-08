// Authentication and session management

import { createUser, authenticateUser, loadUserSettings, saveUserSettings, hasUsers, initDB } from "./sqlite.js";
import { saveSession, loadSession, clearSession } from "./crypto.js";

let currentPassword = null;

export function isAuthenticated() {
  return loadSession() !== null;
}

export function getCurrentUser() {
  const session = loadSession();
  return session ? session.user : null;
}

export function getCurrentSettings() {
  const session = loadSession();
  return session ? session.settings : null;
}

export function getPassword() {
  return currentPassword;
}

export function setPassword(password) {
  currentPassword = password;
}

export function clearPassword() {
  currentPassword = null;
}

export async function login(username, password) {
  await initDB();
  const result = await authenticateUser(username, password);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const settings = await loadUserSettings(result.userId, password);
  const userObj = { id: result.userId, username: result.username };
  saveSession(userObj, settings);
  setPassword(password);

  return { success: true, user: userObj, settings };
}

export async function register(username, password) {
  await initDB();
  const result = await createUser(username, password);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, userId: result.userId };
}

export function logout() {
  clearSession();
  clearPassword();
  window.settings = null;
}

export function usersExist() {
  return hasUsers();
}
