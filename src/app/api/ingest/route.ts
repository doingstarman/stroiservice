import { NextRequest } from 'next/server'
import { ingestPdf } from '@/lib/ingest'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const documentName = formData.get('name') as string | null

  if (!file || !documentName) {
    return Response.json({ error: 'Нужны файл и название документа' }, { status: 400 })
  }

  if (!file.name.endsWith('.pdf')) {
    return Response.json({ error: 'Поддерживаются только PDF файлы' }, { status: 400 })
  }

  // Проверка размера
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'Файл слишком большой. Максимум 50 МБ.' }, { status: 400 })
  }

  // Читаем буфер
  const buffer = Buffer.from(await file.arrayBuffer())

  // Проверка что это PDF
  if (buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
    return Response.json({ error: 'Файл не является валидным PDF.' }, { status: 400 })
  }

  const pageUrl = (formData.get('pageUrl') as string | null) ?? undefined
  const cntdId = (formData.get('cntdId') as string | null) ?? undefined
  const altUrl = (formData.get('altUrl') as string | null) ?? undefined
  const docCode = (formData.get('docCode') as string | null) ?? undefined

  try {
    const { documentId, chunkCount } = await ingestPdf(buffer, file.name, documentName, {
      pageUrl,
      cntdId,
      altUrl,
      docCode,
    })

    if (chunkCount === 0) {
      return Response.json(
        { error: 'PDF не содержит извлекаемого текста. Возможно, это скан без текстового слоя.' },
        { status: 422 }
      )
    }

    return Response.json({ documentId, chunkCount, message: `Загружено ${chunkCount} фрагментов` })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('maximum context length') || message.includes('tokens')) {
      return Response.json(
        { error: 'Документ содержит слишком длинные фрагменты. Попробуйте уменьшить размер файла.' },
        { status: 422 }
      )
    }
    if (message.includes('OPENAI_API_KEY') || message.includes('credentials')) {
      return Response.json({ error: 'Ошибка авторизации OpenAI API.' }, { status: 500 })
    }
    if (message.includes('connect') || message.includes('ECONNREFUSED')) {
      return Response.json({ error: 'Нет подключения к базе данных.' }, { status: 503 })
    }

    console.error('ingest error:', err)
    return Response.json({ error: `Ошибка при обработке документа: ${message}` }, { status: 500 })
  }
}
