// Settings modal and localStorage persistence

const STORAGE_KEY = "bibleCompanion_settings";
const MODELS_STORAGE_KEY = "bibleCompanion_models";

const DEFAULT_SETTINGS = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o"
};

let settings = { ...DEFAULT_SETTINGS };
let availableModels = [];

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

function deriveModelsUrl(endpointUrl) {
  try {
    let url = endpointUrl.replace(/\/+$/, "");
    if (url.endsWith("/models")) return url;
    const v1Idx = url.indexOf("/v1");
    if (v1Idx !== -1) {
      return url.slice(0, v1Idx + 3) + "/models";
    }
    return url + "/v1/models";
  } catch {
    return endpointUrl;
  }
}

async function fetchModels(modelsUrl, apiKey) {
  try {
    const opts = {
      method: "GET",
      headers: { "Accept": "application/json" }
    };
    if (apiKey) {
      opts.headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const res = await fetch(modelsUrl, opts);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.data)) {
      return data.data.map(m => typeof m === "string" ? m : m.id).filter(Boolean);
    }
    return null;
  } catch {
    return null;
  }
}

function populateModelSelect(models) {
  const select = document.getElementById("model-select");
  select.innerHTML = '<option value="">-- Select a model --</option>';
  models.forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    select.appendChild(opt);
  });
  availableModels = models;
}

function switchToSelectMode() {
  document.getElementById("model-select").style.display = "";
  document.getElementById("model-name").style.display = "none";
}

function switchToInputMode() {
  document.getElementById("model-select").style.display = "none";
  document.getElementById("model-name").style.display = "";
}

function saveModelFromUI() {
  const select = document.getElementById("model-select");
  const input = document.getElementById("model-name");
  if (select.style.display !== "none" && select.value) {
    settings.model = select.value;
  } else if (input.style.display !== "none" && input.value.trim()) {
    settings.model = input.value.trim();
  }
}

function loadCachedModels() {
  try {
    const raw = localStorage.getItem(MODELS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function cacheModels(endpoint, models) {
  try {
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify({ endpoint, models }));
  } catch {}
}

function clearCachedModels() {
  try {
    localStorage.removeItem(MODELS_STORAGE_KEY);
  } catch {}
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
  const modelSelect = document.getElementById("model-select");
  const themeSelect = document.getElementById("theme-select");
  const statusEl = document.getElementById("connection-status");
  const fetchModelsBtn = document.getElementById("fetch-models-btn");

  function openModal() {
    endpointInput.value = settings.endpoint;
    modelInput.value = settings.model;
    statusEl.className = "status-message";
    statusEl.textContent = "";
    const savedTheme = localStorage.getItem("bibleCompanion_theme") || "light";
    themeSelect.value = savedTheme;

    if (settings.apiKey) {
      apiKeyInput.value = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      apiKeyInput.dataset.hasKey = "true";
    } else {
      apiKeyInput.value = "";
      apiKeyInput.dataset.hasKey = "false";
    }

    const cached = loadCachedModels();
    if (cached && cached.endpoint === settings.endpoint && cached.models && cached.models.length > 0) {
      populateModelSelect(cached.models);
      modelSelect.value = settings.model;
      switchToSelectMode();
    } else {
      switchToInputMode();
      modelInput.value = settings.model;
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

  fetchModelsBtn.addEventListener("click", async () => {
    const currentEndpoint = endpointInput.value.trim() || settings.endpoint;
    const rawApiKey = apiKeyInput.value;
    const useExistingKey = apiKeyInput.dataset.hasKey === "true";
    const actualApiKey = useExistingKey ? settings.apiKey : rawApiKey;

    if (!currentEndpoint) {
      setStatus("Please enter an endpoint URL first.", "error");
      endpointInput.focus();
      return;
    }

    const modelsUrl = deriveModelsUrl(currentEndpoint);
    setStatus("Fetching models...", "");

    const models = await fetchModels(modelsUrl, actualApiKey);

    if (models && models.length > 0) {
      cacheModels(currentEndpoint, models);
      populateModelSelect(models);
      modelSelect.value = settings.model;
      switchToSelectMode();
      setStatus(`Found ${models.length} models.`, "success");
    } else {
      switchToInputMode();
      modelInput.value = settings.model;
      setStatus("Could not fetch models. Enter a model name manually.", "error");
    }
  });

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  themeSelect.addEventListener("change", () => {
    const theme = themeSelect.value;
    localStorage.setItem("bibleCompanion_theme", theme);
    if (window.applyTheme) {
      window.applyTheme(theme);
    } else {
      const html = document.documentElement;
      if (theme === "light") {
        html.removeAttribute("data-theme");
      } else {
        html.setAttribute("data-theme", theme);
      }
      const themeColors = { light: "#d4c5a9", dark: "#1a1a2e", modern: "#13151b" };
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.content = themeColors[theme] || themeColors.light;
      }
    }
  });

  modelSelect.addEventListener("change", () => {
    if (modelSelect.value) {
      settings.model = modelSelect.value;
    }
  });

  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  resetBtn.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    availableModels = [];
    clearCachedModels();
    saveSettingsLocally();
    endpointInput.value = settings.endpoint;
    apiKeyInput.value = "";
    apiKeyInput.dataset.hasKey = "false";
    modelInput.value = settings.model;
    switchToInputMode();
    setStatus("Settings reset to defaults.", "success");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEndpoint = endpointInput.value.trim();
    const rawApiKey = apiKeyInput.value;

    saveModelFromUI();

    const useExistingKey = apiKeyInput.dataset.hasKey === "true";
    const actualApiKey = useExistingKey ? settings.apiKey : rawApiKey;

    if (!newEndpoint) {
      setStatus("Endpoint URL is required.", "error");
      endpointInput.focus();
      return;
    }

    settings.endpoint = newEndpoint;
    settings.model = settings.model || DEFAULT_SETTINGS.model;
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
