import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './rag'
import type { ChunkMatch } from './rag'

function makeChunk(overrides: Partial<ChunkMatch> = {}): ChunkMatch {
  return {
    id: 'test-id',
    content: 'Минимальная высота жилых помещений составляет 2,7 м.',
    metadata: { chunk_index: 0, total_chunks: 5, page_approx: 12 },
    document_name: 'СП 54.13330.2022',
    similarity: 0.75,
    page_url: null,
    doc_code: null,
    ...overrides,
  }
}

describe('buildSystemPrompt', () => {
  it('includes low-confidence warning when all similarity < 0.5', () => {
    const chunks = [
      makeChunk({ similarity: 0.4 }),
      makeChunk({ similarity: 0.3 }),
    ]
    const prompt = buildSystemPrompt(chunks)
    expect(prompt).toContain('низкую релевантность')
  })

  it('does not include low-confidence warning when some similarity >= 0.5', () => {
    const chunks = [
      makeChunk({ similarity: 0.6 }),
      makeChunk({ similarity: 0.4 }),
    ]
    const prompt = buildSystemPrompt(chunks)
    expect(prompt).not.toContain('низкую релевантность')
  })

  it('includes page_url in context when present', () => {
    const chunks = [
      makeChunk({
        page_url: 'https://docs.cntd.ru/document/1200190920',
        doc_code: 'СП 54.13330.2022',
      }),
    ]
    const prompt = buildSystemPrompt(chunks)
    expect(prompt).toContain('https://docs.cntd.ru/document/1200190920')
  })

  it('uses doc_code over document_name when available', () => {
    const chunks = [
      makeChunk({ doc_code: 'СП 54.13330.2022', document_name: 'Здания жилые многоквартирные' }),
    ]
    const prompt = buildSystemPrompt(chunks)
    expect(prompt).toContain('СП 54.13330.2022')
  })

  it('falls back to document_name when doc_code is null', () => {
    const chunks = [
      makeChunk({ doc_code: null, document_name: 'Здания жилые многоквартирные' }),
    ]
    const prompt = buildSystemPrompt(chunks)
    expect(prompt).toContain('Здания жилые многоквартирные')
  })

  it('formats sources as numbered list in context', () => {
    const chunks = [makeChunk(), makeChunk()]
    const prompt = buildSystemPrompt(chunks)
    expect(prompt).toContain('[1]')
    expect(prompt).toContain('[2]')
  })

  it('returns prompt with citation rules', () => {
    const prompt = buildSystemPrompt([makeChunk()])
    expect(prompt).toContain('markdown')
    expect(prompt).toContain('URL')
  })

  it('handles empty chunks array', () => {
    const prompt = buildSystemPrompt([])
    expect(prompt).toContain('НормативПро')
    expect(prompt).not.toContain('[1]')
  })
})
