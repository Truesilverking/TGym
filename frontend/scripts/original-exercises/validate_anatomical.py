"""Decode and check original animation candidates, without loading any profile."""
from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json,math,argparse
from render_custom_exercises import SPECS,walk_foot,WALK_DUTY,font,DARK

SCRIPT_DIR=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out',required=True,type=Path,help='Directory produced by generate_anatomical.py')
args=parser.parse_args();OUT=args.out.resolve();OLD=SCRIPT_DIR
# Git checkouts can differ only in source line endings; asset hashes stay raw.
BASELINE_RENDERER_SHA256={"render_custom_exercises.py":"97ce18f09b0dfdae67e42d8b2121158011697094496d77a1b48b668e18698c38","render_stepmill.py":"e094ca7164a81c378d7de92508914412d2a4fe8b07f5fada15bec9ff2296a93a"}
if OUT==SCRIPT_DIR:parser.error('--out must differ from the renderer source directory')
assets=[]
for key in [*SPECS,'stepmill-continuous-walk']:
    gif,poster=OUT/(key+'.gif'),OUT/(key+'-poster.png')
    provenance=json.loads((OUT/(key+'-provenance.json')).read_text())
    with Image.open(gif) as im:
        assert im.size==(512,512);assert im.info.get('loop')==0
        frames=im.n_frames;duration=0
        for i in range(frames):im.seek(i);duration+=im.info['duration'];im.load()
        assert frames==36;assert duration==provenance['durationMs']
    with Image.open(poster) as im:assert im.size==(512,512);im.load()
    assets.append({'key':key,'gif':gif.name,'poster':poster.name,'dimensions':[512,512],'decodedFrames':frames,'authoredFrames':36,'loop':0,'durationMs':duration,'gifBytes':gif.stat().st_size,'posterBytes':poster.stat().st_size,'gifSha256':hashlib.sha256(gif.read_bytes()).hexdigest(),'posterSha256':hashlib.sha256(poster.read_bytes()).hexdigest(),'provenanceFile':key+'-provenance.json'})

def rig(key):return json.loads((OUT/(key+'-rig-checks.json')).read_text())
for key in [*SPECS,'stepmill-continuous-walk']:
    assert rig(key)==json.loads((OLD/(key+'-rig-checks.json')).read_text()), 'Kinematic drift: '+key
for filename in ['render_custom_exercises.py','render_stepmill.py']:
    assert hashlib.sha256((SCRIPT_DIR/filename).read_bytes().replace(b'\r\n',b'\n')).hexdigest()==BASELINE_RENDERER_SHA256[filename], 'Baseline source changed: '+filename
hold_keys=['plate-pinch-hold','spanish-squat-hold','nordic-hold','dead-hang']
for key in hold_keys:assert all(row.get('isometric') for row in rig(key))
assert all(row['elbowInternalAngleDegrees']==180 for row in rig('dead-hang'))
bayesian=rig('bayesian-cable-curl');elbows=[r['elbowInternalAngleDegrees'] for r in bayesian]
assert min(elbows)>20;assert max(elbows)<180
for field in ['upperArmLengthPx','forearmLengthPx']:assert max(r[field] for r in bayesian)-min(r[field] for r in bayesian)<1e-8
calf=rig('standing-bent-knee-calf-raise');assert all(r['unilateral'] and r['kneesRemainBent'] for r in calf)
assert all(r['forefootFixed']==[328,443] for r in calf)
assert max(r['kneeFlexionDegrees'] for r in calf)-min(r['kneeFlexionDegrees'] for r in calf)<1e-8
hip=rig('machine-hip-thrust');assert all(r['feetFixed']==hip[0]['feetFixed'] and r['shoulderFixed']==hip[0]['shoulderFixed'] for r in hip)
assert max(r['torsoLengthPx'] for r in hip)-min(r['torsoLengthPx'] for r in hip)<1e-8

# Dense flat-walking sole checks. A tracking camera moves at +124 px/cycle;
# stance soles translate at -124, so their world position is stationary.
stance_error=0;swing_clearance=100
for i in range(1,10000):
    phase=i/10000
    sole,stance,pitch=walk_foot(phase,0)
    if stance and 1e-4<phase<WALK_DUTY-1e-4:
        before=walk_foot(phase-1e-5,0)[0];after=walk_foot(phase+1e-5,0)[0]
        stance_error=max(stance_error,abs((after[0]-before[0])/2e-5+124),abs(after[1]-before[1]))
    elif not stance:
        angle=math.radians(pitch)
        for x in [-16,-8,0,10,18]:swing_clearance=min(swing_clearance,436-(sole[1]+x*math.sin(angle)))
assert stance_error<1e-6;assert swing_clearance>=-1e-8

report={'original':True,'externalMediaInputs':False,'containsPrivateProfileData':False,'productionAssigned':False,'assetCount':len(assets),'totalGifBytes':sum(a['gifBytes'] for a in assets),'totalPosterBytes':sum(a['posterBytes'] for a in assets),'assets':assets,'allKinematicRecordsDeepEqual':True,'baselineRendererSourceIdenticalCanonicalLF':True,'baselineSourceNormalization':'CRLF-to-LF for historical Python source guard only; GIF/PNG hashes are raw bytes','style':'original grayscale anatomy with targeted red muscles','rendererFilesSha256':{name:hashlib.sha256((SCRIPT_DIR/name).read_bytes()).hexdigest() for name in ['anatomical_style.py','generate_anatomical.py','validate_anatomical.py','render_custom_exercises.py','render_stepmill.py','requirements-render.txt']},'geometryChecks':{'holdsHaveNoRepetitionExcursion':True,'deadHangElbowsDegrees':180,'bayesianElbowInternalRangeDegrees':[min(elbows),max(elbows)],'bayesianArmLengthsConstant':True,'calfUnilateral':True,'calfFixedForefoot':[328,443],'calfKneeFlexionDegrees':calf[0]['kneeFlexionDegrees'],'calfShoeMaxPlanePenetrationPx':0,'hipThrustFixedShoulderAndFeet':True,'hipThrustTorsoLengthPx':111,'walkingStanceWorldVelocityErrorPxPerCycle':stance_error,'walkingMinimumSwingSoleClearancePx':swing_clearance},'reviewLimit':'Mathematical and visual checks only; not a clinical or physical-device exercise validation.'}
(OUT/'original-media-final-manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
sheet=Image.new('RGB',(2048,1536),'white');draw=ImageDraw.Draw(sheet)
for i,(key,spec) in enumerate(SPECS.items()):
    with Image.open(OUT/(key+'-poster.png')) as im:
        x,y=i%4*512,i//4*512;sheet.paste(im.resize((480,480),Image.Resampling.LANCZOS),(x+16,y));draw.text((x+16,y+480),spec[0],fill='#222222',font=font(20,True))
sheet.save(OUT/'production-originals-overview.png')
(OUT/'production-originals-manifest.json').write_text(json.dumps([json.loads((OUT/(key+'-provenance.json')).read_text()) for key in SPECS],indent=2)+'\n',encoding='utf8')
print(json.dumps({'assets':len(assets),'gifBytes':report['totalGifBytes'],'posterBytes':report['totalPosterBytes'],'geometryChecks':report['geometryChecks']},indent=2))

all_sheet=Image.new('RGB',(2048,2048),'white');ad=ImageDraw.Draw(all_sheet)
for i,key in enumerate([*SPECS,'stepmill-continuous-walk']):
    with Image.open(OUT/(key+'-poster.png')) as image:
        x,y=i%4*512,i//4*512;all_sheet.paste(image.resize((480,480),Image.Resampling.LANCZOS),(x+16,y));title=SPECS[key][0] if key in SPECS else 'Continuous stair-machine walk';ad.text((x+16,y+480),title,fill='#222222',font=font(18,True))
all_sheet.save(OUT/'all13-anatomical-overview.png')
html='<meta name="viewport" content="width=device-width"><title>Original anatomy animation review</title><style>body{margin:0;background:white;font:16px system-ui;color:#222}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;padding:16px}figure{margin:0}img{width:100%;height:auto;max-width:512px}figcaption{padding:8px}a{color:#222}</style><main>'
for key in [*SPECS,'stepmill-continuous-walk']:
    title=SPECS[key][0] if key in SPECS else 'Continuous stair-machine walk'
    html+=f'<figure><img src="{key}.gif" width="512" height="512" data-key="{key}" alt="Original {title} animation"><figcaption>{title} ? <a href="{key}-contact-sheet.png">four poses</a> ? <a href="{key}-poster.png">poster</a></figcaption></figure>'
html+='</main>';(OUT/'loop-review.html').write_text(html,encoding='utf8')
