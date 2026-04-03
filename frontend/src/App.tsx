import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity,
  ClipboardCheck,
  LoaderCircle,
  MessageSquareText,
  SendHorizontal,
  ShieldPlus,
  Stethoscope,
  UserRound,
} from 'lucide-react'

type Role = '医生' | '患者'

type ChatMessage = {
  id: string
  role: Role
  content: string
}

type StoredSession = {
  sessionId: string
}

type ScoreItem = {
  label: string
  score: number
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: '医生',
    content: '您好，我是今天的接诊医生。请问您最不舒服的地方是哪里？',
  },
  {
    id: 'm2',
    role: '患者',
    content: '医生您好，我这三天一直头痛，尤其是下午和晚上会加重。',
  },
  {
    id: 'm3',
    role: '医生',
    content: '头痛是持续性的还是一阵一阵的？有恶心、呕吐或发热吗？',
  },
  {
    id: 'm4',
    role: '患者',
    content: '像一阵一阵地跳着痛，偶尔有点恶心，没有发热。',
  },
]

const BASE_SCORE_ITEMS: ScoreItem[] = [
  { label: '主诉澄清', score: 76 },
  { label: '伴随症状追问', score: 68 },
  { label: '危险信号识别', score: 62 },
  { label: '沟通同理心', score: 84 },
]

const MOCK_RESPONSES: Array<{ pattern: RegExp; answer: string }> = [
  {
    pattern: /(头痛|部位|前额|后枕)/,
    answer:
      '主要是两侧太阳穴到后枕部，像被绷紧一样，下午会明显一些，休息后会稍好一点。',
  },
  {
    pattern: /(恶心|呕吐|畏光|视物)/,
    answer:
      '会有轻微恶心，没有呕吐。看强光会不太舒服，但视物没有明显重影。',
  },
  {
    pattern: /(既往史|慢性病|高血压|糖尿病)/,
    answer: '我以前没有高血压和糖尿病，平时身体还可以，几乎不怎么住院。',
  },
  {
    pattern: /(药物|过敏)/,
    answer: '目前没有已知药物过敏史，平时偶尔会吃布洛芬止痛。',
  },
]

const DEFAULT_MOCK_RESPONSE =
  '这两天工作压力比较大、睡得也晚，头痛会反复出现，但没有出现明显肢体无力或意识不清。'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const STORAGE_KEY = 'medical-training-demo-session'

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getMockResponse(question: string) {
  const hit = MOCK_RESPONSES.find((item) => item.pattern.test(question))
  return hit?.answer ?? DEFAULT_MOCK_RESPONSE
}

async function streamFromMock(
  text: string,
  onChunk: (chunk: string) => void,
) {
  for (const char of text) {
    onChunk(char)
    await wait(18 + Math.floor(Math.random() * 24))
  }
}

async function streamFromBackend(
  sessionId: string,
  question: string,
  onChunk: (chunk: string) => void,
) {
  const response = await fetch(`${API_BASE_URL}/api/patient/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId, question }),
  })

  if (!response.ok || !response.body) {
    throw new Error('backend stream unavailable')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      onChunk(decoder.decode(value, { stream: true }))
    }
  }
}

async function createSession(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/session`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('create session failed')
  }
  const data = (await response.json()) as { session_id: string }
  return data.session_id
}

async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/messages`)
  if (!response.ok) {
    throw new Error('load session history failed')
  }
  const data = (await response.json()) as {
    session_id: string
    messages: Array<{ role: 'doctor' | 'patient'; content: string; created_at: string }>
  }
  return data.messages.map((item) => ({
    id: crypto.randomUUID(),
    role: item.role === 'doctor' ? '医生' : '患者',
    content: item.content,
  }))
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [inputValue, setInputValue] = useState('请问头痛主要集中在前额还是后枕部？')
  const [scoreItems, setScoreItems] = useState<ScoreItem[]>(BASE_SCORE_ITEMS)
  const [aiSuggestion, setAiSuggestion] = useState(
    '下一轮建议追问：既往偏头痛史、近期睡眠质量、是否视物模糊。',
  )
  const [streamMode, setStreamMode] = useState<'mock' | 'backend'>('mock')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      try {
        const savedRaw = localStorage.getItem(STORAGE_KEY)
        const saved = savedRaw ? (JSON.parse(savedRaw) as StoredSession) : null
        const activeSessionId = saved?.sessionId ?? (await createSession())
        if (!saved?.sessionId) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: activeSessionId }))
        }

        const history = await getSessionHistory(activeSessionId)
        if (!cancelled) {
          setSessionId(activeSessionId)
          if (history.length > 0) {
            setMessages(history)
          }
        }
      } catch {
        if (!cancelled) {
          setStreamMode('mock')
        }
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const node = chatContainerRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [messages])

  const totalScore = useMemo(() => {
    const sum = scoreItems.reduce((acc, item) => acc + item.score, 0)
    return Math.round(sum / scoreItems.length)
  }, [scoreItems])

  const updateEvaluationByQuestion = (question: string) => {
    setScoreItems((prev) =>
      prev.map((item) => {
        if (item.label === '主诉澄清' && /(部位|性质|多久|持续)/.test(question)) {
          return { ...item, score: Math.min(item.score + 6, 98) }
        }
        if (item.label === '伴随症状追问' && /(恶心|呕吐|发热|畏光|视物)/.test(question)) {
          return { ...item, score: Math.min(item.score + 8, 98) }
        }
        if (item.label === '危险信号识别' && /(意识|抽搐|肢体|突发|最严重)/.test(question)) {
          return { ...item, score: Math.min(item.score + 10, 98) }
        }
        if (item.label === '沟通同理心' && /(请您|辛苦|理解|别担心)/.test(question)) {
          return { ...item, score: Math.min(item.score + 5, 98) }
        }
        return item
      }),
    )

    if (/(既往|过敏|药物)/.test(question)) {
      setAiSuggestion('做得很好：你开始补齐既往史与用药史，请继续追问家族史与睡眠节律。')
    } else if (/(意识|肢体|最严重|突发)/.test(question)) {
      setAiSuggestion('优秀：你已触达危险信号筛查，下一步建议追问生命体征与神经系统体征。')
    } else {
      setAiSuggestion('建议下一轮追问：头痛诱因、缓解因素、近期压力与睡眠变化。')
    }
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const question = inputValue.trim()
    if (!question || isStreaming) return

    const doctorMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: '医生',
      content: question,
    }

    const patientMessageId = crypto.randomUUID()

    setMessages((prev) => [
      ...prev,
      doctorMessage,
      { id: patientMessageId, role: '患者', content: '' },
    ])
    setInputValue('')
    setIsStreaming(true)
    updateEvaluationByQuestion(question)

    const pushChunk = (chunk: string) => {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === patientMessageId
            ? { ...item, content: `${item.content}${chunk}` }
            : item,
        ),
      )
    }

    try {
      if (!sessionId) throw new Error('session not ready')
      await streamFromBackend(sessionId, question, pushChunk)
      setStreamMode('backend')
    } catch {
      await streamFromMock(getMockResponse(question), pushChunk)
      setStreamMode('mock')
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <main className="min-h-screen bg-transparent p-6 md:p-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 text-slate-200">
            <div className="rounded-xl bg-cyan-400/15 p-2 text-cyan-300">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                医学生临床问诊模拟工作台
              </h1>
              <p className="mt-1 text-sm text-slate-300/80">
                交互预览版 · 当前回复模式：{streamMode === 'backend' ? '后端流式' : '前端 Mock 流式'}
              </p>
              <p className="mt-1 text-xs text-slate-400">Session: {sessionId || '初始化中...'}</p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <aside className="xl:col-span-3 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-medium text-slate-100">患者基本信息</h2>
            </div>

            <div className="space-y-3 text-sm text-slate-200">
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">姓名</p>
                <p className="mt-1 text-base text-slate-100">王敏</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">年龄</p>
                <p className="mt-1 text-base text-slate-100">32 岁</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">主诉</p>
                <p className="mt-1 text-base text-slate-100">头痛三天</p>
              </div>
              <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-amber-100">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide">
                  <ShieldPlus className="h-3.5 w-3.5" />
                  教学提示
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  请重点追问头痛部位、性质、诱因、伴随症状及既往史。
                </p>
              </div>
            </div>
          </aside>

          <section className="xl:col-span-6 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-medium text-slate-100">医患对话框</h2>
            </div>

            <div
              ref={chatContainerRef}
              className="mb-4 h-[520px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/45 p-4"
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                    message.role === '医生'
                      ? 'ml-auto border-cyan-300/30 bg-cyan-400/15 text-cyan-50'
                      : 'mr-auto border-slate-600/40 bg-slate-700/30 text-slate-100'
                  }`}
                >
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-70">
                    {message.role}
                  </p>
                  <p>{message.content || '...'}</p>
                </article>
              ))}
            </div>

            <form
              onSubmit={handleSend}
              className="rounded-xl border border-white/10 bg-slate-900/40 p-3"
            >
              <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">
                医生输入问题
              </label>
              <div className="flex gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="请输入你想追问的问题..."
                  className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <button
                  type="submit"
                  disabled={isStreaming}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-400/20 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStreaming ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      回复中
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="h-4 w-4" />
                      发送
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <aside className="xl:col-span-3 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-medium text-slate-100">智能实时评估板</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-100/80">
                  当前综合评分
                </p>
                <p className="mt-2 flex items-baseline gap-2 text-3xl font-semibold text-emerald-100">
                  {totalScore}
                  <span className="text-sm font-normal text-emerald-100/70">/ 100</span>
                </p>
              </div>

              <div className="space-y-3">
                {scoreItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-200">{item.label}</span>
                      <span className="text-slate-100">{item.score}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700/60">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-blue-400"
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
                <p className="mb-2 flex items-center gap-2 text-slate-100">
                  <Activity className="h-4 w-4 text-cyan-300" />
                  AI 建议（实时 mock）
                </p>
                <p>{aiSuggestion}</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

export default App
