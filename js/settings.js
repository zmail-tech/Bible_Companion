// Settings modal and localStorage persistence

const STORAGE_KEY = "bibleCompanion_settings";

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
  console.log("[settings] window.loadSettings called with:", s);
  console.log("[settings] window.loadSettings - storage key:", STORAGE_KEY);
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

export function loadSettingsLocally() {
  try {
    console.log("[settings] loadSettingsLocally: STORAGE_KEY =", STORAGE_KEY);
    console.log("[settings] loadSettingsLocally: all localStorage keys:", Object.keys(localStorage));
    const raw = localStorage.getItem(STORAGE_KEY);
    console.log("[settings] loadSettingsLocally: raw =", raw);
    if (raw) {
      const parsed = JSON.parse(raw);
      console.log("[settings] loadSettingsLocally: parsed =", parsed);
      return parsed;
    }
  } catch (e) {
    console.error("[settings] Failed to load settings from localStorage:", e);
  }
  console.log("[settings] loadSettingsLocally: returning null (no data found)");
  return null;
}

function saveSettingsLocally() {
  try {
    const toSave = JSON.stringify(settings);
    console.log("[settings] saveSettingsLocally: saving =", toSave);
    localStorage.setItem(STORAGE_KEY, toSave);
    // Verify by reading back immediately
    const verify = localStorage.getItem(STORAGE_KEY);
    console.log("[settings] saveSettingsLocally: verified =", verify);
  } catch (e) {
    console.error("[settings] Failed to save settings to localStorage:", e);
  }
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

  resetBtn.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettingsLocally();
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

    saveSettingsLocally();

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
