import pool from './db'
import { embed, openai, INTENT_MODEL } from './openai'

export interface ChunkMatch {
  id: string
  content: string
  metadata: Record<string, unknown>
  document_name: string
  similarity: number
  page_url: string | null
  doc_code: string | null
}

export interface IntentAnalysis {
  needsClarification: boolean
  clarifyQuestion: string | null
  complexity: 'brief' | 'standard' | 'detailed'
  searchQuery: string
}

export async function analyzeIntent(
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<IntentAnalysis> {
  const recentHistory = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')

  const response = await openai.chat.completions.create({
    model: INTENT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Ты анализатор запросов к базе строительных нормативов РФ. Отвечай JSON: {"needsClarification": bool, "clarifyQuestion": string|null, "complexity": "brief"|"standard"|"detailed", "searchQuery": string}.
needsClarification=false для технических вопросов о нормах, требованиях, конструкциях, материалах, СП, ГОСТ.
needsClarification=true только для приветствий и нетехнических сообщений без строительной темы.`,
      },
      ...(recentHistory ? [{ role: 'user' as const, content: `История диалога:\n${recentHistory}` }] : []),
      { role: 'user', content: message },
    ],
    max_tokens: 300,
    temperature: 0,
  })

  try {
    const raw = response.choices[0].message.content || '{}'
    const parsed = JSON.parse(raw)
    return {
      needsClarification: parsed.needsClarification === true || parsed.needsClarification === 'true',
      clarifyQuestion: parsed.clarifyQuestion ?? null,
      complexity: ['brief', 'standard', 'detailed'].includes(parsed.complexity)
        ? parsed.complexity
        : 'standard',
      searchQuery: parsed.searchQuery || message,
    }
  } catch {
    return {
      needsClarification: false,
      clarifyQuestion: null,
      complexity: 'standard',
      searchQuery: message,
    }
  }
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
    .map((c, i) => {
      const ref = c.doc_code ?? c.document_name
      const url = c.page_url ? ` (${c.page_url})` : ''
      return `[${i + 1}] ${ref}${url}\n${c.content}`
    })
    .join('\n\n---\n\n')

  return `Ты — НормативПро, экспертный AI-помощник по строительному нормированию России.
Твоя аудитория: инженеры-строители, юристы, специалисты по согласованиям строительных компаний.

ПРАВИЛА:
1. Опирайся ТОЛЬКО на предоставленные фрагменты нормативных документов
2. Каждое утверждение подкрепляй точной ссылкой: [Название документа, п. X.X]
3. Если информации недостаточно — честно сообщи об этом
4. Структура ответа: краткий вывод → подробное объяснение → источники
5. Профессиональный тон
6. В конце каждого утверждения указывай ссылку в формате: [СП XX.XXXXX.XXXX, п. X.X](URL)
7. Если URL источника есть — оборачивай ссылку в markdown-ссылку
${lowConfidenceNote}
КОНТЕКСТ ИЗ НОРМАТИВНЫХ ДОКУМЕНТОВ:
${context}`
}
