import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Creates (idempotently) the platform recharge user and validates that the
// whole developer-recharge chain is ready:
//   1. user from PLATFORM_RECHARGE_USER_EMAIL exists
//   2. it owns at least one active payment code (wechat/alipay)
//   3. that code's Watcher device is online with a recent heartbeat
//
// Device binding + real QR upload are intentionally NOT done here — they must go
// through the real app/console with a physical device and the actual payment-code
// image. This script only seeds the account and reports what's still missing.
//
// Usage:
//   node scripts/setup-platform-recharge.mjs --check            # validate only (local dev.db)
//   node scripts/setup-platform-recharge.mjs --check --remote   # validate only (prod D1)
//   PLATFORM_RECHARGE_PASSWORD=... node scripts/setup-platform-recharge.mjs           # create+validate local
//   PLATFORM_RECHARGE_PASSWORD=... node scripts/setup-platform-recharge.mjs --remote  # create+validate prod

const root = process.cwd()
const isRemote = process.argv.includes('--remote')
const mode = isRemote ? '--remote' : '--local'
const checkOnly = process.argv.includes('--check')

const PBKDF2_ITERATIONS = 100_000 // must match lib/password.ts

function readEnv(key) {
  if (process.env[key]) return process.env[key]
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return ''
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    if (t.slice(0, eq).trim() !== key) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    return v
  }
  return ''
}

const wranglerPath = path.join(root, 'wrangler.json')
if (!fs.existsSync(wranglerPath)) { console.error('Missing wrangler.json'); process.exit(1) }
const databaseName = JSON.parse(fs.readFileSync(wranglerPath, 'utf8')).d1_databases?.find(d => d?.binding === 'DB')?.database_name
if (!databaseName) { console.error('Missing D1 binding named DB in wrangler.json'); process.exit(1) }

const email = (readEnv('PLATFORM_RECHARGE_USER_EMAIL') || '').trim().toLowerCase()
if (!email) { console.error('PLATFORM_RECHARGE_USER_EMAIL is not set in .env'); process.exit(1) }

function sqlString(value) { return `'${String(value).replaceAll("'", "''")}'` }

// Query D1 and parse the JSON result rows.
function query(sql) {
  const result = spawnSync('npx', ['wrangler', 'd1', 'execute', databaseName, mode, '--json', '--command', sql], {
    cwd: root, encoding: 'utf8',
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'wrangler d1 execute failed\n')
    process.exit(result.status ?? 1)
  }
  const text = (result.stdout || '').trim()
  const jsonStart = text.indexOf('[')
  if (jsonStart === -1) return []
  try {
    const parsed = JSON.parse(text.slice(jsonStart))
    return parsed?.[0]?.results || []
  } catch {
    return []
  }
}

function exec(sql) {
  const result = spawnSync('npx', ['wrangler', 'd1', 'execute', databaseName, mode, '--command', sql], {
    cwd: root, stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Reproduce the exact hash format from lib/password.ts so console login works.
function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
  return `pbkdf2-sha256:${PBKDF2_ITERATIONS}:${salt.toString('base64')}:${hash.toString('base64')}`
}

console.log(`Target: ${databaseName} (${mode})`)
console.log(`Platform recharge email: ${email}\n`)

// 1. Ensure the user exists.
let user = query(`SELECT id FROM User WHERE email = ${sqlString(email)} LIMIT 1;`)[0]

if (!user) {
  if (checkOnly) {
    console.log('✗ Platform user does NOT exist. Re-run without --check (set PLATFORM_RECHARGE_PASSWORD) to create it.')
    process.exit(1)
  }
  const password = process.env.PLATFORM_RECHARGE_PASSWORD || ''
  if (password.length < 8) {
    console.error('✗ Set PLATFORM_RECHARGE_PASSWORD (>=8 chars) in the environment to create the platform user.')
    console.error('  e.g. PLATFORM_RECHARGE_PASSWORD=... node scripts/setup-platform-recharge.mjs --remote')
    process.exit(1)
  }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  // emailVerifiedAt set so the account can sign into the console immediately to
  // bind a device and upload payment codes. feeBalance 0, free package.
  exec(
    `INSERT INTO User (id, email, passwordHash, emailVerifiedAt, feeBalance, packageType, freeOrderUsed, firstProDiscountUsed, firstMaxDiscountUsed, createdAt, updatedAt) ` +
    `VALUES (${sqlString(id)}, ${sqlString(email)}, ${sqlString(hashPassword(password))}, ${sqlString(now)}, 0, 'free', 0, 0, 0, ${sqlString(now)}, ${sqlString(now)});`
  )
  console.log(`✓ Created platform user (id ${id}). Password set from PLATFORM_RECHARGE_PASSWORD (not logged).`)
  user = { id }
} else {
  console.log(`✓ Platform user exists (id ${user.id}).`)
}

// 2 & 3. Readiness check: devices + active codes + online status.
const devices = query(`SELECT COUNT(*) AS c FROM Device WHERE userId = ${sqlString(user.id)};`)[0]?.c ?? 0
const codeRows = query(
  `SELECT pc.type AS type, pc.codeType AS codeType, pc.status AS status, ` +
  `d.online AS online, d.status AS deviceStatus, d.lastHeartbeat AS lastHeartbeat ` +
  `FROM PaymentCode pc LEFT JOIN Device d ON d.id = pc.deviceId ` +
  `WHERE pc.userId = ${sqlString(user.id)} AND pc.status = 'active';`
)

const threeMinAgo = Date.now() - 3 * 60 * 1000
const usable = codeRows.filter(c =>
  Number(c.online) === 1 && c.deviceStatus === 'active' &&
  c.lastHeartbeat && new Date(c.lastHeartbeat).getTime() >= threeMinAgo
)
const types = new Set(usable.map(c => c.type))

console.log('\n--- Recharge readiness ---')
console.log(`Bound devices:        ${devices}`)
console.log(`Active payment codes: ${codeRows.length}`)
console.log(`Usable now (online):  ${usable.length} (wechat: ${types.has('wechat') ? 'yes' : 'no'}, alipay: ${types.has('alipay') ? 'yes' : 'no'})`)

const ready = usable.length > 0
if (ready) {
  console.log('\n✓ Platform recharge chain is READY.')
} else {
  console.log('\n✗ NOT ready yet. Remaining steps (do on a physical device / console):')
  if (Number(devices) === 0) console.log('  1. Sign into the console as the platform user and bind a Watcher device (install the app, use the dev_ code).')
  console.log('  2. Upload the real platform payment code(s) (WeChat/Alipay personal QR) under the platform user.')
  console.log('  3. Keep the device online (heartbeat within 3 min) so recharge channel selection succeeds.')
  if (!checkOnly) process.exitCode = 0 // creation succeeded; readiness is a follow-up, don't fail hard
}
