// Focus Block - Content script for x.com / twitter.com
// Injected at document_start for immediate blocking

(function() {
  'use strict';

  let extensionValid = true;
  let overlayShown = false;

  // Check focus mode state and block if needed
  async function checkFocusMode() {
    if (!extensionValid) return;

    try {
      const data = await chrome.storage.sync.get(['focusModeEnabled', 'focusModeEndTime']);
      
      if (data.focusModeEnabled) {
        showBlockOverlay(data.focusModeEndTime);
      } else {
        removeBlockOverlay();
      }
    } catch (e) {
      extensionValid = false;
    }
  }

  // Show the full-screen block overlay
  function showBlockOverlay(endTime) {
    if (overlayShown) {
      // Just update the countdown if overlay already exists
      updateCountdown(endTime);
      return;
    }

    overlayShown = true;

    // Hide the actual page content
    const hideStyle = document.createElement('style');
    hideStyle.id = 'focus-block-hide';
    hideStyle.textContent = `
      body > *:not(#focus-block-overlay) {
        display: none !important;
      }
      body {
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(hideStyle);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'focus-block-overlay';
    overlay.innerHTML = `
      <div class="focus-block-container">
        <div class="focus-block-glow"></div>
        <div class="focus-block-icon">🎯</div>
        <h1 class="focus-block-title">Focus Mode Active</h1>
        <p class="focus-block-message">
          This site is blocked while you're in Focus Mode.<br>
          Stay focused — you've got this.
        </p>
        <div class="focus-block-countdown" id="focusBlockCountdown"></div>
        <div class="focus-block-quote">
          <p>"The successful warrior is the average man, with laser-like focus."</p>
          <span>— Bruce Lee</span>
        </div>
      </div>
    `;

    // Wait for body or append to documentElement
    function attachOverlay() {
      if (document.body) {
        document.body.appendChild(overlay);
        updateCountdown(endTime);
        startCountdownInterval(endTime);
      } else {
        // Body not ready yet, wait for it
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            bodyObserver.disconnect();
            document.body.appendChild(overlay);
            updateCountdown(endTime);
            startCountdownInterval(endTime);
          }
        });
        bodyObserver.observe(document.documentElement, { childList: true });
      }
    }

    attachOverlay();
  }

  let countdownInterval = null;

  function startCountdownInterval(endTime) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (!endTime) return;

    countdownInterval = setInterval(() => {
      updateCountdown(endTime);
    }, 1000);
  }

  function updateCountdown(endTime) {
    const el = document.getElementById('focusBlockCountdown');
    if (!el) return;

    if (!endTime) {
      el.textContent = 'Until you turn it off';
      return;
    }

    const remaining = Math.max(0, endTime - Date.now());
    if (remaining <= 0) {
      el.textContent = 'Focus mode ending...';
      if (countdownInterval) clearInterval(countdownInterval);
      // The background script alarm will handle deactivation
      return;
    }

    const hours = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);

    if (hours > 0) {
      el.textContent = `${hours}h ${mins}m ${secs}s remaining`;
    } else if (mins > 0) {
      el.textContent = `${mins}m ${secs}s remaining`;
    } else {
      el.textContent = `${secs}s remaining`;
    }
  }

  // Remove the block overlay
  function removeBlockOverlay() {
    if (!overlayShown) return;
    overlayShown = false;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const overlay = document.getElementById('focus-block-overlay');
    if (overlay) overlay.remove();

    const hideStyle = document.getElementById('focus-block-hide');
    if (hideStyle) hideStyle.remove();
  }

  // Listen for focus mode changes from background
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!extensionValid) return;

      if (message.action === 'focusModeChanged') {
        if (message.enabled) {
          checkFocusMode();
        } else {
          removeBlockOverlay();
        }
        sendResponse({ success: true });
      }
      return true;
    });
  } catch (e) {
    extensionValid = false;
  }

  // Check immediately
  checkFocusMode();

  // Also check when DOM is ready (in case storage wasn't ready at document_start)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkFocusMode);
  }
})();
