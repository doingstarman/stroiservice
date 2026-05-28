import pool from '../src/lib/db'

async function main() {
  // Удаляем дубликаты — оставляем только первую (самую раннюю) запись по file_name
  const deleted = await pool.query(`
    DELETE FROM documents
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY file_name ORDER BY created_at ASC) AS rn
        FROM documents
      ) t
      WHERE rn > 1
    )
    RETURNING file_name
  `)
  console.log(`Deleted ${deleted.rows.length} duplicates`)

  // Показываем финальное состояние
  const docs = await pool.query('SELECT file_name, chunk_count FROM documents ORDER BY chunk_count DESC')
  console.log(`\nDocuments in DB (${docs.rows.length} total):`)
  for (const d of docs.rows) {
    console.log(`  ${d.chunk_count.toString().padStart(4)} chunks  ${d.file_name}`)
  }
  await pool.end()
}

main().catch(console.error)
