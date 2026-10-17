/* Faceless Studio — Vibes AI Generator
 * Background Service Worker
 */
"use strict";

// Enable side panel to open when user clicks the extension action icon
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  ?.catch((err) => console.error("[Vibes-Background] setPanelBehavior error:", err));

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Vibes-Background] Faceless Studio — Vibes AI Generator installed.");
});

// Relay messages between sidepanel and content script if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ status: "ok" });
    return true;
  }

  // Handle downloads initiated by sidepanel or adapter
  if (message.action === "downloadUrl" && message.url) {
    chrome.downloads.download(
      {
        url: message.url,
        filename: message.filename || "vibes-media.mp4",
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );
    return true; // Keep message channel open for async response
  }
});
