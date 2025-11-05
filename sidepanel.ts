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
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// DOM 요소
const micButton = document.getElementById('micButton') as HTMLButtonElement;
const speakButton = document.getElementById('speakButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const transcriptDiv = document.getElementById('transcript') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;
const htmlCodeDiv = document.getElementById('htmlCode') as HTMLDivElement;

let recognition: any = null;
let isListening: boolean = false;

// TTS (Text-to-Speech) 관련
const synth = window.speechSynthesis;
let isSpeaking: boolean = false;

// 음성인식 초기화
function initRecognition() {
  if (!SpeechRecognition) {
    errorDiv.textContent = '이 브라우저는 음성인식을 지원하지 않습니다.';
    micButton.disabled = true;
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR'; // 한국어 설정
  recognition.continuous = true; // 계속 듣기
  recognition.interimResults = true; // 중간 결과도 표시
  recognition.maxAlternatives = 1; // 최상의 결과만 반환

  // 음성인식 결과 처리
  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alternative = result[0];
      const transcript = alternative.transcript;
      const confidence = alternative.confidence;

      if (result.isFinal) {
        // 신뢰도가 0보다 큰 경우에만 추가 (0이면 Google이 확신하지 못하는 것)
        // 일반적으로 0.5 이상이면 신뢰할 만함
        if (confidence === undefined || confidence > 0) {
          finalTranscript += transcript + ' ';
        }
      } else {
        interimTranscript += transcript;
      }
    }

    // 최종 결과와 중간 결과 표시
    if (finalTranscript) {
      const currentText = transcriptDiv.textContent === '여기에 인식된 텍스트가 표시됩니다...'
        ? ''
        : transcriptDiv.textContent;
      transcriptDiv.textContent = currentText + finalTranscript;
    }

    // 중간 결과는 상태 영역에 표시
    if (interimTranscript) {
      statusDiv.textContent = `인식 중: ${interimTranscript}`;
    }
  };

  // 음성인식 시작
  recognition.onstart = () => {
    isListening = true;
    statusDiv.textContent = '듣고 있습니다...';
    micButton.textContent = '마이크 중지';
    micButton.classList.add('listening');
    errorDiv.textContent = '';
  };

  // 음성 입력 시작됨
  recognition.onaudiostart = () => {
    statusDiv.textContent = '음성 입력 감지 중...';
  };

  // 음성 입력 종료됨
  recognition.onaudioend = () => {
    statusDiv.textContent = '음성 입력 처리 중...';
  };

  // 음성인식 종료
  recognition.onend = () => {
    isListening = false;
    statusDiv.textContent = '음성인식이 중지되었습니다.';
    micButton.textContent = '마이크 시작';
    micButton.classList.remove('listening');
  };

  // 에러 처리
  recognition.onerror = (event: any) => {
    let errorMessage = '';

    switch(event.error) {
      case 'no-speech':
        errorMessage = '음성이 감지되지 않았습니다.';
        break;
      case 'audio-capture':
        errorMessage = '마이크를 찾을 수 없습니다.';
        break;
      case 'not-allowed':
        errorMessage = '마이크 권한이 거부되었습니다.';
        break;
      default:
        errorMessage = `오류 발생: ${event.error}`;
    }

    errorDiv.textContent = errorMessage;
    isListening = false;
    micButton.textContent = '마이크 시작';
    micButton.classList.remove('listening');
  };

  return recognition;
}

// 음성인식 시작
function startRecognition() {
  if (!recognition) {
    recognition = initRecognition();
    if (!recognition) return;
  }

  // 이미 실행 중이면 무시
  if (isListening) {
    return;
  }

  // 처음 시작할 때 텍스트 초기화
  if (transcriptDiv.textContent === '여기에 인식된 텍스트가 표시됩니다...') {
    transcriptDiv.textContent = '';
  }

  // 에러 메시지 초기화
  errorDiv.textContent = '';

  try {
    recognition.start();
    statusDiv.textContent = '음성인식을 시작하는 중...';
  } catch (error: any) {
    if (error.name === 'InvalidStateError') {
      // 이미 시작된 경우 - 중지 후 재시작
      recognition.stop();
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          errorDiv.textContent = '음성인식을 시작할 수 없습니다. 페이지를 새로고침해주세요.';
        }
      }, 100);
    } else {
      errorDiv.textContent = `오류: ${error.message || '음성인식을 시작할 수 없습니다.'}`;
      statusDiv.textContent = '';
    }
  }
}

// TTS - 텍스트 읽기 함수
function speakText() {
  const text = transcriptDiv.textContent;

  if (!text || text === '여기에 인식된 텍스트가 표시됩니다...') {
    errorDiv.textContent = '읽을 텍스트가 없습니다.';
    return;
  }

  if (isSpeaking) {
    // 이미 읽는 중이면 중지
    synth.cancel();
    isSpeaking = false;
    speakButton.textContent = '텍스트 읽기';
    speakButton.classList.remove('speaking');
    statusDiv.textContent = '음성 출력이 중지되었습니다.';
    return;
  }

  // 새로운 발화 생성
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR'; // 한국어
  utterance.rate = 1.0; // 속도 (0.1 ~ 10)
  utterance.pitch = 1.0; // 음높이 (0 ~ 2)
  utterance.volume = 1.0; // 볼륨 (0 ~ 1)

  // 이벤트 핸들러
  utterance.onstart = () => {
    isSpeaking = true;
    speakButton.textContent = '읽기 중지';
    speakButton.classList.add('speaking');
    statusDiv.textContent = '텍스트를 읽고 있습니다...';
    errorDiv.textContent = '';
  };

  utterance.onend = () => {
    isSpeaking = false;
    speakButton.textContent = '텍스트 읽기';
    speakButton.classList.remove('speaking');
    statusDiv.textContent = '음성 출력이 완료되었습니다.';
  };

  utterance.onerror = (event: any) => {
    isSpeaking = false;
    speakButton.textContent = '텍스트 읽기';
    speakButton.classList.remove('speaking');
    errorDiv.textContent = `음성 출력 오류: ${event.error}`;
    statusDiv.textContent = '';
  };

  // 음성 출력 시작
  synth.speak(utterance);
}

// 마이크 버튼 클릭 이벤트
micButton.addEventListener('click', () => {
  if (isListening) {
    recognition.stop();
  } else {
    startRecognition();
  }
});

// 텍스트 읽기 버튼 클릭 이벤트
speakButton.addEventListener('click', speakText);

// HTML 코드 표시 함수
function displayHTML(html: string) {
  // HTML을 보기 좋게 포맷팅
  const formatted = formatHTML(html);
  htmlCodeDiv.textContent = formatted;
}

// HTML 포맷팅 함수 (간단한 들여쓰기)
function formatHTML(html: string): string {
  // 너무 긴 HTML은 잘라내기 (처음 5000자만)
  if (html.length > 5000) {
    html = html.substring(0, 5000) + '\n...(생략)...';
  }
  return html;
}

// Content Script로부터 HTML 받기 (단축키 눌렀을 때)
chrome.runtime.onMessage.addListener((request: any) => {
  if (request.type === 'HTML_CAPTURED') {
    displayHTML(request.html);
  }
});

// 현재 탭의 HTML 가져오기
async function getCurrentTabHTML() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      htmlCodeDiv.textContent = '탭 정보를 가져올 수 없습니다.';
      return;
    }

    // Content Script에 HTML 요청
    chrome.tabs.sendMessage(tab.id, { type: 'GET_HTML' }, (response: any) => {
      if (chrome.runtime.lastError) {
        htmlCodeDiv.textContent = '페이지 로드 중이거나 접근할 수 없는 페이지입니다.\n확장 프로그램을 다시 로드하거나 페이지를 새로고침해주세요.';
        return;
      }

      if (response && response.html) {
        displayHTML(response.html);
      }
    });
  } catch (error) {
    htmlCodeDiv.textContent = `오류: ${error}`;
  }
}

// 초기화
initRecognition();