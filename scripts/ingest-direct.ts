/**
 * Direct DB ingestion script (no Next.js server required)
 * Calls ingestPdf() from src/lib/ingest.ts directly
 */

import { ingestPdf } from '../src/lib/ingest'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { NORMATIVE_DOCS } from './docs-list'

async function main() {
  const docsDir = join(__dirname, 'docs')

  if (!existsSync(docsDir)) {
    console.log('No docs/ directory found')
    process.exit(0)
  }

  const files = readdirSync(docsDir)
    .filter(f => f.endsWith('.pdf'))
    .filter(f => statSync(join(docsDir, f)).size > 10000)

  console.log('='.repeat(60))
  console.log('НормативПро — прямая загрузка в БД')
  console.log('='.repeat(60))
  console.log(`Found ${files.length} valid PDF files`)
  console.log()

  let successCount = 0
  let errorCount = 0
  let totalChunks = 0

  for (const file of files) {
    const doc = NORMATIVE_DOCS.find(d => d.fileName === file)
    const name = doc ? `${doc.code} — ${doc.name}` : file.replace('.pdf', '')

    const sizeKB = Math.round(statSync(join(docsDir, file)).size / 1024)
    process.stdout.write(`Ingesting: ${file} (${sizeKB} KB) ... `)

    try {
      const buffer = readFileSync(join(docsDir, file))
      const result = await ingestPdf(buffer, file, name, {
        pageUrl: doc?.pageUrl,
        cntdId: doc?.cntdId,
        altUrl: doc?.altUrl,
        docCode: doc?.code,
      })
      console.log(`OK: ${result.chunkCount} chunks (ID: ${result.documentId})`)
      successCount++
      totalChunks += result.chunkCount
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error(`ERROR: ${errMsg}`)
      errorCount++
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log(`Done: ${successCount} documents, ${totalChunks} chunks, ${errorCount} errors`)
}

main().catch(console.error)
