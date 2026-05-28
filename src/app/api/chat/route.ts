import { NextRequest } from 'next/server'
import { openai, CHAT_MODEL } from '@/lib/openai'
import { searchChunks, buildSystemPrompt, analyzeIntent } from '@/lib/rag'
import pool from '@/lib/db'
import { langfuse, isLangfuseEnabled } from '@/lib/langfuse'

const MAX_TOKENS_BY_COMPLEXITY = {
  brief: 400,
  standard: 1200,
  detailed: 2500,
}

export async function POST(req: NextRequest) {
  const { message, conversationId } = await req.json()

  if (!message?.trim()) {
    return Response.json({ error: 'Сообщение не может быть пустым' }, { status: 400 })
  }

  const startTime = Date.now()

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

  // Загружаем историю диалога
  type MessageRow = { role: string; content: string }
  let history: MessageRow[] = []
  if (conversationId) {
    const historyResult = await pool.query<MessageRow>(
      `SELECT role, content FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [convId]
    )
    history = historyResult.rows.reverse()
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {

      // Этап 1: анализ намерения
      const intentGeneration = trace?.generation({
        name: 'intent-analysis',
        model: 'gpt-4o-mini',
        input: { message, historyLength: history.length },
      })

      const intent = await analyzeIntent(message, history)

      intentGeneration?.end({ output: intent })

      // Если нужно уточнение — возвращаем без RAG
      if (intent.needsClarification) {
        const clarifyText = intent.clarifyQuestion ?? 'По какому вопросу строительного нормирования могу помочь?'

        await pool.query(
          `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
          [convId, clarifyText]
        )

        send({ type: 'meta', conversationId: convId, sources: [], isClarification: true })
        send({ type: 'delta', content: clarifyText })
        send({ type: 'done', messageId: null, responseTimeMs: Date.now() - startTime })

        if (isLangfuseEnabled()) await langfuse.flushAsync()
        controller.close()
        return
      }

      // Этап 2: поиск в нормативах
      send({ type: 'step', step: 'searching' })

      const ragSpan = trace?.span({ name: 'rag-search', input: { query: intent.searchQuery } })
      const chunks = await searchChunks(intent.searchQuery, 5)
      const systemPrompt = buildSystemPrompt(chunks)

      const sources = chunks.map((c) => ({
        document_name: c.document_name,
        doc_code: c.doc_code,
        excerpt: c.content.slice(0, 200),
        similarity: Math.round(c.similarity * 100),
        page_url: c.page_url,
        page_approx: (c.metadata as Record<string, unknown>)?.page_approx as number | undefined,
      }))

      ragSpan?.end({ output: { chunkCount: chunks.length } })

      send({ type: 'meta', conversationId: convId, sources, isClarification: false })

      // Этап 3: генерация ответа
      const maxTokens = MAX_TOKENS_BY_COMPLEXITY[intent.complexity]

      const generation = trace?.generation({
        name: 'gpt-response',
        model: CHAT_MODEL,
        input: [
          { role: 'system', content: systemPrompt },
          ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: message },
        ],
      })

      const stream = await openai.chat.completions.create({
        model: CHAT_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_completion_tokens: maxTokens,
      })

      let fullResponse = ''

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          fullResponse += delta
          send({ type: 'delta', content: delta })
        }
      }

      generation?.end({
        output: fullResponse,
        usage: { totalTokens: Math.round(fullResponse.length / 4) },
      })
      trace?.update({ output: fullResponse })

      const responseTime = Date.now() - startTime
      const msgRes = await pool.query<{ id: string }>(
        `INSERT INTO messages (conversation_id, role, content, sources, response_time_ms)
         VALUES ($1, 'assistant', $2, $3, $4) RETURNING id`,
        [convId, fullResponse, JSON.stringify(sources), responseTime]
      )

      send({ type: 'done', messageId: msgRes.rows[0].id, responseTimeMs: responseTime })

      if (isLangfuseEnabled()) await langfuse.flushAsync()

      controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Внутренняя ошибка сервера'
        try {
          send({ type: 'delta', content: `\n\n*Ошибка: ${msg}*` })
          send({ type: 'done', messageId: null, responseTimeMs: Date.now() - startTime })
        } catch { /* controller already closed */ }
        controller.close()
      }
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
