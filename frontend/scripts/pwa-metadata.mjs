import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
export const pwaMetadata = version => {
 let mediaBases=['img/','gif/'],dir='dist'
 return ({
 name:'tgym-build-metadata',
 configResolved(config) {
  mediaBases=[config.env.VITE_IMG_BASE||'img/',config.env.VITE_GIF_BASE||'gif/']
  dir=resolve(config.root,config.build.outDir)
 },
 closeBundle() {
  const files=path=>readdirSync(`${dir}/${path}`,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(`${path}/${f.name}`):[`${path}/${f.name}`])
  const assets = existsSync(`${dir}/assets`) ? files('assets').sort() : []
  const commit=process.env.GITHUB_SHA || 'local'
  const shell=['index.html','manifest.json','icon-180.png','icon-192.png','icon-512.png','about.html','privacy.html',...assets]
  const template=readFileSync(`${dir}/sw.js`,'utf8')
  const hash=createHash('sha256').update(template).update(JSON.stringify(mediaBases))
  for(const path of shell)hash.update(path).update(readFileSync(`${dir}/${path}`))
  const digest=hash.digest('hex').slice(0,12)
  const sw=template.replace('__TGYM_CACHE__',`tgym-app-${version}-${commit}-${digest}`).replace("['__TGYM_PRECACHE__']",JSON.stringify(shell)).replace("['__TGYM_MEDIA__']",JSON.stringify(mediaBases))
  writeFileSync(`${dir}/sw.js`,sw)
  writeFileSync(`${dir}/build.json`,JSON.stringify({version,commit}))
 }
})
}
