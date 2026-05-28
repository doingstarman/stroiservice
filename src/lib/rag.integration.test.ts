import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbQueryMock, embedMock, completionCreateMock } = vi.hoisted(() => ({
  dbQueryMock: vi.fn(),
  embedMock: vi.fn(),
  completionCreateMock: vi.fn(),
}))

vi.mock('./db', () => ({
  default: {
    query: dbQueryMock,
  },
}))

vi.mock('./openai', () => ({
  INTENT_MODEL: 'intent-test-model',
  embed: embedMock,
  openai: {
    chat: {
      completions: {
        create: completionCreateMock,
      },
    },
  },
}))

import { analyzeIntent, searchChunks } from './rag'

describe('RAG service integrations', () => {
  beforeEach(() => {
    dbQueryMock.mockReset()
    embedMock.mockReset()
    completionCreateMock.mockReset()
  })

  it('parses intent JSON and sends recent history to the intent model', async () => {
    completionCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              needsClarification: false,
              clarifyQuestion: null,
              complexity: 'detailed',
              searchQuery: 'fire distance between buildings',
            }),
          },
        },
      ],
    })

    const result = await analyzeIntent('Need a full answer', [
      { role: 'user', content: 'old-1' },
      { role: 'assistant', content: 'old-2' },
      { role: 'user', content: 'recent-1' },
      { role: 'assistant', content: 'recent-2' },
      { role: 'user', content: 'recent-3' },
    ])

    expect(result).toEqual({
      needsClarification: false,
      clarifyQuestion: null,
      complexity: 'detailed',
      searchQuery: 'fire distance between buildings',
    })
    expect(completionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'intent-test-model',
        response_format: { type: 'json_object' },
        temperature: 0,
      })
    )
    const messages = completionCreateMock.mock.calls[0][0].messages
    expect(messages.some((m: { content: string }) => m.content.includes('old-1'))).toBe(false)
    expect(messages.some((m: { content: string }) => m.content.includes('recent-1'))).toBe(true)
  })

  it('falls back to the user message when intent JSON is invalid', async () => {
    completionCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'not-json' } }],
    })

    const result = await analyzeIntent('What is the minimum ceiling height?', [])

    expect(result).toEqual({
      needsClarification: false,
      clarifyQuestion: null,
      complexity: 'standard',
      searchQuery: 'What is the minimum ceiling height?',
    })
  })

  it('uses standard complexity when the model returns an unknown value', async () => {
    completionCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              needsClarification: true,
              clarifyQuestion: 'Clarify the building type',
              complexity: 'huge',
              searchQuery: '',
            }),
          },
        },
      ],
    })

    const result = await analyzeIntent('Question', [])

    expect(result).toEqual({
      needsClarification: true,
      clarifyQuestion: 'Clarify the building type',
      complexity: 'standard',
      searchQuery: 'Question',
    })
  })

  it('searches chunks with an embedding vector and requested match count', async () => {
    const rows = [{ id: 'chunk-1', content: 'content', similarity: 0.81 }]
    embedMock.mockResolvedValueOnce([0.1, 0.2, 0.3])
    dbQueryMock.mockResolvedValueOnce({ rows })

    const result = await searchChunks('query text', 8)

    expect(result).toBe(rows)
    expect(embedMock).toHaveBeenCalledWith('query text')
    expect(dbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('match_chunks'),
      ['[0.1,0.2,0.3]', 0.4, 8]
    )
  })
})
