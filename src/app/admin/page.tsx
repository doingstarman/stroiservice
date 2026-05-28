'use client'

import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'

interface UploadResult {
  documentId: string
  chunkCount: number
  message: string
}

interface Document {
  id: string
  name: string
  chunk_count: number
  created_at: string
}

// Fake multi-step progress messages shown during upload
const PROGRESS_STEPS = [
  { label: 'Читаю PDF...', pct: 15 },
  { label: 'Извлекаю текст...', pct: 35 },
  { label: 'Разбиваю на фрагменты...', pct: 55 },
  { label: 'Генерирую embeddings...', pct: 80 },
  { label: 'Сохраняю в базу данных...', pct: 95 },
]

async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch('/api/documents')
  const data = await res.json()
  return data.documents ?? []
}

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [docCode, setDocCode] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true)
    try {
      setDocuments(await fetchDocuments())
    } catch {
      // silently ignore
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchDocuments()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch(() => {
        // silently ignore
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function startProgressAnimation() {
    setProgressStep(0)
    let step = 0
    progressIntervalRef.current = setInterval(() => {
      step = Math.min(step + 1, PROGRESS_STEPS.length - 1)
      setProgressStep(step)
      if (step >= PROGRESS_STEPS.length - 1) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      }
    }, 2500)
  }

  function stopProgressAnimation() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  async function upload() {
    if (!file || !name.trim()) return
    setUploading(true)
    setResult(null)
    setError(null)
    startProgressAnimation()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name.trim())
    if (docCode.trim()) formData.append('docCode', docCode.trim())
    if (pageUrl.trim()) formData.append('pageUrl', pageUrl.trim())

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      setFile(null)
      setName('')
      setDocCode('')
      setPageUrl('')
      if (fileRef.current) fileRef.current.value = ''
      await loadDocuments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      stopProgressAnimation()
      setUploading(false)
    }
  }

  async function deleteDocument(id: string, docName: string) {
    if (!confirm(`Удалить документ «${docName}»?`)) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setDeletingId(null)
    }
  }

  const currentProgress = PROGRESS_STEPS[progressStep]

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← Назад
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Нормативные документы</h1>
            <p className="text-sm text-gray-500">Загрузка и управление базой знаний</p>
          </div>
        </div>

        {/* Upload form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Загрузить документ
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Название документа
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: СП 70.13330.2022"
              disabled={uploading}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Код документа
              </label>
              <input
                type="text"
                value={docCode}
                onChange={(e) => setDocCode(e.target.value)}
                placeholder="СП 54.13330.2022"
                disabled={uploading}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ссылка на источник
              </label>
              <input
                type="url"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="https://docs.cntd.ru/..."
                disabled={uploading}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">PDF файл</label>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!uploading) setIsDragOver(true) }}
              onDragEnter={(e) => { e.preventDefault(); if (!uploading) setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                if (uploading) return
                const f = e.dataTransfer.files[0]
                if (f?.type === 'application/pdf') setFile(f)
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                uploading
                  ? 'border-gray-700 cursor-not-allowed opacity-50'
                  : isDragOver
                    ? 'border-blue-500 bg-blue-950/20 cursor-copy'
                    : 'border-gray-700 hover:border-gray-500 cursor-pointer'
              }`}
            >
              {file ? (
                <div>
                  <p className="text-sm font-medium text-blue-400">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} МБ
                  </p>
                </div>
              ) : (
                <div>
                  <div className={`mb-3 transition-transform ${isDragOver ? 'scale-110' : ''}`}>
                    <svg className="w-8 h-8 text-gray-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">{isDragOver ? 'Отпустите файл' : 'Нажмите или перетащите PDF'}</p>
                  <p className="text-xs text-gray-600 mt-1">Максимум 50 МБ</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            onClick={upload}
            disabled={!file || !name.trim() || uploading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
          >
            {uploading ? 'Обрабатываю...' : 'Загрузить и индексировать'}
          </button>

          {uploading && (
            <div className="space-y-3">
              <ProgressBar pct={currentProgress.pct} label={currentProgress.label} />
              <p className="text-xs text-gray-600 text-center">
                Это занимает 30–120 секунд в зависимости от размера файла
              </p>
            </div>
          )}

          {result && (
            <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-green-400">✓ Готово</p>
              <p className="text-xs text-green-600 mt-1">{result.message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-red-400">✗ Ошибка</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Загруженные документы
            </h2>
            {!docsLoading && (
              <span className="text-xs text-gray-500">
                {documents.length}{' '}
                {documents.length === 1
                  ? 'документ'
                  : documents.length < 5
                    ? 'документа'
                    : 'документов'}
              </span>
            )}
          </div>

          {docsLoading && (
            <div className="py-8 text-center text-gray-500 text-sm">Загружаю список...</div>
          )}

          {!docsLoading && documents.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm text-gray-500">Документов пока нет</p>
            </div>
          )}

          {!docsLoading && documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-xl group"
                >
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.chunk_count} фрагментов · {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id, doc.name)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition-all disabled:opacity-40 rounded-lg"
                    aria-label="Удалить документ"
                    title="Удалить"
                  >
                    {deletingId === doc.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <a
            href="/stats"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Смотреть статистику →
          </a>
        </div>
      </div>
    </div>
  )
}
