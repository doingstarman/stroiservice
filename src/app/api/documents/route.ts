import pool from '@/lib/db'

interface DocumentRow {
  id: string
  name: string
  chunk_count: number
  created_at: string
}

export async function GET() {
  try {
    const result = await pool.query<DocumentRow>(`
      SELECT
        d.id,
        d.name,
        COUNT(c.id)::int AS chunk_count,
        d.created_at
      FROM documents d
      LEFT JOIN chunks c ON c.document_id = d.id
      GROUP BY d.id, d.name, d.created_at
      ORDER BY d.created_at DESC
    `)
    return Response.json({ documents: result.rows })
  } catch (err) {
    console.error('GET /api/documents error:', err)
    return Response.json({ error: 'Ошибка получения документов' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'id обязателен' }, { status: 400 })

    const check = await pool.query('SELECT id FROM documents WHERE id = $1', [id])
    if (check.rows.length === 0) {
      return Response.json({ error: 'Документ не найден' }, { status: 404 })
    }

    await pool.query(`DELETE FROM chunks WHERE document_id = $1`, [id])
    await pool.query(`DELETE FROM documents WHERE id = $1`, [id])
    return Response.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/documents error:', err)
    return Response.json({ error: 'Ошибка удаления документа' }, { status: 500 })
  }
}
