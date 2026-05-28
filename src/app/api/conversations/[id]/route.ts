import pool from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await pool.query(
      `SELECT id, role, content, sources, feedback, response_time_ms, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    )
    return Response.json({ messages: result.rows })
  } catch {
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
