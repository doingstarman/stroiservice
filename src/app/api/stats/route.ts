import pool from '@/lib/db'

interface StatsRow {
  total_questions: string
  total_documents: string
  avg_response_ms: string
  thumbs_up: string
  thumbs_down: string
}

interface RecentQuestion {
  id: string
  content: string
  created_at: string
  conversation_id: string
}

export async function GET() {
  try {
    const statsRes = await pool.query<StatsRow>(`
      SELECT
        (SELECT COUNT(*) FROM messages WHERE role = 'user') AS total_questions,
        (SELECT COUNT(*) FROM documents) AS total_documents,
        (SELECT COALESCE(AVG(response_time_ms), 0) FROM messages WHERE role = 'assistant' AND response_time_ms IS NOT NULL) AS avg_response_ms,
        (SELECT COUNT(*) FROM messages WHERE feedback = 1) AS thumbs_up,
        (SELECT COUNT(*) FROM messages WHERE feedback = -1) AS thumbs_down
    `)

    const recentRes = await pool.query<RecentQuestion>(`
      SELECT id, content, created_at, conversation_id
      FROM messages
      WHERE role = 'user'
      ORDER BY created_at DESC
      LIMIT 10
    `)

    const topDocsResult = await pool.query(`
      SELECT
        source->>'document_name' as name,
        count(*)::int as mentions
      FROM messages, jsonb_array_elements(sources) as source
      WHERE role = 'assistant' AND sources != '[]'::jsonb
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 5
    `)

    const row = statsRes.rows[0]
    return Response.json({
      totalQuestions: parseInt(row.total_questions, 10),
      totalDocuments: parseInt(row.total_documents, 10),
      avgResponseMs: Math.round(parseFloat(row.avg_response_ms)),
      thumbsUp: parseInt(row.thumbs_up, 10),
      thumbsDown: parseInt(row.thumbs_down, 10),
      recentQuestions: recentRes.rows,
      topDocuments: topDocsResult.rows,
    })
  } catch (err) {
    console.error('GET /api/stats error:', err)
    return Response.json({ error: 'Ошибка получения статистики' }, { status: 500 })
  }
}
