document.addEventListener('DOMContentLoaded', function() {
  const commentsTextarea = document.getElementById('comments');
  const intervalInput = document.getElementById('interval');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');

  // Load saved data
  chrome.storage.local.get(['comments', 'interval'], function(result) {
    if (result.comments) commentsTextarea.value = result.comments;
    if (result.interval) intervalInput.value = result.interval;
  });

  // Save data when changed
  commentsTextarea.addEventListener('change', saveData);
  intervalInput.addEventListener('change', saveData);

  function saveData() {
    chrome.storage.local.set({
      comments: commentsTextarea.value,
      interval: intervalInput.value
    });
  }

  startBtn.addEventListener('click', async function() {
    const comments = commentsTextarea.value.split('\n').filter(comment => comment.trim());
    const interval = parseInt(intervalInput.value) * 1000; // Convert to milliseconds

    if (comments.length === 0) {
      alert('Please enter at least one comment');
      return;
    }

    if (interval < 1000) {
      alert('Interval must be at least 1 second');
      return;
    }

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'startPosting',
      comments: comments,
      interval: interval
    });

    // Update UI
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDiv.textContent = 'Status: Running';
    statusDiv.className = 'status running';
  });

  stopBtn.addEventListener('click', async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'stopPosting' });

    // Update UI
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusDiv.textContent = 'Status: Stopped';
    statusDiv.className = 'status stopped';
  });

  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'statusUpdate') {
      if (request.status === 'completed') {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusDiv.textContent = 'Status: Completed';
        statusDiv.className = 'status stopped';
      }
    }
  });
}); 