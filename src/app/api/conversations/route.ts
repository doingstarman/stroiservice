import pool from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.created_at,
        (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at LIMIT 1) as first_message,
        (SELECT count(*)::int FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      ORDER BY c.created_at DESC
      LIMIT 20
    `)
    return Response.json({ conversations: result.rows })
  } catch {
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'ID required' }, { status: 400 })
    await pool.query('DELETE FROM conversations WHERE id = $1', [id])
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
