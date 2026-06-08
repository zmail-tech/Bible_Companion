// Settings modal and localStorage persistence

const STORAGE_KEY = "bibleCompanion_settings";

const DEFAULT_SETTINGS = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o"
};

let settings = loadSettings();

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.warn("Failed to load settings:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettingsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Failed to save settings:", err);
  }
}

export function getSettings() {
  return { ...settings };
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
    apiKeyInput.value = settings.apiKey;
    modelInput.value = settings.model;
    statusEl.className = "status-message";
    statusEl.textContent = "";
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

  async function validateConnection(endpoint) {
    try {
      const opts = {
        method: "HEAD",
        headers: {}
      };
      if (settings.apiKey) {
        opts.headers["Authorization"] = `Bearer ${settings.apiKey}`;
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
    saveSettingsToStorage();
    endpointInput.value = settings.endpoint;
    apiKeyInput.value = settings.apiKey;
    modelInput.value = settings.model;
    setStatus("Settings reset to defaults.", "success");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEndpoint = endpointInput.value.trim();
    const newApiKey = apiKeyInput.value;
    const newModel = modelInput.value.trim();

    if (!newEndpoint) {
      setStatus("Endpoint URL is required.", "error");
      endpointInput.focus();
      return;
    }

    settings.endpoint = newEndpoint;
    settings.apiKey = newApiKey;
    settings.model = newModel || DEFAULT_SETTINGS.model;
    saveSettingsToStorage();

    setStatus("Testing connection...", "");

    const isConnected = await validateConnection(newEndpoint);

    if (isConnected) {
      setStatus("Settings saved. Connection successful.", "success");
    } else {
      setStatus("Settings saved, but connection test could not reach the endpoint. Check the URL and API key.", "warning");
    }
  });
}

document.addEventListener("DOMContentLoaded", initSettingsModal);
