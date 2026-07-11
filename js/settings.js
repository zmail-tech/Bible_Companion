// Settings modal and localStorage persistence

const STORAGE_KEY = "bibleCompanion_settings";
const MODELS_STORAGE_KEY = "bibleCompanion_models";

const DEFAULT_SETTINGS = {
  providers: [
    {
      id: "default",
      name: "Default Provider",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: ""
    }
  ],
  activeProviderId: "default",
  prayerSignature: "\u2014 Bible Companion",
  emailGreeting: "",
  emailSubject: "Prayer List",
  commentaryModel: null,
  prayerModel: null,
  smallModel: null
};

let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

function migrateOldSettings(oldSettings) {
  if (!oldSettings || !oldSettings.endpoint) return null;
  if (Array.isArray(oldSettings.providers)) {
    return {
      ...oldSettings,
      providers: oldSettings.providers.map(p => ({
        ...p,
        primaryModel: p.primaryModel || p.model || "gpt-4o",
        supportModel: p.supportModel ?? null
      }))
    };
  }
  return {
    providers: [{
      id: "default",
      name: "Default Provider",
      endpoint: oldSettings.endpoint,
      apiKey: oldSettings.apiKey || "",
      primaryModel: oldSettings.model || "gpt-4o",
      supportModel: null
    }],
    activeProviderId: "default",
    prayerSignature: oldSettings.prayerSignature || "\u2014 Bible Companion"
  };
}

function migrateModelsToSettings(data) {
  if (!data || !Array.isArray(data.providers)) return data;
  let commentaryModel = null;
  let prayerModel = null;
  for (const p of data.providers) {
    if (p.primaryModel || p.model) {
      const modelId = p.primaryModel || p.model;
      commentaryModel = p.id + "::" + modelId;
    }
    if (p.supportModel && p.supportModel.model) {
      const primary = p.primaryModel || p.model;
      if (p.supportModel.model !== primary) {
        prayerModel = p.id + "::" + p.supportModel.model;
      }
    }
    delete p.primaryModel;
    delete p.supportModel;
    delete p.model;
  }
  return {
    ...data,
    commentaryModel: commentaryModel || data.commentaryModel || null,
    prayerModel: prayerModel || data.prayerModel || null
  };
}

function isNewFormat(data) {
  return data && Array.isArray(data.providers) && data.providers.length > 0;
}

function hasNewModelFields(data) {
  return data && data.commentaryModel !== undefined;
}

window.loadSettings = function(s) {
  console.log("[settings] loadSettings called with:", s);
  if (s && !isNewFormat(s)) {
    s = migrateOldSettings(s);
    console.log("[settings] After old settings migration:", s);
  }
  if (s && isNewFormat(s) && !hasNewModelFields(s)) {
    s = migrateModelsToSettings(s);
    console.log("[settings] After model migration:", s);
  }
  settings = s || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  console.log("[settings] settings set to:", settings);
  window.settings = settings;
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

export function getPrayerSignature() {
  return settings.prayerSignature || "\u2014 Bible Companion";
}

export function setPrayerSignature(val) {
  settings.prayerSignature = val ?? "\u2014 Bible Companion";
  saveSettingsLocally();
}

export function getEmailSubject() {
  return settings.emailSubject || "Prayer List";
}

export function setEmailSubject(val) {
  settings.emailSubject = val ?? "Prayer List";
  saveSettingsLocally();
}

export function getEmailGreeting() {
  return settings.emailGreeting || "";
}

export function setEmailGreeting(val) {
  settings.emailGreeting = val ?? "";
  saveSettingsLocally();
}

export function getCommentaryModel() {
  if (!settings.commentaryModel) return null;
  const parts = settings.commentaryModel.split("::");
  const providerId = parts[0];
  const modelId = parts.slice(1).join("::");
  const provider = getProviderById(providerId);
  return provider ? { providerId, modelId, provider } : null;
}

export function getPrayerModel() {
  if (settings.prayerModel) {
    const parts = settings.prayerModel.split("::");
    const providerId = parts[0];
    const modelId = parts.slice(1).join("::");
    const provider = getProviderById(providerId);
    if (provider) return { providerId, modelId, provider };
  }
  return getCommentaryModel();
}

export function setCommentaryModel(value) {
  settings.commentaryModel = value || null;
  saveSettingsLocally();
}

export function setPrayerModel(value) {
  settings.prayerModel = value || null;
  saveSettingsLocally();
}

export function getSmallModel() {
  if (!settings.smallModel) return null;
  const parts = settings.smallModel.split("::");
  const providerId = parts[0];
  const modelId = parts.slice(1).join("::");
  const provider = getProviderById(providerId);
  return provider ? { providerId, modelId, provider } : null;
}

export function setSmallModel(value) {
  settings.smallModel = value || null;
  saveSettingsLocally();
}

export function buildAggregatedModelList() {
  const modelsStore = loadCachedModels();
  const result = [];
  for (const provider of settings.providers) {
    const cached = modelsStore && typeof modelsStore === "object"
      ? modelsStore[provider.endpoint]
      : null;
    const models = cached || [];
    for (const modelId of models) {
      result.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId,
        displayName: provider.name + " / " + modelId
      });
    }
  }
  return result;
}

export function loadSettingsLocally() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    console.log("[settings] Loading from localStorage, raw:", raw);
    if (raw) {
      const parsed = JSON.parse(raw);
      console.log("[settings] Parsed settings:", parsed);
      if (!isNewFormat(parsed)) {
        const migrated = migrateOldSettings(parsed);
        if (migrated) return migrateModelsToSettings(migrated);
        return migrated;
      }
      if (!hasNewModelFields(parsed)) {
        return migrateModelsToSettings(parsed);
      }
      if (parsed.prayerSignature === undefined || parsed.prayerSignature === null) {
        parsed.prayerSignature = DEFAULT_SETTINGS.prayerSignature;
      }
      if (parsed.emailSubject === undefined || parsed.emailSubject === null) {
        parsed.emailSubject = DEFAULT_SETTINGS.emailSubject;
      }
      if (parsed.emailGreeting === undefined || parsed.emailGreeting === null) {
        parsed.emailGreeting = DEFAULT_SETTINGS.emailGreeting;
      }
      return parsed;
    }
  } catch (e) {
    console.error("[settings] Failed to load settings from localStorage:", e);
  }
  return null;
}

function showToast(message, duration) {
  duration = duration || 2500;
  const toast = document.getElementById("toast-notification");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, duration);
}

function saveSettingsLocally() {
  try {
    const toSave = JSON.stringify(settings);
    console.log("[settings] Saving to localStorage:", toSave);
    localStorage.setItem(STORAGE_KEY, toSave);
    console.log("[settings] Verifying saved data:", JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (e) {
    console.error("[settings] Failed to save settings to localStorage:", e);
  }
}

function normalizeEndpoint(input) {
  if (!input) return input;
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  return `https://${input}/v1/chat/completions`;
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

function addProvider(data) {
  console.log("[settings] addProvider called with:", data);
  const id = data.id || `provider_${Date.now()}`;
  const provider = {
    id,
    name: data.name || "",
    endpoint: normalizeEndpoint(data.endpoint) || "",
    apiKey: data.apiKey || ""
  };
  console.log("[settings] Created provider:", provider);
  settings.providers.push(provider);
  settings.activeProviderId = id;
  console.log("[settings] providers array before save:", settings.providers);
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
  if (data.endpoint !== undefined) provider.endpoint = normalizeEndpoint(data.endpoint);
  if (data.apiKey !== undefined) provider.apiKey = data.apiKey;
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

function populateModelDropdowns() {
  const aggregated = buildAggregatedModelList();
  const commentarySelect = document.getElementById("commentary-model-select");
  const prayerSelect = document.getElementById("prayer-model-select");

  commentarySelect.innerHTML = '<option value="">-- Select a model --</option>';
  for (const m of aggregated) {
    const opt = document.createElement("option");
    opt.value = m.providerId + "::" + m.modelId;
    opt.textContent = m.displayName;
    commentarySelect.appendChild(opt);
  }
  commentarySelect.value = settings.commentaryModel || "";

  prayerSelect.innerHTML = '<option value="">Same as Commentary Model</option>';
  for (const m of aggregated) {
    const opt = document.createElement("option");
    opt.value = m.providerId + "::" + m.modelId;
    opt.textContent = m.displayName;
    prayerSelect.appendChild(opt);
  }
  prayerSelect.value = settings.prayerModel || "";

  const smallSelect = document.getElementById("small-model-select");
  smallSelect.innerHTML = '<option value="">-- Select a model --</option>';
  for (const m of aggregated) {
    const opt = document.createElement("option");
    opt.value = m.providerId + "::" + m.modelId;
    opt.textContent = m.displayName;
    smallSelect.appendChild(opt);
  }
  smallSelect.value = settings.smallModel || "";
}

function initSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("close-settings");
  const overlay = modal.querySelector(".modal-overlay");
  const form = document.getElementById("settings-form");
  const resetBtn = document.getElementById("reset-settings");
  const prayerSignatureInput = document.getElementById("prayer-signature-input");
  const emailGreetingInput = document.getElementById("email-greeting-input");
  const emailSubjectInput = document.getElementById("email-subject-input");

  const providerNameInput = document.getElementById("provider-name");
  const endpointInput = document.getElementById("endpoint-url");
  const apiKeyInput = document.getElementById("api-key");
  const themeSelect = document.getElementById("theme-select");
  const statusEl = document.getElementById("connection-status");
  const addProviderBtn = document.getElementById("add-provider-btn");
  const deleteProviderBtn = document.getElementById("delete-provider-btn");
  const providerListEl = document.getElementById("settings-provider-list");
  const contextNameEl = document.getElementById("settings-context-name");
  const contextEndpointEl = document.getElementById("settings-context-endpoint");
  const commentarySelect = document.getElementById("commentary-model-select");
  const prayerSelect = document.getElementById("prayer-model-select");
  const smallSelect = document.getElementById("small-model-select");
  const refreshAllBtn = document.getElementById("refresh-all-models-btn");

  function renderSettingsSidebar() {
    const navItems = modal.querySelectorAll(".settings-nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", () => {
        switchSettingsPane(item.dataset.settingsPane);
      });
    });
  }

  function switchSettingsPane(paneName) {
    modal.querySelectorAll(".settings-nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.settingsPane === paneName);
    });
    modal.querySelectorAll(".settings-pane").forEach(pane => {
      pane.classList.toggle("active", pane.dataset.settingsPane === paneName);
    });
    if (paneName === "models") {
      populateModelDropdowns();
    }
  }

  function populateProviderList() {
    if (!providerListEl) return;
    providerListEl.innerHTML = "";
    if (settings.providers.length === 0) {
      const placeholder = document.createElement("p");
      placeholder.className = "settings-no-providers";
      placeholder.textContent = "No providers configured.";
      providerListEl.appendChild(placeholder);
      return;
    }
    for (const p of settings.providers) {
      const card = document.createElement("div");
      card.className = "settings-provider-card" + (p.id === settings.activeProviderId ? " active" : "");
      card.textContent = p.name;
      card.addEventListener("click", () => {
        setActiveProvider(p.id);
        populateProviderList();
        populateProviderForm(p);
        if (window.updateProviderStatus) window.updateProviderStatus();
      });
      providerListEl.appendChild(card);
    }
  }

  function updateContextCard(provider) {
    if (!contextNameEl || !contextEndpointEl) return;
    if (provider) {
      contextNameEl.textContent = provider.name;
      contextEndpointEl.textContent = provider.endpoint;
    } else {
      contextNameEl.textContent = "";
      contextEndpointEl.textContent = "";
    }
  }

  function getSelectedProvider() {
    return getProviderById(settings.activeProviderId);
  }

  function populateProviderForm(provider) {
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
    updateContextCard(provider);
  }

  function updateDeleteButtonState() {
    deleteProviderBtn.disabled = settings.providers.length <= 1;
  }

  function openModal() {
    const active = getActiveProvider();
    populateProviderList();
    populateProviderForm(active);
    statusEl.className = "status-message";
    statusEl.textContent = "";
    const savedTheme = localStorage.getItem("bibleCompanion_theme") || "light";
    themeSelect.value = savedTheme;
    prayerSignatureInput.value = getPrayerSignature();
    if (emailGreetingInput) emailGreetingInput.value = getEmailGreeting();
    if (emailSubjectInput) emailSubjectInput.value = getEmailSubject();
    updateDeleteButtonState();
    switchSettingsPane("general");
    modal.classList.add("active");
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

  // --- Event Listeners ---

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

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

  apiKeyInput.addEventListener("input", () => {
    apiKeyInput.dataset.hasKey = "false";
  });

  commentarySelect.addEventListener("change", () => {
    setCommentaryModel(commentarySelect.value || null);
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  prayerSelect.addEventListener("change", () => {
    setPrayerModel(prayerSelect.value || null);
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  smallSelect.addEventListener("change", () => {
    setSmallModel(smallSelect.value || null);
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  refreshAllBtn.addEventListener("click", async () => {
    setStatus("Fetching models from all providers...", "");
    let totalModels = 0;
    let failures = 0;

    for (const provider of settings.providers) {
      const modelsUrl = deriveModelsUrl(provider.endpoint);
      const models = await fetchModels(modelsUrl, provider.apiKey);
      if (models && models.length > 0) {
        cacheModels(provider.endpoint, models);
        totalModels += models.length;
      } else {
        failures++;
      }
    }

    populateModelDropdowns();

    if (failures === settings.providers.length) {
      setStatus("Could not fetch models from any provider.", "error");
    } else {
      setStatus(`Found ${totalModels} models across ${settings.providers.length - failures} provider(s).`, "success");
    }
  });

  addProviderBtn.addEventListener("click", () => {
    const newProvider = addProvider({});
    populateProviderList();
    populateProviderForm(newProvider);
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
    deleteProvider(provider.id);
    populateProviderList();
    const newActive = getActiveProvider();
    populateProviderForm(newActive);
    updateDeleteButtonState();
    setStatus(`Provider "${provider.name}" deleted.`, "success");
    if (window.updateProviderStatus) window.updateProviderStatus();
  });

  resetBtn.addEventListener("click", () => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    clearCachedModels();
    saveSettingsLocally();
    populateProviderList();
    const active = getActiveProvider();
    populateProviderForm(active);
    updateDeleteButtonState();
    if (prayerSignatureInput) {
      prayerSignatureInput.value = getPrayerSignature();
    }
    if (emailGreetingInput) {
      emailGreetingInput.value = getEmailGreeting();
    }
    if (emailSubjectInput) {
      emailSubjectInput.value = getEmailSubject();
    }
    populateModelDropdowns();
    setStatus("Settings reset to defaults.", "success");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEndpoint = normalizeEndpoint(endpointInput.value.trim());
    const rawApiKey = apiKeyInput.value;

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
        apiKey: actualApiKey
      });
    }

    setStatus("Testing connection...", "");
    const isConnected = await validateConnection(newEndpoint, actualApiKey);

    if (isConnected) {
      setStatus("Settings saved. Connection successful.", "success");
      showToast("Settings saved.");
    } else {
      setStatus("Settings saved, but connection test could not reach the endpoint. Check the URL and API key.", "warning");
      showToast("Settings saved.");
    }
    if (window.updateProviderStatus) window.updateProviderStatus();
    if (prayerSignatureInput) {
      const newSig = prayerSignatureInput.value.trim();
      setPrayerSignature(newSig);
      if (window.updatePrayerSignatureDisplay) window.updatePrayerSignatureDisplay();
    }
    if (emailGreetingInput) {
      const newGreeting = emailGreetingInput.value;
      setEmailGreeting(newGreeting);
    }
    if (emailSubjectInput) {
      const newSubj = emailSubjectInput.value.trim();
      setEmailSubject(newSubj);
    }
  });

  renderSettingsSidebar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsModal);
} else {
  initSettingsModal();
}
