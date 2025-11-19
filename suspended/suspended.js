// --- Storage Helpers (needed for cleanup) ---
async function getStorage(keys) {
  return new Promise((resolve) => {
    const storage = (typeof browser !== "undefined") ? browser.storage : chrome.storage;
    storage.local.get(keys, (result) => resolve(result));
  });
}

async function setStorage(items) {
  return new Promise((resolve) => {
    const storage = (typeof browser !== "undefined") ? browser.storage : chrome.storage;
    storage.local.set(items, () => resolve());
  });
}

// --- The Core Unsuspend Logic ---
async function unsuspend(originalUrl) {
  if (!originalUrl) {
    console.error("Cannot unsuspend: Original URL is missing.");
    return;
  }

  try {
    // 1. FIRST: Remove this tab from the suspended list in storage
    const { suspendedTabs } = await getStorage(["suspendedTabs"]);
    const newSuspendedList = (suspendedTabs || []).filter(t => t.url !== originalUrl);
    await setStorage({ suspendedTabs: newSuspendedList });

    // 2. LAST: Navigate and REPLACE the history entry
    window.location.replace(originalUrl);

  } catch (e) {
    console.error("Error during unsuspend:", e);
    // Fallback
    window.location.href = originalUrl;
  }
}

// --- Main Page Logic ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Get all the parameters from our own URL
  const params = new URLSearchParams(window.location.search);
  
  const title = params.get("title") || "Suspended Tab";
  const originalUrl = params.get("url"); // This is the most important part
  const faviconUrl = params.get("fav");
  const summary = params.get("sum") || "No summary available.";

  // 2. Populate the page with the suspended tab's info
  document.title = `(Suspended) ${title}`;
  document.getElementById("tab-title").textContent = title;
  document.getElementById("page-title").textContent = title;
  
  // Set favicons
  if (faviconUrl && faviconUrl !== "undefined") {
    document.getElementById("favicon").href = faviconUrl;
    document.getElementById("tab-favicon").src = faviconUrl;
    document.getElementById("tab-favicon").style.display = "inline-block";
  } else {
    document.getElementById("tab-favicon").style.display = "none";
  }
  
  // Set summary and URL placeholder
  document.getElementById("summary-content").textContent = summary;
  const urlPlaceholder = document.getElementById("original-url-text");
  if (urlPlaceholder) {
      urlPlaceholder.textContent = originalUrl || "Error: Original URL not found.";
  }

  // 3. Add the click-to-unsuspend listener
  document.body.addEventListener("click", () => {
    unsuspend(originalUrl);
  });


  // Check if this page was loaded via a reload
  // 'performance.navigation.type' is deprecated but simple.
  // A 'type' of 1 means 'reload'.
  if (performance.navigation.type === 1) {
    console.log("Page was reloaded, auto-unsuspending...");
    unsuspend(originalUrl);
  }
});