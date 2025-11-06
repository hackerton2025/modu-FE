// Content Script - 단축키를 눌렀을 때 현재 페이지의 DOM 구조를 요약

// Chrome Extension API 타입 선언
declare const chrome: any;

// HTML을 정제하여 토큰 사이즈 줄이기
function cleanHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 불필요한 요소 제거
  const selectorsToRemove = [
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "path",
    "canvas",
    "video",
    "audio",
    'img[src*="data:"]', // base64 이미지
    "[hidden]",
    ".ad",
    ".ads",
    ".advertisement",
  ];

  selectorsToRemove.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  });

  // 불필요한 속성 제거
  const attributesToRemove = ["style", "class", "onclick", "onload", "data-*"];
  doc.querySelectorAll("*").forEach((el) => {
    attributesToRemove.forEach((attr) => {
      if (attr.includes("*")) {
        // data-* 같은 패턴 처리
        Array.from(el.attributes).forEach((a) => {
          if (a.name.startsWith(attr.replace("*", ""))) {
            el.removeAttribute(a.name);
          }
        });
      } else {
        el.removeAttribute(attr);
      }
    });
  });

  // 빈 텍스트 노드 제거
  const removeEmptyNodes = (node: Node) => {
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
        node.removeChild(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        removeEmptyNodes(child);
      }
    }
  };
  removeEmptyNodes(doc.body);

  return doc.documentElement.outerHTML;
}

// DOM 구조 요약
function summarizePageStructure(): string {
  const summary: string[] = [];
  const MAX_CHARS = 15000; // 최대 15,000자로 제한

  // 페이지 기본 정보
  summary.push(`=== 페이지 정보 ===`);
  summary.push(`제목: ${document.title || "(없음)"}`);
  
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const desc = metaDesc.getAttribute("content") || "";
    summary.push(`설명: ${desc.substring(0, 200)}`);
  }
  summary.push("");

  // 페이지 구조
  const main = document.querySelector('main, [role="main"]');
  const header = document.querySelector('header, [role="banner"]');
  const nav = document.querySelector('nav, [role="navigation"]');
  
  const structure = [];
  if (header) structure.push("헤더");
  if (nav) structure.push("네비게이션");
  if (main) structure.push("메인컨텐츠");
  
  if (structure.length > 0) {
    summary.push(`구조: ${structure.join(", ")}`);
    summary.push("");
  }

  // 주요 제목
  const headings = document.querySelectorAll("h1, h2, h3");
  if (headings.length > 0) {
    summary.push(`=== 제목 ===`);
    let count = 0;
    headings.forEach((h) => {
      if (count < 10) {
        const text = h.textContent?.trim();
        if (text && text.length < 100) {
          summary.push(`${h.tagName}: ${text}`);
          count++;
        }
      }
    });
    summary.push("");
  }

  // 인터랙티브 요소
  summary.push(`=== 기능 ===`);
  
  // 폼
  const forms = document.querySelectorAll("form");
  if (forms.length > 0) {
    summary.push(`폼 ${forms.length}개`);
  }

  // 버튼
  const buttons = document.querySelectorAll('button, input[type="submit"], [role="button"]');
  if (buttons.length > 0) {
    const btnTexts: string[] = [];
    buttons.forEach((btn, i) => {
      if (i < 8) {
        const text = btn.textContent?.trim() || btn.getAttribute("aria-label");
        if (text && text.length < 50) {
          btnTexts.push(text);
        }
      }
    });
    if (btnTexts.length > 0) {
      summary.push(`버튼: ${btnTexts.join(", ")}`);
    }
  }

  // 입력 필드
  const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  if (inputs.length > 0) {
    const inputNames: string[] = [];
    inputs.forEach((input, i) => {
      if (i < 8) {
        const type = input.getAttribute("type") || "text";
        const placeholder = input.getAttribute("placeholder");
        const label = input.getAttribute("aria-label");
        const name = label || placeholder || type;
        if (name.length < 50) {
          inputNames.push(name);
        }
      }
    });
    if (inputNames.length > 0) {
      summary.push(`입력: ${inputNames.join(", ")}`);
    }
  }
  summary.push("");

  // 주요 링크
  const links = document.querySelectorAll("a[href]");
  if (links.length > 0) {
    summary.push(`=== 링크 ===`);
    let linkCount = 0;
    links.forEach((link) => {
      if (linkCount < 10) {
        const text = link.textContent?.trim();
        if (text && text.length > 2 && text.length < 50) {
          summary.push(`• ${text}`);
          linkCount++;
        }
      }
    });
    summary.push("");
  }

  // 핵심 텍스트
  const contentElements = document.querySelectorAll('p, article, [role="article"]');
  if (contentElements.length > 0) {
    summary.push(`=== 텍스트 ===`);
    let textCount = 0;
    const seenTexts = new Set<string>();
    
    contentElements.forEach((el) => {
      if (textCount < 5) {
        const text = el.textContent?.trim();
        if (text && text.length > 50 && text.length < 300) {
          const preview = text.substring(0, 150);
          if (!seenTexts.has(preview)) {
            summary.push(preview + (text.length > 150 ? "..." : ""));
            seenTexts.add(preview);
            textCount++;
          }
        }
      }
    });
  }

  // 최종 문자열 생성 및 길이 제한
  let result = summary.join("\n");

  if (result.length > MAX_CHARS) {
    result = result.substring(0, MAX_CHARS) + "\n\n[요약이 길이 제한으로 잘렸습니다]";
  }

  return result;
}

// 전체 HTML 가져오기
function getPageHTML(): string {
  return cleanHTML(document.documentElement.outerHTML);
}

// 캡처된 데이터 저장
let capturedSummary = '';
let capturedHTML = '';

// Background로부터 메시지 받기
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.type === 'CAPTURE_HTML') {
    // DOM 요약 및 HTML 캡처
    capturedSummary = summarizePageStructure();
    capturedHTML = getPageHTML();

    // Background에 응답 (Background가 sidepanel로 전달)
    sendResponse({
      success: true,
      summary: capturedSummary,
      html: capturedHTML
    });

    return true; // 비동기 응답을 위해 true 반환
  }

  if (request.type === 'GET_HTML') {
    // Sidepanel이 직접 요청하는 경우
    const summary = summarizePageStructure();
    const html = getPageHTML();

    sendResponse({
      summary: summary,
      html: html
    });

    return true;
  }
});