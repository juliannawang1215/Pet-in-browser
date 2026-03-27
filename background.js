chrome.action.onClicked.addListener((tab) => {
  console.log("Toolbar icon clicked in tab:", tab.id);
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "toggleSettings" }).then(() => {
        console.log("Message sent successfully");
    }).catch(e => {
        console.error("Failed to send message:", e.message);
    });
  }
});
