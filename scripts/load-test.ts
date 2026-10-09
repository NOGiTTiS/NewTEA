// Concurrency & Load Test Simulation for NewTEA
// Simulates 150 concurrent teachers accessing the system simultaneously
// Usage: bun run scripts/load-test.ts

import { Pool } from 'pg'

const BASE_URL = process.env.API_URL || 'http://localhost:8080'
const DB_URL = process.env.DATABASE_URL || 'postgres://tea_user:tea_password@localhost:5432/tunorth-tea_db?sslmode=disable'

const CONCURRENT_USERS = 150
const REQUESTS_PER_USER = 10
const TOTAL_REQUESTS = CONCURRENT_USERS * REQUESTS_PER_USER

const ENDPOINTS = [
  '/api/health',
  '/api/rooms',
  '/api/terms',
  '/api/courses'
]

type RequestResult = {
  endpoint: string
  durationMs: number
  success: boolean
  status: number
}

const runUserSession = async (userId: number, sessionToken: string): Promise<RequestResult[]> => {
  const results: RequestResult[] = []

  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    const endpoint = ENDPOINTS[(userId + i) % ENDPOINTS.length]
    const url = `${BASE_URL}${endpoint}`
    const start = performance.now()

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Accept': 'application/json'
        }
      })
      const durationMs = performance.now() - start
      results.push({
        endpoint,
        durationMs,
        success: res.ok,
        status: res.status
      })
    } catch {
      const durationMs = performance.now() - start
      results.push({
        endpoint,
        durationMs,
        success: false,
        status: 0
      })
    }
  }

  return results
}

const main = async () => {
  console.log('='.repeat(70))
  console.log('🚀 Triam Evaluation and Assessment (NewTEA) — Load Test Simulation')
  console.log(`🎯 Target Server: ${BASE_URL}`)
  console.log(`👥 Concurrent Teachers: ${CONCURRENT_USERS} teachers`)
  console.log(`📦 Requests per Teacher: ${REQUESTS_PER_USER} requests`)
  console.log(`📊 Total Scheduled Requests: ${TOTAL_REQUESTS} requests`)
  console.log('='.repeat(70))

  // Step 1: Ensure test user and active session token exist in DB
  const pool = new Pool({ connectionString: DB_URL })
  const testToken = `loadtest-token-${Date.now()}`
  let testUserId = ''

  try {
    const userRes = await pool.query('SELECT id FROM "user" WHERE role = \'TEACHER\' OR role = \'ADMIN\' LIMIT 1')
    if (userRes.rows.length > 0) {
      testUserId = userRes.rows[0].id
    } else {
      // Fallback first user
      const anyUser = await pool.query('SELECT id FROM "user" LIMIT 1')
      testUserId = anyUser.rows[0]?.id || 'admin'
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await pool.query(
      'INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (token) DO NOTHING',
      [`sess-${testToken}`, testToken, testUserId, expiresAt]
    )
    console.log(`🔑 Authenticated Session Prepared for User: ${testUserId}`)
  } catch (dbErr) {
    console.warn('⚠️ Could not inject test session into DB, testing with fallback token:', dbErr)
  }

  const overallStart = performance.now()

  // Spawn 150 concurrent workers simultaneously
  const workerPromises: Promise<RequestResult[]>[] = []
  for (let u = 0; u < CONCURRENT_USERS; u++) {
    workerPromises.push(runUserSession(u, testToken))
  }

  const allResultsNested = await Promise.all(workerPromises)
  const allResults = allResultsNested.flat()
  const totalDurationSeconds = (performance.now() - overallStart) / 1000

  // Cleanup test session
  try {
    await pool.query('DELETE FROM session WHERE token = $1', [testToken])
    await pool.end()
  } catch {
    // Ignore cleanup error
  }

  // Analyze metrics
  const successfulRequests = allResults.filter(r => r.success).length
  const failedRequests = allResults.length - successfulRequests
  const durations = allResults.map(r => r.durationMs).sort((a, b) => a - b)

  const sumLatency = durations.reduce((acc, v) => acc + v, 0)
  const avgLatency = sumLatency / durations.length
  const minLatency = durations[0] || 0
  const maxLatency = durations[durations.length - 1] || 0
  const p50 = durations[Math.floor(durations.length * 0.50)] || 0
  const p90 = durations[Math.floor(durations.length * 0.90)] || 0
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0
  const p99 = durations[Math.floor(durations.length * 0.99)] || 0
  const rps = allResults.length / totalDurationSeconds

  const statusCounts: Record<string, number> = {}
  for (const r of allResults) {
    const key = r.status.toString()
    statusCounts[key] = (statusCounts[key] || 0) + 1
  }

  console.log('\n📈 --- SUMMARY BENCHMARK RESULTS ---')
  console.log(`⏱️ Total Time Elapsed:       ${totalDurationSeconds.toFixed(2)} seconds`)
  console.log(`✅ Successful Requests:      ${successfulRequests} / ${allResults.length} (${((successfulRequests / allResults.length) * 100).toFixed(1)}%)`)
  console.log(`❌ Failed Requests:          ${failedRequests}`)
  console.log(`📋 Status Codes Breakdown:   ${JSON.stringify(statusCounts)}`)
  console.log(`⚡ Throughput (RPS):          ${rps.toFixed(1)} req/sec`)
  console.log(`⏱️ Average Latency:          ${avgLatency.toFixed(2)} ms`)
  console.log(`🚀 Min Latency:              ${minLatency.toFixed(2)} ms`)
  console.log(`🐢 Max Latency:              ${maxLatency.toFixed(2)} ms`)
  console.log(`📊 Latency Percentiles:`)
  console.log(`   • P50 (Median):           ${p50.toFixed(2)} ms`)
  console.log(`   • P90:                    ${p90.toFixed(2)} ms`)
  console.log(`   • P95:                    ${p95.toFixed(2)} ms`)
  console.log(`   • P99:                    ${p99.toFixed(2)} ms`)
  console.log('='.repeat(70))

  if (failedRequests === 0 && avgLatency < 200) {
    console.log('🎉 PASS: NewTEA handles 150 concurrent teachers with outstanding performance!')
  } else {
    console.log(`ℹ️ Result: Success Rate ${((successfulRequests / allResults.length) * 100).toFixed(1)}% | Throughput: ${rps.toFixed(1)} RPS`)
  }
}

main().catch(err => {
  console.error('Load test error:', err)
})
