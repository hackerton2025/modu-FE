# 🎙️ Modu

> **시각장애인을 위한 음성 기반 웹 접근성 도우미**
> 음성 명령으로 웹을 탐색하고, AI가 페이지 내용을 요약해 읽어줍니다.

<br />

## ✨ 주요 기능

### 음성 인식
- **Space 키**를 눌러 음성 인식 시작/중지
- 5초 자동 타임아웃으로 자연스러운 대화
- 실시간 음성 인식 결과 표시

### AI 페이지 분석
- **Option+S (Mac) / Alt+S (Windows)**로 현재 페이지 분석
- OpenAI GPT를 활용한 페이지 요약
- 자동 TTS로 분석 결과 읽어주기

### 브라우저 자동화
- MCP 서버 연동으로 복잡한 웹 작업 자동화
- 자연어 명령으로 브라우저 조작
- "네이버에서 치킨집 찾아줘" 같은 직관적인 명령 지원

### 완벽한 접근성
- **WCAG 2.2** 준수
- 스크린 리더 최적화
- 고대비 포커스 표시
- 키보드 단축키 지원

<br />

## 🚀 빠른 시작

### 1. 설치

```bash
# 저장소 클론
git clone https://github.com/hackerton2025/modu-FE.git
cd modu-FE

# 의존성 설치
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 OpenAI API 키를 추가하세요:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 빌드

```bash
npm run build
```

### 4. Chrome에서 확장 프로그램 로드

1. Chrome 주소창에 `chrome://extensions/` 입력
2. 우측 상단 **"개발자 모드"** 활성화
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `dist/` 디렉토리 선택

<br />

## 📁 프로젝트 구조

```
modu-FE/
├── src/                    # 소스 코드
│   ├── background/         # Service Worker (OpenAI API 처리)
│   ├── content/           # Content Scripts (페이지 분석)
│   └── sidepanel/         # Side Panel UI
│       ├── sidepanel.html
│       ├── sidepanel.ts   # 음성 인식, TTS, MCP 통신
│       └── sidepanel.css
│
├── public/                # 정적 파일
│   ├── manifest.json      # Chrome Extension 설정
│   ├── icons/            # 아이콘
│   ├── logos/            # 로고
│   └── fonts/            # 폰트
│
├── scripts/              # 빌드 스크립트
│   └── build.js
│
└── dist/                 # 빌드 결과물 (gitignore)
```

<br />

## ⌨️ 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| **Space** | 음성 인식 시작/중지 |
| **Option+S (Mac)** | 현재 페이지 분석 |
| **Alt+S (Windows)** | 현재 페이지 분석 |
| **Escape** | TTS 음성 읽기 중지 |

<br />

## 🛠️ 기술 스택

### Frontend
- **TypeScript** - 타입 안전성
- **Web Speech API** - 음성 인식 & TTS
- **Chrome Extension API** - 브라우저 통합

### Backend
- **OpenAI API** - GPT-4o-mini 모델
- **MCP Server** - 브라우저 자동화

### Build Tools
- **Webpack** - background.js 번들링
- **TypeScript Compiler** - 모듈 컴파일

<br />

## 🎨 디자인 특징

- **KoddiUDOnGothic** 폰트 사용으로 가독성 향상
- 고대비 포커스 표시 (#FFD700)
- 로딩 애니메이션으로 피드백 제공
- 채팅 스타일 UI로 직관적인 사용성

<br />

## 🔧 개발 명령어

```bash
# 빌드
npm run build

# TypeScript watch 모드 (개발 중)
npm run watch
```

<br />

## 📝 라이센스

이 프로젝트는 해커톤 2025의 일환으로 제작되었습니다.

<br />

## 👥 팀

**팀명**: hackerton2025
**프로젝트**: Modu - 시각장애인 웹 접근성 도우미

<br />

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<br />

---

<div align="center">
  <strong>Made with ❤️ for accessibility</strong>
</div>
