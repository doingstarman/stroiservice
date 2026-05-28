/**
 * НормативПро — загрузка всех PDF из scripts/docs/ в базу данных через ingest API
 *
 * Запуск (при работающем Next.js dev-сервере):
 *   npx tsx scripts/ingest-all.ts
 *
 * Или с указанием базового URL:
 *   BASE_URL=https://your-app.railway.app npx tsx scripts/ingest-all.ts
 *
 * Требования:
 *   - Запущен Next.js сервер (npm run dev или задеплоено)
 *   - В scripts/docs/ лежат PDF файлы
 *   - Настроены переменные окружения DATABASE_URL и OPENAI_API_KEY
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { NORMATIVE_DOCS } from './docs-list'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const DOCS_DIR = path.join(__dirname, 'docs')
const INGEST_ENDPOINT = `${BASE_URL}/api/ingest`
const DELAY_BETWEEN_DOCS_MS = 2000 // задержка между документами (эмбеддинги дорогие)

interface IngestResult {
  fileName: string
  docCode: string
  docName: string
  success: boolean
  documentId?: string
  chunkCount?: number
  error?: string
  skipped?: boolean
  skipReason?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Отправляет PDF файл в API ingest через multipart/form-data
 */
async function ingestFile(
  filePath: string,
  fileName: string,
  documentName: string
): Promise<{ documentId: string; chunkCount: number; message: string }> {
  const fileBuffer = fs.readFileSync(filePath)
  const boundary = `----FormBoundary${Date.now()}`

  // Формируем multipart/form-data вручную (без внешних зависимостей)
  const namePart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="name"\r\n\r\n` +
    `${documentName}\r\n`
  )

  const fileHeader = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: application/pdf\r\n\r\n`
  )

  const fileEnd = Buffer.from(`\r\n--${boundary}--\r\n`)

  const body = Buffer.concat([namePart, fileHeader, fileBuffer, fileEnd])

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(INGEST_ENDPOINT)
    const lib = parsedUrl.protocol === 'https:' ? https : http

    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 300000, // 5 минут — большие PDF с эмбеддингами долго обрабатываются
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString()
        })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(json)
            } else {
              reject(new Error(json.error || `HTTP ${res.statusCode}: ${data}`))
            }
          } catch {
            reject(new Error(`Некорректный JSON от сервера: ${data.slice(0, 200)}`))
          }
        })
      }
    )

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Таймаут запроса (5 минут)'))
    })

    req.write(body)
    req.end()
  })
}

/**
 * Проверяет доступность ingest endpoint
 */
async function checkServerHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const healthUrl = `${BASE_URL}/api/ingest`
    const parsedUrl = new URL(healthUrl)
    const lib = parsedUrl.protocol === 'https:' ? https : http

    // Делаем OPTIONS-запрос или простой HEAD
    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        res.resume()
        // Если сервер отвечает (даже 405 Method Not Allowed) — он работает
        resolve(res.statusCode !== undefined && res.statusCode < 500)
      }
    )

    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

async function main() {
  console.log('='.repeat(60))
  console.log('НормативПро — загрузка документов в базу данных')
  console.log('='.repeat(60))
  console.log()
  console.log(`API endpoint: ${INGEST_ENDPOINT}`)
  console.log(`Папка с документами: ${DOCS_DIR}`)
  console.log()

  // Проверяем доступность сервера
  process.stdout.write('Проверка доступности сервера ... ')
  const serverOk = await checkServerHealth()
  if (!serverOk) {
    console.log('НЕДОСТУПЕН')
    console.log()
    console.log('Убедитесь, что сервер запущен:')
    console.log('  cd app && npm run dev')
    console.log()
    console.log('Или задайте адрес задеплоенного приложения:')
    console.log('  BASE_URL=https://your-app.railway.app npx tsx scripts/ingest-all.ts')
    process.exit(1)
  }
  console.log('OK')
  console.log()

  // Проверяем наличие папки с документами
  if (!fs.existsSync(DOCS_DIR)) {
    console.log(`Папка ${DOCS_DIR} не найдена.`)
    console.log('Сначала запустите: npx tsx scripts/fetch-normatives.ts')
    process.exit(1)
  }

  // Получаем список PDF файлов
  const allPdfFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.pdf'))

  if (allPdfFiles.length === 0) {
    console.log('В папке scripts/docs/ нет PDF файлов.')
    console.log()
    console.log('Шаги:')
    console.log('  1. Запустите: npx tsx scripts/fetch-normatives.ts')
    console.log('  2. Или вручную скачайте PDF и поместите в scripts/docs/')
    console.log('  3. Список документов: npx tsx scripts/docs-list.ts')
    process.exit(1)
  }

  console.log(`Найдено PDF файлов: ${allPdfFiles.length}`)
  console.log()

  // Сопоставляем файлы со списком документов
  const results: IngestResult[] = []

  for (const fileName of allPdfFiles) {
    const filePath = path.join(DOCS_DIR, fileName)
    const stat = fs.statSync(filePath)

    // Находим метаданные документа по имени файла
    const docMeta = NORMATIVE_DOCS.find((d) => d.fileName === fileName)
    const documentName = docMeta
      ? `${docMeta.code} — ${docMeta.name}`
      : fileName.replace('.pdf', '').replace(/_/g, ' ')

    const docCode = docMeta?.code || fileName
    const sizeKb = Math.round(stat.size / 1024)
    const progress = `[${results.length + 1}/${allPdfFiles.length}]`

    console.log(`${progress} ${docCode} (${sizeKb} KB)`)
    process.stdout.write('  Загрузка в базу ... ')

    // Пропускаем слишком маленькие файлы (скорее всего невалидные)
    if (stat.size < 10000) {
      const result: IngestResult = {
        fileName,
        docCode,
        docName: documentName,
        success: false,
        skipped: true,
        skipReason: `Файл слишком мал (${sizeKb} KB) — возможно повреждён`,
      }
      results.push(result)
      console.log(`ПРОПУЩЕН — ${result.skipReason}`)
      continue
    }

    try {
      const response = await ingestFile(filePath, fileName, documentName)
      const result: IngestResult = {
        fileName,
        docCode,
        docName: documentName,
        success: true,
        documentId: response.documentId,
        chunkCount: response.chunkCount,
      }
      results.push(result)
      console.log(`OK — ${response.chunkCount} фрагментов (ID: ${response.documentId})`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({
        fileName,
        docCode,
        docName: documentName,
        success: false,
        error,
      })
      console.log(`ОШИБКА — ${error}`)
    }

    // Пауза между запросами (эмбеддинги нагружают OpenAI API)
    if (results.length < allPdfFiles.length) {
      await sleep(DELAY_BETWEEN_DOCS_MS)
    }
  }

  // Итоговый отчёт
  console.log()
  console.log('='.repeat(60))
  const successful = results.filter((r) => r.success)
  const skipped = results.filter((r) => r.skipped)
  const failed = results.filter((r) => !r.success && !r.skipped)

  const totalChunks = successful.reduce((sum, r) => sum + (r.chunkCount || 0), 0)

  console.log('Итог:')
  console.log(`  Загружено успешно: ${successful.length}`)
  console.log(`  Всего фрагментов: ${totalChunks}`)
  console.log(`  Пропущено:        ${skipped.length}`)
  console.log(`  Ошибки:           ${failed.length}`)
  console.log()

  if (successful.length > 0) {
    console.log('Загруженные документы:')
    for (const r of successful) {
      console.log(`  ✓ ${r.docCode} — ${r.chunkCount} фрагментов`)
    }
    console.log()
  }

  if (failed.length > 0) {
    console.log('Документы с ошибками:')
    for (const r of failed) {
      console.log(`  ✗ ${r.docCode}: ${r.error}`)
    }
    console.log()
  }

  if (skipped.length > 0) {
    console.log('Пропущенные документы:')
    for (const r of skipped) {
      console.log(`  - ${r.docCode}: ${r.skipReason}`)
    }
    console.log()
  }

  console.log('База данных обновлена. RAG-поиск готов к работе.')
  console.log()
  console.log('Следующий шаг — тест поиска:')
  console.log(`  curl -X POST ${BASE_URL}/api/chat \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -d '{"message":"Какие требования к теплозащите жилых зданий?"}'`)
}

main().catch(console.error)
