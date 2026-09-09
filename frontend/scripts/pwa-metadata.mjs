import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
export const pwaMetadata = version => ({
 name:'tgym-build-metadata',
 closeBundle() {
  const dir = 'dist'
  const assets=readdirSync(`${dir}/assets`).map(f=>`assets/${f}`)
  const commit=process.env.GITHUB_SHA || 'local'
  const sw=readFileSync(`${dir}/sw.js`,'utf8').replace('__TGYM_CACHE__',`tgym-${version}-${commit}`).replace("['__TGYM_PRECACHE__']",JSON.stringify(['index.html',...assets]))
  writeFileSync(`${dir}/sw.js`,sw)
  writeFileSync(`${dir}/build.json`,JSON.stringify({version,commit}))
 }
})
