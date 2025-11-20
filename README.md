# Lightweight Tab Suspender

A lightweight Chrome extension that automatically suspends inactive tabs to free up memory and improve browser performance.

## 🎯 Features

- **Auto-Suspend Inactive Tabs** — Automatically suspends tabs after a configurable idle period (default: 15 minutes)
- **Smart Rules** — Preserves active, pinned, and audible tabs; detects unsaved form input
- **Whitelist Support** — Prevent specific domains from being suspended (e.g., `github.com`, regex patterns supported)
- **Search Dashboard** — Find and manage suspended tabs with a searchable interface
- **Bulk Actions** — Unsuspend or close multiple tabs at once
- **One-Click Controls** — Suspend current/other tabs or unsuspend all from the popup
- **Dark Mode UI** — Tokyo Night color scheme for a modern, easy-on-the-eyes interface

## 📦 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked** and select the repository folder
5. The extension icon will appear in your toolbar

## 🚀 Usage

### Popup Menu
Click the extension icon to access quick controls:

- **Suspend Current Tab** — Manually suspend the active tab
- **Suspend Other Tabs** — Suspend all tabs except the current one
- **Unsuspend All Tabs** — Restore all suspended tabs at once
- **Pause Suspension** — Toggle automatic suspension on/off
- **Whitelist Current Site** — Prevent this domain from auto-suspending
- **Search Suspended Tabs** — Open the management dashboard

### Search Dashboard
Click "Search Suspended Tabs" or navigate directly to the dashboard.

**Search Panel:**
- Search suspended tabs by title, domain, or URL
- Click a tab entry to unsuspend it and open in a new tab
- Click the ✕ button to permanently remove it from the suspended list
- Use checkboxes for bulk operations

**Settings Panel:**
- **Suspend Time** — Configure idle duration before suspension (minutes)
- **AI Summary API Key** — Optional API key for page summarization (placeholder)
- **Whitelist Management** — Add domains or regex patterns to exclude from suspension

### Suspended Tab Page
When a tab is suspended, you'll see:
- Original page title and favicon
- Original URL displayed for reference
- Page summary (if available)
- Click anywhere to unsuspend, or reload the page to auto-unsuspend

## ⚙️ Configuration

### Settings Storage

All settings and suspended tab data are stored locally in `chrome.storage.local`:

```javascript
{
  settings: {
    suspendTime: 15,              // Minutes before suspension
    isPaused: false,              // Pause/resume suspension
    whitelist: [                  // Domains/regex to exclude
      "github.com",
      "drive.google.com",
      "/dev\.local/"              // Regex patterns supported
    ],
    aiApiKey: null                // Optional AI service key
  },
  suspendedTabs: [                // Array of suspended tab objects
    {
      id: 123,
      url: "https://example.com",
      title: "Example",
      faviconUrl: "...",
      summary: "...",
      suspendedAt: 1234567890
    }
  ],
  tabsMeta: {                     // Metadata for tracking activity
    123: { lastAccessed: 1234567890 }
  }
}
```
