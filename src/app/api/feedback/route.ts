import { NextRequest } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const { messageId, feedback } = await req.json()

  if (!messageId || ![1, -1].includes(feedback)) {
    return Response.json({ error: 'Неверные данные' }, { status: 400 })
  }

  await pool.query(
    `UPDATE messages SET feedback = $1 WHERE id = $2 AND role = 'assistant'`,
    [feedback, messageId]
  )

  return Response.json({ ok: true })
}
