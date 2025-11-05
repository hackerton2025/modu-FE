// Background Service Worker - 키보드 단축키 및 사이드 패널 처리

import OpenAI from 'openai';

// Chrome Extension API 타입 선언
declare const chrome: any;

// HTML Analyzer 인라인 구현
interface HtmlAnalyzerConfig {
  apiKey?: string;
  model?: string;
}

interface HtmlAnalyzer {
  analyzeHtml: (htmlContent: string) => Promise<string>;
}

function createHtmlAnalyzer({
  apiKey,
  model = 'gpt-4o-mini',
}: HtmlAnalyzerConfig = {}): HtmlAnalyzer {
  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey explicitly.');
  }

  const client = new OpenAI({ apiKey });

  async function analyzeHtml(htmlContent: string): Promise<string> {
    const message = `
    당신은 HTML 문서를 정적으로 분석하는 설명가다.
    주어진 HTML을 기반으로, 다음 두 가지를 일반인에게 말하듯 자연스럽게 설명해줘.

    이 페이지의 전체적인 목적과 구조, 즉 어떤 종류의 페이지인지 (예: 회원가입 화면, 검색 도구, 음악 재생 페이지 등)

    사용자가 이 페이지에서 실제로 할 수 있는 일 (예: 로그인하기, 글쓰기, 버튼 누르기 등)

    지켜야 할 원칙

    HTML 태그명, 클래스명, 속성명 등 기술적인 용어는 절대 언급하지 않는다.

    HTML에 실제로 존재하는 정보만 근거로 설명한다.

    UI나 UX 평가, 성능 평가, 디자인 언급, 추측성 문장은 사용하지 않는다.

    "아마도"나 "~일지도 모릅니다" 대신, "이 문서에는 ~라는 문구가 있어 ~와 관련된 기능으로 보입니다"처럼 근거를 중심으로 말한다.

    설명은 사람에게 말하듯 자연스럽고 일상적인 문장으로 작성한다.

    페이지의 구조를 설명할 때는 "위쪽에는 ~이 있고, 그 아래에는 ~이 있습니다"처럼 위치나 흐름 중심으로 서술한다.

    각 행동에 대해서는 "사용자는 ~할 수 있습니다" 형태로 구체적으로 적는다.

    출력 예시 스타일
    이 페이지는 음성으로 말한 내용을 인식하고 그 결과를 보여주는 웹사이트입니다.
    화면의 위쪽에는 '음성 인식'이라는 제목이 있고, 그 아래에는 현재 상태와 인식된 문장이 표시됩니다.
    사용자는 '마이크 시작' 버튼을 눌러 음성 인식을 시작할 수 있고, 인식된 내용을 '텍스트 읽기' 버튼을 눌러 소리로 다시 들을 수 있습니다.
    문제나 오류가 생기면 관련 메시지가 화면에 나타나도록 되어 있습니다.

    이제 아래 HTML을 분석해줘.
    [HTML]
    <<<
    ${htmlContent}
    >>>
    `;
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }]
    });
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI response did not include any message content.');
    }

    return content;
  }

  return { analyzeHtml };
}

// 확장 아이콘 클릭 시 사이드 패널 열기
chrome.action.onClicked.addListener((tab: any) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 단축키 명령 리스너
chrome.commands.onCommand.addListener((command: string) => {
  if (command === 'read-page') {
    // 사용자 제스처 컨텍스트를 유지하기 위해 동기적으로 처리
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]?.id && tabs[0]?.windowId) {
        // 1. 사이드패널 열기 (사용자 제스처 컨텍스트 내에서)
        chrome.sidePanel.open({ windowId: tabs[0].windowId });

        // 2. 사이드패널이 로드될 시간을 주고 HTML 캡처
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_HTML' });
        }, 300);
      }
    });
  }
});

// Webpack DefinePlugin으로 주입될 API 키
declare const __OPENAI_API_KEY__: string;

// HTML 분석 메시지 리스너
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.type === 'ANALYZE_HTML') {
    // 비동기 처리
    (async () => {
      try {
        // API 키는 webpack 빌드 시점에 주입됨
        const apiKey = __OPENAI_API_KEY__;
        const analyzer = createHtmlAnalyzer({ apiKey });
        const result = await analyzer.analyzeHtml(request.html);
        sendResponse({ success: true, result });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message || String(error) });
      }
    })();
    return true; // 비동기 응답을 위해 true 반환
  }
});
