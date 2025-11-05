// Content Script - 단축키를 눌렀을 때 현재 페이지의 HTML을 캡처

// Chrome Extension API 타입 선언
declare const chrome: any;

// DOM 가져오기 함수
function getPageHTML(): string {
  return document.documentElement.outerHTML;
}

// HTML을 저장할 변수
let capturedHTML: string | null = null;

// 메시지 리스너
chrome.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
  // Background에서 단축키 눌렀을 때
  if (request.type === 'CAPTURE_HTML') {
    capturedHTML = getPageHTML();

    // Popup으로 HTML 전송
    chrome.runtime.sendMessage({
      type: 'HTML_CAPTURED',
      html: capturedHTML
    }).catch(() => {
      // Popup이 닫혀있으면 에러 무시
    });

    sendResponse({ success: true });
  }

  // Popup에서 HTML 요청했을 때
  if (request.type === 'GET_HTML') {
    // 캡처된 HTML이 있으면 그것을, 없으면 현재 HTML 반환
    const html = capturedHTML || getPageHTML();
    sendResponse({ html: html });
  }

  return true; // 비동기 응답을 위해 true 반환
});
