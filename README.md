# YouTube Focus Timer

A Chrome extension that helps you manage your YouTube screen time by automatically hiding the home feed and Shorts after a configurable time limit.

## Features

- ⏱️ **Timer for Home Feed** - Set a daily time limit for browsing YouTube's home page
- 📱 **Timer for Shorts** - Set a separate time limit for YouTube Shorts
- 🚫 **Auto-redirect** - When time is up, automatically redirects to Subscriptions page
- 🔒 **Navigation Hiding** - Removes Home/Shorts navigation buttons when blocked
- 🌙 **Midnight Reset** - Timers automatically reset every day at midnight
- ⚙️ **Configurable** - Adjust time limits from the popup or settings page
- 💾 **Persistent** - Time accumulates across browsing sessions

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `youtube-home-feed-hide-extension` folder
6. The extension icon should appear in your toolbar

## Usage

1. **Click the extension icon** to see your current timer status
2. **Toggle features** on/off using the switches
3. **Reset timers** using the "Reset All Timers" button
4. **Adjust time limits** by clicking "Settings"

### How It Works

- The timer only runs when you're actively viewing the specific page (Home or Shorts)
- Switching to another tab pauses the timer
- When your time limit is reached:
  - You'll be redirected to your Subscriptions page
  - The Home/Shorts navigation will be hidden
  - You won't be able to access that section until the next day

## Default Settings

- Home Feed: 5 minutes
- Shorts: 5 minutes
- Reset: Daily at midnight

## Privacy

This extension:
- ✅ Works entirely locally
- ✅ Does not collect any data
- ✅ Does not make any network requests
- ✅ Only accesses youtube.com

## Development

### Project Structure

```
youtube-home-feed-hide-extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for background tasks
├── content.js         # Content script for YouTube pages
├── content.css        # Base styles for content script
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── popup.css          # Popup styles
├── options.html       # Settings page
├── options.js         # Settings logic
├── options.css        # Settings styles
├── icons/             # Extension icons
└── README.md          # This file
```

## License

MIT License - Feel free to use and modify!
