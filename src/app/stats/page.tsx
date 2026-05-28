'use client'

import React from 'react'
import { useEffect, useState } from 'react'

interface StatsData {
  totalQuestions: number
  totalDocuments: number
  avgResponseMs: number
  thumbsUp: number
  thumbsDown: number
  recentQuestions: Array<{
    id: string
    content: string
    created_at: string
    conversation_id: string
  }>
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setStats(data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalFeedback = stats ? stats.thumbsUp + stats.thumbsDown : 0
  const thumbsUpPct = totalFeedback > 0 ? Math.round((stats!.thumbsUp / totalFeedback) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← Назад
          </a>
          <div>
            <h1 className="text-xl font-semibold text-white">Статистика</h1>
            <p className="text-sm text-gray-500">Использование НормативПро</p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-20 text-gray-500">Загружаю статистику...</div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-2xl p-5 text-red-400">
            Ошибка: {error}
          </div>
        )}

        {stats && (
          <>
            {/* Summary cards */}
            {stats.totalQuestions === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center mb-8">
                <svg className="w-10 h-10 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <p className="text-gray-500 text-sm mb-3">Вопросов ещё не задавали</p>
                <a href="/" className="text-sm text-blue-500 hover:text-blue-400 transition-colors">
                  Задать первый вопрос →
                </a>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>}
                label="Вопросов задано"
                value={stats.totalQuestions.toLocaleString('ru')}
              />
              <StatCard
                icon={<svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
                label="Документов загружено"
                value={stats.totalDocuments.toLocaleString('ru')}
              />
              <StatCard
                icon={<svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
                label="Среднее время ответа"
                value={`${(stats.avgResponseMs / 1000).toFixed(1)} с`}
                sub="vs 2–4 часа вручную"
              />
              <StatCard
                icon={<svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
                label="Рейтинг ответов"
                value={totalFeedback > 0 ? `${thumbsUpPct}%` : '—'}
                sub={totalFeedback > 0 ? `${stats.thumbsUp} · ${stats.thumbsDown}` : 'Нет оценок'}
              />
            </div>

            {/* Feedback bar */}
            {totalFeedback > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-8">
                <h2 className="text-sm font-medium text-gray-300 mb-3">Обратная связь</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-8 text-right">{stats.thumbsUp}</span>
                  <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full transition-all duration-500"
                      style={{ width: `${thumbsUpPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8">{stats.thumbsDown}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-green-500">👍 Полезно</span>
                  <span className="text-xs text-red-500">👎 Не полезно</span>
                </div>
              </div>
            )}

            {/* Recent questions */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-medium text-gray-300 mb-4">Последние вопросы</h2>
              {stats.recentQuestions.length === 0 ? (
                <p className="text-sm text-gray-600">Вопросов ещё не задавали</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0"
                    >
                      <span className="text-blue-500 mt-0.5 flex-shrink-0">?</span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 leading-snug">{q.content}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(q.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
