// Background service worker for YouTube Focus Timer

// Default settings
const DEFAULT_SETTINGS = {
  homeFeedTime: 0,
  shortsTime: 0,
  homeFeedLimit: 300, // 5 minutes in seconds
  shortsLimit: 300,   // 5 minutes in seconds
  homeFeedEnabled: true,
  shortsEnabled: true,
  lastResetDate: new Date().toDateString(),
  focusModeEnabled: false,
  focusModeEndTime: null
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(null);
  if (!existing.homeFeedLimit) {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  } else {
    // Ensure focus mode fields exist for existing installs
    const updates = {};
    if (existing.focusModeEnabled === undefined) updates.focusModeEnabled = false;
    if (existing.focusModeEndTime === undefined) updates.focusModeEndTime = null;
    if (Object.keys(updates).length > 0) {
      await chrome.storage.sync.set(updates);
    }
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

// --- Focus Mode Alarm ---

// Check if focus mode has expired
async function checkFocusModeExpiry() {
  const data = await chrome.storage.sync.get(['focusModeEnabled', 'focusModeEndTime']);
  
  if (data.focusModeEnabled && data.focusModeEndTime && Date.now() >= data.focusModeEndTime) {
    await deactivateFocusMode();
  }
}

// Deactivate focus mode and notify all tabs
async function deactivateFocusMode() {
  await chrome.storage.sync.set({
    focusModeEnabled: false,
    focusModeEndTime: null
  });
  
  // Clear the alarm
  await chrome.alarms.clear('focusModeExpiry');
  
  // Notify all relevant tabs
  await broadcastFocusModeChanged(false);
}

// Activate focus mode
async function activateFocusMode(durationMinutes) {
  const updates = {
    focusModeEnabled: true,
    focusModeEndTime: null
  };
  
  if (durationMinutes && durationMinutes > 0) {
    updates.focusModeEndTime = Date.now() + (durationMinutes * 60 * 1000);
    
    // Set a chrome alarm for reliable expiry
    await chrome.alarms.create('focusModeExpiry', {
      when: updates.focusModeEndTime
    });
  }
  
  await chrome.storage.sync.set(updates);
  await broadcastFocusModeChanged(true);
}

// Broadcast focus mode state change to all relevant tabs
async function broadcastFocusModeChanged(enabled) {
  const message = { action: 'focusModeChanged', enabled };
  
  // Notify YouTube tabs
  const ytTabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  ytTabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  });
  
  // Notify x.com / twitter.com tabs
  const xTabs = await chrome.tabs.query({ url: '*://*.x.com/*' });
  const twitterTabs = await chrome.tabs.query({ url: '*://*.twitter.com/*' });
  const xTabsDirect = await chrome.tabs.query({ url: '*://x.com/*' });
  const twitterTabsDirect = await chrome.tabs.query({ url: '*://twitter.com/*' });
  
  [...xTabs, ...twitterTabs, ...xTabsDirect, ...twitterTabsDirect].forEach(tab => {
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  });
}

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusModeExpiry') {
    deactivateFocusMode();
  }
});

// Also check periodically in case alarm was missed
setInterval(checkFocusModeExpiry, 5000);

// Listen for messages from content script / popup
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
  
  if (message.action === 'toggleFocusMode') {
    (async () => {
      const data = await chrome.storage.sync.get(['focusModeEnabled']);
      
      if (data.focusModeEnabled) {
        // Turning OFF
        await deactivateFocusMode();
      } else {
        // Turning ON with optional duration
        await activateFocusMode(message.durationMinutes || 0);
      }
      
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (message.action === 'forceDisableFocusMode') {
    // Called after the user completes the friction challenge
    (async () => {
      await deactivateFocusMode();
      sendResponse({ success: true });
    })();
    return true;
  }
});
