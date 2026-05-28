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

  const { documentId, chunkCount } = await ingestPdf(buffer, file.name, documentName)

  return Response.json({ documentId, chunkCount, message: `Загружено ${chunkCount} фрагментов` })
}
