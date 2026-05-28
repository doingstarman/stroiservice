import pool from './db'
import { embed } from './openai'

export interface ChunkMatch {
  id: string
  content: string
  metadata: Record<string, unknown>
  document_name: string
  similarity: number
}

export async function searchChunks(query: string, matchCount = 5): Promise<ChunkMatch[]> {
  const embedding = await embed(query)
  const vector = `[${embedding.join(',')}]`

  const result = await pool.query<ChunkMatch>(
    `SELECT * FROM match_chunks($1::vector, $2, $3)`,
    [vector, 0.4, matchCount]
  )
  return result.rows
}

export function buildSystemPrompt(chunks: ChunkMatch[]): string {
  const hasRelevantChunks = chunks.some(c => c.similarity > 0.5)
  const lowConfidenceNote = !hasRelevantChunks && chunks.length > 0
    ? '\n\n[Примечание: найденные фрагменты имеют низкую релевантность. Ответь честно если информации недостаточно.]\n'
    : ''

  const context = chunks
    .map((c, i) => `[${i + 1}] Документ: ${c.document_name}\n${c.content}`)
    .join('\n\n---\n\n')

  return `Ты — НормативПро, экспертный AI-помощник по строительному нормированию России.
Твоя аудитория: инженеры-строители, юристы, специалисты по согласованиям строительных компаний.

ПРАВИЛА:
1. Опирайся ТОЛЬКО на предоставленные фрагменты нормативных документов
2. Каждое утверждение подкрепляй точной ссылкой: [Название документа, п. X.X]
3. Если информации недостаточно — честно сообщи об этом
4. Структура ответа: краткий вывод → подробное объяснение → источники
5. Профессиональный тон
${lowConfidenceNote}
КОНТЕКСТ ИЗ НОРМАТИВНЫХ ДОКУМЕНТОВ:
${context}`
}
