import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Deploys the CoderPay web console to Cloudflare Pages production.
//
// Hard lesson baked into this script: a stale `.vercel/output` can silently
// ship old code. So we ALWAYS rebuild, then refuse to deploy unless the freshly
// built artifact is newer than this run started AND contains the marker strings
// of the fixes that must be live. This is a guard, not a full test suite.

const root = process.cwd()
const PROJECT_NAME = 'coderpay'
const OUTPUT_DIR = path.join(root, '.vercel', 'output')
const STATIC_DIR = path.join(OUTPUT_DIR, 'static')
const FUNCTIONS_DIR = path.join(OUTPUT_DIR, 'functions')

// Marker strings that must exist in the built functions. Each maps a critical
// fix to a unique string the bundler preserves (user-facing text / log lines).
const REQUIRED_MARKERS = [
  { label: 'P0-1 webhook status machine skip guard', needle: 'webhook_status_', file: 'api/events.func/index.js' },
  { label: 'P0-1 webhook dispatcher failure path', needle: 'dispatcher_error', file: 'api/events.func/index.js' },
  { label: 'P0-2 full-email-only login', needle: '请输入完整的注册邮箱', file: 'api/auth/login.func/index.js' },
  { label: 'P1-5 expired_payment branch', needle: '但订单已过期', file: 'api/events.func/index.js' },
]

const startedAt = Date.now()

function run(cmd, args, label) {
  console.log(`\n▶ ${label}\n  ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status ?? 'signal'})`)
    process.exit(1)
  }
}

function fail(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

// PLACEHOLDER_MAIN
// 1. Quality gate. Skippable only with --skip-verify (e.g. when CI already ran it).
if (!process.argv.includes('--skip-verify')) {
  run('npm', ['run', 'verify'], 'Quality gate (npm run verify)')
  run('npm', ['run', 'check:prod'], 'Production config check (npm run check:prod)')
}

// 2. Always rebuild the Pages output from current source.
run('npx', ['@cloudflare/next-on-pages'], 'Rebuild Pages output (@cloudflare/next-on-pages)')

// 3. Freshness: the worker bundle must have been written during THIS run.
const workerEntry = path.join(STATIC_DIR, '_worker.js', 'index.js')
if (!fs.existsSync(workerEntry)) {
  fail(`Built worker not found at ${workerEntry}. Build did not produce expected output.`)
}
const builtAt = fs.statSync(workerEntry).mtimeMs
if (builtAt < startedAt) {
  fail(`Built worker is older than this deploy run (built ${new Date(builtAt).toISOString()}, run started ${new Date(startedAt).toISOString()}). Refusing to ship a stale artifact.`)
}
console.log(`\n✓ Fresh artifact: worker built at ${new Date(builtAt).toISOString()}`)

// 4. Marker check: each critical fix must be present in the built functions.
const missing = []
for (const marker of REQUIRED_MARKERS) {
  const filePath = path.join(FUNCTIONS_DIR, marker.file)
  if (!fs.existsSync(filePath)) {
    missing.push(`${marker.label}: function file missing (${marker.file})`)
    continue
  }
  const contents = fs.readFileSync(filePath, 'utf8')
  if (!contents.includes(marker.needle)) {
    missing.push(`${marker.label}: marker "${marker.needle}" not found in ${marker.file}`)
  }
}
if (missing.length > 0) {
  console.error('\n✗ Built artifact is missing required fix markers:')
  for (const m of missing) console.error(`  - ${m}`)
  fail('Refusing to deploy: built code does not contain expected fixes.')
}
console.log(`✓ All ${REQUIRED_MARKERS.length} fix markers present in built functions.`)

// 5. Deploy. Pass --dry-run through for a no-op rehearsal.
const deployArgs = ['wrangler', 'pages', 'deploy', STATIC_DIR, `--project-name=${PROJECT_NAME}`, '--commit-dirty=true']
if (process.argv.includes('--dry-run')) {
  console.log('\n--dry-run: build + verification passed, skipping actual deploy.')
  console.log(`Would run: npx ${deployArgs.join(' ')}`)
  process.exit(0)
}
run('npx', deployArgs, `Deploy to Cloudflare Pages (${PROJECT_NAME})`)
console.log('\n✓ Deployment complete. Verify the production alias and run smoke tests.')
