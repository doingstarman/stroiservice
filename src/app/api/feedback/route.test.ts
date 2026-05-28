import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    query: queryMock,
  },
}))

import { POST } from './route'

async function jsonOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('/api/feedback route', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('rejects missing message id', async () => {
    const request = new Request('http://test.local/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ feedback: 1 }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('rejects unsupported feedback values', async () => {
    const request = new Request('http://test.local/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1', feedback: 0 }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('stores feedback only for assistant messages', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const request = new Request('http://test.local/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1', feedback: -1 }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({ ok: true })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $2 AND role = 'assistant'"),
      [-1, 'msg-1']
    )
  })
})
