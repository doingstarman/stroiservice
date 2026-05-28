import { describe, it, expect } from 'vitest'
import { splitText } from './ingest'

describe('splitText', () => {
  it('splits regulatory text by paragraph numbers', () => {
    const text = '1.1 Первый пункт нормативного документа содержит требования к конструкции.\n1.2 Второй пункт содержит дополнительные требования и уточнения по применению.\n1.3 Третий пункт описывает исключения и особые случаи применения норм.'
    const chunks = splitText(text)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.some(c => c.includes('1.1'))).toBe(true)
  })

  it('falls back to double newlines when no paragraph numbers', () => {
    const para1 = 'Абзац первый содержит общие сведения о документе и его области применения в строительстве.'
    const para2 = 'Абзац второй содержит технические требования к материалам и конструктивным решениям зданий.'
    const para3 = 'Абзац третий определяет порядок применения и контроля соответствия нормативным требованиям.'
    const para4 = 'Абзац четвёртый содержит дополнительные условия и исключения из общих правил нормирования.'
    const text = `${para1}\n\n${para2}\n\n${para3}\n\n${para4}`
    const chunks = splitText(text)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.some(c => c.includes('Абзац первый'))).toBe(true)
  })

  it('falls back to char split for unstructured text', () => {
    const text = 'А'.repeat(3000)
    const chunks = splitText(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200 + 10)
    }
  })

  it('respects MIN_CHUNK_SIZE and filters short paragraphs', () => {
    const text = 'Короткий.\n\nДостаточно длинный абзац содержащий информацию о строительных нормах и правилах применения конструктивных решений.\n\nЕщё один достаточно длинный абзац о требованиях к несущим конструкциям зданий и сооружений различного назначения.\n\nИ ещё один абзац описывающий порядок расчёта и проверки конструкций при различных видах нагрузок и воздействий.'
    const chunks = splitText(text)
    // Короткий. — меньше MIN_CHUNK_SIZE=100, должен быть отфильтрован или объединён
    const allLong = chunks.every(c => c.length >= 100 || chunks.length === 1)
    expect(allLong).toBe(true)
  })

  it('handles empty string gracefully', () => {
    const chunks = splitText('')
    expect(chunks).toEqual([])
  })
})
