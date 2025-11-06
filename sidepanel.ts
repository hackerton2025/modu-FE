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

// DOM 요소
const micButton = document.getElementById('micButton') as HTMLButtonElement;
const transcriptText = document.getElementById('transcriptText') as HTMLParagraphElement;
const messageList = document.getElementById('messageList') as HTMLDivElement;
const statusAnnouncer = document.getElementById('statusAnnouncer') as HTMLDivElement;

let recognition: any = null;
let isListening: boolean = false;
let silenceTimer: any = null;

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
      statusAnnouncer.textContent = '';
    }, 2000);
  }
}

// 사용자 메시지 추가 함수
function addUserMessage(text: string) {
  if (!messageList || !text) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  messageDiv.setAttribute('role', 'article');
  messageDiv.setAttribute('aria-label', '사용자 메시지');
  messageDiv.textContent = text;
  messageDiv.tabIndex = -1;

  messageList.appendChild(messageDiv);
  scrollToBottom();
}

// AI 응답 메시지 추가 함수
function addAIMessage(text: string) {
  if (!messageList || !text) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai';
  messageDiv.setAttribute('role', 'article');
  messageDiv.setAttribute('aria-label', 'AI 응답');
  messageDiv.textContent = text;
  messageDiv.tabIndex = -1;

  messageList.appendChild(messageDiv);

  // 새 메시지에 포커스 (스크린 리더가 읽음)
  messageDiv.focus();
  scrollToBottom();
}

// 채팅 스크롤을 맨 아래로
function scrollToBottom() {
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// 음성인식 초기화
function initRecognition() {
  if (!SpeechRecognition) {
    console.error('이 브라우저는 음성인식을 지원하지 않습니다.');
    announceToScreenReader('음성인식이 지원되지 않는 브라우저입니다.');
    if (micButton) micButton.disabled = true;
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  // 음성인식 결과 처리
  recognition.onresult = (event: any) => {
    // 기존 타이머 초기화 (말을 하면 타이머 리셋)
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }

    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alternative = result[0];
      const transcript = alternative.transcript;
      const confidence = alternative.confidence;

      if (result.isFinal) {
        if (confidence === undefined || confidence > 0) {
          finalTranscript += transcript + ' ';
        }
      } else {
        interimTranscript += transcript;
      }
    }

    // 인식 중인 텍스트 실시간 표시
    if (interimTranscript && transcriptText) {
      transcriptText.textContent = interimTranscript;
    }

    // 최종 결과 - 사용자 메시지로 추가
    if (finalTranscript) {
      addUserMessage(finalTranscript.trim());
      // 인식 완료 후 텍스트 초기화
      if (transcriptText) {
        transcriptText.textContent = '';
      }
    }

    // 3초 후 자동 종료 타이머 시작
    silenceTimer = setTimeout(() => {
      if (isListening) {
        recognition.stop();
        announceToScreenReader('5초 동안 음성이 감지되지 않아 음성인식이 종료되었습니다.');
      }
    }, 5000);
  };

  // 음성인식 시작
  recognition.onstart = () => {
    isListening = true;
    if (micButton) {
      micButton.textContent = '음성인식 중지';
      micButton.setAttribute('aria-pressed', 'true');
      micButton.setAttribute('aria-label', '음성인식 중지하기');
      micButton.classList.add('listening');
    }
    announceToScreenReader('음성인식이 시작되었습니다.');

    // 초기 3초 타이머 시작
    silenceTimer = setTimeout(() => {
      if (isListening) {
        recognition.stop();
        announceToScreenReader('3초 동안 음성이 감지되지 않아 음성인식이 종료되었습니다.');
      }
    }, 3000);
  };

  // 음성인식 종료
  recognition.onend = () => {
    isListening = false;

    // 타이머 정리
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    if (micButton) {
      micButton.textContent = '음성인식 시작';
      micButton.setAttribute('aria-pressed', 'false');
      micButton.setAttribute('aria-label', '음성인식 시작하기');
      micButton.classList.remove('listening');
    }
    announceToScreenReader('음성인식이 중지되었습니다.');

    // 마지막 사용자 메시지를 가져와서 MCP 명령어 처리
    const messages = messageList.querySelectorAll('.message.user');
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const command = (lastMessage.textContent || '').trim();

      // 명령어가 비어있지 않을 때만 처리
      if (command && command.length > 0) {
        processCommand(command);
      }
    }
  };

  // 에러 처리
  recognition.onerror = (event: any) => {
    console.error('음성인식 오류:', event.error);
    isListening = false;

    // 타이머 정리
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    if (micButton) {
      micButton.textContent = '음성인식 시작';
      micButton.setAttribute('aria-pressed', 'false');
      micButton.classList.remove('listening');
    }

    let errorMessage = '음성인식 오류가 발생했습니다.';
    switch (event.error) {
      case 'no-speech':
        errorMessage = '음성이 감지되지 않았습니다.';
        break;
      case 'audio-capture':
        errorMessage = '마이크를 찾을 수 없습니다.';
        break;
      case 'not-allowed':
        errorMessage = '마이크 권한이 거부되었습니다.';
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
    if (error.name === 'InvalidStateError') {
      recognition.stop();
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          console.error('음성인식을 시작할 수 없습니다:', e);
        }
      }, 100);
    } else {
      console.error('음성인식 오류:', error);
    }
  }
}

// MCP 명령어 처리 함수
async function processCommand(message: string) {
  // 빈 메시지는 처리하지 않음
  const trimmedMessage = message.trim();
  if (!trimmedMessage || trimmedMessage === '' || trimmedMessage === '여기에 인식된 텍스트가 표시됩니다...') {
    return;
  }

  // "처리 중..." 메시지 추가 (TTS 안함)
  addAIMessage('처리 중입니다...');

  try {
    // 백엔드에 명령어 전송
    const response = await executeCommand(trimmedMessage);

    // 마지막 AI 메시지 업데이트 (처리 중 -> 실제 응답)
    const aiMessages = messageList.querySelectorAll('.message.ai');
    if (aiMessages.length > 0) {
      const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
      lastAIMessage.textContent = response;

      speakText(response);
    }
  } catch (error: any) {
    console.error('명령어 처리 오류:', error);
    const errorMessage = `오류가 발생했습니다: ${error.message}`;

    // 마지막 AI 메시지 업데이트
    const aiMessages = messageList.querySelectorAll('.message.ai');
    if (aiMessages.length > 0) {
      const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
      lastAIMessage.textContent = errorMessage;
    } else {
      addAIMessage(errorMessage);
    }

    // 오류도 TTS로 읽어주기
    speakText(errorMessage);
  }
}

// TTS - 텍스트를 읽어주는 함수
function speakText(text: string) {
  if (!text) return;

  // 이미 읽고 있으면 중지
  if (isSpeaking) {
    synth.cancel();
    isSpeaking = false;
    announceToScreenReader('음성 읽기가 중지되었습니다.');
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    isSpeaking = true;
    announceToScreenReader('페이지 내용을 읽고 있습니다.');
  };

  utterance.onend = () => {
    isSpeaking = false;
    announceToScreenReader('페이지 내용 읽기가 완료되었습니다.');
  };

  utterance.onerror = (event: any) => {
    isSpeaking = false;
    console.error('음성 출력 오류:', event.error);
    announceToScreenReader('음성 출력 오류가 발생했습니다.');
  };

  synth.speak(utterance);
}

// HTML 분석 함수
async function analyzeHTML(summary: string) {
  announceToScreenReader('페이지를 분석하고 있습니다. 잠시만 기다려주세요.');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_HTML',
      html: summary,
    });

    if (response.success) {
      // AI 응답 메시지 추가
      addAIMessage(response.result);

      // 자동으로 TTS로 읽어주기
      speakText(response.result);
    } else {
      console.error('분석 실패:', response.error);
      announceToScreenReader('페이지 분석에 실패했습니다.');
      addAIMessage('죄송합니다. 페이지 분석에 실패했습니다.');
    }
  } catch (error: any) {
    console.error('오류 발생:', error);
    announceToScreenReader('오류가 발생했습니다.');
    addAIMessage('오류가 발생했습니다. 다시 시도해주세요.');
  }
}

// Content Script로부터 데이터 받기 (단축키 눌렀을 때)
chrome.runtime.onMessage.addListener((request: any) => {
  if (request.type === 'HTML_CAPTURED') {
    // summary를 사용해서 페이지 분석
    analyzeHTML(request.summary);
  }
});

// 마이크 버튼 클릭 이벤트
if (micButton) {
  micButton.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      startRecognition();
    }
  });
}

// 키보드 단축키
document.addEventListener('keydown', (event: KeyboardEvent) => {
  // Escape: 음성 중지
  if (event.key === 'Escape' && isSpeaking) {
    synth.cancel();
    isSpeaking = false;
    announceToScreenReader('음성 읽기가 중지되었습니다.');
  }

  // 스페이스바: 음성인식 시작/중지
  if (event.code === 'Space') {
    // input이나 textarea에서는 작동하지 않도록
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    event.preventDefault();
    if (isListening) {
      recognition.stop();
    } else {
      startRecognition();
    }
  }
});

// 초기화
initRecognition();
announceToScreenReader('Modu 웹 접근성 도우미가 준비되었습니다. Command+Shift+L을 눌러 페이지를 분석하세요.');
