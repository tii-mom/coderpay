import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

// Parse arguments
const args = process.argv.slice(2)
const isRemote = args.includes('--remote')
const mode = isRemote ? '--remote' : '--local'

function getArgValue(flag) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  return ''
}

const email = getArgValue('--email').trim().toLowerCase()
const password = getArgValue('--password')

if (!email || !password) {
  console.error('Usage:')
  console.error('  node scripts/reset-user-password.mjs --email <email> --password <password> [--remote]')
  process.exit(1)
}

if (!password.trim()) {
  console.error('Password is required')
  process.exit(1)
}

const PBKDF2_ITERATIONS = 100_000

function hashPassword(pass) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(pass, salt, PBKDF2_ITERATIONS, 32, 'sha256')
  return `pbkdf2-sha256:${PBKDF2_ITERATIONS}:${salt.toString('base64')}:${hash.toString('base64')}`
}

const wranglerPath = path.join(root, 'wrangler.json')
if (!fs.existsSync(wranglerPath)) {
  console.error('Missing wrangler.json')
  process.exit(1)
}

const databaseName = JSON.parse(fs.readFileSync(wranglerPath, 'utf8')).d1_databases?.find(d => d?.binding === 'DB')?.database_name
if (!databaseName) {
  console.error('Missing D1 binding named DB in wrangler.json')
  process.exit(1)
}

console.log(`Target database: ${databaseName} (${mode})`)
console.log(`Resetting password for user: ${email}...`)

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

// Check if user exists
const checkResult = spawnSync('npx', ['wrangler', 'd1', 'execute', databaseName, mode, '--json', '--command', `SELECT id FROM User WHERE email = ${sqlString(email)} LIMIT 1;`], {
  cwd: root, encoding: 'utf8'
})

if (checkResult.status !== 0) {
  process.stderr.write(checkResult.stderr || checkResult.stdout || 'wrangler d1 execute check failed\n')
  process.exit(1)
}

let userRows = []
try {
  const jsonStart = checkResult.stdout.indexOf('[')
  if (jsonStart !== -1) {
    userRows = JSON.parse(checkResult.stdout.slice(jsonStart))[0]?.results || []
  }
} catch (err) {
  // Parsing failed
}

if (userRows.length === 0) {
  console.error(`✗ User with email "${email}" not found in database.`)
  process.exit(1)
}

// Generate new hash and run UPDATE query
const newHash = hashPassword(password)
const updateResult = spawnSync('npx', ['wrangler', 'd1', 'execute', databaseName, mode, '--command', `UPDATE User SET passwordHash = ${sqlString(newHash)}, updatedAt = ${sqlString(new Date().toISOString())} WHERE email = ${sqlString(email)};`], {
  cwd: root, stdio: 'inherit'
})

if (updateResult.status === 0) {
  console.log(`✓ Successfully reset password for "${email}".`)
} else {
  console.error('✗ Failed to update password.')
  process.exit(updateResult.status ?? 1)
}
