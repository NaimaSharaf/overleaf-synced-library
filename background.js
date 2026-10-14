chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(console.error);

// Right-click the extension icon → Open Paper City (it lives in paper-city/ inside this extension)
chrome.runtime.onInstalled.addListener(()=>chrome.contextMenus.removeAll(()=>chrome.contextMenus.create({id:'open-paper-city',title:'Open Paper City',contexts:['action']})));
chrome.contextMenus.onClicked.addListener(info=>{if(info.menuItemId==='open-paper-city')chrome.tabs.create({url:chrome.runtime.getURL('paper-city/city.html')});});
