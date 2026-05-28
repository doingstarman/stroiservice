import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
})

async function migrate() {
  const sql = readFileSync(join(__dirname, 'migrate.sql'), 'utf-8')
  const client = await pool.connect()
  try {
    await client.query(sql)
    console.log('✓ Миграция выполнена успешно')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('✗ Ошибка миграции:', err.message)
  process.exit(1)
})
