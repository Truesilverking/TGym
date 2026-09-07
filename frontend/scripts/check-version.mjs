import { readFileSync } from 'node:fs'
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8')
const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1]
const code = Number(gradle.match(/versionCode\s+(\d+)/)?.[1])
if (!name || name !== pkg.version) throw new Error(`Version mismatch: package ${pkg.version}, Android ${name || 'missing'}`)
if (!Number.isInteger(code) || code < 1) throw new Error('Android versionCode must be a positive integer')
const tag = process.env.GITHUB_REF_NAME || process.argv[2]
if (tag && tag !== `v${pkg.version}`) throw new Error(`Tag ${tag} does not match v${pkg.version}`)
const previous = Number(process.env.PREVIOUS_VERSION_CODE || 0)
if (previous && code <= previous) throw new Error(`versionCode ${code} must exceed published ${previous}`)
console.log(JSON.stringify({ version: pkg.version, versionCode: code }))
