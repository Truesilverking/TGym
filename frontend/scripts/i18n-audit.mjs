import fs from 'node:fs'
import path from 'node:path'
import spanish from '../src/locales/es.js'

const ignored = new Set(['node_modules', 'locales', 'instr', 'exercise-names'])
const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) files.push(file)
  }
}
walk(new URL('../src', import.meta.url).pathname.slice(1))

const used = new Set()
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const regex of [/\bt\(\s*'((?:\\'|[^'])*)'/g, /\bt\(\s*"((?:\\"|[^"])*)"/g]) {
    for (const match of source.matchAll(regex)) used.add(match[1].replaceAll("\\'", "'").replaceAll('\\"', '"'))
  }
}

const missing = [...used].filter(key => !Object.hasOwn(spanish, key)).sort()
if (missing.length) {
  console.error(`Missing Spanish UI strings (${missing.length}):`)
  console.error(missing.join('\n'))
  process.exitCode = 1
} else console.log(`Spanish UI audit passed (${used.size} translated strings).`)
