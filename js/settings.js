// Settings modal and localStorage persistence

const STORAGE_KEY = "bibleCompanion_settings";
const MODELS_STORAGE_KEY = "bibleCompanion_models";

const DEFAULT_SETTINGS = {
  providers: [
    {
      id: "default",
      name: "Default Provider",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "",
      model: "gpt-4o"
    }
  ],
  activeProviderId: "default"
};

let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
let availableModels = [];

function migrateOldSettings(oldSettings) {
  if (!oldSettings || !oldSettings.endpoint) return null;
  return {
    providers: [{
      id: "default",
      name: "Default Provider",
      endpoint: oldSettings.endpoint,
      apiKey: oldSettings.apiKey || "",
      model: oldSettings.model || "gpt-4o"
    }],
    activeProviderId: "default"
  };
}

function isNewFormat(data) {
  return data && Array.isArray(data.providers) && data.providers.length > 0;
}

window.loadSettings = function(s) {
  if (s && !isNewFormat(s)) {
    s = migrateOldSettings(s);
  }
  settings = s || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  window.settings = settings;
  console.log("[settings] window.loadSettings called with:", s);
  console.log("[settings] window.loadSettings - storage key:", STORAGE_KEY);
};

export function getSettings() {
  return { ...settings };
}

export function getActiveProvider() {
  return getProviderById(settings.activeProviderId) || settings.providers[0] || null;
}

export function getProviderById(id) {
  return settings.providers.find(p => p.id === id) || null;
}

export function setApiKey(key) {
  const provider = getActiveProvider();
  if (provider) provider.apiKey = key;
}

export function clearApiKey() {
  const provider = getActiveProvider();
  if (provider) provider.apiKey = "";
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
      if (!isNewFormat(parsed)) {
        return migrateOldSettings(parsed);
      }
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
  const provider = getProviderById(document.getElementById("provider-select").value);
  if (provider) {
    if (select.style.display !== "none" && select.value) {
      provider.model = select.value;
    } else if (input.style.display !== "none" && input.value.trim()) {
      provider.model = input.value.trim();
    }
  }
}

function getSavedModel() {
  const select = document.getElementById("model-select");
  const input = document.getElementById("model-name");
  if (select.style.display !== "none" && select.value) {
    return select.value;
  }
  if (input.style.display !== "none" && input.value.trim()) {
    return input.value.trim();
  }
  return null;
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
    let store = {};
    const raw = localStorage.getItem(MODELS_STORAGE_KEY);
    if (raw) {
      try { store = JSON.parse(raw); } catch {}
    }
    if (typeof store !== "object" || Array.isArray(store)) store = {};
    store[endpoint] = models;
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function clearCachedModels() {
  try {
    localStorage.removeItem(MODELS_STORAGE_KEY);
  } catch {}
}

function getCachedModelsForEndpoint(endpoint) {
  const store = loadCachedModels();
  if (store && typeof store === "object" && !Array.isArray(store)) {
    return store[endpoint] || null;
  }
  // Legacy single-endpoint cache
  if (store && store.endpoint === endpoint) {
    return store.models || null;
  }
  return null;
}

function addProvider(data) {
  const id = data.id || `provider_${Date.now()}`;
  const provider = {
    id,
    name: data.name || "New Provider",
    endpoint: data.endpoint || "",
    apiKey: data.apiKey || "",
    model: data.model || "gpt-4o"
  };
  settings.providers.push(provider);
  settings.activeProviderId = id;
  saveSettingsLocally();
  return provider;
}

function deleteProvider(id) {
  if (settings.providers.length <= 1) return false;
  const idx = settings.providers.findIndex(p => p.id === id);
  if (idx === -1) return false;
  settings.providers.splice(idx, 1);
  if (settings.activeProviderId === id) {
    settings.activeProviderId = settings.providers[0]?.id || null;
  }
  saveSettingsLocally();
  return true;
}

function updateProvider(id, data) {
  const provider = getProviderById(id);
  if (!provider) return false;
  if (data.endpoint !== undefined) provider.endpoint = data.endpoint;
  if (data.apiKey !== undefined) provider.apiKey = data.apiKey;
  if (data.model !== undefined) provider.model = data.model;
  if (data.name !== undefined) provider.name = data.name;
  saveSettingsLocally();
  return true;
}

function setActiveProvider(id) {
  if (getProviderById(id)) {
    settings.activeProviderId = id;
    saveSettingsLocally();
  }
}

function initSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("close-settings");
  const overlay = modal.querySelector(".modal-overlay");
  const form = document.getElementById("settings-form");
  const resetBtn = document.getElementById("reset-settings");

  const providerSelect = document.getElementById("provider-select");
  const providerNameInput = document.getElementById("provider-name");
  const endpointInput = document.getElementById("endpoint-url");
  const apiKeyInput = document.getElementById("api-key");
  const modelInput = document.getElementById("model-name");
  const modelSelect = document.getElementById("model-select");
  const themeSelect = document.getElementById("theme-select");
  const statusEl = document.getElementById("connection-status");
  const fetchModelsBtn = document.getElementById("fetch-models-btn");
  const addProviderBtn = document.getElementById("add-provider-btn");
  const deleteProviderBtn = document.getElementById("delete-provider-btn");

  function populateProviderDropdown() {
    providerSelect.innerHTML = "";
    for (const p of settings.providers) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === settings.activeProviderId) opt.selected = true;
      providerSelect.appendChild(opt);
    }
  }

  function getSelectedProvider() {
    return getProviderById(providerSelect.value);
  }

  function populateFormFromProvider(provider) {
    if (!provider) return;
    providerNameInput.value = provider.name;
    endpointInput.value = provider.endpoint;
    if (provider.apiKey) {
      apiKeyInput.value = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      apiKeyInput.dataset.hasKey = "true";
    } else {
      apiKeyInput.value = "";
      apiKeyInput.dataset.hasKey = "false";
    }
    const cached = getCachedModelsForEndpoint(provider.endpoint);
    if (cached && cached.length > 0) {
      populateModelSelect(cached);
      modelSelect.value = provider.model;
      switchToSelectMode();
    } else {
      switchToInputMode();
      modelInput.value = provider.model;
    }
  }

  function updateDeleteButtonState() {
    deleteProviderBtn.disabled = settings.providers.length <= 1;
  }

  function openModal() {
    populateProviderDropdown();
    const active = getActiveProvider();
    populateFormFromProvider(active);
    statusEl.className = "status-message";
    statusEl.textContent = "";
    const savedTheme = localStorage.getItem("bibleCompanion_theme") || "light";
    themeSelect.value = savedTheme;
    updateDeleteButtonState();
    modal.classList.add("active");
    providerSelect.focus();
    if (window.updateProviderStatus) window.updateProviderStatus();
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

  providerSelect.addEventListener("change", () => {
    const provider = getSelectedProvider();
    if (provider) {
      setActiveProvider(provider.id);
      populateFormFromProvider(provider);
    }
    updateDeleteButtonState();
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  addProviderBtn.addEventListener("click", () => {
    const newProvider = addProvider({ name: "New Provider" });
    populateProviderDropdown();
    populateFormFromProvider(newProvider);
    providerSelect.value = newProvider.id;
    updateDeleteButtonState();
    setStatus("New provider added. Fill in the details and save.", "success");
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  deleteProviderBtn.addEventListener("click", () => {
    const provider = getSelectedProvider();
    if (!provider) return;
    if (settings.providers.length <= 1) {
      setStatus("Cannot delete the last provider.", "error");
      return;
    }
    const wasActive = provider.id === settings.activeProviderId;
    deleteProvider(provider.id);
    populateProviderDropdown();
    const newActive = getActiveProvider();
    populateFormFromProvider(newActive);
    updateDeleteButtonState();
    setStatus(`Provider "${provider.name}" deleted.`, "success");
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  fetchModelsBtn.addEventListener("click", async () => {
    const currentEndpoint = endpointInput.value.trim();
    const rawApiKey = apiKeyInput.value;
    const useExistingKey = apiKeyInput.dataset.hasKey === "true";
    const provider = getSelectedProvider();
    const actualApiKey = useExistingKey ? (provider?.apiKey || "") : rawApiKey;

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
      if (provider) modelSelect.value = provider.model;
      switchToSelectMode();
      setStatus(`Found ${models.length} models.`, "success");
    } else {
      switchToInputMode();
      if (provider) modelInput.value = provider.model;
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
    const provider = getSelectedProvider();
    if (provider && modelSelect.value) {
      provider.model = modelSelect.value;
    }
  });

  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  resetBtn.addEventListener("click", () => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    availableModels = [];
    clearCachedModels();
    saveSettingsLocally();
    populateProviderDropdown();
    const active = getActiveProvider();
    populateFormFromProvider(active);
    updateDeleteButtonState();
    setStatus("Settings reset to defaults.", "success");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEndpoint = endpointInput.value.trim();
    const rawApiKey = apiKeyInput.value;

    saveModelFromUI();

    const useExistingKey = apiKeyInput.dataset.hasKey === "true";
    const provider = getSelectedProvider();
    const actualApiKey = useExistingKey ? (provider?.apiKey || "") : rawApiKey;

    if (!newEndpoint) {
      setStatus("Endpoint URL is required.", "error");
      endpointInput.focus();
      return;
    }

    if (provider) {
      updateProvider(provider.id, {
        name: providerNameInput.value.trim() || "Unnamed Provider",
        endpoint: newEndpoint,
        apiKey: actualApiKey,
        model: getSavedModel()
      });
    }

    setStatus("Testing connection...", "");
    const isConnected = await validateConnection(newEndpoint, actualApiKey);

    if (isConnected) {
      setStatus("Settings saved. Connection successful.", "success");
    } else {
      setStatus("Settings saved, but connection test could not reach the endpoint. Check the URL and API key.", "warning");
    }
    if (window.updateProviderStatus) window.updateProviderStatus();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsModal);
} else {
  initSettingsModal();
}
