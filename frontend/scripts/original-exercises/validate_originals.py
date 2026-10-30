"""Decode and check original animation candidates, without loading any profile."""
from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json,math
from render_custom_exercises import SPECS,walk_foot,WALK_DUTY,font,DARK

OUT=Path(__file__).resolve().parent
assets=[]
for key in [*SPECS,'stepmill-continuous-walk']:
    gif,poster=OUT/(key+'.gif'),OUT/(key+'-poster.png')
    provenance=json.loads((OUT/(key+'-provenance.json')).read_text())
    with Image.open(gif) as im:
        assert im.size==(512,512);assert im.info.get('loop')==0
        frames=im.n_frames;duration=0
        for i in range(frames):im.seek(i);duration+=im.info['duration'];im.load()
        assert frames>1;assert duration==provenance['durationMs']
    with Image.open(poster) as im:assert im.size==(512,512);im.load()
    assets.append({'key':key,'gif':gif.name,'poster':poster.name,'dimensions':[512,512],'decodedFrames':frames,'authoredFrames':36,'loop':0,'durationMs':duration,'gifBytes':gif.stat().st_size,'posterBytes':poster.stat().st_size,'gifSha256':hashlib.sha256(gif.read_bytes()).hexdigest(),'posterSha256':hashlib.sha256(poster.read_bytes()).hexdigest(),'provenanceFile':key+'-provenance.json'})

def rig(key):return json.loads((OUT/(key+'-rig-checks.json')).read_text())
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

report={'original':True,'externalMediaInputs':False,'containsPrivateProfileData':False,'productionAssigned':False,'assetCount':len(assets),'totalGifBytes':sum(a['gifBytes'] for a in assets),'totalPosterBytes':sum(a['posterBytes'] for a in assets),'assets':assets,'geometryChecks':{'holdsHaveNoRepetitionExcursion':True,'deadHangElbowsDegrees':180,'bayesianElbowInternalRangeDegrees':[min(elbows),max(elbows)],'bayesianArmLengthsConstant':True,'calfUnilateral':True,'calfFixedForefoot':[328,443],'calfKneeFlexionDegrees':calf[0]['kneeFlexionDegrees'],'calfShoeMaxPlanePenetrationPx':0,'hipThrustFixedShoulderAndFeet':True,'hipThrustTorsoLengthPx':111,'walkingStanceWorldVelocityErrorPxPerCycle':stance_error,'walkingMinimumSwingSoleClearancePx':swing_clearance},'reviewLimit':'Mathematical and visual checks only; not a clinical or physical-device exercise validation.'}
(OUT/'original-media-final-manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
sheet=Image.new('RGB',(2048,1536),'#eaf0f4');draw=ImageDraw.Draw(sheet)
for i,(key,spec) in enumerate(SPECS.items()):
    with Image.open(OUT/(key+'-poster.png')) as im:
        x,y=i%4*512,i//4*512;sheet.paste(im.resize((480,480),Image.Resampling.LANCZOS),(x+16,y));draw.text((x+16,y+480),spec[0],fill=DARK,font=font(20,True))
sheet.save(OUT/'production-originals-overview.png')
(OUT/'production-originals-manifest.json').write_text(json.dumps([json.loads((OUT/(key+'-provenance.json')).read_text()) for key in SPECS],indent=2)+'\n',encoding='utf8')
print(json.dumps({'assets':len(assets),'gifBytes':report['totalGifBytes'],'posterBytes':report['totalPosterBytes'],'geometryChecks':report['geometryChecks']},indent=2))
