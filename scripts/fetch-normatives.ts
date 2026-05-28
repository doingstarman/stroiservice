/**
 * НормативПро — скрипт для скачивания PDF нормативных документов
 *
 * Запуск:
 *   npx tsx scripts/fetch-normatives.ts
 *
 * Стратегия источников (в порядке приоритета):
 *   1. standartgost.ru — неофициальный агрегатор, многие документы открыты
 *   2. fgistp.minstroyrf.ru — ФГИС ТП, официальные PDF от Минстроя
 *   3. Прямые ссылки на PDF (если известны)
 *
 * Результат: PDF файлы сохраняются в scripts/docs/
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { NORMATIVE_DOCS, NormativeDoc } from './docs-list'

const DOCS_DIR = path.join(__dirname, 'docs')
const REQUEST_DELAY_MS = 3000 // 3 секунды между запросами
const TIMEOUT_MS = 30000 // 30 секунд таймаут на загрузку

// Заголовки для имитации браузера
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/pdf,text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
}

interface DownloadResult {
  doc: NormativeDoc
  success: boolean
  filePath?: string
  error?: string
  source?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Попытка скачать файл по URL.
 * Возвращает Buffer при успехе или null при ошибке.
 * Следует редиректам (до 5 раз).
 */
function downloadUrl(
  url: string,
  redirectsLeft = 5
): Promise<{ buffer: Buffer; contentType: string } | null> {
  return new Promise((resolve) => {
    if (redirectsLeft <= 0) {
      resolve(null)
      return
    }

    const parsedUrl = new URL(url)
    const lib = parsedUrl.protocol === 'https:' ? https : http

    const req = lib.get(
      url,
      {
        headers: BROWSER_HEADERS,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        // Обработка редиректов
        if (
          (res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 303 ||
            res.statusCode === 307 ||
            res.statusCode === 308) &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, url).toString()
          res.resume()
          resolve(downloadUrl(redirectUrl, redirectsLeft - 1))
          return
        }

        if (res.statusCode !== 200) {
          res.resume()
          resolve(null)
          return
        }

        const contentType = res.headers['content-type'] || ''
        const chunks: Buffer[] = []

        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          resolve({ buffer, contentType })
        })
        res.on('error', () => resolve(null))
      }
    )

    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

/**
 * Проверяем, является ли буфер валидным PDF (начинается с %PDF-)
 */
function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) return false
  return buffer.slice(0, 5).toString('ascii') === '%PDF-'
}

/**
 * Строим список URL для попытки скачивания документа
 */
function buildDownloadUrls(doc: NormativeDoc): string[] {
  const urls: string[] = []

  // 1. Прямая ссылка на PDF (если задана)
  if (doc.pdfUrl) {
    urls.push(doc.pdfUrl)
  }

  // 2. docs.cntd.ru — прямой PDF (работает только с подпиской, но пробуем)
  urls.push(`https://docs.cntd.ru/document/${doc.cntdId}/pdf`)

  // 3. fgistp.minstroyrf.ru для СП — официальный портал Минстроя
  if (doc.code.startsWith('СП')) {
    const spMatch = doc.code.match(/СП\s*(\d+)\.(\d+)\.(\d+)/)
    if (spMatch) {
      const spNum = spMatch[1]
      const setNum = spMatch[2]
      const year = spMatch[3]
      // Различные варианты именования файлов на портале Минстроя
      urls.push(
        `https://fgistp.minstroyrf.ru/uploads/iblock/SP_${spNum}_${setNum}_${year}.pdf`,
        `https://fgistp.minstroyrf.ru/uploads/iblock/sp_${spNum}_${setNum.toLowerCase()}_${year}.pdf`,
        `https://fgistp.minstroyrf.ru/uploads/sp${spNum}.${setNum}.${year}.pdf`
      )
    }
  }

  // 4. protect.gost.ru для ГОСТ
  if (doc.code.startsWith('ГОСТ')) {
    const gostMatch = doc.code.match(/ГОСТ\s*(?:Р\s*)?(\d+[\w.-]+)/)
    if (gostMatch) {
      urls.push(`https://protect.gost.ru/download.aspx?id.pdf=${gostMatch[1]}`)
    }
  }

  return urls.filter((u, i, arr) => arr.indexOf(u) === i) // дедупликация
}

/**
 * Скачивает один документ, пробуя несколько источников
 */
async function downloadDoc(doc: NormativeDoc): Promise<DownloadResult> {
  const filePath = path.join(DOCS_DIR, doc.fileName)

  // Если файл уже существует — пропускаем
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath)
    if (stat.size > 10000) {
      // > 10KB — считаем валидным
      return {
        doc,
        success: true,
        filePath,
        source: 'cached',
      }
    }
  }

  // Специфичные ссылки для конкретных документов
  // Эти URL были проверены вручную как публично доступные
  const specificUrls: Record<string, string[]> = {
    'СП 20.13330.2017': [
      'https://standartgost.ru/0/4293747183',
    ],
    'СП 54.13330.2022': [
      'https://fgistp.minstroyrf.ru/uploads/iblock/4a3/sp_54_13330_2022.pdf',
    ],
    'СП 50.13330.2012': [
      'https://fgistp.minstroyrf.ru/uploads/iblock/3a1/sp_50_13330_2012.pdf',
    ],
    'СП 131.13330.2020': [
      'https://fgistp.minstroyrf.ru/uploads/iblock/5b2/sp_131_13330_2020.pdf',
    ],
    'СанПиН 1.2.3685-21': [
      'https://rg.ru/2021/03/05/gigiena-dok.html',
    ],
  }

  const urls: string[] = [
    ...(specificUrls[doc.code] || []),
    ...buildDownloadUrls(doc),
  ]

  for (const url of urls) {
    try {
      const result = await downloadUrl(url)

      if (result && isPdfBuffer(result.buffer)) {
        fs.writeFileSync(filePath, result.buffer)
        return { doc, success: true, filePath, source: url }
      }

      // Если ответ пришёл, но это не PDF (может быть HTML-страница с PDF)
      if (result && result.contentType.includes('pdf')) {
        fs.writeFileSync(filePath, result.buffer)
        return { doc, success: true, filePath, source: url }
      }
    } catch {
      // продолжаем со следующим URL
    }
  }

  return {
    doc,
    success: false,
    error:
      'Не удалось скачать автоматически. Требуется ручная загрузка с ' +
      doc.pageUrl,
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('НормативПро — загрузка нормативных документов')
  console.log('='.repeat(60))
  console.log()

  // Создаём директорию для документов
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true })
  }

  const results: DownloadResult[] = []
  const total = NORMATIVE_DOCS.length

  for (let i = 0; i < total; i++) {
    const doc = NORMATIVE_DOCS[i]
    const progress = `[${i + 1}/${total}]`

    process.stdout.write(`${progress} ${doc.code} ... `)

    const result = await downloadDoc(doc)
    results.push(result)

    if (result.success) {
      const size = result.filePath
        ? Math.round(fs.statSync(result.filePath).size / 1024)
        : 0
      console.log(
        result.source === 'cached'
          ? `ПРОПУЩЕН (уже есть, ${size} KB)`
          : `OK (${size} KB) [${result.source}]`
      )
    } else {
      console.log(`ОШИБКА — ${result.error}`)
    }

    // Rate limiting — пауза между запросами
    if (i < total - 1) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  // Итог
  console.log()
  console.log('='.repeat(60))
  const successful = results.filter((r) => r.success && r.source !== 'cached')
  const cached = results.filter((r) => r.success && r.source === 'cached')
  const failed = results.filter((r) => !r.success)

  console.log(`Итог:`)
  console.log(`  Скачано:   ${successful.length}`)
  console.log(`  Из кэша:   ${cached.length}`)
  console.log(`  Не удалось: ${failed.length}`)
  console.log()

  if (failed.length > 0) {
    console.log('Документы, требующие ручной загрузки:')
    for (const r of failed) {
      console.log(`  - ${r.doc.code}: ${r.doc.pageUrl}`)
    }
    console.log()
    console.log('Инструкция:')
    console.log('  1. Откройте ссылку в браузере')
    console.log('  2. Скачайте PDF вручную')
    console.log(`  3. Сохраните в папку: ${DOCS_DIR}`)
    console.log('  4. Убедитесь, что имя файла совпадает с fileName в docs-list.ts')
    console.log()
    console.log('Для получения всех документов рекомендуем:')
    console.log('  - Подписка docs.cntd.ru (~3000 руб/мес)')
    console.log('  - Портал ФГИС ТП: https://fgistp.minstroyrf.ru/')
    console.log('  - ФАУ ФЦС: https://faufcc.ru/')
  }

  console.log()
  console.log(`Документы сохранены в: ${DOCS_DIR}`)
  console.log()
  console.log('Следующий шаг — загрузите в базу:')
  console.log('  npx tsx scripts/ingest-all.ts')
}

main().catch(console.error)
