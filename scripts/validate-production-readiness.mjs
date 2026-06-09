import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const issues = []
const warnings = []

function readEnvFile(filePath) {
  const env = new Map()
  if (!fs.existsSync(filePath)) return env

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) {
      warnings.push(`${filePath}:${index + 1} is not KEY=value`)
      continue
    }

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (/\s/.test(key)) {
      issues.push(`${filePath}:${index + 1} has invalid env key "${key}"`)
    }
    env.set(key, value)
  }

  return env
}

function requireEnv(env, key, description) {
  const value = env.get(key)
  if (!value) {
    issues.push(`Missing ${key}: ${description}`)
  } else if (isPlaceholder(value)) {
    issues.push(`${key} still contains a placeholder value`)
  }
  return value
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase()
  return normalized.includes('replace-with') ||
    normalized.includes('xxxxxxxx') ||
    normalized.includes('your-') ||
    normalized === 'changeme'
}

function requireLength(env, key, minLength) {
  const value = env.get(key)
  if (value && value.length < minLength) {
    issues.push(`${key} must be at least ${minLength} characters`)
  }
}

function requireUrl(env, key) {
  const value = env.get(key)
  if (!value) return
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol)) {
      issues.push(`${key} must be an HTTP(S) URL`)
    }
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      issues.push(`${key} must use HTTPS outside local development`)
    }
  } catch {
    issues.push(`${key} must be a valid URL`)
  }
}

function requireEmailLike(env, key) {
  const value = env.get(key)
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    issues.push(`${key} must be an email address`)
  }
}

function checkEmailProvider(env) {
  const provider = env.get('EMAIL_PROVIDER')
  if (!provider) {
    issues.push('Missing EMAIL_PROVIDER: required for verification and password reset emails')
    return
  }

  if (provider === 'brevo') {
    requireEnv(env, 'BREVO_API_KEY', 'Brevo API key for transactional email')
  } else if (provider === 'resend') {
    requireEnv(env, 'RESEND_API_KEY', 'Resend API key for transactional email')
  } else {
    issues.push('EMAIL_PROVIDER must be "brevo" or "resend"')
  }

  requireEnv(env, 'EMAIL_FROM', 'sender address for transactional email')
}

function checkAndroidSigning() {
  const androidRoot = path.join(root, 'coderpay-android')
  const keystorePropertiesPath = path.join(androidRoot, 'keystore.properties')
  const proguardRulesPath = path.join(androidRoot, 'app', 'proguard-rules.pro')

  if (!fs.existsSync(proguardRulesPath)) {
    issues.push('Missing coderpay-android/app/proguard-rules.pro')
  }

  if (!fs.existsSync(keystorePropertiesPath)) {
    issues.push('Missing coderpay-android/keystore.properties: release APK will be unsigned')
    return
  }

  const signing = readEnvFile(keystorePropertiesPath)
  for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
    const value = signing.get(key)
    if (!value) {
      issues.push(`Missing coderpay-android/keystore.properties ${key}`)
    } else if (isPlaceholder(value)) {
      issues.push(`coderpay-android/keystore.properties ${key} still contains a placeholder value`)
    }
  }

  const storeFile = signing.get('storeFile')
  if (storeFile) {
    const resolved = path.isAbsolute(storeFile)
      ? storeFile
      : path.join(androidRoot, storeFile)
    if (!fs.existsSync(resolved)) {
      issues.push('Android release keystore file does not exist at configured storeFile path')
    }
  }
}

function checkWranglerD1Binding() {
  const wranglerPath = path.join(root, 'wrangler.json')
  if (!fs.existsSync(wranglerPath)) {
    issues.push('Missing wrangler.json: Cloudflare Pages/D1 deployment config is required')
    return
  }

  let config
  try {
    config = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'))
  } catch {
    issues.push('wrangler.json must be valid JSON')
    return
  }

  const d1Databases = Array.isArray(config.d1_databases) ? config.d1_databases : []
  const db = d1Databases.find(database => database?.binding === 'DB')
  if (!db) {
    issues.push('wrangler.json must define a D1 database binding named DB')
    return
  }
  if (!db.database_name) issues.push('wrangler.json DB binding is missing database_name')
  if (!db.database_id) issues.push('wrangler.json DB binding is missing database_id')
}

function findDbFiles(dir) {
  const found = []
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...findDbFiles(full))
    } else if (/\.db(-shm|-wal)?$/.test(entry.name)) {
      found.push(full)
    }
  }
  return found
}

// Guards against a local SQLite dev DB leaking into the deployed Pages bundle.
// Only the `static` dir is uploaded by `wrangler pages deploy`.
function checkBuildArtifactClean() {
  const staticDir = path.join(root, '.vercel', 'output', 'static')
  if (!fs.existsSync(staticDir)) {
    warnings.push('.vercel/output/static not built yet; run `npm run pages:build` before deploy to scan for leaked DB files')
    return
  }
  const dbFiles = findDbFiles(staticDir)
  for (const file of dbFiles) {
    issues.push(`SQLite DB file leaked into deploy bundle: ${path.relative(root, file)}`)
  }
}

function checkPrismaMigrations() {
  const migrationsPath = path.join(root, 'prisma', 'migrations')
  if (!fs.existsSync(migrationsPath)) {
    issues.push('Missing prisma/migrations directory')
    return
  }

  const migrations = fs.readdirSync(migrationsPath)
    .filter(name => fs.existsSync(path.join(migrationsPath, name, 'migration.sql')))
  if (migrations.length === 0) {
    issues.push('No Prisma migrations found')
  }
}

const envPath = path.join(root, '.env')
const env = readEnvFile(envPath)

if (!fs.existsSync(envPath)) {
  issues.push('Missing .env')
}

requireEnv(env, 'NEXT_PUBLIC_APP_URL', 'public app URL used by checkout, callbacks, and Android')
requireUrl(env, 'NEXT_PUBLIC_APP_URL')
requireEnv(env, 'SESSION_SECRET', 'HMAC secret used to sign login cookies')
requireLength(env, 'SESSION_SECRET', 32)
requireEnv(env, 'PLATFORM_RECHARGE_USER_EMAIL', 'platform account for developer balance recharge')
requireEmailLike(env, 'PLATFORM_RECHARGE_USER_EMAIL')
checkEmailProvider(env)
checkWranglerD1Binding()
checkPrismaMigrations()
checkBuildArtifactClean()
checkAndroidSigning()

if (warnings.length > 0) {
  console.log('Production readiness warnings:')
  for (const warning of warnings) console.log(`- ${warning}`)
  console.log('')
}

if (issues.length > 0) {
  console.error('Production readiness check failed:')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exit(1)
}

console.log('Production readiness check passed.')
