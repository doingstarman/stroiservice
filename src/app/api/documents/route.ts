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
      LEFT JOIN document_chunks c ON c.document_id = d.id
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
  const { id } = await req.json().catch(() => ({}))
  if (!id) return Response.json({ error: 'id обязателен' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const check = await client.query('SELECT id FROM documents WHERE id = $1', [id])
    if (check.rows.length === 0) {
      await client.query('ROLLBACK')
      return Response.json({ error: 'Документ не найден' }, { status: 404 })
    }

    await client.query('DELETE FROM document_chunks WHERE document_id = $1', [id])
    await client.query('DELETE FROM documents WHERE id = $1', [id])
    await client.query('COMMIT')

    return Response.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('DELETE /api/documents error:', err)
    return Response.json({ error: 'Ошибка удаления документа' }, { status: 500 })
  } finally {
    client.release()
  }
}
