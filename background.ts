// Background Service Worker - 키보드 단축키 및 사이드 패널 처리

// 확장 아이콘 클릭 시 사이드 패널 열기
chrome.action.onClicked.addListener((tab: any) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 단축키 명령 리스너
chrome.commands.onCommand.addListener((command: string) => {
  if (command === 'read-page') {
    // 현재 활성 탭에 메시지 전송
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_HTML' });
      }
    });
  }
});
