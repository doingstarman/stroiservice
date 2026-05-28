import pool from './db'
import { embed } from './openai'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 150
const MIN_CHUNK_SIZE = 100

function splitByChars(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > MIN_CHUNK_SIZE) chunks.push(chunk)
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

function mergeParagraphsIntoChunks(paragraphs: string[]): string[] {
  const chunks: string[] = []
  let current = ''
  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim())
      current = current.slice(-CHUNK_OVERLAP) + '\n' + para
    } else {
      current += (current ? '\n' : '') + para
    }
  }
  if (current.trim().length > MIN_CHUNK_SIZE) chunks.push(current.trim())
  return chunks
}

function splitText(text: string): string[] {
  // Нормативные документы: пункты начинаются с \n + цифры
  const byParagraphs = text.split(/\n(?=\d+\.\d+[\s\.]|\d+\s{2,}|[А-Я]\.\d+|Приложение\s[А-ЯA-Z])/)
    .map(p => p.trim())
    .filter(p => p.length > MIN_CHUNK_SIZE)

  if (byParagraphs.length > 3) {
    return mergeParagraphsIntoChunks(byParagraphs)
  }

  const byDoubleNewline = text.split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > MIN_CHUNK_SIZE)

  if (byDoubleNewline.length > 3) {
    return mergeParagraphsIntoChunks(byDoubleNewline)
  }

  return splitByChars(text)
}

export async function ingestPdf(
  buffer: Buffer,
  fileName: string,
  documentName: string
): Promise<{ documentId: string; chunkCount: number }> {
  const data = await pdf(buffer)
  // Сохраняем переносы строк для структурного чанкинга
  const text = data.text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const estimatedPages = data.numpages || Math.ceil(text.length / 3000)
  const chunks = splitText(text)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const docResult = await client.query<{ id: string }>(
      `INSERT INTO documents (name, file_name, chunk_count) VALUES ($1, $2, $3) RETURNING id`,
      [documentName, fileName, chunks.length]
    )
    const documentId = docResult.rows[0].id

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await embed(chunk)
      const vector = `[${embedding.join(',')}]`
      const pageApprox = Math.floor((i / chunks.length) * estimatedPages) + 1

      await client.query(
        `INSERT INTO document_chunks (document_id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [documentId, chunk, JSON.stringify({ chunk_index: i, total_chunks: chunks.length, page_approx: pageApprox }), vector]
      )
    }

    await client.query('COMMIT')
    return { documentId, chunkCount: chunks.length }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
