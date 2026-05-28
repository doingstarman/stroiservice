import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    query: queryMock,
  },
}))

import { DELETE, GET } from './route'

async function jsonOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('/api/conversations route', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns recent conversations', async () => {
    const rows = [{ id: 'conv-1', first_message: 'Hello', message_count: 2 }]
    queryMock.mockResolvedValueOnce({ rows })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({ conversations: rows })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('LIMIT 20'))
  })

  it('requires id on delete', async () => {
    const request = new Request('http://test.local/api/conversations', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })

    const response = await DELETE(request as never)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toEqual({ error: 'ID required' })
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('deletes a conversation by id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const request = new Request('http://test.local/api/conversations', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'conv-1' }),
    })

    const response = await DELETE(request as never)

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({ success: true })
    expect(queryMock).toHaveBeenCalledWith(
      'DELETE FROM conversations WHERE id = $1',
      ['conv-1']
    )
  })
})
