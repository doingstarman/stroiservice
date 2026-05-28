import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryMock, clientQueryMock, releaseMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    query: queryMock,
    connect: vi.fn().mockResolvedValue({
      query: clientQueryMock,
      release: releaseMock,
    }),
  },
}))

import { DELETE, GET } from './route'

async function jsonOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('/api/documents route', () => {
  beforeEach(() => {
    queryMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
  })

  it('returns the document list', async () => {
    const rows = [
      {
        id: 'doc-1',
        name: 'SP 54.13330.2022',
        chunk_count: 12,
        created_at: '2026-05-28T10:00:00.000Z',
      },
    ]
    queryMock.mockResolvedValueOnce({ rows })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({ documents: rows })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM documents d'))
  })

  it('returns 500 when the document list query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('db down'))

    const response = await GET()

    expect(response.status).toBe(500)
    expect(await jsonOf(response)).toHaveProperty('error')
    consoleSpy.mockRestore()
  })

  it('rejects delete requests without id', async () => {
    const request = new Request('http://test.local/api/documents', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })

    const response = await DELETE(request)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(clientQueryMock).not.toHaveBeenCalled()
  })

  it('returns 404 when deleting a missing document', async () => {
    // BEGIN, SELECT (returns []), ROLLBACK
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT — not found
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

    const request = new Request('http://test.local/api/documents', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'missing-doc' }),
    })

    const response = await DELETE(request)

    expect(response.status).toBe(404)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(releaseMock).toHaveBeenCalled()
  })

  it('deletes chunks before deleting the document', async () => {
    // BEGIN, SELECT (found), DELETE chunks, DELETE documents, COMMIT
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] })           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'doc-1' }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] })           // DELETE chunks
      .mockResolvedValueOnce({ rows: [] })           // DELETE documents
      .mockResolvedValueOnce({ rows: [] })           // COMMIT

    const request = new Request('http://test.local/api/documents', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'doc-1' }),
    })

    const response = await DELETE(request)

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toEqual({ ok: true })
    expect(releaseMock).toHaveBeenCalled()

    const calls = clientQueryMock.mock.calls
    expect(calls[2][0]).toContain('DELETE FROM document_chunks')
    expect(calls[2][1]).toEqual(['doc-1'])
    expect(calls[3][0]).toContain('DELETE FROM documents')
    expect(calls[3][1]).toEqual(['doc-1'])
  })
})
