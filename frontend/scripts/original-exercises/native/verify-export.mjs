// Independent, read-only checks of exported world joints and decoded artwork.
// No renderer imports, pose reconstruction, image edits, or device claims.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const KEYS = [
  'overhead-cable-triceps-ez-bar', 'cross-body-lat-pull-around', 'plate-pinch-hold',
  'bayesian-cable-curl', 'spanish-squat-hold', 'nordic-hold', 'dead-hang',
  'standing-bent-knee-calf-raise', 'machine-hip-thrust', 'captains-chair-knee-raise',
  'suitcase-carry', 'walking-flat-ground', 'stepmill-continuous-walk',
];
const HOLDS = new Set(['plate-pinch-hold', 'spanish-squat-hold', 'nordic-hold', 'dead-hang']);
const WALK = new Set(['walking-flat-ground', 'suitcase-carry']);
const JOINTS = ['leftShoulder','leftElbow','leftWrist','leftHip','leftKnee','leftAnkle','leftToes',
  'rightShoulder','rightElbow','rightWrist','rightHip','rightKnee','rightAnkle','rightToes',
  'pelvis','head','neck','leftGrip','rightGrip'];
const SUPPORT = ['leftShoulder','rightShoulder','leftHip','rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle'];
const LENGTHS = ['left','right'].flatMap(side => [
  [side+'Shoulder',side+'Elbow'], [side+'Elbow',side+'Wrist'],
  [side+'Hip',side+'Knee'], [side+'Knee',side+'Ankle'], [side+'Ankle',side+'Toes'],
]);
const EPS_METRES = 1e-4; // 0.1 mm: numerical world-joint stability, not skin contact.
const vec = a => Array.isArray(a) && a.length===3 && a.every(Number.isFinite);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const norm = a => Math.hypot(...a);
const dist = (a,b) => norm(sub(a,b));
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const mid = (a,b) => a.map((v,i)=>(v+b[i])/2);
const range = a => [Math.min(...a),Math.max(...a)];
const flexion = (a,b,c) => 180-Math.acos(Math.max(-1,Math.min(1,dot(sub(a,b),sub(c,b))/(dist(a,b)*dist(c,b)))))*180/Math.PI;
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
const argv = process.argv.slice(2);
if(argv.length!==1 || ['-h','--help'].includes(argv[0])) {
  console.log('Usage: node verify-export.mjs <complete-export-directory>');
  console.log('Reads only. Emits JSON to stdout; exits 1 on any failed check. Redirect stdout to retain a report.');
  process.exit(argv.length===1?0:2);
}
const out=path.resolve(argv[0]);
const report={pass:false,recordedAt:new Date().toISOString(),out,
  method:'Independent raw world-joint invariants and Pillow decoding; no renderer imports or image edits',
  limits:'Skeleton landmarks and encoded-file checks only. Does not establish skin/equipment contact, clinical correctness, visual approval or physical-device acceptance.',
  thresholds:{stationaryJointMetres:EPS_METRES,boneLengthDriftMetres:EPS_METRES,seamMetres:.0005,calfFlexionDegrees:[39.9,40.1],calfToeAnchorMetres:.002,stanceVelocityErrorMetresPerCycle:.005},
  checks:[],exercises:[],errors:[]};
function check(list,name,pass,observed,expected) {list.push({name,pass:!!pass,observed,...(expected===undefined?{}:{expected})});}
function stable(rows,names) {return Math.max(...rows.flatMap(r=>names.map(n=>dist(r.joints[n],rows[0].joints[n]))));}
function statsRange(rows,fn) {return range(rows.map(fn));}
function angleRange(rows,side,joint='Elbow') {const [a,c]=joint==='Elbow'?['Shoulder','Wrist']:['Hip','Ankle'];return statsRange(rows,r=>flexion(r.joints[side+a],r.joints[side+joint],r.joints[side+c]));}
function within(value,lo,hi) {return Number.isFinite(value)&&value>=lo&&value<=hi;}
function phase(t,offset) {const total=t+offset;return {round:Math.floor(total+1e-10),p:((total%1)+1)%1};}

let proof;
try {proof=read(path.join(out,'export-proof.json'));}
catch(e){report.errors.push('Cannot read export-proof.json: '+e.message);}
if(proof) {
  check(report.checks,'export reports complete success',proof.pass===true&&Array.isArray(proof.errors)&&proof.errors.length===0,{pass:proof.pass,errors:proof.errors},{pass:true,errors:[]});
  const recordKeys=Array.isArray(proof.records)?proof.records.map(r=>r.key):[];
  check(report.checks,'exact thirteen unique export records',recordKeys.length===13&&new Set(recordKeys).size===13&&KEYS.every(k=>recordKeys.includes(k)),recordKeys,KEYS);
}
for(const key of KEYS) {
  const result={key,checks:[],errors:[]};report.exercises.push(result);
  try {
    const records=proof?.records?.filter(r=>r.key===key)||[];
    if(records.length!==1)throw Error('Expected one export-proof record, found '+records.length);
    const record=records[0],motionPath=path.join(out,key,'motion.json'),rows=read(motionPath);
    check(result.checks,'49 samples spanning full normalized cycle',Array.isArray(rows)&&rows.length===49&&rows.every((r,i)=>r.key===key&&Number.isFinite(r.t)&&Math.abs(r.t-i/48)<1e-10),Array.isArray(rows)?{count:rows.length,times:rows.map(r=>r.t)}:typeof rows,'49 entries with t=i/48, i=0..48');
    if(!Array.isArray(rows)||rows.length!==49)throw Error('Cannot evaluate motion with a non-49-entry array');
    const invalid=[];
    for(let i=0;i<rows.length;i++)for(const name of JOINTS)if(!vec(rows[i]?.joints?.[name]))invalid.push({frame:i,joint:name,value:rows[i]?.joints?.[name]});
    check(result.checks,'all nineteen world joints finite at every sample',invalid.length===0,invalid.slice(0,10),{jointSamples:49*19});
    if(invalid.length)throw Error('Invalid world joints prevent geometric checks');
    const errors=rows.flatMap((r,i)=>(Array.isArray(r.errors)?r.errors:[{missingErrorsArray:true}]).map(e=>({frame:i,...e})));
    check(result.checks,'no recorded unreachable-contact solver errors',errors.length===0,errors.slice(0,10),[]);
    const lengths=LENGTHS.map(([a,b])=>{const bounds=statsRange(rows,r=>dist(r.joints[a],r.joints[b]));return {segment:a+'—'+b,min:bounds[0],max:bounds[1],drift:bounds[1]-bounds[0]};});
    check(result.checks,'limb and foot bone lengths remain positive and constant',lengths.every(l=>l.min>.03&&l.max<.70&&l.drift<=EPS_METRES),lengths,{minMetres:.03,maxMetres:.70,maxDriftMetres:EPS_METRES});
    const first=rows[0],last=rows[48],travel=WALK.has(key)?last.metadata?.travel-first.metadata?.travel:0;
    check(result.checks,'cycle travel metadata is finite',Number.isFinite(travel)&&(!WALK.has(key)||travel>.1),travel,WALK.has(key)?'finite positive forward displacement':'zero');
    const seam=Math.max(...JOINTS.map(name=>dist(sub(last.joints[name],[0,0,travel]),first.joints[name])));
    check(result.checks,'joint cycle closes after documented forward travel removal',Number.isFinite(seam)&&seam<=.0005,seam,{maxMetres:.0005,travelRemovedAlong:'+Z'});
    if(HOLDS.has(key)) {
      const drift=stable(rows,JOINTS);
      check(result.checks,'isometric hold has no joint excursion',drift<=EPS_METRES,drift,{maxMetres:EPS_METRES});
    }
    if(key==='overhead-cable-triceps-ez-bar') {
      const drift=stable(rows,[...SUPPORT,'leftElbow','rightElbow','pelvis','head']);
      check(result.checks,'overhead support and upper-arm anchors fixed',drift<=EPS_METRES,drift,{maxMetres:EPS_METRES});
      const gripSeparations=statsRange(rows,r=>dist(r.joints.leftGrip,r.joints.rightGrip)),gripSeparationDrift=gripSeparations[1]-gripSeparations[0];
      check(result.checks,'actual two-hand EZ grip separation remains constant',gripSeparations[0]>.15&&gripSeparations[1]<.60&&gripSeparationDrift<=.0005,{separationMetres:gripSeparations,driftMetres:gripSeparationDrift},{maxDriftMetres:.0005,plausibleSeparationMetres:[.15,.60]});
      for(const side of ['left','right']) {const a=angleRange(rows,side);check(result.checks,side+' elbow alone provides a broad extension range',within(a[0],5,20)&&within(a[1],100,130)&&a[1]-a[0]>=80,a,{minimumFlexion:[5,20],maximumFlexion:[100,130],minimumExcursion:80});}
      const fromVertical=v=>Math.acos(Math.max(-1,Math.min(1,v[1]/norm(v))))*180/Math.PI;
      const torsoAngles=rows.map(r=>fromVertical(sub(mid(r.joints.leftShoulder,r.joints.rightShoulder),mid(r.joints.leftHip,r.joints.rightHip))));
      check(result.checks,'upright low-pulley torso measured from shoulder–hip centers',Math.max(...torsoAngles)<=5,range(torsoAngles),{maxFromVerticalDegrees:5});
      for(const side of ['left','right']) {
        const humeri=rows.map(r=>sub(r.joints[side+'Elbow'],r.joints[side+'Shoulder'])),elevations=humeri.map(fromVertical),firstDirection=humeri[0].map(v=>v/norm(humeri[0]));
        const directionDrift=humeri.map(v=>Math.acos(Math.max(-1,Math.min(1,dot(v,firstDirection)/norm(v))))*180/Math.PI);
        check(result.checks,side+' actual humerus remains vertical and directionally fixed',Math.max(...elevations)<=5&&Math.max(...directionDrift)<=.1,{fromVerticalDegrees:range(elevations),maxDirectionDriftDegrees:Math.max(...directionDrift)},{maxFromVerticalDegrees:5,maxDirectionDriftDegrees:.1});
        const flexAt=index=>flexion(rows[index].joints[side+'Shoulder'],rows[index].joints[side+'Elbow'],rows[index].joints[side+'Wrist']),ends=[flexAt(0),flexAt(24),flexAt(48)];
        check(result.checks,side+' controlled elbow path reaches authored 105–12–105 degrees',Math.abs(ends[0]-105)<=.1&&Math.abs(ends[1]-12)<=.1&&Math.abs(ends[2]-105)<=.1,ends,{flexionDegrees:[105,12,105],toleranceDegrees:.1});
      }
      const kneeAngles=['left','right'].flatMap(side=>angleRange(rows,side,'Knee'));
      check(result.checks,'upright overhead retains softly bent knees',Math.min(...kneeAngles)>1&&Math.max(...kneeAngles)<45,range(kneeAngles),{flexionDegreesExclusive:[1,45]});
      const anchors=rows.map(r=>r.equipment?.anchors?.pulley),validAnchors=anchors.every(vec),anchorDrift=validAnchors?Math.max(...anchors.map(a=>dist(a,anchors[0]))):null;
      check(result.checks,'actual equipment pulley remains low and behind throughout',validAnchors&&anchors.every(a=>Math.abs(a[1]-.14)<=.002&&a[2]<-.1)&&anchorDrift<=EPS_METRES,{anchorsValid:validAnchors,firstAnchor:anchors[0],maxAnchorDriftMetres:anchorDrift},{pulleyYMetres:.14,toleranceYMetres:.002,behindZLessThan:-.1,maxDriftMetres:EPS_METRES});
      const lowSource='https://www.muscleandstrength.com/exercises/standing-low-pulley-overhead-tricep-extension.html';
      const badSourceFrames=rows.flatMap((r,i)=>r.metadata?.source===lowSource&&/low.pulley/i.test(r.metadata?.sourceScope||'')&&/upright/i.test(r.metadata?.sourceScope||'')&&vec(r.metadata?.pulley)&&vec(anchors[i])&&dist(r.metadata.pulley,anchors[i])<=EPS_METRES?[]:[i]);
      check(result.checks,'low-pulley source metadata agrees with actual equipment anchor',badSourceFrames.length===0,{badSourceFrames,source:first.metadata?.source,scope:first.metadata?.sourceScope},{source:lowSource,all49Frames:true});
    } else if(key==='bayesian-cable-curl') {
      const drift=stable(rows,[...SUPPORT,'rightElbow','pelvis','head']);
      check(result.checks,'Bayesian working right elbow and split stance fixed',drift<=EPS_METRES,drift,{maxMetres:EPS_METRES});
      const a=angleRange(rows,'right');check(result.checks,'Bayesian elbow performs curl',within(a[0],5,20)&&within(a[1],110,136)&&a[1]-a[0]>=90,a,{minimumFlexion:[5,20],maximumFlexion:[110,136],minimumExcursion:90});
      const behind=rows.map(r=>r.joints.rightElbow[2]-r.joints.rightShoulder[2]);check(result.checks,'Bayesian elbow stays behind torso in +Z-facing coordinates',Math.max(...behind)<-.02,range(behind),{maximumForwardOffsetMetres:-.02});
    } else if(key==='cross-body-lat-pull-around') {
      const drift=stable(rows,[...SUPPORT,'pelvis','head','rightElbow','rightWrist']);
      check(result.checks,'half-kneeling legs and square torso remain fixed',drift<=EPS_METRES,drift,{maxMetres:EPS_METRES});
      const across=statsRange(rows,r=>r.joints.leftWrist[0]-mid(r.joints.leftShoulder,r.joints.rightShoulder)[0]);
      check(result.checks,'far left working wrist crosses torso center toward opposite pulley',across[0]<-.10&&across[1]>.10,across,{startBelowX:-.10,finishAboveX:.10});
      const near=statsRange(rows,r=>r.joints.rightKnee[1]),far=statsRange(rows,r=>r.joints.leftKnee[1]);
      check(result.checks,'near right knee low and far knee higher in half-kneeling',near[1]<.15&&far[0]>near[1]+.15,{rightKneeY:near,leftKneeY:far},{rightKneeMaxMetres:.15,minimumKneeHeightDifferenceMetres:.15});
      const a=angleRange(rows,'left');check(result.checks,'far arm elbow changes from extended reach to bent pull',within(a[0],0,30)&&a[1]>=65&&a[1]<=120,a,{reachFlexion:[0,30],pullFlexion:[65,120]});
    } else if(key==='captains-chair-knee-raise') {
      const drift=stable(rows,['leftShoulder','rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist','leftGrip','rightGrip','pelvis','head']);
      check(result.checks,'chair upper torso, forearms and grips fixed',drift<=EPS_METRES,drift,{maxMetres:EPS_METRES});
      const footFloor=Math.min(...rows.flatMap(r=>['leftAnkle','rightAnkle','leftToes','rightToes'].map(n=>r.joints[n][1])));
      check(result.checks,'feet landmarks clear floor throughout',footFloor>.05,footFloor,{minimumMetres:.05});
      for(const side of ['left','right']) {const raised=statsRange(rows,r=>r.joints[side+'Knee'][1]),a=angleRange(rows,side,'Knee');check(result.checks,side+' knee rises substantially while flexing',raised[1]-raised[0]>.25&&a[1]>=80&&a[1]<=110,{kneeHeight:raised,kneeFlexion:a},{minimumHeightExcursionMetres:.25,topKneeFlexion:[80,110]});}
      const symmetry=Math.max(...rows.map(r=>Math.abs(r.joints.leftKnee[1]-r.joints.rightKnee[1])+Math.abs(r.joints.leftKnee[2]-r.joints.rightKnee[2])));
      check(result.checks,'both knees rise together',symmetry<.001,symmetry,{maxYPlusZDifferenceMetres:.001});
    } else if(key==='machine-hip-thrust') {
      const shoulderCenters=rows.map(r=>mid(r.joints.leftShoulder,r.joints.rightShoulder));
      const shoulderDrift=Math.max(...shoulderCenters.map(p=>dist(p,shoulderCenters[0]))),ankles=stable(rows,['leftAnkle','rightAnkle']);
      check(result.checks,'hip thrust shoulder center and planted ankles fixed',shoulderDrift<=EPS_METRES&&ankles<=EPS_METRES,{shoulderCenterDrift:shoulderDrift,ankleDrift:ankles},{maxMetres:EPS_METRES});
      const top=rows.reduce((a,b)=>mid(a.joints.leftHip,a.joints.rightHip)[1]>mid(b.joints.leftHip,b.joints.rightHip)[1]?a:b),s=mid(top.joints.leftShoulder,top.joints.rightShoulder),h=mid(top.joints.leftHip,top.joints.rightHip),k=mid(top.joints.leftKnee,top.joints.rightKnee),lineFlex=flexion(s,h,k),hipRise=h[1]-mid(rows[0].joints.leftHip,rows[0].joints.rightHip)[1];
      check(result.checks,'top shoulder–hip–knee line approaches neutral after hip rise',lineFlex<=15&&hipRise>.15,{topTime:top.t,lineFlexionDegrees:lineFlex,hipRise},{maxLineFlexionDegrees:15,minimumRiseMetres:.15});
    } else if(key==='standing-bent-knee-calf-raise') {
      const a=angleRange(rows,'left','Knee'),toes=rows.map(r=>r.joints.leftToes),anchor=[.0971,.10,.12],anchorError=Math.max(...toes.map(p=>dist(p,anchor))),heel=statsRange(rows,r=>r.joints.leftAnkle[1]);
      check(result.checks,'working calf knee remains 40 ± 0.1 degrees bent',a.every(v=>within(v,39.9,40.1)),a,[39.9,40.1]);
      check(result.checks,'working left toe stays at declared fixed ground anchor',anchorError<.002,{maximumErrorMetres:anchorError,anchor},{maximumMetres:.002});
      check(result.checks,'heel landmark lifts instead of toe lifting',heel[1]-heel[0]>.035,{ankleHeight:heel,toeAnchorError:anchorError},{minimumHeelExcursionMetres:.035});
      const freeFoot=Math.min(...rows.map(r=>Math.min(r.joints.rightAnkle[1],r.joints.rightToes[1])));check(result.checks,'free-side foot landmarks stay clear',freeFoot>.1,freeFoot,{minimumMetres:.1});
    } else if(key==='nordic-hold') {
      const lines=rows.flatMap(r=>['left','right'].map(side=>flexion(r.joints[side+'Shoulder'],r.joints[side+'Hip'],r.joints[side+'Knee'])));
      check(result.checks,'Nordic shoulder–hip–knee line stays straight',Math.max(...lines)<=10,range(lines),{maxFlexionDegrees:10});
      const lean=rows.map(r=>{const sh=mid(r.joints.leftShoulder,r.joints.rightShoulder),kn=mid(r.joints.leftKnee,r.joints.rightKnee),v=sub(sh,kn);return Math.acos(v[1]/norm(v))*180/Math.PI;});
      check(result.checks,'Nordic forward lean held within authored range',Math.min(...lean)>=25&&Math.max(...lean)<=40&&rows.every(r=>mid(r.joints.leftShoulder,r.joints.rightShoulder)[2]>mid(r.joints.leftKnee,r.joints.rightKnee)[2]),range(lean),{degrees:[25,40],direction:'+Z forward'});
    } else if(key==='dead-hang') {
      const a=['left','right'].map(side=>angleRange(rows,side));check(result.checks,'dead-hang elbows remain extended',a.every(bounds=>bounds[1]<=8),a,{maxFlexionDegrees:8});
    }
    if(WALK.has(key)||key==='stepmill-continuous-walk') {
      const conveyor=key==='stepmill-continuous-walk',expectedVelocity=conveyor?[0,-.38,-.5]:[0,0,0],velocityErrors=[],offsetErrors=[],pairs=[];
      for(const [side,offset] of [['left',0],['right',.5]]) {
        for(let i=1;i<rows.length;i++) {
          const a=rows[i-1],b=rows[i],pa=phase(a.t,offset),pb=phase(b.t,offset);
          // Exclude loading/swing boundary and wrap; never compare across another tread/ground segment.
          if(pa.round!==pb.round||pa.p<1e-7||pb.p<1e-7||pa.p>=.62-1e-7||pb.p>=.62-1e-7)continue;
          const dt=b.t-a.t;if(!(dt>0))continue;
          for(const joint of ['Ankle','Toes']) {const actual=sub(b.joints[side+joint],a.joints[side+joint]).map(v=>v/dt);velocityErrors.push({side,joint,frame:i,error:norm(sub(actual,expectedVelocity))});}
          pairs.push({side,frame:i});
        }
        if(conveyor)for(let i=0;i<rows.length;i++) {
          const r=rows[i],p=phase(r.t,offset).p;if(p<1e-7||p>=.62-1e-7)continue;
          const cfg=r.equipment?.tread;if(!cfg||![cfg.frontY,cfg.frontZ,cfg.rise,cfg.run].every(Number.isFinite)){offsetErrors.push({side,frame:i,missingTreadConfiguration:true});continue;}
          const treadTop=cfg.frontY+2*cfg.rise-2*cfg.rise*p,offsetY=r.joints[side+'Ankle'][1]-treadTop;
          const treadZ=cfg.frontZ+2*cfg.run-2*cfg.run*p,offsetZ=r.joints[side+'Ankle'][2]-treadZ;
          if(!within(offsetY,.063,.068)||!within(offsetZ,-.045,-.035)||Math.abs(cfg.rise-.19)>1e-8||Math.abs(cfg.run-.25)>1e-8)offsetErrors.push({side,frame:i,ankleAboveTread:offsetY,ankleVsTreadZ:offsetZ,rise:cfg.rise,run:cfg.run});
        }
      }
      const worst=velocityErrors.reduce((a,b)=>b.error>a.error?b:a,{error:0}),count=pairs.length;
      check(result.checks,conveyor?'stance ankles/toes follow descending tread velocity':'stance ankles/toes remain stationary in world space',count>=25&&worst.error<=.005,{checkedPairCount:count,worstError:worst,expectedVelocity},{minimumPairs:25,maxVelocityErrorMetresPerCycle:.005});
      if(conveyor)check(result.checks,'stance ankles occupy the correct descending tread level and depth',offsetErrors.length===0,offsetErrors.slice(0,12),{ankleAboveTreadMetres:[.063,.068],ankleRelativeTreadCenterZ:[-.045,-.035]});
    }
    const fps=WALK.has(key)||key==='stepmill-continuous-walk'?25:20;
    const files=[['gif',path.join(out,key+'.gif'),record.gifSha256,record.gifBytes],['poster',path.join(out,key+'-poster.png'),record.posterSha256,record.posterBytes],['motion',motionPath,record.motionSha256,undefined]];
    for(const [kind,file,expectedHash,expectedBytes] of files){const actual=sha(file),bytes=fs.statSync(file).size;check(result.checks,kind+' bytes match export proof',actual===expectedHash&&(expectedBytes===undefined||bytes===expectedBytes),{sha256:actual,bytes},{sha256:expectedHash,...(expectedBytes===undefined?{}:{bytes:expectedBytes})});}
    check(result.checks,'export frame/fps/poster metadata valid',record.frames===48&&record.fps===fps&&Number.isInteger(record.posterIndex)&&record.posterIndex>=0&&record.posterIndex<48,{frames:record.frames,fps:record.fps,posterIndex:record.posterIndex},{frames:48,fps,posterIndex:'0..47'});
  } catch(e) {result.errors.push(e.stack||String(e));}
}

// Pillow reads and composites GIF disposal into RGBA; no resize, draw, or save.
const inspector=String.raw`
import sys, json, pathlib, hashlib
from PIL import Image
out=pathlib.Path(sys.argv[1]); proof=json.loads((out/'export-proof.json').read_text()); records=[]
for row in proof['records']:
  key=row['key']; result={'key':key,'pass':False}
  try:
    with Image.open(out/(key+'.gif')) as gif:
      result.update(size=list(gif.size),frames=gif.n_frames,loop=gif.info.get('loop'),format=gif.format)
      durations=[]; poster_frame=None; decoded_hashes=[]
      for index in range(gif.n_frames):
        gif.seek(index); rgba=gif.convert('RGBA'); raw=rgba.tobytes()
        durations.append(gif.info.get('duration',0)); decoded_hashes.append(hashlib.sha256(raw).hexdigest())
        if index==row['posterIndex']: poster_frame=raw
      result.update(durationMs=sum(durations),frameDurationsMs=sorted(set(durations)),distinctDecodedFrames=len(set(decoded_hashes)))
    with Image.open(out/(key+'-poster.png')) as poster:
      poster.load(); result['posterSize']=list(poster.size); result['posterFormat']=poster.format
      result['posterExactRGBA']=poster_frame is not None and poster.convert('RGBA').tobytes()==poster_frame
    fps=25 if ('walk' in key or key=='suitcase-carry') else 20
    result['pass']=result['size']==[512,512] and result['posterSize']==[512,512] and result['frames']==48 and result['loop']==0 and result['format']=='GIF' and result['posterFormat']=='PNG' and result['durationMs']==48*1000/fps and result['frameDurationsMs']==[1000/fps] and result['posterExactRGBA']
  except Exception as e: result['error']=str(e)
  records.append(result)
print(json.dumps({'pass':len(records)==13 and all(r['pass'] for r in records),'records':records}))
`;
const decoded=spawnSync(process.env.PYTHON_PATH||(process.platform==='win32'?'python':'python3'),['-c',inspector,out],{encoding:'utf8',maxBuffer:2*1024*1024,windowsHide:true});
if(decoded.status!==0||decoded.error)report.errors.push('Pillow inspector failed: '+(decoded.error?.message||decoded.stderr||'exit '+decoded.status));
else try {report.decodedArtwork=JSON.parse(decoded.stdout);check(report.checks,'all thirteen GIFs decode with correct format/timing/loop and exact selected posters',report.decodedArtwork.pass===true,{passed:report.decodedArtwork.records.filter(r=>r.pass).length,total:report.decodedArtwork.records.length},13);}
catch(e){report.errors.push('Pillow inspector output invalid: '+e.message);}
for(const e of report.exercises)e.pass=e.errors.length===0&&e.checks.length>0&&e.checks.every(c=>c.pass);
report.pass=report.errors.length===0&&report.checks.length>0&&report.checks.every(c=>c.pass)&&report.exercises.length===13&&report.exercises.every(e=>e.pass);
report.failedChecks=[...report.checks.filter(c=>!c.pass).map(c=>({scope:'export',...c})),...report.exercises.flatMap(e=>e.checks.filter(c=>!c.pass).map(c=>({key:e.key,...c})))];
console.log(JSON.stringify(report,null,2));
process.exitCode=report.pass?0:1;
