// Background service worker for YouTube Focus Timer

// Default settings
const DEFAULT_SETTINGS = {
  homeFeedTime: 0,
  shortsTime: 0,
  homeFeedLimit: 300, // 5 minutes in seconds
  shortsLimit: 300,   // 5 minutes in seconds
  homeFeedEnabled: true,
  shortsEnabled: true,
  lastResetDate: new Date().toDateString()
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(null);
  if (!existing.homeFeedLimit) {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
});

// Check for midnight reset on startup and periodically
async function checkMidnightReset() {
  const data = await chrome.storage.sync.get(['lastResetDate']);
  const today = new Date().toDateString();
  
  if (data.lastResetDate !== today) {
    // Reset timers at midnight
    await chrome.storage.sync.set({
      homeFeedTime: 0,
      shortsTime: 0,
      lastResetDate: today
    });
    
    // Notify all YouTube tabs to refresh their state
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'timersReset' }).catch(() => {});
    });
  }
}

// Check on startup
checkMidnightReset();

// Check periodically (every minute)
setInterval(checkMidnightReset, 60000);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getState') {
    chrome.storage.sync.get(null).then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'updateTime') {
    chrome.storage.sync.get(null).then(async (data) => {
      const updates = {};
      if (message.type === 'homeFeed') {
        updates.homeFeedTime = (data.homeFeedTime || 0) + message.delta;
      } else if (message.type === 'shorts') {
        updates.shortsTime = (data.shortsTime || 0) + message.delta;
      }
      await chrome.storage.sync.set(updates);
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'resetTimer') {
    chrome.storage.sync.get(null).then(async (data) => {
      const updates = {};
      if (message.type === 'homeFeed') {
        updates.homeFeedTime = 0;
      } else if (message.type === 'shorts') {
        updates.shortsTime = 0;
      } else if (message.type === 'all') {
        updates.homeFeedTime = 0;
        updates.shortsTime = 0;
      }
      await chrome.storage.sync.set(updates);
      
      // Notify all YouTube tabs
      const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'timersReset' }).catch(() => {});
      });
      
      sendResponse({ success: true });
    });
    return true;
  }
});

