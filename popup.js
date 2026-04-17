// YouTube Focus Timer - Popup Script

const SHAME_SENTENCE = 'I am choosing distraction over my goals right now.';
const FRICTION_WAIT_SECONDS = 30;

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
  const focusModeEnabled = data.focusModeEnabled || false;
  const focusModeEndTime = data.focusModeEndTime || null;
  
  // --- Focus Mode UI ---
  const focusCard = document.getElementById('focusCard');
  const focusBadge = document.getElementById('focusBadge');
  const focusActivate = document.getElementById('focusActivate');
  const focusActive = document.getElementById('focusActive');
  const focusCountdown = document.getElementById('focusCountdown');
  
  if (focusModeEnabled) {
    focusCard.classList.add('active');
    focusBadge.textContent = 'ON';
    focusBadge.classList.add('on');
    focusActivate.style.display = 'none';
    focusActive.style.display = 'block';
    
    // Update countdown
    if (focusModeEndTime) {
      const remaining = Math.max(0, focusModeEndTime - Date.now());
      if (remaining <= 0) {
        focusCountdown.textContent = 'Ending...';
      } else {
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        
        if (hours > 0) {
          focusCountdown.textContent = `${hours}h ${mins}m ${secs}s remaining`;
        } else if (mins > 0) {
          focusCountdown.textContent = `${mins}m ${secs}s remaining`;
        } else {
          focusCountdown.textContent = `${secs}s remaining`;
        }
      }
    } else {
      focusCountdown.textContent = 'Active — no timer set';
    }
  } else {
    focusCard.classList.remove('active');
    focusBadge.textContent = 'OFF';
    focusBadge.classList.remove('on');
    focusActivate.style.display = 'block';
    focusActive.style.display = 'none';
  }
  
  // --- Existing Timer UI ---
  
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
  
  // --- Focus Mode ---
  
  // Start Focus Mode
  document.getElementById('focusStartBtn').addEventListener('click', async () => {
    const durationInput = document.getElementById('focusDuration');
    const durationMinutes = Math.max(0, parseInt(durationInput.value) || 0);
    
    await chrome.runtime.sendMessage({
      action: 'toggleFocusMode',
      durationMinutes
    });
    
    loadState();
  });
  
  // Stop Focus Mode (triggers friction)
  document.getElementById('focusStopBtn').addEventListener('click', () => {
    showFrictionModal();
  });
  
  // --- Friction Modal ---
  setupFrictionListeners();
}

// --- Friction Modal Logic (Option C: 30s wait + shame sentence) ---

let frictionTimerInterval = null;

function showFrictionModal() {
  const overlay = document.getElementById('frictionOverlay');
  const phase1 = document.getElementById('frictionPhase1');
  const phase2 = document.getElementById('frictionPhase2');
  const timerEl = document.getElementById('frictionTimer');
  
  // Reset state
  overlay.style.display = 'flex';
  phase1.style.display = 'block';
  phase2.style.display = 'none';
  
  // Start the 30-second countdown
  let remaining = FRICTION_WAIT_SECONDS;
  timerEl.textContent = remaining;
  
  if (frictionTimerInterval) clearInterval(frictionTimerInterval);
  
  frictionTimerInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = remaining;
    
    if (remaining <= 0) {
      clearInterval(frictionTimerInterval);
      frictionTimerInterval = null;
      
      // Move to Phase 2
      phase1.style.display = 'none';
      phase2.style.display = 'block';
      
      // Reset the input
      const input = document.getElementById('frictionInput');
      input.value = '';
      document.getElementById('frictionConfirm').disabled = true;
      document.getElementById('frictionMatch').textContent = '';
      
      // Focus the input
      input.focus();
    }
  }, 1000);
}

function hideFrictionModal() {
  const overlay = document.getElementById('frictionOverlay');
  overlay.style.display = 'none';
  
  if (frictionTimerInterval) {
    clearInterval(frictionTimerInterval);
    frictionTimerInterval = null;
  }
}

function setupFrictionListeners() {
  // Cancel buttons (both phases)
  document.getElementById('frictionCancel1').addEventListener('click', hideFrictionModal);
  document.getElementById('frictionCancel2').addEventListener('click', hideFrictionModal);
  
  // Shame sentence input
  const frictionInput = document.getElementById('frictionInput');
  const frictionConfirm = document.getElementById('frictionConfirm');
  const frictionMatch = document.getElementById('frictionMatch');
  
  // Block paste
  frictionInput.addEventListener('paste', (e) => {
    e.preventDefault();
  });
  
  // Block drag-and-drop text
  frictionInput.addEventListener('drop', (e) => {
    e.preventDefault();
  });
  
  // Check input match
  frictionInput.addEventListener('input', () => {
    const value = frictionInput.value;
    const target = SHAME_SENTENCE;
    
    if (value === target) {
      frictionConfirm.disabled = false;
      frictionMatch.textContent = '✓ Sentence matches';
      frictionMatch.className = 'friction-match match-success';
    } else if (target.startsWith(value)) {
      frictionConfirm.disabled = true;
      frictionMatch.textContent = `${value.length}/${target.length} characters`;
      frictionMatch.className = 'friction-match match-progress';
    } else {
      frictionConfirm.disabled = true;
      frictionMatch.textContent = '✗ Does not match — check your typing';
      frictionMatch.className = 'friction-match match-error';
    }
  });
  
  // Confirm disable
  frictionConfirm.addEventListener('click', async () => {
    if (frictionInput.value !== SHAME_SENTENCE) return;
    
    // Actually disable focus mode
    await chrome.runtime.sendMessage({ action: 'forceDisableFocusMode' });
    hideFrictionModal();
    loadState();
  });
}

async function notifyTabs() {
  const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {});
  });
}
