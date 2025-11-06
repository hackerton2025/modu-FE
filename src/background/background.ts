// Background Service Worker - 키보드 단축키 및 사이드 패널 처리

import OpenAI from "openai";

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
  model = "gpt-4o-mini",
}: HtmlAnalyzerConfig = {}): HtmlAnalyzer {
  if (!apiKey) {
    throw new Error(
      "OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey explicitly."
    );
  }

  const client = new OpenAI({ apiKey });

  async function analyzeHtml(htmlContent: string): Promise<string> {
    const message = `
      당신은 시각장애인을 위해 웹페이지의 내용을 읽어주는 음성 해설자입니다.
      아래 페이지 정보를 읽고, **이 페이지에 어떤 내용이 담겨있는지**를 자연스럽게 설명하세요.

      ---

      ### 설명 순서
      1. **페이지 제목과 주제** - 이 페이지가 무엇에 관한 것인지
      2. **주요 콘텐츠** - 표시된 텍스트, 뉴스, 기사, 검색 결과 등의 실제 내용
      3. **핵심 정보** - 사용자가 알아야 할 중요한 정보나 데이터
      4. **부가 기능** (필요시) - 중요한 버튼이나 입력란이 있다면 간단히 언급

      ---

      ### 반드시 지켜야 할 규칙
      - **내용 중심으로 설명**: "검색 결과가 표시됩니다" (X) → "A, B, C에 대한 검색 결과가 나타나 있습니다" (O)
      - **실제 텍스트를 읽어줌**: 제목, 링크 텍스트, 주요 문장 등을 직접 읽어주세요
      - HTML 태그명, 클래스명 같은 기술 용어는 절대 사용하지 않습니다
      - "~을 위한 페이지입니다" 같은 메타적 설명 최소화
      - 추측 표현 금지 ("아마도", "~일 것 같습니다")
      - 2~4개의 자연스러운 문단으로 작성

      ---

      ### 좋은 예시
      "시각장애인"에 대한 검색 결과가 표시되어 있습니다.

      첫 번째 결과는 "시각장애인의 안전한 보행을 도우려면 어떻게 해야 할까요?"라는 제목의 글이며,
      그 아래에는 "시각장애인 점자 교육" 관련 뉴스가 있습니다.
      또한 "대한시각장애인연합회" 웹사이트 링크와 "시각장애 등급 기준" 정보도 함께 나타나 있습니다.

      ---

      [페이지 정보]
      ${htmlContent}
    `;

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: message }],
    });
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI response did not include any message content.");
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
  if (command === "read-page") {
    // 사용자 제스처 컨텍스트를 유지하기 위해 동기적으로 처리
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]?.id && tabs[0]?.windowId) {
        const tabId = tabs[0].id;
        const windowId = tabs[0].windowId;

        // 1. 사이드패널 열기 (사용자 제스처 컨텍스트 내에서)
        chrome.sidePanel.open({ windowId });

        // 2. 사이드패널이 로드될 시간을 주고 HTML 캡처
        setTimeout(() => {
          // Content script에 HTML 캡처 요청
          chrome.tabs.sendMessage(tabId, { type: "CAPTURE_HTML" }, (response: any) => {
            if (chrome.runtime.lastError) {
              console.error('Content script 통신 오류:', chrome.runtime.lastError);
              return;
            }

            if (response && response.success) {
              // 3. 사이드패널에 데이터 전달 (약간의 지연 후)
              setTimeout(() => {
                chrome.runtime.sendMessage({
                  type: 'HTML_CAPTURED',
                  summary: response.summary,
                  html: response.html
                }).catch(() => {
                  console.log('Sidepanel이 아직 준비되지 않았습니다.');
                });
              }, 100);
            }
          });
        }, 300);
      }
    });
  }
});

// Webpack DefinePlugin으로 주입될 API 키
declare const __OPENAI_API_KEY__: string;

// HTML 분석 메시지 리스너
chrome.runtime.onMessage.addListener(
  (request: any, sender: any, sendResponse: any) => {
    if (request.type === "ANALYZE_HTML") {
      // 비동기 처리
      (async () => {
        try {
          // API 키는 webpack 빌드 시점에 주입됨
          const apiKey = __OPENAI_API_KEY__;
          const analyzer = createHtmlAnalyzer({ apiKey });
          const result = await analyzer.analyzeHtml(request.html);
          sendResponse({ success: true, result });
        } catch (error: any) {
          sendResponse({
            success: false,
            error: error.message || String(error),
          });
        }
      })();
      return true; // 비동기 응답을 위해 true 반환
    }
  }
);
