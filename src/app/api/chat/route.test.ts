import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rag', () => ({
  analyzeIntent: vi.fn(),
  searchChunks: vi.fn(),
  buildSystemPrompt: vi.fn(),
}))

vi.mock('@/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  CHAT_MODEL: 'gpt-test',
  INTENT_MODEL: 'gpt-test-mini',
  EMBEDDING_MODEL: 'text-embedding-test',
  embed: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}))

vi.mock('@/lib/langfuse', () => ({
  langfuse: { trace: vi.fn(), flushAsync: vi.fn() },
  isLangfuseEnabled: vi.fn().mockReturnValue(false),
}))

import { POST } from './route'
import * as rag from '@/lib/rag'
import * as openaiLib from '@/lib/openai'
import pool from '@/lib/db'

// Helper: читает все SSE события из ReadableStream
async function collectSSE(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => JSON.parse(line.slice(6)))
}

// Helper: создаёт фейковый async-итерируемый стрим от OpenAI
function makeOpenAIStream(deltas: string[]) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i >= deltas.length) return { done: true, value: undefined }
          return { done: false, value: { choices: [{ delta: { content: deltas[i++] } }] } }
        },
      }
    },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // По умолчанию: новый диалог
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: 'conv-123' }] } as never) // INSERT conversation
      .mockResolvedValueOnce({ rows: [] } as never)                    // INSERT user message
      .mockResolvedValueOnce({ rows: [{ id: 'msg-456' }] } as never)  // INSERT assistant message
  })

  it('returns 400 for empty message', async () => {
    const res = await POST(makeRequest({ message: '' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns clarification stream when needsClarification is true', async () => {
    vi.mocked(rag.analyzeIntent).mockResolvedValue({
      needsClarification: true,
      clarifyQuestion: 'Уточните, какой именно документ вас интересует?',
      complexity: 'standard',
      searchQuery: '',
    })

    const res = await POST(makeRequest({ message: 'привет' }) as never)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')

    const events = await collectSSE(res)
    const meta = events.find(e => e.type === 'meta') as Record<string, unknown>
    const done = events.find(e => e.type === 'done')
    const delta = events.find(e => e.type === 'delta')

    expect(meta?.isClarification).toBe(true)
    expect(meta?.sources).toEqual([])
    expect(delta?.content).toContain('Уточните')
    expect(done).toBeTruthy()

    // RAG не должен вызываться при уточнении
    expect(rag.searchChunks).not.toHaveBeenCalled()
  })

  it('uses reformulated searchQuery for RAG search', async () => {
    vi.mocked(rag.analyzeIntent).mockResolvedValue({
      needsClarification: false,
      clarifyQuestion: null,
      complexity: 'standard',
      searchQuery: 'требования армирование монолитные перекрытия',
    })
    vi.mocked(rag.searchChunks).mockResolvedValue([])
    vi.mocked(rag.buildSystemPrompt).mockReturnValue('system prompt')
    vi.mocked(openaiLib.openai.chat.completions.create).mockResolvedValue(
      makeOpenAIStream(['Ответ', ' на вопрос']) as never
    )

    await POST(makeRequest({ message: 'армирование' }) as never)

    expect(rag.searchChunks).toHaveBeenCalledWith(
      'требования армирование монолитные перекрытия',
      5
    )
  })

  it('streams delta events and emits meta + done', async () => {
    vi.mocked(rag.analyzeIntent).mockResolvedValue({
      needsClarification: false,
      clarifyQuestion: null,
      complexity: 'brief',
      searchQuery: 'высота потолка жилой дом',
    })
    vi.mocked(rag.searchChunks).mockResolvedValue([])
    vi.mocked(rag.buildSystemPrompt).mockReturnValue('system prompt')
    vi.mocked(openaiLib.openai.chat.completions.create).mockResolvedValue(
      makeOpenAIStream(['По ', 'СП 54', ' — 2.7 м']) as never
    )

    const res = await POST(makeRequest({ message: 'высота потолка' }) as never)
    const events = await collectSSE(res)

    const types = events.map(e => e.type)
    expect(types).toContain('step')
    expect(types).toContain('meta')
    expect(types).toContain('delta')
    expect(types).toContain('done')

    const fullText = events
      .filter(e => e.type === 'delta')
      .map(e => e.content)
      .join('')
    expect(fullText).toBe('По СП 54 — 2.7 м')
  })

  it('includes history in messages for existing conversation', async () => {
    // Reset beforeEach defaults — this is an existing conversation (no INSERT conversation step)
    vi.mocked(pool.query).mockReset()
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)  // INSERT user message
      .mockResolvedValueOnce({ rows: [
        { role: 'user', content: 'предыдущий вопрос' },
        { role: 'assistant', content: 'предыдущий ответ' },
      ] } as never)  // history SELECT
      .mockResolvedValueOnce({ rows: [{ id: 'msg-789' }] } as never)  // INSERT assistant

    vi.mocked(rag.analyzeIntent).mockResolvedValue({
      needsClarification: false,
      clarifyQuestion: null,
      complexity: 'standard',
      searchQuery: 'продолжение',
    })
    vi.mocked(rag.searchChunks).mockResolvedValue([])
    vi.mocked(rag.buildSystemPrompt).mockReturnValue('system')

    const createMock = vi.mocked(openaiLib.openai.chat.completions.create)
    createMock.mockResolvedValue(makeOpenAIStream(['ok']) as never)

    const res = await POST(makeRequest({ message: 'продолжи', conversationId: 'existing-conv' }) as never)
    await res.text() // consume stream so ReadableStream.start() completes

    expect(createMock).toHaveBeenCalledOnce()
    const callArgs = createMock.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
    const roles = callArgs.messages.map(m => m.role)
    expect(roles).toContain('user')
    expect(roles).toContain('assistant')
    // История вошла в prompt
    const contents = callArgs.messages.map(m => m.content)
    expect(contents).toContain('предыдущий вопрос')
  })
})
