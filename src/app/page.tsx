'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Source {
  document_name: string
  doc_code?: string
  excerpt: string
  similarity: number
  page_url?: string
  page_approx?: number
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  responseTimeMs?: number
  feedback?: 1 | -1 | null
  isClarification?: boolean
}

interface Conversation {
  id: string
  title: string
  createdAt: number
  messages: Message[]
}

interface DocumentItem {
  id: string
  name: string
  chunk_count: number
  created_at: string
}

// ─── Source Card ────────────────────────────────────────────────────────────

function SourceCard({ src, query }: { src: Source; query: string }) {
  const [expanded, setExpanded] = useState(false)

  const badgeColor =
    src.similarity >= 80
      ? 'bg-green-900 text-green-400 border-green-700'
      : src.similarity >= 60
        ? 'bg-yellow-900 text-yellow-400 border-yellow-700'
        : 'bg-gray-800 text-gray-400 border-gray-700'

  // Simple keyword highlight: bold any word from query longer than 3 chars
  function highlight(text: string): string {
    const words = query
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (words.length === 0) return text
    const re = new RegExp(`(${words.join('|')})`, 'gi')
    return text.replace(re, '**$1**')
  }

  const displayText = expanded ? src.excerpt : src.excerpt.slice(0, 180)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-xs font-medium text-blue-400 truncate">{src.document_name}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${badgeColor}`}>
          {src.similarity}%
        </span>
      </div>

      <div className="text-xs text-gray-400 leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {highlight(displayText) + (expanded || src.excerpt.length <= 180 ? '' : '...')}
        </ReactMarkdown>
      </div>

      {src.excerpt.length > 180 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-500 hover:text-blue-400 mt-1 transition-colors"
        >
          {expanded ? 'Свернуть' : 'Читать полностью'}
        </button>
      )}

      {src.page_url && (
        <a
          href={src.page_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Открыть источник
          {src.page_approx && (
            <span className="text-gray-600">· стр. ~{src.page_approx}</span>
          )}
        </a>
      )}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  open,
  onClose,
}: {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-64 flex flex-col bg-gray-900 border-r border-gray-800
          transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">История</span>
          <button
            onClick={onClose}
            className="md:hidden text-gray-500 hover:text-gray-300"
            aria-label="Закрыть"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors"
          >
            <span className="text-base">+</span>
            Новый диалог
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-600 px-2 py-4 text-center">
              Диалогов ещё нет
            </p>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => { onSelect(conv.id); onClose() }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors truncate ${
                conv.id === currentId
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              title={conv.title}
            >
              {conv.title}
            </button>
          ))}
        </div>
      </aside>
    </>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 10

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingStep, setThinkingStep] = useState<null | 'analyzing' | 'searching' | 'generating'>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [docCount, setDocCount] = useState<number | null>(null)
  const [dbOk, setDbOk] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load conversations from localStorage
  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      try {
        const stored = localStorage.getItem('np_conversations')
        if (stored) {
          const parsed: Conversation[] = JSON.parse(stored)
          setConversations(parsed.slice(0, MAX_HISTORY))
        }
      } catch {
        // ignore
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('np_conversations', JSON.stringify(conversations.slice(0, MAX_HISTORY)))
    }
  }, [conversations])

  // Fetch document count
  useEffect(() => {
    fetch('/api/documents')
      .then((r) => r.json())
      .then((data: { documents?: DocumentItem[]; error?: string }) => {
        if (data.documents) {
          setDocCount(data.documents.length)
          setDbOk(true)
        } else {
          setDbOk(false)
        }
      })
      .catch(() => setDbOk(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveConversation = useCallback(
    (convId: string, msgs: Message[], firstUserMsg: string) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === convId)
        const updated: Conversation = {
          id: convId,
          title: firstUserMsg.slice(0, 60) || 'Диалог',
          createdAt: existing?.createdAt ?? Date.now(),
          messages: msgs,
        }
        const filtered = prev.filter((c) => c.id !== convId)
        return [updated, ...filtered].slice(0, MAX_HISTORY)
      })
    },
    []
  )

  function startNew() {
    setCurrentConvId(null)
    setMessages([])
    setInput('')
  }

  function selectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return
    setCurrentConvId(id)
    setMessages(conv.messages)
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setLoading(true)
    setThinkingStep('analyzing')

    const assistantIndex = newMessages.length
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId: currentConvId }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let sources: Source[] = []
      let serverConvId = currentConvId
      let isClarification = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = JSON.parse(line.slice(6))

          if (data.type === 'step') {
            if (data.step === 'searching') setThinkingStep('searching')
          } else if (data.type === 'meta') {
            serverConvId = data.conversationId
            setCurrentConvId(data.conversationId)
            sources = data.sources
            isClarification = Boolean(data.isClarification)
            setThinkingStep('generating')
          } else if (data.type === 'delta') {
            setThinkingStep(null)
            setMessages((prev) => {
              const updated = [...prev]
              updated[assistantIndex] = {
                ...updated[assistantIndex],
                content: updated[assistantIndex].content + data.content,
              }
              return updated
            })
          } else if (data.type === 'done') {
            setThinkingStep(null)
            setMessages((prev) => {
              const updated = [...prev]
              updated[assistantIndex] = {
                ...updated[assistantIndex],
                id: data.messageId ?? undefined,
                sources: isClarification ? [] : sources,
                responseTimeMs: isClarification ? undefined : data.responseTimeMs,
                isClarification,
              }
              if (serverConvId) {
                saveConversation(serverConvId, updated, userMessage)
              }
              return updated
            })
          }
        }
      }
    } catch {
      setThinkingStep(null)
      setMessages((prev) => {
        const updated = [...prev]
        updated[assistantIndex] = {
          ...updated[assistantIndex],
          content: 'Ошибка при получении ответа. Попробуйте ещё раз.',
        }
        return updated
      })
    } finally {
      setLoading(false)
      setThinkingStep(null)
    }
  }

  async function sendFeedback(messageId: string, feedback: 1 | -1, idx: number) {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, feedback }),
    })
    setMessages((prev) => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], feedback }
      return updated
    })
  }

  const exampleQuestions = [
    'Какие требования к армированию монолитных перекрытий по СП 63?',
    'Минимальная высота этажа в жилом доме по нормам?',
    'Требования к противопожарным расстояниям между зданиями',
    'Нормы инсоляции для жилых помещений',
  ]

  function sourceQueryFor(messageIndex: number): string {
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return ''
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        currentId={currentConvId}
        onSelect={selectConversation}
        onNew={startNew}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-gray-200 p-1"
              aria-label="Открыть историю"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
              Н
            </div>
            <div>
              <h1 className="font-semibold text-white">НормативПро</h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                AI-помощник по строительному нормированию
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* DB status */}
            <div className="flex items-center gap-1.5" title={dbOk ? 'БД подключена' : 'Нет подключения к БД'}>
              <span
                className={`w-2 h-2 rounded-full ${dbOk ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-xs text-gray-500 hidden sm:inline">
                {dbOk ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>

            {/* Doc count */}
            {docCount !== null && (
              <span className="text-xs text-gray-500 hidden sm:inline">
                📄 {docCount} {docCount === 1 ? 'документ' : docCount < 5 ? 'документа' : 'документов'}
              </span>
            )}

            <div className="flex items-center gap-2">
              <a
                href="/stats"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 px-3 py-1.5 rounded-lg"
              >
                Статистика
              </a>
              <a
                href="/admin"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 px-3 py-1.5 rounded-lg"
              >
                Документы
              </a>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="py-12 fade-in">
              <div className="flex items-center justify-center mb-6">
                <div className="w-14 h-14 bg-blue-600/10 border border-blue-600/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2 text-center">
                Задайте вопрос по нормативам
              </h2>
              <p className="text-gray-500 text-sm mb-1 text-center">
                Поиск по базе СП, ГОСТ, СанПиН с точными ссылками на пункты
              </p>
              <p className="text-gray-600 text-xs mb-8 text-center">
                Ответ за секунды вместо часов ручного поиска
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exampleQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="group text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-all flex items-start gap-3"
                  >
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                    <span className="leading-snug">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                  Н
                </div>
              )}
              <div className={`max-w-2xl w-full ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white inline-block max-w-xl'
                      : 'bg-gray-900 border border-gray-800 text-gray-100 w-full'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    msg.isClarification ? (
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-yellow-500/20 border border-yellow-500/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none
                        prose-headings:text-gray-100 prose-headings:font-semibold
                        prose-p:text-gray-200 prose-p:leading-relaxed
                        prose-strong:text-white
                        prose-li:text-gray-200
                        prose-code:text-blue-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700
                        prose-blockquote:border-l-blue-500 prose-blockquote:text-gray-400
                        prose-table:text-sm
                        prose-th:text-gray-300 prose-th:bg-gray-800
                        prose-td:text-gray-300 prose-td:border-gray-700
                        prose-hr:border-gray-700
                        [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-700 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-gray-700 [&_td]:px-3 [&_td]:py-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col gap-2 py-1">
                      {thinkingStep && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-3 h-3 animate-spin text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          {thinkingStep === 'analyzing' && 'Анализирую вопрос...'}
                          {thinkingStep === 'searching' && 'Ищу в нормативах...'}
                          {thinkingStep === 'generating' && 'Формирую ответ...'}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Источники:</p>
                    {msg.sources.map((src, i) => (
                      <SourceCard key={i} src={src} query={sourceQueryFor(idx)} />
                    ))}
                  </div>
                )}

                {/* Feedback row */}
                {msg.role === 'assistant' && msg.responseTimeMs && (
                  <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-500 font-medium">
                        ⚡ Ответ за {(msg.responseTimeMs / 1000).toFixed(1)} сек
                      </span>
                      <span className="text-xs text-gray-600 hidden sm:inline">
                        (обычный поиск: 2–4 часа)
                      </span>
                    </div>
                    {msg.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => msg.id && sendFeedback(msg.id, 1, idx)}
                          className={`transition-opacity ${
                            msg.feedback === 1 ? 'opacity-100' : 'opacity-40 hover:opacity-100'
                          }`}
                          aria-label="Полезно"
                        >
                          <svg className="w-4 h-4" fill={msg.feedback === 1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => msg.id && sendFeedback(msg.id, -1, idx)}
                          className={`transition-opacity ${
                            msg.feedback === -1 ? 'opacity-100' : 'opacity-40 hover:opacity-100'
                          }`}
                          aria-label="Не полезно"
                        >
                          <svg className="w-4 h-4" fill={msg.feedback === -1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 px-4 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Задайте вопрос по строительным нормам..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0 flex items-center justify-center"
              title="Отправить"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
