"""Original exercise illustrations. No photographs, third-party GIFs or traced art.

Each joint path and all equipment are authored here with Pillow primitives.
Isometric examples retain their joint configuration; only a small chest expansion
and highlight cycle indicate breathing. Candidates require human visual review.
"""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from render_stepmill import line, ellipse, polygon, tube, ik, shoe, SCALE, SIZE

OUT = Path(__file__).resolve().parent
FRAMES = 36
GRAY, SHADE, DARK = '#c4cfd6', '#879aa8', '#354958'
RED, RED_DARK, RED_LIGHT = '#dd5a51', '#a9403e', '#f09789'

def add(a,b): return a[0]+b[0],a[1]+b[1]
def mul(a,s): return a[0]*s,a[1]*s
def sub(a,b): return a[0]-b[0],a[1]-b[1]
def unit(a):
    n=math.hypot(*a)
    return a[0]/n,a[1]/n
def polar(o,length,angle):
    a=math.radians(angle)
    return o[0]+length*math.cos(a),o[1]+length*math.sin(a)
def mix(a,b,u): return (a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u)
def cycle(t): return (1-math.cos(2*math.pi*t))/2
def joint_angle(a,j,b):
    va,vb=sub(a,j),sub(b,j)
    return math.degrees(math.acos(max(-1,min(1,(va[0]*vb[0]+va[1]*vb[1])/(math.hypot(*va)*math.hypot(*vb))))))

def scene(ground=446):
    image=Image.new('RGB',(SIZE*SCALE,SIZE*SCALE),'white')
    d=ImageDraw.Draw(image)
    ellipse(d,(105,ground-7,420,ground+12),'#edf1f3')
    line(d,[(75,ground+1),(445,ground+1)],'#d7e0e5',1)
    return image,d

def limb(d,a,j,b,active=False,far=False,width=20):
    color=RED if active else GRAY
    rim=RED_DARK if active else SHADE
    if far:
        color='#b64b46' if active else '#9fadb8'
        rim='#8d3c3c' if active else '#738a99'
    tube(d,a,j,color,width,rim,False)
    tube(d,j,b,color,width*.73,rim,False)
    ellipse(d,(j[0]-width*.38,j[1]-width*.38,j[0]+width*.38,j[1]+width*.38),color,rim,1)
    if active and not far:
        line(d,[add(a,(3,0)),add(j,(2,-2))],RED_LIGHT,2.5)

def torso(d,hip,shoulder,breath=0,active=None,front=False,face=1):
    axis=unit(sub(shoulder,hip));side=(-axis[1],axis[0])
    waist=19 if not front else 23
    chest=(25 if not front else 30)+breath
    p=[add(hip,mul(side,-waist)),add(shoulder,mul(side,-chest)),add(shoulder,mul(axis,8)),add(shoulder,mul(side,chest)),add(hip,mul(side,waist))]
    polygon(d,p,GRAY,SHADE,1.5)
    polygon(d,[add(hip,mul(side,8)),add(shoulder,mul(side,11)),add(shoulder,mul(side,chest)),add(hip,mul(side,waist))],'#a3b3be')
    if active in ['core','lats','lats-both']:
        if active=='core':
            low=add(hip,mul(axis,12));high=add(shoulder,mul(axis,-26))
            polygon(d,[add(low,mul(side,-10)),add(high,mul(side,-14)),add(high,mul(side,15)),add(low,mul(side,11))],RED,RED_DARK,1)
            for s in [.3,.6]:line(d,[add(mix(low,high,s),mul(side,-10)),add(mix(low,high,s),mul(side,10))],RED_LIGHT,1.2)
        else:
            top=add(shoulder,mul(axis,-15));bottom=add(hip,mul(axis,12))
            for sign in ([1,-1] if active=='lats-both' else [1]):
                polygon(d,[add(top,mul(side,sign*15)),add(top,mul(side,sign*25)),add(bottom,mul(side,sign*13)),add(bottom,mul(side,sign*5))],RED,RED_DARK,1)
    line(d,[add(shoulder,mul(side,-17)),add(add(hip,mul(axis,10)),mul(side,-13))],'#e8eef1',2)
    # Shorts wrap the hip, keeping the upper-leg joints visually inside the pelvis.
    polygon(d,[add(add(hip,mul(axis,14)),mul(side,-23)),add(add(hip,mul(axis,14)),mul(side,23)),add(add(hip,mul(axis,-15)),mul(side,20)),add(hip,mul(axis,-22)),add(add(hip,mul(axis,-15)),mul(side,-21))],'#657787',DARK,1.5)
    neck=add(shoulder,mul(axis,20));tube(d,add(shoulder,mul(axis,5)),neck,GRAY,15,SHADE,False)
    hc=add(shoulder,mul(axis,45))
    pts=[add(hc,add(mul(side,18*math.cos(a)),mul(axis,24*math.sin(a)))) for a in [j*math.pi/24 for j in range(48)]]
    polygon(d,pts,GRAY,SHADE,1.3)
    if not front:
        nose=add(hc,mul(side,face*19))
        polygon(d,[add(nose,mul(axis,3)),add(nose,mul(side,face*6)),add(nose,mul(axis,-4))],'#b9c6cf',SHADE,.8)
        eye=add(add(hc,mul(side,face*13)),mul(axis,7));line(d,[eye,add(eye,mul(side,face*3))],DARK,1)
    else:
        for s in [-1,1]:ellipse(d,(*add(hc,(s*7,-1)),*add(hc,(s*7+2,1))),DARK)
    return hc

def hand(d,p,active=False,far=False):
    color=RED if active else ('#9fadb8' if far else GRAY)
    ellipse(d,(p[0]-6,p[1]-7,p[0]+6,p[1]+8),color,RED_DARK if active else SHADE,1)

def flat_shoe(d,ankle,far=False): shoe(d,(ankle[0]+4,ankle[1]+10),0,not far)

def standing_legs(d,hip,active=False,feet=((255,435),(311,435))):
    for far,ankle in [(True,feet[0]),(False,feet[1])]:
        h=add(hip,(-7,-2) if far else (7,1));distance=math.dist(h,ankle);knee,_=ik(h,ankle,distance*.49*1.015,distance*.51*1.015,True)
        limb(d,h,knee,ankle,active,far,25 if not far else 22);flat_shoe(d,ankle,far)

def cable_tower(d,pulley=(102,160),weight=0):
    polygon(d,[(58,82),(96,75),(113,438),(67,446)],'#e4eaed','#b5c2cb',2)
    tube(d,(82,85),(83,432),'#b6c2ca',9,'#8195a3',False)
    tube(d,(105,85),(107,435),'#b6c2ca',7,'#8195a3',False)
    polygon(d,[(53,438),(122,438),(140,452),(45,452)],'#4a6070',DARK,1)
    for j in range(9):
        y=345+j*8-(weight if j<5 else 0)
        polygon(d,[(68,y),(101,y-2),(104,y+4),(70,y+6)],'#81949f','#586f7e',.8)
    ellipse(d,(pulley[0]-10,pulley[1]-10,pulley[0]+10,pulley[1]+10),'#a8b8c2',DARK,1.6)
    ellipse(d,(pulley[0]-3,pulley[1]-3,pulley[0]+3,pulley[1]+3),DARK)

def d_handle(d,point,anchor):
    direction=unit(sub(anchor,point));normal=(-direction[1],direction[0])
    tip=add(point,mul(direction,17));a=add(point,mul(normal,-10));b=add(point,mul(normal,10))
    line(d,[anchor,tip],'#465c6a',2)
    line(d,[tip,a,b,tip],'#849ba9',3)
    tube(d,a,b,'#273f4f',4,'#203646',False)

def bayesian(t):
    image,d=scene();u=cycle(t);hip=(286,295);shoulder=(282+7*u,185)
    cable_tower(d,(102,393),6*u)
    standing_legs(d,hip)
    far_s=add(shoulder,(-10,2));far_j=add(far_s,(-5,57));far_h=add(far_j,(5,51));limb(d,far_s,far_j,far_h,False,True,17);hand(d,far_h,far=True)
    torso(d,hip,shoulder,face=1)
    s=add(shoulder,(11,3));elbow=add(s,(-23,54));wrist=polar(elbow,53,72-114*u)
    d_handle(d,wrist,(102,393));limb(d,s,elbow,wrist,True,False,19);hand(d,wrist)
    elbow_angle=joint_angle(s,elbow,wrist);assert 20<elbow_angle<180
    return image,{'elbowFlexionProgress':u,'elbowInternalAngleDegrees':elbow_angle,'upperArmLengthPx':math.dist(s,elbow),'forearmLengthPx':math.dist(elbow,wrist),'upperArmBehindTorsoDegrees':math.degrees(math.atan2(23,54)),'pulley':'low, behind the athlete','stance':'stationary split stance'}

def cross_body(t):
    image,d=scene();u=cycle(t);hip=(276,340);shoulder=(276,228);anchor=(107,155)
    cable_tower(d,anchor,8*u)
    # Fixed half-kneeling support: cable-side knee down, outside foot forward.
    limb(d,(267,341),(253,436),(178,436),False,True,24);flat_shoe(d,(174,432),True)
    limb(d,(284,341),(356,342),(356,435),False,False,25);flat_shoe(d,(356,435))
    far_s=(256,233);far_j=(280,286);far_h=(326,326);limb(d,far_s,far_j,far_h,False,True,17);hand(d,far_h,far=True)
    torso(d,hip,shoulder,active='lats',front=True)
    s=(300,232);elbow=polar(s,59,-150-140*u);wrist=polar(elbow,55,-150-105*u)
    d_handle(d,wrist,anchor);limb(d,s,elbow,wrist,False,False,19);hand(d,wrist)
    return image,{'repetitionProgress':u,'stance':'fixed half-kneeling','workingArm':'one, across body to ipsilateral hip','torsoRotationDegrees':0}

def spanish(t):
    image,d=scene(451);hip=(216,335);shoulder=(215,232);breath=1.0*math.sin(2*math.pi*t)
    tube(d,(434,168),(434,445),'#a9b9c3',13,'#738b9a',False)
    tube(d,(401,444),(464,444),'#7c93a2',15,'#4d6778',False)
    tube(d,(434,331),(309,331),'#40788c',15,'#235365',False)
    for far,off in [(True,(-6,-4)),(False,(8,3))]:
        h=add(hip,off);k=add((313,334),off);a=add((313,435),off)
        limb(d,h,k,a,True,far,27 if not far else 23);flat_shoe(d,a,far)
    torso(d,hip,shoulder,breath,face=1)
    for far,off in [(True,(-7,-4)),(False,(8,3))]:
        s=add(shoulder,off);j=add((268,245),off);h=add((318,237),off)
        limb(d,s,j,h,False,far,17);hand(d,h,far=far)
    line(d,[(434,318),(313,318),(304,326),(304,343),(313,349),(434,344)],'#4c92a7',7)
    line(d,[(434,318),(313,318),(304,326)],'#83bfd0',1.5)
    return image,{'isometric':True,'kneeAngleDegrees':90,'shin':'vertical','band':'fixed in front, passes behind knees','jointExcursionPx':0}

def nordic(t):
    image,d=scene(451);knee=(230,427);ankle=(143,426);a=math.radians(35);direction=(math.sin(a),-math.cos(a));hip=add(knee,mul(direction,80));shoulder=add(hip,mul(direction,101))
    polygon(d,[(112,435),(260,435),(275,449),(97,449)],'#dce6eb','#acbdc8',1)
    tube(d,(132,424),(132,447),'#a3b3be',12,'#6f8797',False)
    for far,off in [(True,(-6,-5)),(False,(6,1))]:
        limb(d,add(hip,off),add(knee,off),add(ankle,off),True,far,26);flat_shoe(d,add(ankle,off),far)
    # Padded ankle anchor sits above both heels; legs remain fixed under it.
    tube(d,(114,417),(166,417),'#647c8e',19,'#3d596d',False)
    torso(d,hip,shoulder,math.sin(2*math.pi*t)*.8,face=1)
    s1=add(shoulder,(-7,5));s2=add(shoulder,(7,4));j1=add(shoulder,(-26,42));h1=add(shoulder,(-34,8));j2=add(shoulder,(9,43));h2=add(shoulder,(-31,24))
    limb(d,s1,j1,h1,False,True,17);hand(d,h1,far=True);limb(d,s2,j2,h2,False,False,18);hand(d,h2)
    return image,{'isometric':True,'bodyLeanFromVerticalDegrees':35,'kneesHipsShouldersCollinear':True,'ankles':'fixed under padded support','jointExcursionPx':0,'notReverseNordic':True}

def dead_hang(t):
    image,d=scene(490);hip=(255,297);shoulder=(255,190)
    tube(d,(157,80),(157,480),'#b6c5ce',12,'#7d94a4',False);tube(d,(355,80),(355,480),'#b6c5ce',12,'#7d94a4',False)
    tube(d,(130,483),(183,483),'#9eb0bc',14,'#728b9d',False);tube(d,(330,483),(384,483),'#9eb0bc',14,'#728b9d',False)
    tube(d,(146,79),(367,79),'#485f6f',12,'#304a5c',False)
    for far,h,a in [(True,(248,297),(241,452)),(False,(264,299),(267,454))]:
        k,_=ik(h,a,79,80,True);limb(d,h,k,a,False,far,25);flat_shoe(d,a,far)
    torso(d,hip,shoulder,math.sin(2*math.pi*t)*1.1,active='lats-both',front=True)
    for far,s,h in [(True,(236,193),(205,79)),(False,(275,193),(306,79))]:
        j=mix(s,h,.51);limb(d,s,j,h,True,far,18);hand(d,h,True,far)
    return image,{'isometric':True,'handsFixed':[[205,79],[306,79]],'elbowInternalAngleDegrees':180,'footClearancePx':25,'jointExcursionPx':0,'notPullup':True}

def pinch(t):
    image,d=scene();hip=(246,297);shoulder=(246,190);standing_legs(d,hip,False,((221,435),(274,435)))
    far_s=(219,193);far_j=(211,253);far_h=(216,311);limb(d,far_s,far_j,far_h,False,True,18);hand(d,far_h,far=True)
    torso(d,hip,shoulder,math.sin(2*math.pi*t)*1.1,front=True)
    s=(272,194);j=(286,254);w=(292,316);limb(d,s,j,w,True,False,19)
    # Two smooth plates are held by their TOP RIM, never by the centre hole.
    for x in [299,290]:
        ellipse(d,(x-27,331,x+27,403),'#596d7b',DARK,1.4)
        ellipse(d,(x-22,336,x+22,398),'#7b8d98','#9daeb9',1)
        ellipse(d,(x-4,363,x+4,372),'white',DARK,1)
    hand(d,(291,325),True)
    line(d,[(289,322),(282,334),(284,343)],RED_DARK,4)
    line(d,[(297,322),(302,331),(300,341)],RED_LIGHT,4)
    # Original close-up clearly distinguishes a pinch from a handle grip.
    ellipse(d,(338,133,484,279),'#f4f7f9','#d1dce3',1)
    line(d,[(311,331),(348,265)],'#b9c8d2',1)
    for x in [397,410]:
        polygon(d,[(x-8,184),(x+8,181),(x+8,254),(x-8,257)],'#5a7281',DARK,1)
        line(d,[(x-5,189),(x-5,248)],'#9db0bc',2)
    tube(d,(404,146),(403,175),GRAY,24,SHADE,False)
    polygon(d,[(389,166),(414,166),(423,183),(424,205),(416,208),(410,185),(398,181),(389,203),(381,202),(383,182)],RED,RED_DARK,1)
    for y in [187,194,201]:line(d,[(416,y),(423,y+1)],RED_LIGHT,1)
    return image,{'isometric':True,'grip':'thumb opposing fingers on smooth plate faces, top rim','plateTranslationPx':0,'notHandleOrCentreHoleGrip':True}

WALK_DUTY=.63
def walk_foot(phase,offset):
    x0,y=302+offset,436+offset*.10
    if phase<WALK_DUTY:return (x0-124*phase,y),True,0
    s=(phase-WALK_DUTY)/(1-WALK_DUTY)
    x1=x0-124*WALK_DUTY
    # C1 return path matches the tracked ground's backward velocity at contact.
    m=-124*(1-WALK_DUTY)
    x=(2*s**3-3*s*s+1)*x1+(s**3-2*s*s+s)*m+(-2*s**3+3*s*s)*x0+(s**3-s*s)*m
    return (x,y-29*math.sin(math.pi*s)**2),False,-12*math.sin(math.pi*s)**2

def walking(t,carry=False):
    image,d=scene(436);bob=-2.0*math.cos(4*math.pi*t);hip=(264,276+bob);shoulder=(266,172+bob)
    # Camera follows the walker over flat ground; markers move at foot-contact speed.
    for j in range(-1,8):
        x=(j*72-124*t)%504
        line(d,[(x,438),(x+19,438)],'#cbd6dd',2)
    for far,off,depth in [(True,.5,-6),(False,0,7)]:
        sole,stance,pitch=walk_foot((t+off)%1,depth);ankle=(sole[0]-3,sole[1]-10);h=add(hip,(-5,-2) if far else (6,2));k,_=ik(h,ankle,80,84,True)
        limb(d,h,k,ankle,not carry,far,25);shoe(d,sole,pitch,not far)
    far_s=add(shoulder,(-9,3));angle=90+24*math.cos(2*math.pi*t)
    far_j=polar(far_s,56,angle);far_h=polar(far_j,49,angle-15);limb(d,far_s,far_j,far_h,False,True,17);hand(d,far_h,far=True)
    torso(d,hip,shoulder,active='core' if carry else None,face=1)
    s=add(shoulder,(10,3))
    if carry:
        j=add(s,(1,56));h=add(j,(0,53));limb(d,s,j,h,True,False,18);hand(d,h,True)
        # One and only one load, held beside the body with a neutral wrist.
        tube(d,(h[0]-25,h[1]+8),(h[0]+25,h[1]+8),'#a3b1bb',7,DARK,False)
        for dx in [-24,24]:
            polygon(d,[(h[0]+dx-8,h[1]-8),(h[0]+dx+8,h[1]-5),(h[0]+dx+8,h[1]+23),(h[0]+dx-8,h[1]+20)],'#4e6676',DARK,1.5)
        hand(d,h,True)
    else:
        angle=90-24*math.cos(2*math.pi*t);j=polar(s,56,angle);h=polar(j,49,angle-15);limb(d,s,j,h,False,False,18);hand(d,h)
    return image,{'flatGround':True,'camera':'tracks walker; ground markers translate at planted-foot velocity','alternatingFootsteps':True,'loads':1 if carry else 0,'loadType':'unilateral dumbbell at side' if carry else 'none'}

def captain(t):
    image,d=scene(505);u=cycle(t);hip=(245,286);shoulder=(245,183)
    for x in [182,293]:tube(d,(x,171),(x,491),'#a6b8c4',12,'#748e9f',False)
    tube(d,(147,494),(327,494),'#7993a4',17,'#506d81',False)
    polygon(d,[(206,190),(242,184),(242,289),(206,296)],'#536e81','#344f63',1.5)
    polygon(d,[(202,197),(232,193),(232,280),(202,286)],'#879daa','#617e91',1)
    for far,off in [(True,(-8,-5)),(False,(8,3))]:
        h=add(hip,off);k=polar(h,84,86*(1-u));a=polar(k,89,86+4*u)
        limb(d,h,k,a,False,far,25);shoe(d,(a[0]+4,a[1]+10),0,not far)
    torso(d,hip,shoulder,active='core',face=1)
    for far,off in [(True,(-9,-5)),(False,(9,4))]:
        s=add(shoulder,off);j=add((246,239),off);h=add((300,239),off)
        tube(d,add(j,(-18,12)),add(h,(7,12)),'#5b778c',20,'#3c5b72',False)
        tube(d,add(h,(0,14)),add(h,(0,-10)),'#455f73',7,'#2f4b61',False)
        limb(d,s,j,h,False,far,18);hand(d,h,far=far)
    return image,{'repetitionProgress':u,'support':'captain chair back pad and forearm pads','legs':'knees flex as both thighs lift; no straight-leg raise','armsFixed':True}

def calf(t):
    image,d=scene(443);u=cycle(t);angle=28*u
    toe=(328,443);a=math.radians(angle)
    ankle=add(toe,(-37*math.cos(a)+11*math.sin(a),-37*math.sin(a)-11*math.cos(a)))
    knee=add(ankle,(23,-70));hip=add(knee,(-31,-67));shoulder=add(hip,(0,-107))
    # Per-side prescription in the source routine: the other leg is held clear.
    fh=add(hip,(-10,-3));fk=add(fh,(-12,68));fa=add(fk,(-43,49))
    limb(d,fh,fk,fa,False,True,23);shoe(d,add(fa,(3,9)),-8,False)
    limb(d,hip,knee,ankle,True,False,25)
    def p(v):return add(toe,(v[0]*math.cos(a)-v[1]*math.sin(a),v[0]*math.sin(a)+v[1]*math.cos(a)))
    polygon(d,[p(v) for v in [(-47,-9),(-35,-12),(-18,-7),(-1,-3),(0,0),(-47,0)]],'#cad5dc',DARK,1.2)
    line(d,[p((-47,0)),p((0,0))],DARK,2)
    tube(d,(392,165),(392,446),'#adbcc5',11,'#7c92a2',False);tube(d,(366,446),(431,446),'#9bafbd',13,'#6e899c',False);tube(d,(392,214),(357,214),'#adbcc5',8,'#7c92a2',False)
    torso(d,hip,shoulder,face=1)
    for far,off in [(True,(-8,-3)),(False,(8,3))]:
        s=add(shoulder,off);h=(365,214+off[1]);j,_=ik(s,h,57,59,False);limb(d,s,j,h,False,far,18);hand(d,h,far=far)
    flexion=180-math.degrees(math.acos((-31*-23+-67*70)/(math.hypot(31,67)*math.hypot(23,70))))
    return image,{'standing':True,'unilateral':True,'kneesRemainBent':True,'kneeFlexionDegrees':flexion,'forefootFixed':[328,443],'freeFootClear':True,'heelRotationDegrees':angle,'movement':'plantarflexion / heel raise; not tibialis toe lift'}

def hip_thrust(t):
    image,d=scene(467);u=cycle(t);shoulder=(171,282);hip=polar(shoulder,111,42*(1-u));feet=((356,404),(369,411))
    # Dedicated plate-loaded hip-thrust machine: low pivot arm, hip restraint,
    # upper-back pad, broad angled foot platform; no Smith vertical guide rails.
    tube(d,(100,452),(434,452),'#8199a9',16,'#536f82',False)
    tube(d,(128,451),(151,300),'#a6b8c4',14,'#7892a4',False)
    polygon(d,[(106,254),(195,270),(199,291),(110,278)],'#6e8799','#456175',1.5)
    polygon(d,[(118,252),(194,265),(194,282),(117,269)],'#a7b7c2','#7e97a8',1)
    polygon(d,[(335,423),(414,423),(427,449),(334,449)],'#607c90','#3e5e75',1.5)
    for j in range(5):line(d,[(342,427+j*4),(415,427+j*4)],'#9aafbd',1)
    knee_angles=[]
    for far,a in [(True,feet[0]),(False,feet[1])]:
        h=add(hip,(-5,-4) if far else (5,3));k,knee_angle=ik(h,a,91,111,True);knee_angles.append(knee_angle);limb(d,h,k,a,False,far,26);flat_shoe(d,a,far)
    torso(d,hip,shoulder,face=1)
    # Hip/glute region is the active area rather than an abdominal crunch cue.
    ellipse(d,(hip[0]-23,hip[1]-20,hip[0]+18,hip[1]+17),RED,RED_DARK,1.5)
    for far,off in [(True,(-5,-6)),(False,(5,5))]:
        s=add(shoulder,off);h=add(hip,(-14,-9));j,_=ik(s,h,60,60,False);limb(d,s,j,h,False,far,18);hand(d,h,far=far)
    pivot=(418,420);restraint=add(hip,(4,5));tube(d,pivot,restraint,'#758fa1',11,'#4b697e',False)
    ellipse(d,(402,404,434,436),'#405e74','#28465c',1.4)
    # Plates ride on the machine lever, not on a bar across the athlete.
    load=mix(pivot,restraint,.35);ellipse(d,(load[0]-28,load[1]-28,load[0]+28,load[1]+28),'#667e8f','#3f5b70',2);ellipse(d,(load[0]-7,load[1]-7,load[0]+7,load[1]+7),'#b9c8d2','#607d92',1)
    tube(d,add(restraint,(-17,-3)),add(restraint,(18,5)),'#3d596e',16,'#29485f',False)
    return image,{'repetitionProgress':u,'kneeInternalAnglesDegrees':knee_angles,'torsoLengthPx':math.dist(shoulder,hip),'machine':'dedicated plate-loaded hip-thrust machine with hip restraint and back pad','shoulderFixed':shoulder,'feetFixed':feet,'notSmithOrBarbell':True}

def overhead(t):
    image,d=scene();u=cycle(t);hip=(281,298);shoulder=(282,187);anchor=(102,106)
    cable_tower(d,anchor,7*u);standing_legs(d,hip,False,((255,435),(313,435)))
    torso(d,hip,shoulder,face=1)
    arms=[]
    for far,s,j in [(True,(271,189),(286,126)),(False,(296,192),(315,132))]:
        h=polar(j,60,140+150*u);arms.append((far,s,j,h))
    center=mul(add(arms[0][3],arms[1][3]),.5)
    line(d,[anchor,add(center,(-6,0))],'#48616f',2)
    for far,s,j,h in arms:limb(d,s,j,h,True,far,19)
    # Short angled EZ / wavy cable bar: two angled grip zones, not rope/straight/V.
    axis=unit(sub(arms[1][3],arms[0][3]));normal=(-axis[1],axis[0])
    contour=[(-42,0),(-30,0),(-22,7),(-9,7),(-1,0),(10,0),(19,7),(30,7),(38,0),(45,0)]
    pts=[add(center,add(mul(axis,x),mul(normal,y))) for x,y in contour]
    line(d,pts,'#455e70',7);line(d,[add(p,(-1,-1)) for p in pts],'#c1ccd4',3)
    for far,s,j,h in arms:hand(d,h,False,far)
    # The far arm travels BEHIND the head in this side view. Drawing the head
    # last restores that depth order, keeping the whole head recognisable while
    # the near upper arm remains beside it. No joint trajectory is changed.
    tube(d,(282,181),(282,166),GRAY,15,SHADE,False)
    ellipse(d,(264,118,300,166),GRAY,SHADE,1.3)
    polygon(d,[(299,137),(306,142),(299,146)],'#b9c6cf',SHADE,.8)
    ellipse(d,(274,139,280,148),'#acbcc7',SHADE,.7)
    line(d,[(293,135),(296,135)],DARK,1)
    return image,{'repetitionProgress':u,'standing':True,'pulley':'high and behind','attachment':'short angled EZ / wavy bar','upperArmsFixedOverhead':True,'headVisibility':'far arm behind head; near arm beside profile','notPushdown':True}

SPECS={
 'cross-body-lat-pull-around':('Cross-body lat pull-around',cross_body,'https://www.youtube.com/watch?v=4xHF_pMbEsk','Original trainer demonstration; half-kneeling cross-body reach and elbow sweep. No video frames copied.'),
 'plate-pinch-hold':('Plate pinch hold',pinch,'https://www.davidhorne-gripmaster.com/gripfeats.html','Primary grip-sport demonstration; smooth plate faces opposed by fingers and thumb.'),
 'bayesian-cable-curl':('Bayesian cable curl',bayesian,'https://mennohenselmans.com/bayesian-curls/','Exercise originator: face away from low cable, elbow near side, controlled curl.'),
 'spanish-squat-hold':('Spanish squat hold',spanish,'https://www.catalystathletics.com/exercise/747/Spanish-Squat/','Coach demonstration: anterior anchor, band behind knees, vertical shins and trunk, isometric variation.'),
 'nordic-hold':('Nordic hamstring hold',nordic,'https://www.orthopt.org/uploads/OP_v26no2_FINAL_Web.pdf','Primary clinical protocol: secured feet and straight upper body; this candidate holds a fixed lean for time.'),
 'dead-hang':('Dead hang',dead_hang,'https://www.acefitness.org/continuing-education/certified/june-2025/8887/the-truth-behind-the-trends/','Professional organisation description: static bar hang; no pull-up repetitions.'),
 'captains-chair-knee-raise':('Captain chair knee raise',captain,'https://www.precor.com/en-GB/products/DBR0702','Primary manufacturer: elbow pads, hand grips and back pad support knee-up exercises. Original station geometry, no product art copied.'),
 'suitcase-carry':('Suitcase carry',lambda t:walking(t,True),'https://www.acefitness.org/resources/everyone/exercise-library/358/suitcase-carry/','Trainer demonstration: one dumbbell at one side while walking upright.'),
 'walking-flat-ground':('Walking on level ground',lambda t:walking(t,False),'https://www.ouh.nhs.uk/gait-lab/','Flat alternating gait, no stair machine, treadmill or incline.'),
 'standing-bent-knee-calf-raise':('Standing bent-knee calf raise',calf,None,'Owner confirmed standing variant. Knees stay flexed as heels lift; forefeet stay in contact.'),
 'machine-hip-thrust':('Machine hip thrust',hip_thrust,None,'Owner confirmed dedicated machine. Fixed upper-back support and foot platform; hip restraint lifts with hips.'),
 'overhead-cable-triceps-ez-bar':('Overhead cable triceps: EZ bar',overhead,None,'Owner described short curved / wavy attachment and confirmed standing cable overhead extension; high pulley behind.'),
}

def font(size,bold=False):
    try:return ImageFont.truetype(r'C:\Windows\Fonts\segoeuib.ttf' if bold else r'C:\Windows\Fonts\segoeui.ttf',size)
    except OSError:return ImageFont.load_default()

def save(key,spec):
    title,render,reference,reference_note=spec;images=[];checks=[]
    for i in range(FRAMES):
        im,record=render(i/FRAMES);images.append(im.resize((SIZE,SIZE),Image.Resampling.LANCZOS));checks.append(record)
    sample=Image.new('RGB',(SIZE*3,SIZE*2),'white');indices=[0,6,12,18,24,30]
    for n,i in enumerate(indices):sample.paste(images[i],((n%3)*SIZE,(n//3)*SIZE))
    palette=sample.quantize(colors=192,method=Image.Quantize.MEDIANCUT)
    frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in images]
    duration=60 if key in ['suitcase-carry','walking-flat-ground'] else 80
    gif=OUT/(key+'.gif');frames[0].save(gif,save_all=True,append_images=frames[1:],loop=0,duration=duration,optimize=False,disposal=2)
    diagnostic=0 if checks[0].get('isometric') or key=='cross-body-lat-pull-around' else (18 if key in ['captains-chair-knee-raise','standing-bent-knee-calf-raise','machine-hip-thrust','overhead-cable-triceps-ez-bar'] else 9)
    images[diagnostic].save(OUT/(key+'-poster.png'))
    sheet=Image.new('RGB',(1040,760),'#edf2f5');d=ImageDraw.Draw(sheet);d.text((18,10),title,fill=DARK,font=font(24,True))
    for n,i in enumerate(indices):
        x,y=12+n%3*342,49+n//3*352;sheet.paste(images[i].resize((330,330),Image.Resampling.LANCZOS),(x,y));d.text((x+8,y+306),f'{i+1:02d}/{FRAMES}  {i*duration/1000:.2f}s',fill=DARK,font=font(18))
    sheet.save(OUT/(key+'-contact-sheet.png'))
    with Image.open(gif) as check:
        decoded_frames=check.n_frames;assert decoded_frames>1;assert check.info.get('loop')==0
        decoded_duration=0
        for i in range(decoded_frames):check.seek(i);decoded_duration+=check.info['duration']
        assert decoded_duration==FRAMES*duration
    provenance={'original':True,'externalMediaInputs':False,'asset':gif.name,'dimensions':[SIZE,SIZE],'frames':decoded_frames,'authoredFrames':FRAMES,'frameDurationMs':duration,'durationMs':decoded_duration,'gifBytes':gif.stat().st_size,'renderer':'render_custom_exercises.py + original primitives in render_stepmill.py; 3x antialiasing','movement':title,'reference':({'url':reference,'usedFor':reference_note} if reference else {'ownerConfirmedVariant':reference_note}),'reviewStatus':'Candidate only: contact-sheet and loop review required before assignment','productionAssigned':False,'physicalExerciseValidation':False,'firstFrameRig':checks[0]}
    (OUT/(key+'-provenance.json')).write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf8');(OUT/(key+'-rig-checks.json')).write_text(json.dumps(checks,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'asset':key,'bytes':gif.stat().st_size,'frames':FRAMES}),flush=True)
    return images[diagnostic],provenance

def main():
    import sys
    keys=sys.argv[1:] or list(SPECS)
    rendered=[]
    for key in keys:rendered.append((key,*save(key,SPECS[key])))
    if set(keys)==set(SPECS):
        sheet=Image.new('RGB',(2048,math.ceil(len(keys)/4)*512),'#eaf0f4');d=ImageDraw.Draw(sheet)
        for i,(key,im,meta) in enumerate(rendered):
            x,y=i%4*512,i//4*512;sheet.paste(im.resize((480,480),Image.Resampling.LANCZOS),(x+16,y));d.text((x+16,y+480),meta['movement'],fill=DARK,font=font(20,True))
        sheet.save(OUT/'production-originals-overview.png')
        (OUT/'production-originals-manifest.json').write_text(json.dumps([meta for _,_,meta in rendered],indent=2)+'\n',encoding='utf8')

if __name__=='__main__':main()
