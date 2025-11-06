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
let lastProcessedMessageCount: number = 0;
let currentSessionTranscript: string = ''; // 현재 음성인식 세션의 전체 transcript
let isProcessing: boolean = false; // AI 처리 중 여부

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

  // 첫 메시지일 때 안내 메시지 숨기기
  const emptyState = document.getElementById('emptyState');
  if (emptyState) {
    emptyState.style.display = 'none';
  }

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
function addAIMessage(text: string, isLoading: boolean = false) {
  if (!messageList || !text) return;

  // 첫 메시지일 때 안내 메시지 숨기기
  const emptyState = document.getElementById('emptyState');
  if (emptyState) {
    emptyState.style.display = 'none';
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = isLoading ? 'message ai loading' : 'message ai';
  messageDiv.setAttribute('role', 'article');
  messageDiv.setAttribute('aria-label', 'AI 응답');
  messageDiv.textContent = text;
  messageDiv.tabIndex = -1;

  messageList.appendChild(messageDiv);

  // 로딩 메시지가 아닐 때만 포커스 (스크린 리더가 읽음)
  if (!isLoading) {
    messageDiv.focus();
  }
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

    // 최종 결과를 세션 transcript에 누적
    if (finalTranscript) {
      currentSessionTranscript += finalTranscript;
    }

    // 인식 중인 텍스트 실시간 표시 (누적된 내용 + 현재 인식 중인 내용)
    if (transcriptText) {
      transcriptText.textContent = currentSessionTranscript + interimTranscript;
    }

    // 5초 후 자동 종료 타이머 시작
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
    currentSessionTranscript = ''; // 세션 시작 시 transcript 초기화
    if (micButton) {
      micButton.textContent = '음성인식 중지';
      micButton.setAttribute('aria-pressed', 'true');
      micButton.setAttribute('aria-label', '음성인식 중지하기');
      micButton.classList.add('listening');
    }
    announceToScreenReader('음성인식이 시작되었습니다.');

    // 초기 5초 타이머 시작
    silenceTimer = setTimeout(() => {
      if (isListening) {
        recognition.stop();
        announceToScreenReader('5초 동안 음성이 감지되지 않아 음성인식이 종료되었습니다.');
      }
    }, 5000);
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

    // 누적된 transcript를 사용자 메시지로 추가
    const finalCommand = currentSessionTranscript.trim();

    // transcript 초기화
    if (transcriptText) {
      transcriptText.textContent = '';
    }

    // 명령어가 비어있지 않을 때만 처리
    if (finalCommand && finalCommand.length > 0) {
      addUserMessage(finalCommand);
      processCommand(finalCommand);
      lastProcessedMessageCount++;
    }

    // 세션 transcript 초기화
    currentSessionTranscript = '';
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

  // AI가 처리 중이면 음성인식 시작 불가
  if (isProcessing) {
    announceToScreenReader('AI가 응답을 처리하는 중입니다. 잠시만 기다려주세요.');
    return;
  }

  // TTS가 실행 중이면 중지
  if (isSpeaking) {
    synth.cancel();
    isSpeaking = false;
    announceToScreenReader('음성 읽기가 중지되고 음성인식이 시작됩니다.');
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

  // 처리 시작
  isProcessing = true;
  if (micButton) {
    micButton.disabled = true;
    micButton.style.opacity = '0.5';
    micButton.style.cursor = 'not-allowed';
  }

  // "처리 중..." 메시지 추가 (로딩 애니메이션 포함)
  addAIMessage('처리 중입니다...', true);

  try {
    // 백엔드에 명령어 전송
    const response = await executeCommand(trimmedMessage);

    // 마지막 AI 메시지 업데이트 (처리 중 -> 실제 응답)
    const aiMessages = messageList.querySelectorAll('.message.ai');
    if (aiMessages.length > 0) {
      const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
      // 로딩 클래스 제거
      lastAIMessage.classList.remove('loading');
      lastAIMessage.textContent = response;
      // 포커스 이동 (스크린 리더가 읽음)
      lastAIMessage.focus();

      speakText(response);
    }
  } catch (error: any) {
    console.error('명령어 처리 오류:', error);
    const errorMessage = `오류가 발생했습니다: ${error.message}`;

    // 마지막 AI 메시지 업데이트
    const aiMessages = messageList.querySelectorAll('.message.ai');
    if (aiMessages.length > 0) {
      const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
      // 로딩 클래스 제거
      lastAIMessage.classList.remove('loading');
      lastAIMessage.textContent = errorMessage;
      lastAIMessage.focus();
    } else {
      addAIMessage(errorMessage);
    }

    // 오류도 TTS로 읽어주기
    speakText(errorMessage);
  } finally {
    // 처리 종료
    isProcessing = false;
    if (micButton) {
      micButton.disabled = false;
      micButton.style.opacity = '1';
      micButton.style.cursor = 'pointer';
    }
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
  // 처리 시작
  isProcessing = true;
  if (micButton) {
    micButton.disabled = true;
    micButton.style.opacity = '0.5';
    micButton.style.cursor = 'not-allowed';
  }

  announceToScreenReader('페이지를 분석하고 있습니다. 잠시만 기다려주세요.');

  // 로딩 메시지 추가
  addAIMessage('페이지를 분석하고 있습니다...', true);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_HTML',
      html: summary,
    });

    if (response.success) {
      // 마지막 AI 메시지 업데이트 (로딩 -> 실제 응답)
      const aiMessages = messageList.querySelectorAll('.message.ai');
      if (aiMessages.length > 0) {
        const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
        lastAIMessage.classList.remove('loading');
        lastAIMessage.textContent = response.result;
        lastAIMessage.focus();
      }

      // 자동으로 TTS로 읽어주기
      speakText(response.result);
    } else {
      console.error('분석 실패:', response.error);
      announceToScreenReader('페이지 분석에 실패했습니다.');

      // 마지막 AI 메시지 업데이트
      const aiMessages = messageList.querySelectorAll('.message.ai');
      if (aiMessages.length > 0) {
        const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
        lastAIMessage.classList.remove('loading');
        lastAIMessage.textContent = '죄송합니다. 페이지 분석에 실패했습니다.';
        lastAIMessage.focus();
      }
    }
  } catch (error: any) {
    console.error('오류 발생:', error);
    announceToScreenReader('오류가 발생했습니다.');

    // 마지막 AI 메시지 업데이트
    const aiMessages = messageList.querySelectorAll('.message.ai');
    if (aiMessages.length > 0) {
      const lastAIMessage = aiMessages[aiMessages.length - 1] as HTMLElement;
      lastAIMessage.classList.remove('loading');
      lastAIMessage.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
      lastAIMessage.focus();
    }
  } finally {
    // 처리 종료
    isProcessing = false;
    if (micButton) {
      micButton.disabled = false;
      micButton.style.opacity = '1';
      micButton.style.cursor = 'pointer';
    }
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
