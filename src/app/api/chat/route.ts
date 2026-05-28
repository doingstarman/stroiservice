import { NextRequest } from 'next/server'
import { openai, CHAT_MODEL } from '@/lib/openai'
import { searchChunks, buildSystemPrompt } from '@/lib/rag'
import pool from '@/lib/db'
import { langfuse, isLangfuseEnabled } from '@/lib/langfuse'

export async function POST(req: NextRequest) {
  const { message, conversationId } = await req.json()

  if (!message?.trim()) {
    return Response.json({ error: 'Сообщение не может быть пустым' }, { status: 400 })
  }

  const startTime = Date.now()

  // Langfuse: начинаем trace для всего запроса
  const trace = isLangfuseEnabled() ? langfuse.trace({
    name: 'chat-request',
    metadata: { conversationId: conversationId ?? null },
  }) : null

  // Получаем или создаём диалог
  let convId = conversationId
  if (!convId) {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO conversations DEFAULT VALUES RETURNING id`
    )
    convId = res.rows[0].id
  }

  // Сохраняем вопрос пользователя
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
    [convId, message]
  )

  // Langfuse: span для RAG поиска
  const ragSpan = trace?.span({ name: 'rag-search', input: { query: message } })

  // RAG: ищем релевантные чанки
  const chunks = await searchChunks(message, 5)
  const systemPrompt = buildSystemPrompt(chunks)

  // Формируем источники для ответа
  const sources = chunks.map((c) => ({
    document_name: c.document_name,
    excerpt: c.content.slice(0, 200),
    similarity: Math.round(c.similarity * 100),
  }))

  // Langfuse: завершаем RAG span
  ragSpan?.end({ output: { chunkCount: chunks.length, sources: sources.map(s => s.document_name) } })

  // Загружаем историю диалога (только для существующих диалогов)
  type MessageRow = { role: string; content: string }
  let history: MessageRow[] = []
  if (conversationId) {  // только если диалог уже существовал, не новый
    const historyResult = await pool.query<MessageRow>(
      `SELECT role, content FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [convId]
    )
    history = historyResult.rows.reverse() // DESC → ASC
  }

  // Langfuse: generation для OpenAI вызова
  const generation = trace?.generation({
    name: 'gpt-4o-response',
    model: CHAT_MODEL,
    input: [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ],
  })

  // Стриминг от GPT-4o
  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ],
    temperature: 0.1,
    max_tokens: 1500,
  })

  let fullResponse = ''

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      // Сначала отправляем метаданные
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'meta', conversationId: convId, sources })}\n\n`
        )
      )

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          fullResponse += delta
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
          )
        }
      }

      // Langfuse: завершаем generation и trace
      generation?.end({
        output: fullResponse,
        usage: { totalTokens: Math.round(fullResponse.length / 4) },
      })
      trace?.update({ output: fullResponse })

      // Сохраняем ответ ассистента
      const responseTime = Date.now() - startTime
      const msgRes = await pool.query<{ id: string }>(
        `INSERT INTO messages (conversation_id, role, content, sources, response_time_ms)
         VALUES ($1, 'assistant', $2, $3, $4) RETURNING id`,
        [convId, fullResponse, JSON.stringify(sources), responseTime]
      )

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'done', messageId: msgRes.rows[0].id, responseTimeMs: responseTime })}\n\n`
        )
      )

      // Langfuse: сбрасываем буфер событий
      if (isLangfuseEnabled()) await langfuse.flushAsync()

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
