// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with default values
  chrome.storage.local.get(['comments', 'interval'], function(result) {
    if (!result.comments) {
      chrome.storage.local.set({ comments: '' });
    }
    if (!result.interval) {
      chrome.storage.local.set({ interval: '5' });
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    // Forward status updates to popup if it's open
    chrome.runtime.sendMessage(request);
  }
}); 