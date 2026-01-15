// YouTube Focus Timer - Popup Script

document.addEventListener('DOMContentLoaded', init);

function init() {
  loadState();
  setupEventListeners();
  
  // Refresh state periodically
  setInterval(loadState, 1000);
}

async function loadState() {
  try {
    const data = await chrome.storage.sync.get(null);
    updateUI(data);
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

function updateUI(data) {
  const homeFeedTime = data.homeFeedTime || 0;
  const shortsTime = data.shortsTime || 0;
  const homeFeedLimit = data.homeFeedLimit || 300;
  const shortsLimit = data.shortsLimit || 300;
  const homeFeedEnabled = data.homeFeedEnabled !== false;
  const shortsEnabled = data.shortsEnabled !== false;
  
  // Update home feed card
  document.getElementById('homeFeedTime').textContent = formatTime(homeFeedTime);
  document.getElementById('homeFeedLimit').textContent = formatTime(homeFeedLimit);
  document.getElementById('homeFeedToggle').checked = homeFeedEnabled;
  
  const homeFeedProgress = Math.min((homeFeedTime / homeFeedLimit) * 100, 100);
  document.getElementById('homeFeedProgress').style.width = homeFeedProgress + '%';
  
  const homeFeedCard = document.getElementById('homeFeedCard');
  const homeFeedStatus = document.getElementById('homeFeedStatus');
  
  homeFeedCard.classList.toggle('disabled', !homeFeedEnabled);
  homeFeedCard.classList.toggle('blocked', homeFeedEnabled && homeFeedTime >= homeFeedLimit);
  
  if (!homeFeedEnabled) {
    homeFeedStatus.textContent = 'Disabled';
    homeFeedStatus.className = 'timer-status';
  } else if (homeFeedTime >= homeFeedLimit) {
    homeFeedStatus.textContent = 'Blocked';
    homeFeedStatus.className = 'timer-status blocked';
  } else {
    homeFeedStatus.textContent = 'Active';
    homeFeedStatus.className = 'timer-status';
  }
  
  // Update shorts card
  document.getElementById('shortsTime').textContent = formatTime(shortsTime);
  document.getElementById('shortsLimit').textContent = formatTime(shortsLimit);
  document.getElementById('shortsToggle').checked = shortsEnabled;
  
  const shortsProgress = Math.min((shortsTime / shortsLimit) * 100, 100);
  document.getElementById('shortsProgress').style.width = shortsProgress + '%';
  
  const shortsCard = document.getElementById('shortsCard');
  const shortsStatus = document.getElementById('shortsStatus');
  
  shortsCard.classList.toggle('disabled', !shortsEnabled);
  shortsCard.classList.toggle('blocked', shortsEnabled && shortsTime >= shortsLimit);
  
  if (!shortsEnabled) {
    shortsStatus.textContent = 'Disabled';
    shortsStatus.className = 'timer-status';
  } else if (shortsTime >= shortsLimit) {
    shortsStatus.textContent = 'Blocked';
    shortsStatus.className = 'timer-status blocked';
  } else {
    shortsStatus.textContent = 'Active';
    shortsStatus.className = 'timer-status';
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setupEventListeners() {
  // Toggle handlers
  document.getElementById('homeFeedToggle').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ homeFeedEnabled: e.target.checked });
    notifyTabs();
  });
  
  document.getElementById('shortsToggle').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ shortsEnabled: e.target.checked });
    notifyTabs();
  });
  
  // Reset all button
  document.getElementById('resetAll').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'resetTimer', type: 'all' });
    loadState();
  });
  
  // Settings button
  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

async function notifyTabs() {
  const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {});
  });
}
