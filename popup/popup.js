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

// --- Main Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  const pauseToggle = document.getElementById("pause-toggle");
  const suspendButton = document.getElementById("suspend-current");
  const whitelistButton = document.getElementById("whitelist-current");
  const domainText = document.getElementById("current-domain");
  const searchButton = document.getElementById("open-search");

  // --- NEW BUTTONS ---
  const suspendOthersButton = document.getElementById("suspend-others");
  const unsuspendAllButton = document.getElementById("unsuspend-all");
  // --- END NEW BUTTONS ---

  let currentTab = null;
  let currentDomain = "";

  // 1. Load current settings
  const { settings } = await getStorage(["settings"]);
  if (settings) {
    pauseToggle.checked = settings.isPaused;
  }
  
  // 2. Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  if (currentTab && currentTab.url && currentTab.url.startsWith("http")) {
    currentDomain = new URL(currentTab.url).hostname;
    domainText.textContent = currentDomain;
    domainText.title = currentDomain;
  } else {
    domainText.textContent = "(no active web page)";
    whitelistButton.disabled = true;
    suspendButton.disabled = true;
    suspendOthersButton.disabled = true; // Disable if not on a real page
  }

  // 3. Add Event Listeners

  // Pause Toggle
  pauseToggle.addEventListener("change", async () => {
    const { settings } = await getStorage(["settings"]);
    const newSettings = { ...settings, isPaused: pauseToggle.checked };
    await setStorage({ settings: newSettings });
    console.log("Pause state set to:", pauseToggle.checked);
  });
  
  // Suspend Current Tab
  suspendButton.addEventListener("click", async () => {
    if (currentTab) {
      // This is complex. We'll send a message to the background script
      // to ask it to perform the suspend logic on our tab.
      chrome.runtime.sendMessage(
        { action: "suspendTabManually", tab: currentTab },
        () => window.close() // Close popup after action
      );
    }
  });

  // Whitelist Current
  whitelistButton.addEventListener("click", async () => {
    if (currentDomain) {
      const { settings } = await getStorage(["settings"]);
      const newWhitelist = [...settings.whitelist, currentDomain];
      // Remove duplicates
      const uniqueWhitelist = [...new Set(newWhitelist)];
      await setStorage({ settings: { ...settings, whitelist: uniqueWhitelist } });
      
      whitelistButton.textContent = "Whitelisted!";
      whitelistButton.disabled = true;
    }
  });

  // Suspend Other Tabs
  suspendOthersButton.addEventListener("click", () => {
    if (currentTab) {
      chrome.runtime.sendMessage(
        { action: "suspendOtherTabs", tab: currentTab },
        () => window.close()
      );
    }
  });

  // Unsuspend All Tabs
  unsuspendAllButton.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      { action: "unsuspendAllTabs" },
      () => window.close()
    );
  });

  // Open Search Page
  searchButton.addEventListener("click", () => {
    const searchUrl = chrome.runtime.getURL("search/search.html");
    chrome.tabs.create({ url: searchUrl });
    window.close(); // Close popup
  });
});

// --- Add a listener in background.js for the manual suspend ---
// You MUST add this to your background.js file for the button to work:
/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "suspendTabManually" && request.tab) {
    console.log("Manual suspend request received");
    // We wrap this in an async IIFE to handle the promise
    (async () => {
      await suspendTab(request.tab);
      sendResponse({ success: true });
    })();
    return true; // Indicates async response
  }
});
*/