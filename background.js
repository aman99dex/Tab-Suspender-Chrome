// --- Constants ---
const DEFAULT_SUSPEND_TIME = 15; // in minutes
const TIMER_NAME = "suspendTimer";

// --- Utility Functions for Storage ---
// (Using wrappers for easier async/await)

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

// --- Initialization ---
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Tab Suspender Installed.");

  // Set default settings on first install
  const { settings } = await getStorage(["settings"]);
  if (!settings) {
    await setStorage({
      settings: {
        suspendTime: DEFAULT_SUSPEND_TIME,
        isPaused: false,
        whitelist: ["github.com", "drive.google.com"],
        aiApiKey: null
      },
      suspendedTabs: []
    });
  }

  // Create the main timer (alarm)
  createSuspensionAlarm();
});

function createSuspensionAlarm() {
  chrome.alarms.get(TIMER_NAME, (alarm) => {
    if (!alarm) {
      console.log("Creating suspension alarm...");
      chrome.alarms.create(TIMER_NAME, {
        delayInMinutes: 1, // Check every 1 minute
        periodInMinutes: 1 // Repeat every 1 minute
      });
    }
  });
}

// --- Main Timer Logic ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TIMER_NAME) {
    console.log("Alarm triggered: Checking tabs for suspension...");
    const { settings } = await getStorage(["settings"]);

    if (settings.isPaused) {
      console.log("Suspension is paused. Skipping check.");
      return;
    }

    await checkAndSuspendTabs(settings);
  }
});

// --- Core Suspension Logic ---
async function checkAndSuspendTabs(settings) {
  const { suspendTime, whitelist } = settings;
  const { suspendedTabs } = await getStorage(["suspendedTabs"]);
  const tabs = await chrome.tabs.query({
    autoDiscardable: true, // Only get tabs that *can* be suspended
    windowType: "normal"
  });

  const now = Date.now();
  const suspendMillis = suspendTime * 60 * 1000;
  const suspendedUrls = new Set(suspendedTabs.map(t => t.url));

  for (const tab of tabs) {
    // 1. Skip if already suspended or not a web page
    if (suspendedUrls.has(tab.url) || !tab.url.startsWith("http")) {
      continue;
    }

    // 2. Apply Smart Rules
    if (tab.active || tab.pinned || tab.audible) {
      continue;
    }

    // 3. Check Whitelist
    if (isWhitelisted(tab.url, whitelist)) {
      continue;
    }
    
    // 4. Check for form input (Smart Rule)
    const hasFormInput = await checkForFormInput(tab.id);
    if (hasFormInput) {
      console.log(`Skipping tab ${tab.id} (form input detected)`);
      continue;
    }

    // 5. Check Inactive Time
    const { tabsMeta } = await getStorage(["tabsMeta"]);
    const lastAccessed = tabsMeta?.[tab.id]?.lastAccessed || now;
    
    if (now - lastAccessed > suspendMillis) {
      console.log(`Suspending tab ${tab.id}: ${tab.title}`);
      await suspendTab(tab);
    }
  }
}

// --- Helper Functions ---

function isWhitelisted(url, whitelist) {
  if (!url) return false;
  const tabUrl = new URL(url);
  
  for (const pattern of whitelist) {
    try {
      // Try to treat it as a Regex
      if (pattern.startsWith("/") && pattern.endsWith("/")) {
        const regex = new RegExp(pattern.slice(1, -1));
        if (regex.test(url)) return true;
      }
      // Treat as a domain/hostname
      if (tabUrl.hostname.includes(pattern)) {
        return true;
      }
    } catch (e) {
      console.warn("Invalid regex in whitelist:", pattern);
    }
  }
  return false;
}

async function checkForFormInput(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        let hasInput = false;
        document.querySelectorAll('input, textarea').forEach(el => {
          if (el.type === 'password' && el.value.length > 0) hasInput = true;
          if (!el.readOnly && el.type !== 'hidden' && el.value.length > 0) hasInput = true;
        });
        return hasInput;
      }
    });
    return results[0]?.result || false;
  } catch (e) {
    // This can fail on "chrome://" pages, which is fine.
    return false;
  }
}

async function suspendTab(tab) {
  // TODO: Add optional AI Summary logic here
  // 1. Get settings.aiApiKey
  // 2. If present, executeScript to get page content
  // 3. await fetch() to AI API
  // 4. Get summary text
  const summary = "AI Summary feature is not yet implemented.";

  const { suspendedTabs } = await getStorage(["suspendedTabs"]);
  const newSuspendedTab = {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    faviconUrl: tab.faviconUrl || null,
    summary: summary,
    suspendedAt: Date.now()
  };

  // Add to our list
  const newSuspendedList = [...suspendedTabs, newSuspendedTab];
  await setStorage({ suspendedTabs: newSuspendedList });

  // Get the URL for our suspended page
  const suspendedPageUrl = chrome.runtime.getURL("suspended/suspended.html");

  // Redirect the tab
  try {
    await chrome.tabs.update(tab.id, {
      url: `${suspendedPageUrl}?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title)}&fav=${encodeURIComponent(tab.faviconUrl || '')}&sum=${encodeURIComponent(summary)}`
    });
  } catch (e) {
    console.error("Failed to update tab:", e);
    // Tab might have been closed. Remove from list.
    await setStorage({ 
      suspendedTabs: suspendedTabs.filter(t => t.id !== tab.id) 
    });
  }
}

// --- Event Listeners ---

// Update last accessed time when a tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabsMeta } = await getStorage(["tabsMeta"]);
  const newMeta = { ...tabsMeta, [activeInfo.tabId]: { lastAccessed: Date.now() } };
  await setStorage({ tabsMeta: newMeta });
});

// // Handle unsuspend-on-reload
// chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
//   const suspendedPageUrl = chrome.runtime.getURL("suspended/suspended.html");

//   // Check if navigating to our suspended page AND it was a reload
//   if (details.url.startsWith(suspendedPageUrl) && details.type === "reload") {
    
//     // 1. Get the original URL from the parameters
//     const urlParams = new URL(details.url).searchParams;
//     const originalUrl = urlParams.get("url");

//     if (originalUrl) {
//       // --- THIS IS THE FIX ---
      
//       // 2. FIRST: Remove the tab from our storage list
//       // We do this before navigating to prevent a race condition.
//       const { suspendedTabs } = await getStorage(["suspendedTabs"]);
//       const newSuspendedList = suspendedTabs.filter(t => t.url !== originalUrl);
//       await setStorage({ suspendedTabs: newSuspendedList });

//       // 3. LAST: Navigate the tab back to its original URL
//       // This will replace the current "suspended.html" page
//       await chrome.tabs.update(details.tabId, { url: originalUrl });
//     }
//   }
// });

// Handle suspended tab being closed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const { suspendedTabs, tabsMeta } = await getStorage(["suspendedTabs", "tabsMeta"]);
  
  // Remove from metadata
  if (tabsMeta?.[tabId]) {
    delete tabsMeta[tabId];
    await setStorage({ tabsMeta });
  }

  // Remove from suspended list
  const tabWasSuspended = suspendedTabs.some(t => t.id === tabId);
  if (tabWasSuspended) {
    const newSuspendedList = suspendedTabs.filter(t => t.id !== tabId);
    await setStorage({ suspendedTabs: newSuspendedList });
    console.log(`Removed closed suspended tab (ID: ${tabId}) from list.`);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "suspendTabManually" && request.tab) {
    console.log("Manual suspend request received for:", request.tab.title);
    (async () => {
      await suspendTab(request.tab);
      sendResponse({ success: true });
    })();
    return true; // Indicates async response

  // --- NEW LOGIC STARTS HERE ---
  
  } else if (request.action === "suspendOtherTabs" && request.tab) {
    console.log("Suspending all other tabs...");
    (async () => {
      const currentTabId = request.tab.id;
      const allTabs = await chrome.tabs.query({ windowType: "normal" });
      
      for (const tab of allTabs) {
        // Only suspend http tabs that are NOT the current one
        if (tab.id !== currentTabId && tab.url.startsWith("http")) {
          //let them suspend in parallel
          suspendTab(tab); 
        }
      }
      sendResponse({ success: true });
    })();
    return true;

  } else if (request.action === "unsuspendAllTabs") {
    console.log("Reloading all suspended tabs...");
    (async () => {
      const suspendedPageUrl = chrome.runtime.getURL("suspended/suspended.html") + "*";
      const suspendedTabs = await chrome.tabs.query({ url: suspendedPageUrl });
      if (suspendedTabs && suspendedTabs.length > 0) {
        for (const tab of suspendedTabs) {
          chrome.tabs.reload(tab.id);
        }
      }
      sendResponse({ success: true });
    })();
    console.log("All suspended tabs reloaded...");
    return true;
  }
});