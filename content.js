// Content script for YouTube Focus Timer

(function() {
  'use strict';

  // Flag to track if extension context is still valid
  let extensionValid = true;

  let state = {
    homeFeedTime: 0,
    shortsTime: 0,
    homeFeedLimit: 300,
    shortsLimit: 300,
    homeFeedEnabled: true,
    shortsEnabled: true,
    homeFeedBlocked: false,
    shortsBlocked: false,
    focusModeEnabled: false
  };

  let timerInterval = null;
  let currentPage = null; // 'home', 'shorts', or null
  let isPageVisible = true;

  // Safe wrapper for chrome.runtime.sendMessage
  async function safeSendMessage(message) {
    if (!extensionValid) return null;
    
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (e) {
      // Extension context invalidated
      extensionValid = false;
      cleanup();
      return null;
    }
  }

  // Cleanup function when extension is invalidated
  function cleanup() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    console.log('YouTube Focus Timer: Extension context invalidated, cleaned up');
  }

  // Initialize
  async function init() {
    if (!extensionValid) return;
    
    await loadState();
    detectPage();
    setupVisibilityHandler();
    setupNavigationObserver();
    startTimer();
    applyBlocking();
  }

  // Load state from storage
  async function loadState() {
    const data = await safeSendMessage({ action: 'getState' });
    if (data) {
      state = { ...state, ...data };
      state.homeFeedBlocked = state.homeFeedEnabled && state.homeFeedTime >= state.homeFeedLimit;
      state.shortsBlocked = state.shortsEnabled && state.shortsTime >= state.shortsLimit;
      state.focusModeEnabled = data.focusModeEnabled || false;
    }
  }

  // Detect current page type
  function detectPage() {
    const path = window.location.pathname;
    
    if (path === '/') {
      currentPage = 'home';
    } else if (path.startsWith('/shorts')) {
      currentPage = 'shorts';
    } else {
      currentPage = null;
    }
    
    return currentPage;
  }

  // Handle page visibility changes
  function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden;
    });
  }

  // Observe YouTube SPA navigation
  function setupNavigationObserver() {
    // YouTube fires this event on navigation
    window.addEventListener('yt-navigate-finish', () => {
      if (!extensionValid) return;
      detectPage();
      applyBlocking();
    });

    // Also handle popstate for back/forward navigation
    window.addEventListener('popstate', () => {
      if (!extensionValid) return;
      setTimeout(() => {
        detectPage();
        applyBlocking();
      }, 100);
    });

    // Watch for URL changes as fallback
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (!extensionValid) {
        urlObserver.disconnect();
        return;
      }
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        detectPage();
        applyBlocking();
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Timer that runs every second
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(async () => {
      if (!extensionValid) {
        cleanup();
        return;
      }
      
      if (!isPageVisible) return;
      
      // Only count time on active pages
      if (currentPage === 'home' && state.homeFeedEnabled && !state.homeFeedBlocked) {
        state.homeFeedTime += 1;
        await safeSendMessage({ action: 'updateTime', type: 'homeFeed', delta: 1 });
        
        if (state.homeFeedTime >= state.homeFeedLimit) {
          state.homeFeedBlocked = true;
          applyBlocking();
        }
      } else if (currentPage === 'shorts' && state.shortsEnabled && !state.shortsBlocked) {
        state.shortsTime += 1;
        await safeSendMessage({ action: 'updateTime', type: 'shorts', delta: 1 });
        
        if (state.shortsTime >= state.shortsLimit) {
          state.shortsBlocked = true;
          applyBlocking();
        }
      }
    }, 1000);
  }

  // Apply blocking based on state
  function applyBlocking() {
    if (!extensionValid) return;
    
    // Focus mode takes priority — immediately block home and shorts
    if (state.focusModeEnabled) {
      if (currentPage === 'home' || currentPage === 'shorts') {
        window.location.href = '/feed/subscriptions';
        return;
      }
    }
    
    // Check if home feed should be blocked (daily timer)
    if (state.homeFeedBlocked && currentPage === 'home') {
      // Redirect to subscriptions
      window.location.href = '/feed/subscriptions';
      return;
    }
    
    // Check if shorts should be blocked (daily timer)
    if (state.shortsBlocked && currentPage === 'shorts') {
      // Redirect to subscriptions
      window.location.href = '/feed/subscriptions';
      return;
    }
    
    // Hide/show navigation elements
    hideNavigationElements();
  }

  // Hide navigation elements for blocked sections
  function hideNavigationElements() {
    const style = document.getElementById('yt-focus-timer-styles');
    
    let css = '';
    
    // When focus mode is on, hide both Home and Shorts nav
    const hideHome = state.homeFeedBlocked || state.focusModeEnabled;
    const hideShorts = state.shortsBlocked || state.focusModeEnabled;
    
    if (hideHome) {
      css += `
        /* Hide Home in sidebar */
        ytd-guide-entry-renderer:has(a[href="/"]),
        ytd-mini-guide-entry-renderer:has(a[href="/"]),
        /* Hide Home chip on top */
        yt-chip-cloud-chip-renderer[chip-style="STYLE_HOME_FILTER"] {
          display: none !important;
        }
      `;
    }
    
    if (hideShorts) {
      css += `
        /* Hide Shorts in sidebar */
        ytd-guide-entry-renderer:has(a[href="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href="/shorts"]),
        /* Hide Shorts shelf on any page */
        ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer[is-shorts],
        /* Hide Shorts section */
        ytd-rich-section-renderer:has([is-shorts]) {
          display: none !important;
        }
      `;
    }
    
    if (style) {
      style.textContent = css;
    } else {
      const newStyle = document.createElement('style');
      newStyle.id = 'yt-focus-timer-styles';
      newStyle.textContent = css;
      document.head.appendChild(newStyle);
    }
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!extensionValid) return;
    
    try {
      if (message.action === 'timersReset') {
        // Reload state and remove blocks
        state.homeFeedTime = 0;
        state.shortsTime = 0;
        state.homeFeedBlocked = false;
        state.shortsBlocked = false;
        hideNavigationElements();
        sendResponse({ success: true });
      }
      
      if (message.action === 'settingsUpdated') {
        loadState().then(() => {
          applyBlocking();
        });
        sendResponse({ success: true });
      }
      
      if (message.action === 'focusModeChanged') {
        state.focusModeEnabled = message.enabled;
        applyBlocking();
        sendResponse({ success: true });
      }
    } catch (e) {
      extensionValid = false;
      cleanup();
    }
    
    return true;
  });

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
