// TGym authoring source: AGPL-3.0-or-later. Model and derived artwork: see model/NOTICE.md.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const root=fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const model=path.join(root,'model');
const frames=48;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const KEYS=[
 'overhead-cable-triceps-ez-bar','cross-body-lat-pull-around','plate-pinch-hold',
 'bayesian-cable-curl','spanish-squat-hold','nordic-hold','dead-hang',
 'standing-bent-knee-calf-raise','machine-hip-thrust','captains-chair-knee-raise',
 'suitcase-carry','walking-flat-ground','stepmill-continuous-walk',
];
const SOURCE_FILES=[
 'index.html','scene.mjs','rig.mjs','poses-main.mjs','poses-upper.mjs',
 'equipment.mjs','hands.mjs','render.mjs','verify-export.mjs',
 'mechanical-acceptance.json','package.json','package-lock.json','README.md',
 'avatar.mjs','body-envelope.mjs','head.mjs','projected-surface.mjs',
 ...assetFiles('assets'),
 ...assetFiles('model'),
];
function assetFiles(relative){
 const folder=path.join(root,relative);
 return fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry=>{
  const file=relative+'/'+entry.name;
  if(entry.isSymbolicLink())throw Error('Authoring assets must not contain symbolic links: '+file);
  return entry.isDirectory()?assetFiles(file):entry.isFile()?[file]:[];
 });
}
const ART_HASHES=JSON.parse(fs.readFileSync(path.join(root,'assets/pinned-inputs.json'),'utf8'));
const MODEL_HASHES={
 'body_superficial.app5m.glb':'ce9859de013c2ee9713dbe3158275208b57be1b4ff31957eca87195b991c0ab1',
 'data/muscles.json':'da930e89dd70ac65b2a960df3bf20321898a5171716400a14dc620e6dedc9883',
 'data/za_map.json':'3a7466ea3537854db373364060f3428c3d1d22df683d1c4065a09519ade498af',
};
function parseArgs(args){
 let out=path.resolve(root,'../../../../output/exercise-media-native');const keys=[];
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--help'||arg==='-h')return{help:true};
  if(arg==='--list')return{list:true};
  if(arg==='--out'){
   if(!args[i+1]||args[i+1].startsWith('--'))throw Error('--out requires a directory');
   out=path.resolve(args[++i]);
  }else if(arg.startsWith('--out=')){
   if(!arg.slice(6))throw Error('--out requires a directory');out=path.resolve(arg.slice(6));
  }else if(arg.startsWith('-'))throw Error('Unknown option: '+arg);
  else keys.push(arg);
 }
 const selected=keys.length?keys:KEYS;
 if(new Set(selected).size!==selected.length||selected.some(key=>!KEYS.includes(key)))throw Error('Exercise IDs must be unique members of --list');
 return{out,keys:selected};
}
function inside(parent,file){const rel=path.relative(parent,file);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
function plannedRealPath(file){
 let head=path.resolve(file);const tail=[];
 while(!fs.existsSync(head)){const parent=path.dirname(head);if(parent===head)throw Error('No existing output ancestor');tail.unshift(path.basename(head));head=parent;}
 return path.resolve(fs.realpathSync(head),...tail);
}
function help(){
 console.log('Usage: node render.mjs [--out NEW_DIRECTORY] [exercise-id ...]');
 console.log('Default: repository output/exercise-media-native. Existing output directories are never overwritten.');
 console.log('No exercise IDs means all thirteen. --list prints valid IDs.');
 console.log('FFMPEG_PATH overrides ffmpeg; CHROMIUM_PATH overrides the browser executable.');
 console.log('Windows defaults to installed Edge; other systems use Playwright Chromium.');
}
function makeServer(){
 const exact=new Map(SOURCE_FILES.filter(name=>name.endsWith('.mjs')||name==='index.html'||name.startsWith('assets/')).map(name=>['/'+name,path.join(root,name)]));
 exact.set('/',path.join(root,'index.html'));
 exact.set('/body.glb',path.join(model,'body_superficial.app5m.glb'));
 exact.set('/muscles.json',path.join(model,'data/muscles.json'));
 const threeRoot=fs.realpathSync(path.join(root,'node_modules/three'));
 return http.createServer((request,response)=>{
  try{
   if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405);response.end();return;}
   const url=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
   let file=exact.get(url);
   if(!file&&url.startsWith('/node_modules/three/')){
    file=fs.realpathSync(path.resolve(threeRoot,url.slice('/node_modules/three/'.length)));
    if(!inside(threeRoot,file))throw Error('outside dependency scope');
   }else if(file){file=fs.realpathSync(file);if(!inside(root,file))throw Error('outside source scope');}
   if(!file||!fs.statSync(file).isFile())throw Error('not found');
   response.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
   response.setHeader('Cache-Control','no-store');
   response.setHeader('X-Content-Type-Options','nosniff');
   response.end(request.method==='HEAD'?undefined:fs.readFileSync(file));
  }catch{response.writeHead(404);response.end('Not found');}
 });
}

async function main(){
 const args=parseArgs(process.argv.slice(2));
 if(args.help){help();return;}if(args.list){console.log(KEYS.join('\n'));return;}
 const out=plannedRealPath(args.out),applicationSources=plannedRealPath(path.resolve(root,'../../../src'));
 if(inside(root,out)||inside(applicationSources,out))throw Error('Output must be outside the authoring and application source directories');
 if(fs.existsSync(out))throw Error('Choose a new output directory; existing and completed exports are immutable: '+out);
 const dependencies=Object.fromEntries(['three','playwright'].map(name=>[name,JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'),'utf8')).version]));
 if(dependencies.three!=='0.183.2'||dependencies.playwright!=='1.63.0')throw Error('Dependency versions differ from the pinned authoring toolchain; run npm ci');
 const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
 const ffmpegVersion=execFileSync(ffmpeg,['-version'],{encoding:'utf8',windowsHide:true}).split(/\r?\n/,1)[0];
 for(const [file,expected] of Object.entries(MODEL_HASHES))if(sha(fs.readFileSync(path.join(model,file)))!==expected)throw Error('Unexpected immutable upstream model input: '+file);
 for(const [file,expected] of Object.entries(ART_HASHES)){
  if(!inside(root,path.resolve(root,file)))throw Error('Artwork pin outside authoring scope: '+file);
  if(sha(fs.readFileSync(path.join(root,file)))!==expected)throw Error('Unexpected pinned avatar input: '+file);
 }
 const rendererSources=Object.fromEntries(SOURCE_FILES.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
 const server=makeServer();let browser;const errors=[],records=[];
 const run=parameters=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error',...parameters],{stdio:['ignore','pipe','pipe'],maxBuffer:5e6,windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const launch={headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']};
  if(process.env.CHROMIUM_PATH)launch.executablePath=process.env.CHROMIUM_PATH;
  else if(process.platform==='win32')launch.channel='msedge';
  browser=await chromium.launch(launch);
  const page=await browser.newPage({viewport:{width:768,height:768}});
  page.on('pageerror',error=>{errors.push(error.message);console.log(JSON.stringify({pageError:error.message}));});
  page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.log(JSON.stringify({consoleError:message.text()}));}});
  const response=await page.goto('http://127.0.0.1:'+server.address().port);
  if(response.status()!==200)throw Error('HTML '+response.status());
  await page.waitForFunction(()=>window.ready,null,{timeout:20000});
  for(const key of args.keys){
   const folder=path.join(out,key);fs.mkdirSync(folder);const motion=[];
   for(let i=0;i<=frames;i++){
    const t=i/frames,pose=await page.evaluate(({key,t})=>nativeArt.renderPose(key,t),{key,t});motion.push(pose);
    const filename=i===frames?'cycle-end.png':'frame-'+String(i).padStart(3,'0')+'.png';
    await page.screenshot({path:path.join(folder,filename)});
    if(pose.errors.length)throw Error(key+' unreachable contact in frame '+i+': '+JSON.stringify(pose.errors));
   }
   fs.writeFileSync(path.join(folder,'motion.json'),JSON.stringify(motion),{flag:'wx'});
   const fps=key.includes('walk')||key==='suitcase-carry'?25:20;
   const gif=path.join(out,key+'.gif'),poster=path.join(out,key+'-poster.png');
   const posterIndex=['standing-bent-knee-calf-raise','machine-hip-thrust','captains-chair-knee-raise','bayesian-cable-curl','overhead-cable-triceps-ez-bar'].includes(key)?24:0;
   run(['-framerate',String(fps),'-i',path.join(folder,'frame-%03d.png'),'-filter_complex','scale=512:512:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-frames:v',String(frames),'-loop','0','-gifflags','+transdiff','-y',gif]);
   run(['-i',gif,'-vf',`select='eq(n,${posterIndex})'`,'-frames:v','1','-y',poster]);
   const row={key,frames,fps,posterIndex,gifSha256:sha(fs.readFileSync(gif)),posterSha256:sha(fs.readFileSync(poster)),gifBytes:fs.statSync(gif).size,posterBytes:fs.statSync(poster).size,motionSha256:sha(fs.readFileSync(path.join(folder,'motion.json')))};
   records.push(row);console.log(JSON.stringify(row));
  }
 }catch(error){errors.push(error.stack||String(error));console.log(JSON.stringify({fatal:error.stack||String(error)}));process.exitCode=1;}
 finally{
  if(JSON.stringify(assetFiles('assets'))!==JSON.stringify(SOURCE_FILES.filter(file=>file.startsWith('assets/'))))errors.push('Avatar asset file list changed during export');
  if(JSON.stringify(assetFiles('model'))!==JSON.stringify(SOURCE_FILES.filter(file=>file.startsWith('model/'))))errors.push('Anatomical model source file list changed during export');
  for(const [file,expected] of Object.entries(rendererSources)){
   try{if(sha(fs.readFileSync(path.join(root,file)))!==expected)errors.push('Renderer changed during export: '+file);}
   catch(error){errors.push('Cannot recheck renderer '+file+': '+error.message);}
  }
  for(const [file,expected] of Object.entries(MODEL_HASHES)){
   try{if(sha(fs.readFileSync(path.join(model,file)))!==expected)errors.push('Model changed during export: '+file);}
   catch(error){errors.push('Cannot recheck model '+file+': '+error.message);}
  }
  const browserVersion=browser?.version();
  try{await browser?.close();}catch(error){errors.push('Browser cleanup failed: '+error.message);}
  try{if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  catch(error){errors.push('Local server cleanup failed: '+error.message);}
  fs.writeFileSync(path.join(out,'export-proof.json'),JSON.stringify({pass:errors.length===0&&records.length===args.keys.length,recordedAt:new Date().toISOString(),requestedExercises:args.keys,renderer:'Three.js fixed native rig and authored motions/equipment, continuous CC0-derived surface and one static four-view anatomical texture; no generated animation-frame interpolation',threeVersion:dependencies.three,playwrightVersion:dependencies.playwright,browserVersion,ffmpegVersion,modelSha256:MODEL_HASHES['body_superficial.app5m.glb'],modelSources:MODEL_HASHES,artworkInputs:ART_HASHES,rendererSources,errors,records},null,2),{flag:'wx'});
  if(errors.length)process.exitCode=1;
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
