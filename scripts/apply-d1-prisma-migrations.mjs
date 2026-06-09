import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const mode = process.argv.includes('--remote') ? '--remote' : '--local'
const wranglerPath = path.join(root, 'wrangler.json')
const migrationsDir = path.join(root, 'prisma', 'migrations')

if (!fs.existsSync(wranglerPath)) {
  console.error('Missing wrangler.json')
  process.exit(1)
}

const wrangler = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'))
const databaseName = wrangler.d1_databases?.find(db => db?.binding === 'DB')?.database_name
if (!databaseName) {
  console.error('Missing D1 database binding named DB in wrangler.json')
  process.exit(1)
}

const migrations = fs.readdirSync(migrationsDir)
  .map(name => ({ name, sqlPath: path.join(migrationsDir, name, 'migration.sql') }))
  .filter(migration => fs.existsSync(migration.sqlPath))
  .sort((a, b) => a.name.localeCompare(b.name))

if (migrations.length === 0) {
  console.error('No Prisma migration.sql files found')
  process.exit(1)
}

function runWrangler(args, options = {}) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: root,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
  })
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    process.exit(result.status ?? 1)
  }
  return result.stdout || ''
}

function executeCommand(sql, capture = false) {
  return runWrangler(['d1', 'execute', databaseName, mode, '--command', sql], { capture })
}

function executeFile(filePath) {
  runWrangler(['d1', 'execute', databaseName, mode, '--file', filePath])
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coderpay-d1-migrations-'))

try {
  executeCommand('CREATE TABLE IF NOT EXISTS "__CoderPayD1Migration" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);')

  for (const migration of migrations) {
    const existing = executeCommand(`SELECT "name" FROM "__CoderPayD1Migration" WHERE "name" = ${sqlString(migration.name)};`, true)
    if (existing.includes(migration.name)) {
      console.log(`Skipping ${migration.name}; already applied to ${databaseName} (${mode})`)
      continue
    }

    console.log(`Applying ${migration.name} to ${databaseName} (${mode})`)
    const tmpSqlPath = path.join(tmpDir, `${migration.name}.sql`)
    fs.copyFileSync(migration.sqlPath, tmpSqlPath)
    executeFile(tmpSqlPath)
    executeCommand(`INSERT INTO "__CoderPayD1Migration" ("name") VALUES (${sqlString(migration.name)});`)
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
