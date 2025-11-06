export {};

// Web Speech API 타입 선언
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Chrome Extension API 타입 선언
declare const chrome: any;

// Web Speech API 사용을 위한 변수
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

// DOM 요소 - 새 UI 구조에 맞게 수정
const micButton = document.getElementById("micButton") as HTMLButtonElement;
const transcriptDiv = document.getElementById("transcript") as HTMLDivElement;
const listContainer = document.getElementById(
  "listContainer"
) as HTMLDivElement;
const descriptP = transcriptDiv.querySelector(
  ".descript"
) as HTMLParagraphElement;
const statusAnnouncer = document.getElementById(
  "statusAnnouncer"
) as HTMLDivElement;

let recognition: any = null;
let isListening: boolean = false;

// TTS (Text-to-Speech) 관련
const synth = window.speechSynthesis;
let isSpeaking: boolean = false;

// MCP API URL
const API_URL = "http://localhost:3000/api/execute-command";

async function executeCommand(userCommand: string): Promise<string> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command: userCommand }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message || "응답을 받았습니다.";
  } catch (error: any) {
    console.error("백엔드 호출 오류:", error);
    return `오류: ${error.message}`;
  }
}
// 스크린 리더에 상태 알림
function announceToScreenReader(message: string) {
  if (statusAnnouncer) {
    statusAnnouncer.textContent = message;
    // 2초 후 메시지 지우기
    setTimeout(() => {
      statusAnnouncer.textContent = "";
    }, 2000);
  }
}

// 음성인식 초기화
function initRecognition() {
  if (!SpeechRecognition) {
    console.error("이 브라우저는 음성인식을 지원하지 않습니다.");
    announceToScreenReader("음성인식이 지원되지 않는 브라우저입니다.");
    if (micButton) micButton.disabled = true;
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  // 음성인식 결과 처리
  recognition.onresult = (event: any) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alternative = result[0];
      const transcript = alternative.transcript;
      const confidence = alternative.confidence;

      if (result.isFinal) {
        if (confidence === undefined || confidence > 0) {
          finalTranscript += transcript + " ";
        }
      } else {
        interimTranscript += transcript;
      }
    }

    // 최종 결과 표시
    if (finalTranscript && transcriptDiv) {
      if (descriptP) {
        if (descriptP.textContent === "* 인식한 명령어가 없습니다 *") {
          descriptP.textContent = finalTranscript;
        } else {
          descriptP.textContent += finalTranscript;
        }
      }
    }
  };

  // 음성인식 시작
  recognition.onstart = () => {
    isListening = true;
    if (micButton) {
      micButton.textContent = "음성인식 중지";
      micButton.setAttribute("aria-pressed", "true");
      micButton.setAttribute("aria-label", "음성인식 중지하기");
      micButton.classList.add("listening");
    }
    announceToScreenReader("음성인식이 시작되었습니다.");
  };

  // 음성인식 종료
  recognition.onend = () => {
    isListening = false;
    if (micButton) {
      micButton.textContent = "음성인식 시작";
      micButton.setAttribute("aria-pressed", "false");
      micButton.setAttribute("aria-label", "음성인식 시작하기");
      micButton.classList.remove("listening");
    }
    announceToScreenReader("음성인식이 중지되었습니다.");
    const message = descriptP.textContent;
    processCommand(message || "");
  };

  // 에러 처리
  recognition.onerror = (event: any) => {
    console.error("음성인식 오류:", event.error);
    isListening = false;
    if (micButton) {
      micButton.textContent = "음성인식 시작";
      micButton.setAttribute("aria-pressed", "false");
      micButton.classList.remove("listening");
    }

    let errorMessage = "음성인식 오류가 발생했습니다.";
    switch (event.error) {
      case "no-speech":
        errorMessage = "음성이 감지되지 않았습니다.";
        break;
      case "audio-capture":
        errorMessage = "마이크를 찾을 수 없습니다.";
        break;
      case "not-allowed":
        errorMessage = "마이크 권한이 거부되었습니다.";
        break;
    }
    announceToScreenReader(errorMessage);
  };

  return recognition;
}

// 음성인식 시작
function startRecognition() {
  if (!recognition) {
    recognition = initRecognition();
    if (!recognition) return;
  }

  if (isListening) {
    return;
  }

  try {
    recognition.start();
  } catch (error: any) {
    if (error.name === "InvalidStateError") {
      recognition.stop();
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          console.error("음성인식을 시작할 수 없습니다:", e);
        }
      }, 100);
    } else {
      console.error("음성인식 오류:", error);
    }
  }
}

function processCommand(message: string) {
  if (message === "" || message === "여기에 인식된 텍스트가 표시됩니다...")
    return;

  const reqDiv = document.createElement("div");
  reqDiv.className = "answerContainer";
  reqDiv.innerHTML = `
    <p class="descript">${message}</p>
  `;
  listContainer.appendChild(reqDiv);

  const resDiv = document.createElement("div");
  resDiv.className = "answerContainer";
  resDiv.innerHTML = `
      <p class="title">처리 중 입니다...</p>
    `;
  listContainer.appendChild(resDiv);

  // 백엔드에 명령어 전송
  executeCommand(message).then((response) => {
    resDiv.innerHTML = `
      <p class="title">${response}</p>
    `;
  });
}

// TTS - 텍스트를 읽어주는 함수
function speakText(text: string) {
  if (!text) return;

  // 이미 읽고 있으면 중지
  if (isSpeaking) {
    synth.cancel();
    isSpeaking = false;
    announceToScreenReader("음성 읽기가 중지되었습니다.");
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    isSpeaking = true;
    announceToScreenReader("페이지 내용을 읽고 있습니다.");
  };

  utterance.onend = () => {
    isSpeaking = false;
    announceToScreenReader("페이지 내용 읽기가 완료되었습니다.");
  };

  utterance.onerror = (event: any) => {
    isSpeaking = false;
    console.error("음성 출력 오류:", event.error);
    announceToScreenReader("음성 출력 오류가 발생했습니다.");
  };

  synth.speak(utterance);
}

// HTML 분석 함수
async function analyzeHTML(summary: string) {
  announceToScreenReader("페이지를 분석하고 있습니다. 잠시만 기다려주세요.");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_HTML",
      html: summary,
    });

    if (response.success) {
      // 분석 결과를 리스트에 추가 (answerContainer와 동일한 스타일)
      if (listContainer) {
        const answerDiv = document.createElement("article");
        answerDiv.id = "answerContainer";
        answerDiv.setAttribute("role", "article");
        answerDiv.setAttribute("aria-labelledby", "answerTitle-" + Date.now());
        answerDiv.tabIndex = -1; // 프로그래밍 방식으로 포커스 가능

        const titleId = "answerTitle-" + Date.now();
        answerDiv.innerHTML = `
          <h3 id="${titleId}" class="sr-only">페이지 분석 결과</h3>
          <p id="descript">${response.result}</p>
        `;

        listContainer.appendChild(answerDiv);

        // 새 결과에 포커스 이동 (스크린 리더가 읽음)
        answerDiv.focus();
      }

      // 자동으로 TTS로 읽어주기
      speakText(response.result);
    } else {
      console.error("분석 실패:", response.error);
      announceToScreenReader("페이지 분석에 실패했습니다.");
    }
  } catch (error: any) {
    console.error("오류 발생:", error);
    announceToScreenReader("오류가 발생했습니다.");
  }
}

// Content Script로부터 데이터 받기 (단축키 눌렀을 때)
chrome.runtime.onMessage.addListener((request: any) => {
  if (request.type === "HTML_CAPTURED") {
    // summary를 사용해서 페이지 분석
    analyzeHTML(request.summary);
  }
});

// 마이크 버튼 클릭 이벤트
if (micButton) {
  micButton.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
    } else {
      startRecognition();
    }
  });
}

// 키보드 단축키: Escape로 음성 중지
document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape" && isSpeaking) {
    synth.cancel();
    isSpeaking = false;
    announceToScreenReader("음성 읽기가 중지되었습니다.");
  }
});

// 초기화
initRecognition();
announceToScreenReader(
  "Modu 웹 접근성 도우미가 준비되었습니다. Command+Shift+L을 눌러 페이지를 분석하세요."
);
