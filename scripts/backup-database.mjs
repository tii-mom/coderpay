import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

// Read wrangler.json
const wranglerPath = path.join(root, 'wrangler.json')
if (!fs.existsSync(wranglerPath)) {
  console.error('Missing wrangler.json')
  process.exit(1)
}

let wranglerConfig
try {
  wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'))
} catch (err) {
  console.error('Failed to parse wrangler.json:', err.message)
  process.exit(1)
}

const dbConfig = wranglerConfig.d1_databases?.find(d => d?.binding === 'DB')
if (!dbConfig || !dbConfig.database_name) {
  console.error('Missing D1 database binding named "DB" or its database_name in wrangler.json')
  process.exit(1)
}

const dbName = dbConfig.database_name
const backupsDir = path.join(root, 'backups')

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const filename = `backup-${dbName}-${timestamp}.sql`
const outputPath = path.join(backupsDir, filename)

console.log(`Starting cold backup for D1 database "${dbName}"...`)

// Run wrangler d1 export <name> --remote --output=<path>
const result = spawnSync('npx', ['wrangler', 'd1', 'export', dbName, '--remote', `--output=${outputPath}`], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit'
})

if (result.status === 0) {
  console.log(`✓ Cold backup of D1 database "${dbName}" exported successfully to: ${outputPath}`)
} else {
  console.error(`✗ Backup failed with exit code: ${result.status}`)
  process.exit(result.status ?? 1)
}
