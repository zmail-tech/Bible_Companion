// Settings modal and SQLite persistence

import { saveUserSettings } from "./sqlite.js";
import { getPassword } from "./auth.js";

const DEFAULT_SETTINGS = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o"
};

let settings = { ...DEFAULT_SETTINGS };

window.settings = null;

window.loadSettings = function(s) {
  settings = s || { ...DEFAULT_SETTINGS };
  window.settings = settings;
};

export function getSettings() {
  return { ...settings };
}

export function setApiKey(key) {
  settings.apiKey = key;
}

export function clearApiKey() {
  settings.apiKey = "";
}

function initSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("close-settings");
  const overlay = modal.querySelector(".modal-overlay");
  const form = document.getElementById("settings-form");
  const resetBtn = document.getElementById("reset-settings");

  const endpointInput = document.getElementById("endpoint-url");
  const apiKeyInput = document.getElementById("api-key");
  const modelInput = document.getElementById("model-name");
  const statusEl = document.getElementById("connection-status");

  function openModal() {
    endpointInput.value = settings.endpoint;
    modelInput.value = settings.model;
    statusEl.className = "status-message";
    statusEl.textContent = "";

    if (settings.apiKey) {
      apiKeyInput.value = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      apiKeyInput.dataset.hasKey = "true";
    } else {
      apiKeyInput.value = "";
      apiKeyInput.dataset.hasKey = "false";
    }

    modal.classList.add("active");
    endpointInput.focus();
  }

  function closeModal() {
    modal.classList.remove("active");
  }

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
  }

  async function validateConnection(endpoint, apiKey) {
    try {
      const opts = {
        method: "HEAD",
        headers: {}
      };
      if (apiKey) {
        opts.headers["Authorization"] = `Bearer ${apiKey}`;
      }
      const res = await fetch(endpoint, opts);
      return res.status < 500;
    } catch {
      return false;
    }
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  resetBtn.addEventListener("click", async () => {
    settings = { ...DEFAULT_SETTINGS };
    const password = getPassword();
    if (password) {
      const user = JSON.parse(sessionStorage.getItem("bibleCompanion_user"));
      if (user) {
        await saveUserSettings(user.id, settings, password);
      }
    }
    endpointInput.value = settings.endpoint;
    apiKeyInput.value = "";
    apiKeyInput.dataset.hasKey = "false";
    modelInput.value = settings.model;
    setStatus("Settings reset to defaults.", "success");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEndpoint = endpointInput.value.trim();
    const rawApiKey = apiKeyInput.value;
    const newModel = modelInput.value.trim();

    const useExistingKey = apiKeyInput.dataset.hasKey === "true";
    const actualApiKey = useExistingKey ? settings.apiKey : rawApiKey;

    if (!newEndpoint) {
      setStatus("Endpoint URL is required.", "error");
      endpointInput.focus();
      return;
    }

    settings.endpoint = newEndpoint;
    settings.model = newModel || DEFAULT_SETTINGS.model;
    settings.apiKey = actualApiKey;

    const password = getPassword();
    const user = JSON.parse(sessionStorage.getItem("bibleCompanion_user"));

    if (user && password) {
      await saveUserSettings(user.id, settings, password);
    }

    setStatus("Testing connection...", "");
    const isConnected = await validateConnection(newEndpoint, settings.apiKey);

    if (isConnected) {
      setStatus("Settings saved. Connection successful.", "success");
    } else {
      setStatus("Settings saved, but connection test could not reach the endpoint. Check the URL and API key.", "warning");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsModal);
} else {
  initSettingsModal();
}
