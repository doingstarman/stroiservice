import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ingestPdfMock } = vi.hoisted(() => ({
  ingestPdfMock: vi.fn(),
}))

vi.mock('@/lib/ingest', () => ({
  ingestPdf: ingestPdfMock,
}))

import { POST } from './route'

function makeRequest(formData: FormData): Request {
  return new Request('http://test.local/api/ingest', {
    method: 'POST',
    body: formData,
  })
}

async function jsonOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('/api/ingest route', () => {
  beforeEach(() => {
    ingestPdfMock.mockReset()
  })

  it('requires both file and document name', async () => {
    const formData = new FormData()
    formData.set('name', 'SP 54')

    const response = await POST(makeRequest(formData) as never)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(ingestPdfMock).not.toHaveBeenCalled()
  })

  it('rejects non-pdf filenames before reading the file', async () => {
    const formData = new FormData()
    formData.set('name', 'Document')
    formData.set('file', new File(['plain text'], 'document.txt', { type: 'text/plain' }))

    const response = await POST(makeRequest(formData) as never)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(ingestPdfMock).not.toHaveBeenCalled()
  })

  it('rejects files without a PDF signature', async () => {
    const formData = new FormData()
    formData.set('name', 'Document')
    formData.set('file', new File(['not a pdf'], 'document.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData) as never)

    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
    expect(ingestPdfMock).not.toHaveBeenCalled()
  })

  it('passes uploaded PDF metadata to ingestPdf', async () => {
    ingestPdfMock.mockResolvedValueOnce({ documentId: 'doc-1', chunkCount: 3 })
    const formData = new FormData()
    formData.set('name', 'SP 54')
    formData.set('pageUrl', 'https://docs.example/sp54')
    formData.set('cntdId', '1200000000')
    formData.set('altUrl', 'https://mirror.example/sp54')
    formData.set('docCode', 'SP 54.13330.2022')
    formData.set('file', new File(['%PDF-1.7 body'], 'sp54.pdf', { type: 'application/pdf' }))

    const response = await POST(makeRequest(formData) as never)

    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toMatchObject({ documentId: 'doc-1', chunkCount: 3 })
    expect(ingestPdfMock).toHaveBeenCalledOnce()

    const [buffer, fileName, documentName, options] = ingestPdfMock.mock.calls[0]
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
    expect(fileName).toBe('sp54.pdf')
    expect(documentName).toBe('SP 54')
    expect(options).toEqual({
      pageUrl: 'https://docs.example/sp54',
      cntdId: '1200000000',
      altUrl: 'https://mirror.example/sp54',
      docCode: 'SP 54.13330.2022',
    })
  })
})
