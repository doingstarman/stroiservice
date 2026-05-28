/**
 * Загружает один PDF по имени файла из scripts/docs/
 * Использование: npx tsx --env-file=.env.local scripts/ingest-one.ts SP_131.13330.2020_klimatologiya.pdf
 */
import { ingestPdf } from '../src/lib/ingest'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { NORMATIVE_DOCS } from './docs-list'
import pool from '../src/lib/db'

async function main() {
  const fileName = process.argv[2]
  if (!fileName) {
    console.error('Usage: npx tsx scripts/ingest-one.ts <filename.pdf>')
    process.exit(1)
  }

  // Удаляем 0-чанковые документы
  const del = await pool.query(`DELETE FROM documents WHERE chunk_count = 0 RETURNING file_name`)
  if (del.rows.length > 0) {
    console.log('Removed 0-chunk documents:', del.rows.map(r => r.file_name).join(', '))
  }

  const filePath = join(__dirname, 'docs', fileName)
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const doc = NORMATIVE_DOCS.find(d => d.fileName === fileName)
  const name = doc ? `${doc.code} — ${doc.name}` : fileName.replace('.pdf', '')
  const sizeKB = Math.round(statSync(filePath).size / 1024)

  console.log(`Ingesting: ${fileName} (${sizeKB} KB)...`)

  const buffer = readFileSync(filePath)
  const result = await ingestPdf(buffer, fileName, name, {
    pageUrl: doc?.pageUrl,
    cntdId: doc?.cntdId,
    altUrl: doc?.altUrl,
    docCode: doc?.code,
  })

  console.log(`OK: ${result.chunkCount} chunks (ID: ${result.documentId})`)
  await pool.end()
}

main().catch(console.error)
