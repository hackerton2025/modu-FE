import OpenAI from 'openai'
import 'dotenv/config'

interface HtmlAnalyzerConfig {
  apiKey?: string
  model?: string
}

type GlobalWithProcess = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

export interface HtmlAnalyzer {
  analyzeHtml: (htmlContent: string) => Promise<string>
}

export function createHtmlAnalyzer({
  apiKey,
  model = 'gpt-4o-mini',
}: HtmlAnalyzerConfig = {}): HtmlAnalyzer {
  const globalWithProcess = globalThis as GlobalWithProcess
  const resolvedApiKey = apiKey ?? globalWithProcess.process?.env?.OPENAI_API_KEY

  if (!resolvedApiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey explicitly.')
  }

  const client = new OpenAI({ apiKey: resolvedApiKey })

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
    `
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }]
    })
    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error('OpenAI response did not include any message content.')
    }

    return content
  }

  return { analyzeHtml }
}
