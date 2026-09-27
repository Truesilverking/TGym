import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pwaMetadata } from '../../scripts/pwa-metadata.mjs'

const dirs=[]
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true})})
it('precaches all local shell assets and separates builds even if only a public file changes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tgym-pwa-test-'));dirs.push(dir)
 mkdirSync(join(dir,'assets/nested'),{recursive:true})
 for(const name of ['index.html','manifest.json','icon-180.png','icon-192.png','icon-512.png','about.html','privacy.html','assets/nested/lazy.js'])writeFileSync(join(dir,name),name)
 const template="const CACHE='__TGYM_CACHE__';const PRECACHE=['__TGYM_PRECACHE__'];const MEDIA=['__TGYM_MEDIA__']"
 const plugin=pwaMetadata('1.0.0');plugin.configResolved({root:dir,build:{outDir:'.'},env:{VITE_IMG_BASE:'https://images.test/'}})
 const build=()=>{writeFileSync(join(dir,'sw.js'),template);plugin.closeBundle();return readFileSync(join(dir,'sw.js'),'utf8')}
 const first=build();expect(first).toContain('assets/nested/lazy.js');expect(first).toContain('icon-180.png');expect(first).toContain('https://images.test/')
 expect(build()).toBe(first)
 writeFileSync(join(dir,'manifest.json'),'changed icon/settings');expect(build()).not.toBe(first)
})
