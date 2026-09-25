chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'toggle-widget' }).catch(() => {
    // No content script listening on this tab (e.g. chrome:// pages) — ignore.
  });
});
