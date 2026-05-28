import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  let dbStatus: 'ok' | 'error' = 'error'
  let dbLatencyMs: number | null = null

  try {
    const t = Date.now()
    await pool.query('SELECT 1')
    dbLatencyMs = Date.now() - t
    dbStatus = 'ok'
  } catch {
    // db unreachable
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded'

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      version: process.env.npm_package_version ?? 'unknown',
    },
    { status: status === 'ok' ? 200 : 503 }
  )
}
