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

describe('/api/conversations/[id] route', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('awaits promised params and returns messages for the conversation', async () => {
    const rows = [{ id: 'msg-1', role: 'user', content: 'Question' }]
    queryMock.mockResolvedValueOnce({ rows })

    const response = await GET(
      new Request('http://test.local/api/conversations/conv-1') as never,
      { params: Promise.resolve({ id: 'conv-1' }) }
    )

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({ messages: rows })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE conversation_id = $1'),
      ['conv-1']
    )
  })

  it('returns 500 on query failure', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'))

    const response = await GET(
      new Request('http://test.local/api/conversations/conv-1') as never,
      { params: Promise.resolve({ id: 'conv-1' }) }
    )

    expect(response.status).toBe(500)
    expect(await jsonOf(response)).toEqual({ error: 'Database error' })
  })
})
