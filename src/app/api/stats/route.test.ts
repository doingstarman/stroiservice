import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    query: queryMock,
  },
}))

import { GET } from './route'

async function jsonOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('/api/stats route', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('normalizes database aggregate values for the dashboard', async () => {
    const recentQuestions = [
      {
        id: 'msg-1',
        content: 'Question',
        created_at: '2026-05-28T10:00:00.000Z',
        conversation_id: 'conv-1',
      },
    ]
    const topDocuments = [{ name: 'SP 54', mentions: 4 }]

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            total_questions: '7',
            total_documents: '2',
            avg_response_ms: '1234.56',
            thumbs_up: '5',
            thumbs_down: '1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: recentQuestions })
      .mockResolvedValueOnce({ rows: topDocuments })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({
      totalQuestions: 7,
      totalDocuments: 2,
      avgResponseMs: 1235,
      thumbsUp: 5,
      thumbsDown: 1,
      recentQuestions,
      topDocuments,
    })
  })

  it('returns 500 when any stats query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('db down'))

    const response = await GET()

    expect(response.status).toBe(500)
    expect(await jsonOf(response)).toHaveProperty('error')
    consoleSpy.mockRestore()
  })
})
