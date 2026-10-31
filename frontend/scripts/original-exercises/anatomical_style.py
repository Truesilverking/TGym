"""Original anatomical drawing material over the unchanged TGym exercise rigs.

No input image is loaded, traced, recolored or transformed. The catalog reference
is a visual style reference only. All silhouette, muscle and shading geometry is
authored here. The render entrypoint is generate_anatomical.py.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageColor
import render_custom_exercises as rig

S = rig.SCALE
ACTIVE = ''
HAND_AXES = {}
RAW = {name: getattr(rig, name) for name in ['line', 'ellipse', 'polygon', 'tube', 'shoe']}

def xy(point): return tuple(round(v*S) for v in point)
def add(a,b): return a[0]+b[0], a[1]+b[1]
def sub(a,b): return a[0]-b[0], a[1]-b[1]
def mul(a,s): return a[0]*s,a[1]*s
def mix(a,b,t): return add(a,mul(sub(b,a),t))
def unit(v):
    n=math.hypot(*v)
    return v[0]/n,v[1]/n
def neutral(color):
    if color is None: return None
    if isinstance(color,int): return color
    rgba=ImageColor.getrgb(color) if isinstance(color,str) else color
    rgb=rgba[:3]
    g=round(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])
    return (g,g,g,rgba[3]) if len(rgba)==4 else (g,g,g)
def gray_line(d,pts,color,width=1):
    if ACTIVE=='overhead-cable-triceps-ez-bar' and pts==[(293,135),(296,135)]:return
    RAW['line'](d,pts,neutral(color),width)
def gray_polygon(d,pts,fill,outline=None,width=1):
    if ACTIVE=='overhead-cable-triceps-ez-bar' and pts==[(299,137),(306,142),(299,146)]:return
    if ACTIVE=='standing-bent-knee-calf-raise' and fill=='#cad5dc':
        toe,heel=pts[-2:];axis=unit(sub(toe,heel));normal=(-axis[1],axis[0]);curved=smooth_closed(pts)
        # Round the shoe while keeping every point above its unchanged sole plane.
        curved=[sub(p,mul(normal,max(0,(p[0]-toe[0])*normal[0]+(p[1]-toe[1])*normal[1]))) for p in curved]
        shaded(d,curved,mix(heel,toe,.5),add(mix(heel,toe,.5),mul(normal,-12)),24,curved=False)
        return
    RAW['polygon'](d,pts,neutral(fill),neutral(outline),width)
def image_of(d): return d._image

def smooth_closed(points,steps=7):
    result=[];count=len(points)
    for index in range(count):
        p0=np.array(points[(index-1)%count]);p1=np.array(points[index]);p2=np.array(points[(index+1)%count]);p3=np.array(points[(index+2)%count])
        for t in np.linspace(0,1,steps,endpoint=False):
            point=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
            result.append((float(point[0]),float(point[1])))
    return result

def shaded(d, points, a, b, radius, red=False, far=False, outline=.7,curved=True):
    """A local grayscale/red material lit across its own muscle/body axis."""
    if curved:points=smooth_closed(points,4 if len(points)>45 else 8)
    xs,ys=zip(*points)
    box=(max(0,int(min(xs)*S)-4),max(0,int(min(ys)*S)-4),min(rig.SIZE*S,int(max(xs)*S)+5),min(rig.SIZE*S,int(max(ys)*S)+5))
    if box[2]<=box[0] or box[3]<=box[1]: return
    mask=Image.new('L',(box[2]-box[0],box[3]-box[1]))
    md=ImageDraw.Draw(mask);local=[(p[0]*S-box[0],p[1]*S-box[1]) for p in points];md.polygon(local,fill=255)
    yy,xx=np.mgrid[box[1]:box[3],box[0]:box[2]];xx=xx/S;yy=yy/S
    axis=unit(sub(b,a));n=(-axis[1],axis[0]);q=((xx-a[0])*n[0]+(yy-a[1])*n[1])/max(1,radius)
    dome=np.sqrt(np.maximum(0,1-np.minimum(1,np.abs(q))**2));light=np.clip(.30+.70*dome-.12*q,0,1)
    if red:
        dark=np.array([104,13,15]);bright=np.array([232,57,49])
        data=dark[None,None,:]+light[:,:,None]*(bright-dark)[None,None,:]
    else:
        value=np.clip(66+170*light-(22 if far else 0),0,255)
        data=np.stack([value,value,value],axis=-1)
    patch=Image.fromarray(np.uint8(np.clip(data,0,255)))
    image_of(d).paste(patch,box,mask)
    d.line([xy(p) for p in points+[points[0]]],fill=(51,51,51) if not red else (102,21,21),width=max(1,round(outline*S)),joint='curve')

def section(d,a,b,width,kind,far=False):
    axis=unit(sub(b,a));normal=(-axis[1],axis[0]);length=math.dist(a,b)
    def radius(t):
        if kind=='upper-arm': return width*(.28+.35*math.exp(-((t-.22)/.33)**2))
        if kind=='forearm': return width*(.18+.28*math.exp(-((t-.28)/.34)**2))
        if kind=='thigh': return width*(.30+.34*math.exp(-((t-.24)/.40)**2))
        return width*(.16+.34*math.exp(-((t-.30)/.32)**2))
    points=[]
    # Rounded anatomical caps are part of each silhouette, not joint discs.
    for sign,ts in [(1,np.linspace(0,1,30)),(-1,np.linspace(1,0,30))]:
        for t in ts:
            r=radius(float(t));center=mix(a,b,float(t));points.append(add(center,mul(normal,sign*r)))
        origin=b if sign==1 else a;cap_radius=radius(1 if sign==1 else 0)
        for angle in np.linspace(0,math.pi,12)[1:-1]:
            normal_part=sign*math.cos(float(angle));axis_part=sign*math.sin(float(angle))
            points.append(add(origin,add(mul(normal,normal_part*cap_radius),mul(axis,axis_part*cap_radius))))
    shaded(d,points,a,b,max(radius(t) for t in np.linspace(0,1,20)),far=far)
    # Subtle fascia borders follow the muscle belly and taper into the tendon.
    for sign in [-1,1]:
        curve=[add(mix(a,b,float(t)),mul(normal,sign*radius(float(t))*.64)) for t in np.linspace(.12,.83,18)]
        gray_line(d,curve,'#777777' if far else '#6c6c6c',.48)
    return axis,normal

def muscle(d,a,b,width,start=.18,end=.82,offset=0,far=False):
    axis=unit(sub(b,a));normal=(-axis[1],axis[0]);p=mix(a,b,start);q=mix(a,b,end)
    points=[]
    for sign,ts in [(1,np.linspace(0,1,28)),(-1,np.linspace(1,0,28))]:
        for t in ts:
            belly=width*(.14+.86*math.sin(math.pi*float(t))**.72)
            points.append(add(mix(p,q,float(t)),mul(normal,offset+sign*belly)))
    shaded(d,points,add(p,mul(normal,offset)),add(q,mul(normal,offset)),width,True,far,.6)
    for sign in [-1,1]:
        pts=[add(mix(p,q,float(t)),mul(normal,offset+sign*width*.42*math.sin(math.pi*float(t)))) for t in np.linspace(.13,.88,16)]
        RAW['line'](d,pts,'#a42d2d',.45)

def limb(d,a,j,b,active=False,far=False,width=20):
    leg=width>=22 or ACTIVE=='stepmill-continuous-walk' and width>=20
    section(d,a,j,width,'thigh' if leg else 'upper-arm',far)
    section(d,j,b,width*.94 if leg else width,'calf' if leg else 'forearm',far)
    axis=unit(sub(b,j));normal=(-axis[1],axis[0])
    # A short skin fold instead of a visible ball-and-socket joint circle.
    gray_line(d,[add(j,mul(normal,-width*.25)),add(add(j,mul(axis,2)),mul(normal,width*.22))],'#606060',.65)
    if active and ACTIVE=='bayesian-cable-curl' and not leg:
        muscle(d,a,j,width*.32,.23,.84,offset=width*.10,far=far)
    if active and ACTIVE=='standing-bent-knee-calf-raise' and leg:
        # Bent-knee plantarflexion: soleus belly at the sides of the lower calf;
        # knee, quadriceps and Achilles tendon remain gray.
        muscle(d,j,b,width*.26,.24,.82,offset=width*.08,far=far)
    if active and ACTIVE=='spanish-squat-hold' and leg:
        muscle(d,a,j,width*.34,.13,.87,offset=width*.10,far=far)
    if active and ACTIVE=='nordic-hold' and leg:
        muscle(d,a,j,width*.32,.14,.86,offset=width*.12,far=far)
    if active and ACTIVE in ['walking-flat-ground','stepmill-continuous-walk'] and leg:
        muscle(d,a,j,width*.27,.20,.83,offset=-width*.06,far=far)
        muscle(d,j,b,width*.25,.18,.76,offset=width*.05,far=far)
    if active and ACTIVE in ['plate-pinch-hold','dead-hang','suitcase-carry'] and not leg:
        muscle(d,j,b,width*.25,.18,.83,offset=width*.08,far=far)
    if active and ACTIVE=='overhead-cable-triceps-ez-bar' and not leg:
        muscle(d,a,j,width*.30,.20,.82,offset=-width*.13,far=far)
    HAND_AXES[(round(b[0],2),round(b[1],2))]=axis

def torso(d,hip,shoulder,breath=0,active=None,front=False,face=1):
    axis=unit(sub(shoulder,hip));normal=(-axis[1],axis[0]);length=math.dist(hip,shoulder)
    def p(x,y): return add(add(hip,mul(normal,x)),mul(axis,y))
    # Pelvis, waist, rib cage, shoulders and trapezius form one continuous form.
    ratio=length/107
    right=[(17,-14*ratio),(22,-5*ratio),(21,12*ratio),(16,34*ratio),(18,61*ratio),(26+breath,85*ratio),(27,length-4),(19,length+8),(8,length+16)]
    left=[(-8,length+16),(-19,length+8),(-27,length-4),(-24-breath,85*ratio),(-18,61*ratio),(-16,34*ratio),(-22,12*ratio),(-23,-2*ratio),(-15,-14*ratio)]
    points=[p(x,y) for x,y in right+left]
    shaded(d,points,hip,shoulder,28+breath,far=False,outline=.85)
    # The pectoral masses round away from the sternum into the shoulder girdle.
    for sign in [-1,1]:
        pec=[p(sign*x,length-y) for x,y in [(3,10),(13,5),(24,12),(23,26),(13,32),(3,26)]]
        shaded(d,pec,p(sign*13,length-31),p(sign*13,length-7),14,outline=.35)
    # Readable anatomical planes, no armor plate or shorts block.
    chest=length-23
    for sign in [-1,1]:
        gray_line(d,[p(sign*5,length+5),p(sign*15,length-4),p(sign*23,length-6)],'#6d6d6d',.65)
        gray_line(d,[p(sign*22,chest+8),p(sign*17,chest-1),p(sign*6,chest-5)],'#747474',.6)
        gray_line(d,[p(sign*19,62),p(sign*13,39),p(sign*14,21)],'#7c7c7c',.55)
        gray_line(d,[p(sign*18,8),p(sign*8,19),p(sign*3,10)],'#727272',.65)
    gray_line(d,[p(0,19),p(0,length-15)],'#909090',.45)
    for y in [39,52,65]:gray_line(d,[p(-7,y+1),p(0,y-1),p(7,y+1)],'#929292',.4)
    if active in ['lats','lats-both']:
        for sign in ([1,-1] if active=='lats-both' else [1]):
            patch=[p(sign*x,y) for x,y in [(12,17),(8,25),(16,length-31),(24,length-15),(26,length-35),(19,52)]]
            shaded(d,patch,p(sign*16,20),p(sign*18,length-20),12,True,outline=.6)
    if ACTIVE=='captains-chair-knee-raise' and active=='core':
        patch=[p(x,y) for x,y in [(-10,19),(-13,length-34),(-7,length-28),(8,length-28),(13,length-34),(10,19),(0,13)]]
        shaded(d,patch,p(0,15),p(0,length-28),14,True,outline=.6)
        for y in [35,48,61]:RAW['line'](d,[p(-10,y),p(0,y-1),p(10,y)],'#9c3030',.6)
        RAW['line'](d,[p(0,17),p(0,length-30)],'#992b2b',.6)
    if ACTIVE=='suitcase-carry' and active=='core':
        patch=[p(x,y) for x,y in [(14,16),(20,25),(22,58),(14,72),(10,51),(10,27)]]
        shaded(d,patch,p(15,17),p(15,67),11,True,outline=.6)
    return draw_head(d,shoulder,axis,front,face)

def draw_head(d,shoulder,axis=(0,-1),front=False,face=1):
    normal=(-axis[1],axis[0])
    def p(x,y):return add(add(shoulder,mul(normal,x)),mul(axis,y))
    neck0=p(0,5);neck1=p(0,24)
    section(d,neck0,neck1,11,'forearm')
    hc=p(0,43)
    def h(x,y):return add(add(hc,mul(normal,x)),mul(axis,y))
    if front:
        head=[h(x,y) for x,y in [(-11,-13),(-14,-3),(-13,14),(-8,21),(6,22),(12,16),(13,1),(10,-13),(4,-19),(-5,-19)]]
    else:
        head=[h(x*face,y) for x,y in [(-10,-15),(-14,-3),(-13,14),(-7,22),(5,23),(12,17),(12,8),(18,2),(12,0),(13,-6),(8,-15),(2,-19)]]
    shaded(d,head,h(-1,-18),h(-1,23),15,outline=.75)
    if not front:
        gray_line(d,[h(6*face,10),h(11*face,9)],'#484848',.75)
        gray_line(d,[h(11*face,-5),h(7*face,-5)],'#727272',.5)
        gray_line(d,[h(-4*face,4),h(-7*face,7),h(-9*face,2),h(-5*face,-3)],'#777777',.55)
        gray_line(d,[h(-4*face,-18),p(7*face,6)],'#777777',.55)
    return hc

def hand(d,p,active=False,far=False):
    axis=HAND_AXES.get((round(p[0],2),round(p[1],2)),(0,1));normal=(-axis[1],axis[0])
    def h(x,y):return add(add(p,mul(normal,x)),mul(axis,y))
    pts=[h(x,y) for x,y in [(-4,-4),(-5,1),(-4,7),(-1,9),(4,7),(5,1),(3,-5)]]
    shaded(d,pts,h(0,-4),h(0,9),6,far=far,outline=.6)
    for y in [2,4.5,6.5]:gray_line(d,[h(-3,y),h(2,y+1)],'#777777',.45)
    gray_line(d,[h(3,-1),h(0,3),h(-3,2)],'#666666',.5)

def gray_ellipse(d,box,fill,outline=None,width=1):
    if ACTIVE=='overhead-cable-triceps-ez-bar' and tuple(box) in [(264,118,300,166),(274,139,280,148)]:return
    if ACTIVE=='machine-hip-thrust' and fill==rig.RED:
        cx=(box[0]+box[2])/2;cy=(box[1]+box[3])/2+10;rx=(box[2]-box[0])*.40;ry=(box[3]-box[1])*.34
        points=[(cx+rx*x,cy+ry*y) for x,y in [(-.9,-.15),(-.7,-.7),(-.2,-1),(.55,-.75),(.95,-.15),(.68,.65),(.1,1),(-.65,.75),(-1,.25)]]
        shaded(d,points,(cx,cy-ry),(cx,cy+ry),rx,True,False,.8)
        RAW['line'](d,[(cx-rx*.65,cy-ry*.3),(cx-rx*.2,cy),(cx+rx*.4,cy+ry*.45)],'#a72929',.7)
        return
    RAW['ellipse'](d,box,neutral(fill),neutral(outline),width)

def gray_tube(d,a,b,color,width,rim='#394856',shine=True):
    if ACTIVE=='overhead-cable-triceps-ez-bar' and a==(282,181) and b==(282,166):return
    RAW['tube'](d,a,b,neutral(color),width,neutral(rim),False)
    if width>5:gray_line(d,[add(a,(-1,-1)),add(b,(-1,-1))],'#d8d8d8',max(.5,width*.13))

def gray_shoe(d,sole,pitch,near=True):
    angle=math.radians(pitch)
    def p(x,y):return (sole[0]+x*math.cos(angle)-y*math.sin(angle),sole[1]+x*math.sin(angle)+y*math.cos(angle))
    shoe_points=[(-16,0),(-15,-8),(-7,-10),(5,-7),(17,-5),(19,-2),(18,0)] if ACTIVE=='stepmill-continuous-walk' else [(-23,0),(-23,-11),(-17,-16),(-9,-12),(1,-6),(17,-4),(22,0)]
    local=smooth_closed(shoe_points)
    pts=[p(x,min(0,y)) for x,y in local]
    shaded(d,pts,p(-8,-15),p(-8,0),24,far=not near,outline=.8,curved=False)
    gray_line(d,[p(-16 if ACTIVE=='stepmill-continuous-walk' else -23,0),p(18 if ACTIVE=='stepmill-continuous-walk' else 22,0)],'#333333',1)
    for x in [-6,-2,2]:gray_line(d,[p(x,-9),p(x+4,-5)],'#777777',.5)

rig.limb=limb;rig.torso=torso;rig.hand=hand;rig.line=gray_line;rig.polygon=gray_polygon;rig.ellipse=gray_ellipse;rig.tube=gray_tube;rig.shoe=gray_shoe
