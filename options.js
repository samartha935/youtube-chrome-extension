// YouTube Focus Timer - Options Page Script

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  setupEventListeners();
}

async function loadSettings() {
  const data = await chrome.storage.sync.get(null);
  
  document.getElementById('homeFeedEnabled').checked = data.homeFeedEnabled !== false;
  document.getElementById('shortsEnabled').checked = data.shortsEnabled !== false;
  document.getElementById('homeFeedLimit').value = Math.floor((data.homeFeedLimit || 300) / 60);
  document.getElementById('shortsLimit').value = Math.floor((data.shortsLimit || 300) / 60);
}

function setupEventListeners() {
  // Toggle handlers
  document.getElementById('homeFeedEnabled').addEventListener('change', saveSettings);
  document.getElementById('shortsEnabled').addEventListener('change', saveSettings);
  
  // Number input handlers with debounce
  let debounceTimer;
  const debouncedSave = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveSettings, 500);
  };
  
  document.getElementById('homeFeedLimit').addEventListener('input', debouncedSave);
  document.getElementById('shortsLimit').addEventListener('input', debouncedSave);
  
  // Reset button
  document.getElementById('resetAll').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'resetTimer', type: 'all' });
    showStatus('All timers have been reset!');
  });
}

async function saveSettings() {
  const homeFeedEnabled = document.getElementById('homeFeedEnabled').checked;
  const shortsEnabled = document.getElementById('shortsEnabled').checked;
  const homeFeedLimit = Math.max(1, parseInt(document.getElementById('homeFeedLimit').value) || 5) * 60;
  const shortsLimit = Math.max(1, parseInt(document.getElementById('shortsLimit').value) || 5) * 60;
  
  await chrome.storage.sync.set({
    homeFeedEnabled,
    shortsEnabled,
    homeFeedLimit,
    shortsLimit
  });
  
  // Notify all YouTube tabs
  const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {});
  });
  
  showStatus('Settings saved!');
}

function showStatus(message) {
  const statusEl = document.getElementById('saveStatus');
  statusEl.textContent = message;
  setTimeout(() => {
    statusEl.textContent = '';
  }, 2000);
}
