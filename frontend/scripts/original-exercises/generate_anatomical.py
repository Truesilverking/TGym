"""Render original gray anatomical art without changing saved exercise rigs.

Input photographs/GIFs/bitmaps are never opened. Existing-style-reference.jpg is
not a render input. The copied old renderers remain byte-for-byte available.
"""
from pathlib import Path
import json, math, hashlib, argparse
from PIL import Image, ImageDraw
import anatomical_style as art
import render_custom_exercises as rig
import render_stepmill as step

SCRIPT_DIR=Path(__file__).resolve().parent
OUT=None
OLD=SCRIPT_DIR
FRAMES=36

def stepmill(t):
    for name,fn in [('line',art.gray_line),('ellipse',art.gray_ellipse),('polygon',art.gray_polygon),('tube',art.gray_tube)]:setattr(step,name,fn)
    image=step.machine_background();image.alpha_composite(step.treads(t));d=ImageDraw.Draw(image)
    bob=1.2*math.cos(4*math.pi*t);records=[]
    for near,offset,depth in [(False,.5,.30),(True,0,.70)]:
        phase=(t+offset)%1;sole,pitch,stance=step.foot(phase,depth)
        hip=(244+(0 if near else -5),247+bob+(0 if near else -3));ankle=(sole[0]-3,sole[1]-9)
        knee,angle=step.ik(hip,ankle);art.limb(d,hip,knee,ankle,True,not near,24 if near else 21);art.gray_shoe(d,sole,pitch,near)
        machine_phase=(t*2)%1;tread_index=round((sole[0]-step.BASE[0]-step.DEPTH[0]*depth)/step.RUN+machine_phase)
        expected=(step.BASE[0]+(tread_index-machine_phase)*step.RUN+step.DEPTH[0]*depth,step.BASE[1]-(tread_index-machine_phase)*step.RISE+step.DEPTH[1]*depth)
        error=math.dist(sole,expected) if stance else None
        records.append({'near':near,'stance':stance,'phase':phase,'sole':sole,'kneeAngleDegrees':angle,'treadContactErrorPx':error})
    art.torso(d,(244,247+bob),(253,175+bob),face=1)
    for near,shoulder,hand in [(False,(245,182+bob),(312,208)),(True,(258,183+bob),(327,218))]:
        elbow,_=step.ik(shoulder,hand,46,47,forward=False)
        art.limb(d,shoulder,elbow,hand,False,not near,14 if not near else 16)
        if near:
            art.gray_tube(d,(391,454),(391,220),'#74838e',10,'#293d4b',False)
            art.gray_tube(d,(391,220),(304,220),'#87959f',8,'#344c5b',False)
        art.hand(d,hand,far=not near)
    return image.convert('RGB'),records

def render(key,t):
    art.ACTIVE=key;art.HAND_AXES.clear()
    if key=='stepmill-continuous-walk':return stepmill(t)
    image,record=rig.SPECS[key][1](t)
    if key=='overhead-cable-triceps-ez-bar':
        # The same anatomical head returns to the foreground, preserving the
        # original far-arm-behind-head visibility correction without old art.
        art.draw_head(ImageDraw.Draw(image),(282,187))
    return image,record

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def save(key):
    images=[];records=[]
    for index in range(FRAMES):
        image,record=render(key,index/FRAMES);images.append(image.convert('RGB').resize((512,512),Image.Resampling.LANCZOS))
        records.append({'frame':index,'legs':record} if key=='stepmill-continuous-walk' else record)
    baseline=json.loads((OLD/(key+'-rig-checks.json')).read_text(encoding='utf8'))
    assert json.loads(json.dumps(records))==baseline,'KINEMATIC DRIFT: '+key
    indices=[0,9,18,27];palette_image=Image.new('RGB',(2048,512),'white')
    for j,index in enumerate(indices):palette_image.paste(images[index],(512*j,0))
    palette=palette_image.quantize(colors=192,method=Image.Quantize.MEDIANCUT)
    quantized=[image.quantize(palette=palette,dither=Image.Dither.NONE) for image in images]
    duration=60 if key in ['walking-flat-ground','suitcase-carry','stepmill-continuous-walk'] else 80
    gif=OUT/(key+'.gif');quantized[0].save(gif,save_all=True,append_images=quantized[1:],loop=0,duration=duration,optimize=False,disposal=1)
    diagnostic=0 if records[0].get('isometric') or key in ['cross-body-lat-pull-around','stepmill-continuous-walk'] else (18 if key in ['captains-chair-knee-raise','standing-bent-knee-calf-raise','machine-hip-thrust','overhead-cable-triceps-ez-bar'] else 9)
    poster=OUT/(key+'-poster.png');images[diagnostic].save(poster)
    title='Continuous stair-machine walk' if key=='stepmill-continuous-walk' else rig.SPECS[key][0]
    sheet=Image.new('RGB',(2048,574),'white');draw=ImageDraw.Draw(sheet);draw.text((14,8),title,fill='#222222',font=rig.font(25,True))
    for j,index in enumerate(indices):
        sheet.paste(images[index],(512*j,38));draw.text((512*j+14,548),f'Frame {index+1:02d}/36   {index*duration/1000:.2f}s',fill='#333333',font=rig.font(18))
    sheet.save(OUT/(key+'-contact-sheet.png'))
    with Image.open(gif) as check:
        decoded=check.n_frames;assert check.size==(512,512) and check.info.get('loop')==0
        decoded_duration=0
        for j in range(decoded):check.seek(j);decoded_duration+=check.info.get('duration',0)
    assert decoded_duration==36*duration
    assert decoded==36,f'Expected36 decoded frames for {key}, got{decoded}'
    (OUT/(key+'-rig-checks.json')).write_text(json.dumps(records,indent=2)+'\n',encoding='utf8')
    old_provenance=json.loads((OLD/(key+'-provenance.json')).read_text(encoding='utf8'))
    provenance={**old_provenance,'original':True,'externalMediaInputs':False,'containsPrivateProfileData':False,'productionAssigned':False,'renderer':'anatomical_style.py + generate_anatomical.py; original grayscale anatomy, targeted red muscle regions,3x antialiasing','style':'Original gray/black anatomical silhouette, volume shading, red target muscles; white background','asset':gif.name,'dimensions':[512,512],'frames':decoded,'authoredFrames':36,'durationMs':decoded_duration,'frameDurationMs':duration,'loop':True,'gifBytes':gif.stat().st_size,'gifSha256':sha(gif),'posterBytes':poster.stat().st_size,'posterSha256':sha(poster),'kinematicRecordsDeepEqual':True,'baselineRigSha256':sha(OLD/(key+'-rig-checks.json')),'rigSha256':sha(OUT/(key+'-rig-checks.json')),'referenceBitmapUsedAsInput':False,'reviewStatus':'Approved by root and independent visual reviewer on all13 contact sheets/loops before integration; mathematical and visual validation only','physicalExerciseValidation':False}
    (OUT/(key+'-provenance.json')).write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'asset':key,'frames':decoded,'gifBytes':gif.stat().st_size,'rigDeepEqual':True}),flush=True)
    return images[diagnostic],provenance

def main():
    global OUT
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',required=True,type=Path,help='Output directory; keep generated artifacts separate from these source files')
    parser.add_argument('keys',nargs='*',metavar='EXERCISE_KEY',help='Optional exercise keys; default is all13')
    args=parser.parse_args();OUT=args.out.resolve()
    unknown=set(args.keys)-set([*rig.SPECS,'stepmill-continuous-walk'])
    if unknown:parser.error('Unknown exercise keys: '+', '.join(sorted(unknown)))
    if OUT==SCRIPT_DIR:parser.error('--out must differ from the renderer source directory')
    OUT.mkdir(parents=True,exist_ok=True)
    keys=args.keys or [*rig.SPECS,'stepmill-continuous-walk'];done=[]
    for key in keys:done.append((key,*save(key)))
    if len(done)==13:
        all_sheet=Image.new('RGB',(2048,2048),'white');prod_sheet=Image.new('RGB',(2048,1536),'white')
        for index,(key,image,meta) in enumerate(done):
            x,y=index%4*512,index//4*512;tile=Image.new('RGB',(512,512),'white');tile.paste(image.resize((470,470),Image.Resampling.LANCZOS),(21,0));ImageDraw.Draw(tile).text((12,478),meta.get('movement',key),fill='#222222',font=rig.font(18,True));all_sheet.paste(tile,(x,y))
            if index<12:prod_sheet.paste(tile,(x,y))
        all_sheet.save(OUT/'all13-anatomical-overview.png');prod_sheet.save(OUT/'production-originals-overview.png')
        manifest={'original':True,'externalMediaInputs':False,'containsPrivateProfileData':False,'productionAssigned':False,'assetCount':13,'totalGifBytes':sum(m['gifBytes'] for _,_,m in done),'totalPosterBytes':sum(m['posterBytes'] for _,_,m in done),'allKinematicRecordsDeepEqual':True,'assets':[m for _,_,m in done]}
        (OUT/'original-media-v6-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8');print(json.dumps({'complete':True,'totalGifBytes':manifest['totalGifBytes'],'totalPosterBytes':manifest['totalPosterBytes']}),flush=True)

if __name__=='__main__':main()
