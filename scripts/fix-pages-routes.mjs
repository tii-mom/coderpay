import fs from 'node:fs'
import path from 'node:path'

const routesPath = path.join(process.cwd(), '.vercel', 'output', 'static', '_routes.json')

if (!fs.existsSync(routesPath)) {
  console.error(`Missing Pages routes file at ${routesPath}`)
  process.exit(1)
}

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'))
const exclude = new Set(Array.isArray(routes.exclude) ? routes.exclude : [])
exclude.add('/downloads/*')
routes.exclude = Array.from(exclude)

fs.writeFileSync(routesPath, `${JSON.stringify(routes)}\n`)
console.log('Updated Pages routes: excluded /downloads/* from Worker routing.')
