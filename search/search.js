// --- Storage Helpers ---
async function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

async function setStorage(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

// --- Global State ---
let allSettings = {};
let allSuspendedTabs = [];

// --- DOM Elements ---
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const searchInput = document.getElementById("search-input");
const suspendedList = document.getElementById("suspended-list");
const noResults = document.getElementById("no-results");
const unsuspendSelectedBtn = document.getElementById("unsuspend-selected");
const closeSelectedBtn = document.getElementById("close-selected");

// Settings
const saveButton = document.getElementById("save-settings");
const saveStatus = document.getElementById("save-status");
const suspendTimeInput = document.getElementById("suspend-time");
const aiKeyInput = document.getElementById("ai-key");
const whitelistInput = document.getElementById("whitelist-input");
const whitelistAddBtn = document.getElementById("whitelist-add");
const whitelistList = document.getElementById("whitelist-list");

// --- Tab Switching Logic ---
tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    // Deactivate all
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabPanels.forEach(panel => panel.classList.remove("active"));
    
    // Activate clicked
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

// --- Search Panel Logic ---

function renderSuspendedList(tabsToRender) {
  suspendedList.innerHTML = ""; // Clear list
  
  if (tabsToRender.length === 0) {
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";

  tabsToRender.forEach(tab => {
    const li = document.createElement("li");
    li.className = "list-item search-item";
    li.dataset.url = tab.url; // Store URL for unsuspend
    
    li.innerHTML = `
      <input type="checkbox" class="list-checkbox" data-url="${tab.url}">
      <img src="${tab.faviconUrl || 'icons/icon16.png'}" class="favicon" alt="">
      <div class="info">
        <span class="title">${tab.title}</span>
        <span class="url">${tab.url}</span>
      </div>
      <button class="action-btn" data-url="${tab.url}" title="Close (Remove)">&#x2716;</button>
    `;
    
    // Click on info to unsuspend
    li.querySelector(".info").addEventListener("click", () => {
      unsuspendTab(tab.url);
    });
    
    // Click on X to close
    li.querySelector(".action-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.url);
    });

    suspendedList.appendChild(li);
  });
}

async function unsuspendTab(url) {
  // 1. Create new tab
  chrome.tabs.create({ url: url, active: true });
  
  // 2. Remove from suspended list
  allSuspendedTabs = allSuspendedTabs.filter(t => t.url !== url);
  await setStorage({ suspendedTabs: allSuspendedTabs });
  
  // 3. Re-render
  filterAndRenderList();
}

async function closeTab(url) {
  // 1. Remove from suspended list
  allSuspendedTabs = allSuspendedTabs.filter(t => t.url !== url);
  await setStorage({ suspendedTabs: allSuspendedTabs });
  
  // 2. Re-render
  filterAndRenderList();
}

function getSelectedUrls() {
  const selected = [];
  document.querySelectorAll(".list-checkbox:checked").forEach(cb => {
    selected.push(cb.dataset.url);
  });
  return selected;
}

function filterAndRenderList() {
  const searchTerm = searchInput.value.toLowerCase();
  if (searchTerm === "") {
    renderSuspendedList(allSuspendedTabs);
    return;
  }
  
  const filteredTabs = allSuspendedTabs.filter(tab => {
    return tab.title.toLowerCase().includes(searchTerm) ||
           tab.url.toLowerCase().includes(searchTerm);
  });
  
  renderSuspendedList(filteredTabs);
}

// --- Settings Panel Logic ---

function renderWhitelist() {
  whitelistList.innerHTML = "";
  if (!allSettings.whitelist || allSettings.whitelist.length === 0) {
    whitelistList.innerHTML = "<li class='empty-state-small'>No whitelisted sites.</li>";
    return;
  }
  
  allSettings.whitelist.forEach(item => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.innerHTML = `
      <div class="info" style="cursor: default;">
        <span class="title">${item}</span>
      </div>
      <button class="action-btn" data-item="${item}" title="Remove">&#x2716;</button>
    `;
    
    li.querySelector(".action-btn").addEventListener("click", () => {
      removeWhitelistItem(item);
    });
    
    whitelistList.appendChild(li);
  });
}

function addWhitelistItem() {
  const newItem = whitelistInput.value.trim();
  if (newItem && !allSettings.whitelist.includes(newItem)) {
    allSettings.whitelist.push(newItem);
    whitelistInput.value = "";
    renderWhitelist();
  }
}

function removeWhitelistItem(itemToRemove) {
  allSettings.whitelist = allSettings.whitelist.filter(item => item !== itemToRemove);
  renderWhitelist();
}

async function loadSettings() {
  const { settings } = await getStorage(["settings"]);
  allSettings = settings || {};
  
  suspendTimeInput.value = allSettings.suspendTime || 15;
  aiKeyInput.value = allSettings.aiApiKey || "";
  allSettings.whitelist = allSettings.whitelist || [];
  
  renderWhitelist();
}

async function saveSettings() {
  allSettings.suspendTime = parseInt(suspendTimeInput.value, 10) || 15;
  allSettings.aiApiKey = aiKeyInput.value.trim() || null;
  // allSettings.whitelist is already up-to-date from its render functions

  await setStorage({ settings: allSettings });
  
  saveStatus.textContent = "Settings saved successfully!";
  setTimeout(() => { saveStatus.textContent = ""; }, 3000);
}

// --- Initialization ---
async function init() {
  // Load initial data
  const { settings, suspendedTabs } = await getStorage(["settings", "suspendedTabs"]);
  allSettings = settings || {};
  allSuspendedTabs = suspendedTabs || [];
  
  // Init Search
  filterAndRenderList();
  
  // Init Settings
  loadSettings();

  // --- Add Event Listeners ---
  
  // Search
  searchInput.addEventListener("input", filterAndRenderList);
  
  unsuspendSelectedBtn.addEventListener("click", async () => {
    const urls = getSelectedUrls();
    for (const url of urls) {
      chrome.tabs.create({ url: url, active: false });
      allSuspendedTabs = allSuspendedTabs.filter(t => t.url !== url);
    }
    await setStorage({ suspendedTabs: allSuspendedTabs });
    filterAndRenderList();
  });
  
  closeSelectedBtn.addEventListener("click", async () => {
    const urls = getSelectedUrls();
    allSuspendedTabs = allSuspendedTabs.filter(t => !urls.includes(t.url));
    await setStorage({ suspendedTabs: allSuspendedTabs });
    filterAndRenderList();
  });

  // Settings
  saveButton.addEventListener("click", saveSettings);
  whitelistAddBtn.addEventListener("click", addWhitelistItem);
  whitelistInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addWhitelistItem();
  });
}

document.addEventListener("DOMContentLoaded", init);