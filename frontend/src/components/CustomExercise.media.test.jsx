// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {webcrypto} from 'node:crypto'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {customExSheet} from '../sheets.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {registerCustom} from '../lib/exercises.js'
import {hydrateProfile,retainProfileResources} from '../lib/profile-resources.js'
import {setLang} from '../lib/i18n.js'

vi.mock('../lib/demo.js',()=>({STANDALONE:true,DEMO:false,DEMO_SEEDED:'test'}))
const KEY='gym_state_v1',image='data:image/gif;base64,'+'A'.repeat(65536)
const updateAtomic=useStore.getState().updateAtomic
let host,root,stores,controls,quota,before,raw,done,atomic,readers,holdRead
function fakeDatabase(){
 stores={resources:new Map(),snapshots:new Map()};controls={fail:false,hold:false,releases:[]}
 const db={close(){},transaction(name,mode){
  const staged=new Map(stores[name]);let failed=false
  const tx={error:null,abort(){failed=true;queueMicrotask(()=>tx.onabort?.())},objectStore:()=>({
   put(value,key){const request={error:null};queueMicrotask(()=>{if(failed)return;if(name==='resources'&&controls.fail){failed=true;request.error=tx.error=new DOMException('Synthetic full disk','QuotaExceededError');request.onerror?.();tx.onerror?.()}else staged.set(key,structuredClone(value))});return request},
   get(key){const request={};queueMicrotask(()=>{request.result=stores[name].get(key);request.onsuccess?.()});return request},
  })}
  const complete=()=>queueMicrotask(()=>queueMicrotask(()=>{if(!failed){if(mode==='readwrite')stores[name]=staged;tx.oncomplete?.()}}))
  if(controls.hold&&name==='resources'&&mode==='readwrite')controls.releases.push(complete);else complete()
  return tx
 }}
 vi.stubGlobal('indexedDB',{open(){const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request}})
}
function Sheets(){return useUI(s=>s.sheets).map(sheet=><div key={sheet.id}>{sheet.render(()=>useUI.getState().closeSheet(sheet.id))}</div>)}
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)
async function chooseImage(){await act(async()=>{
 const input=host.querySelector('#custom-ex-image')
 Object.defineProperty(input,'files',{configurable:true,value:[new File(['synthetic GIF fixture'],'synthetic.gif',{type:'image/gif'})]})
 input.dispatchEvent(new Event('change',{bubbles:true}))
})}
async function save(){await act(async()=>{
 useUI.setState({toastMsg:''});button('Save').click()
 await vi.waitFor(()=>expect(useUI.getState().sheets.length===0||useUI.getState().toastMsg!=='').toBe(true))
})}
const expectOnlyImage=(baseline=before)=>{
 const after=useStore.getState().S
 expect(after.customEx).toEqual(baseline.customEx.map((ex,i)=>i?ex:{...ex,img:image}))
 for(const key of Object.keys(baseline))if(!['_ts','customEx'].includes(key))expect(after[key]).toEqual(baseline[key])
 expect(localStorage.getItem('synthetic-device-credential')).toBe('kept')
}
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.stubGlobal('crypto',webcrypto);fakeDatabase();retainProfileResources({});localStorage.clear();await setLang('en')
 quota=Infinity;holdRead=false;readers=[]
 vi.stubGlobal('FileReader',class{
  readAsDataURL(){this.result=image;readers.push(this);if(!holdRead)queueMicrotask(()=>this.onload?.())}
  abort(){this.onabort?.()}
 })
 useStore.setState({S:structuredClone(DEF),user:null,storageError:null,storageWarning:null,updateAtomic})
 useStore.getState().replaceState({...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,
  customEx:[{id:'legacy-one',n:'  Synthetic duplicate press  ',bp:'upper arms',tg:'triceps',sm:['forearms'],gif:'kept-existing.gif',custom:true,unknown:{keep:1}},{id:'legacy-two',n:'  Synthetic duplicate press  ',bp:'upper arms',custom:true}],
  routines:[{id:'kept-routine',name:'Synthetic routine',ex:[{id:'legacy-one',sets:3},{id:'legacy-two',sets:2}]}],
  workouts:[{id:'kept-history',d:'2026-10-20',entries:[{id:'legacy-one',sets:[{w:20,r:8,done:true}]}]}],_ts:1},false)
 before=structuredClone(useStore.getState().S);raw=localStorage.getItem(KEY);localStorage.setItem('synthetic-device-credential','kept')
 const storage=localStorage
 vi.stubGlobal('localStorage',new Proxy(storage,{get(target,key){if(key==='setItem')return(name,value)=>{if(name===KEY&&value.length>quota)throw new DOMException('Synthetic primary quota','QuotaExceededError');return target.setItem(name,value)};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}}))
 atomic=vi.fn(updateAtomic);useStore.setState({updateAtomic:atomic});done=vi.fn()
 useUI.setState({sheets:[],timer:null,work:null,toastMsg:''})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>{root.render(<Sheets/>);customExSheet(useStore.getState().S.customEx[0],done)})
})
afterEach(async()=>{
 await useStore.getState().flushPersistence();await act(async()=>root.unmount());host.remove();useUI.getState().closeAll()
 useStore.setState({updateAtomic});vi.restoreAllMocks();vi.unstubAllGlobals();registerCustom([]);retainProfileResources({})
})

it('changes only the selected legacy img, retaining absent metadata, duplicate IDs and the existing gif',async()=>{
 await chooseImage();await save()
 expectOnlyImage();expect(atomic).toHaveBeenCalledOnce();expect(done).toHaveBeenCalledOnce()
 expect(done.mock.calls[0][0]).toEqual(useStore.getState().S.customEx[0])
 expect(useUI.getState().sheets).toHaveLength(0);expect(useUI.getState().toastMsg).toBe('Saved')
})

it('does not write any profile when the image and metadata are unchanged',async()=>{
 const same=useStore.getState().S;await save()
 expect(atomic).not.toHaveBeenCalled();expect(useStore.getState().S).toBe(same);expect(localStorage.getItem(KEY)).toBe(raw)
 expect(useStore.getState().S.customEx[0]).not.toHaveProperty('img')
})

it('retains live metadata edited after opening and resolves the callback from the saved live ID',async()=>{
 await chooseImage()
 act(()=>useStore.getState().update(s=>{s.customEx[0].n='Synthetic live rename';s.customEx[0].unknown.keep=2}))
 const latest=structuredClone(useStore.getState().S);await save();expectOnlyImage(latest)
 expect(done.mock.calls[0][0].n).toBe('Synthetic live rename')
})

it('commits verified resources when the primary quota is full and hydrates the same profile',async()=>{
 quota=12000;await chooseImage();await save();expectOnlyImage()
 const core=JSON.parse(localStorage.getItem(KEY));expect(core._webStorage).toEqual({version:1})
 expect(core.customEx[0].img).toMatchObject({$tgymResource:1});expect(stores.resources.size).toBe(1)
 expect(await hydrateProfile(core)).toEqual(useStore.getState().S)
})

it('keeps the old profile and uploaded draft after resource failure, then retries without duplicate IDs',async()=>{
 quota=12000;controls.fail=true;await chooseImage();await save()
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem(KEY)).toBe(raw);expect(stores.resources.size).toBe(0)
 expect(useUI.getState().sheets).toHaveLength(1);expect(button('Change image or GIF')).toBeTruthy()
 expect(button('Save').disabled).toBe(false);expect(done).not.toHaveBeenCalled();expect(useUI.getState().toastMsg).not.toBe('Saved')
 controls.fail=false;await save();expectOnlyImage();expect(useStore.getState().S.customEx).toHaveLength(2);expect(stores.resources.size).toBe(1)
})

it('reuses a staged resource after a compact-core failure instead of duplicating it on retry',async()=>{
 quota=1;await chooseImage();await save()
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem(KEY)).toBe(raw);expect(stores.resources.size).toBe(1)
 expect(done).not.toHaveBeenCalled();quota=12000;await save();expectOnlyImage();expect(stores.resources.size).toBe(1)
 expect(useStore.getState().S.customEx).toHaveLength(2);expect(done).toHaveBeenCalledOnce()
})

it('guards same-stack double saves and disables file and form actions while staging',async()=>{
 quota=12000;controls.hold=true;await chooseImage()
 await act(async()=>{const saveButton=button('Save');saveButton.click();saveButton.click();await vi.waitFor(()=>expect(controls.releases).toHaveLength(1))})
 expect(atomic).toHaveBeenCalledOnce();expect(button('Save').disabled).toBe(true)
 expect(button('Change image or GIF').disabled).toBe(true);expect(host.querySelector('#custom-ex-image').disabled).toBe(true)
 expect(useStore.getState().S).toEqual(before)
 await act(async()=>{controls.releases[0]();await vi.waitFor(()=>expect(useUI.getState().sheets).toHaveLength(0))})
 expectOnlyImage();expect(done).toHaveBeenCalledOnce();expect(stores.resources.size).toBe(1)
})

it('retains concurrent live edits when staging loses its snapshot, then retries against the current ID',async()=>{
 quota=12000;controls.hold=true;await chooseImage()
 await act(async()=>{button('Save').click();await vi.waitFor(()=>expect(controls.releases).toHaveLength(1))})
 act(()=>useStore.getState().update(s=>{s.theme='light';s.customEx[0].unknown.keep=3}))
 const latest=structuredClone(useStore.getState().S),latestRaw=localStorage.getItem(KEY)
 await act(async()=>{controls.releases[0]();await vi.waitFor(()=>expect(useUI.getState().toastMsg).toBe('Could not save. Check available storage and try again.'))})
 expect(button('Save').disabled).toBe(false)
 expect(useStore.getState().S).toEqual(latest);expect(localStorage.getItem(KEY)).toBe(latestRaw)
 expect(useUI.getState().sheets).toHaveLength(1);expect(done).not.toHaveBeenCalled();expect(useUI.getState().toastMsg).not.toBe('Saved')
 controls.hold=false;await save();expectOnlyImage(latest);expect(stores.resources.size).toBe(1)
 expect(useStore.getState().S.customEx).toHaveLength(2);expect(done).toHaveBeenCalledOnce()
})

it('waits for the file read before permitting Save',async()=>{
 holdRead=true;await chooseImage();expect(button('Save').disabled).toBe(true)
 await act(async()=>button('Save').click());expect(atomic).not.toHaveBeenCalled();expect(useUI.getState().sheets).toHaveLength(1)
 await act(async()=>readers[0].onload());await save();expectOnlyImage()
})

it('does not recreate a live ID deleted after opening',async()=>{
 await chooseImage();act(()=>useStore.getState().update(s=>{s.customEx=s.customEx.filter(ex=>ex.id!=='legacy-one')}))
 const latest=structuredClone(useStore.getState().S);await save()
 expect(useStore.getState().S).toEqual(latest);expect(done).not.toHaveBeenCalled();expect(useUI.getState().sheets).toHaveLength(1)
})

it('keeps regular metadata editing semantics and skips duplicate confirmation for an unchanged name',async()=>{
 act(()=>{const field=host.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Synthetic new description');field.dispatchEvent(new Event('input',{bubbles:true}))})
 await save();expect(atomic).not.toHaveBeenCalled();expect(useUI.getState().sheets).toHaveLength(0)
 expect(useStore.getState().S.customEx[0]).toMatchObject({id:'legacy-one',n:'Synthetic duplicate press',desc:'Synthetic new description',eq:'custom'})
})
