"""Original vector-like stair-machine walking rig; no external image inputs.

The planted foot is attached to a translating tread. The other foot clears the
next riser, then returns to a higher tread. Drawings and joint paths are authored
here, rather than traced from third-party exercise media.
"""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent
SIZE, SCALE, FRAMES, DURATION_MS = 512, 3, 36, 60
RUN, RISE, DEPTH = 44.0, 30.0, (32.0, 12.0)
BASE, DUTY = (260.0, 343.0), .62
UPPER, LOWER = 68.0, 70.0


def point(v):
    return tuple(int(round(n * SCALE)) for n in v)


def polygon(draw, pts, fill, outline=None, width=1):
    coords = [point(p) for p in pts]
    draw.polygon(coords, fill=fill)
    if outline:
        draw.line(coords + coords[:1], fill=outline, width=round(width * SCALE), joint="curve")


def line(draw, pts, fill, width=1):
    draw.line([point(p) for p in pts], fill=fill, width=round(width * SCALE), joint="curve")


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse([*point(box[:2]), *point(box[2:])], fill=fill, outline=outline, width=round(width * SCALE))


def tube(draw, a, b, color, width, rim="#394856", shine=True):
    for thickness, fill in [(width + 2, rim), (width, color)]:
        line(draw, [a, b], fill, thickness)
        r = thickness / 2
        for x, y in (a, b):
            ellipse(draw, (x-r, y-r, x+r, y+r), fill)
    if shine:
        line(draw, [(a[0]-1.5, a[1]-1.5), (b[0]-1.5, b[1]-1.5)], "#ffffff35", max(1, width * .12))


def ik(hip, ankle, upper=UPPER, lower=LOWER, forward=True):
    dx, dy = ankle[0]-hip[0], ankle[1]-hip[1]
    distance = math.hypot(dx, dy)
    assert abs(upper-lower) < distance < upper+lower, "Unreachable joint target"
    ux, uy = dx/distance, dy/distance
    a = (upper*upper-lower*lower+distance*distance)/(2*distance)
    h = math.sqrt(max(0, upper*upper-a*a))
    side = 1 if forward else -1
    knee = (hip[0]+a*ux+side*h*uy, hip[1]+a*uy-side*h*ux)
    cos_angle = (upper*upper+lower*lower-distance*distance)/(2*upper*lower)
    angle = math.degrees(math.acos(max(-1, min(1, cos_angle))))
    return knee, angle


def hermite(start, end, m0, m1, s):
    return (2*s**3-3*s*s+1)*start+(s**3-2*s*s+s)*m0+(-2*s**3+3*s*s)*end+(s**3-s*s)*m1


def hermite5(start, end, m0, m1, s):
    # Zero endpoint accelerations give a soft join to constant-speed treads.
    return (1-10*s**3+15*s**4-6*s**5)*start+(s-6*s**3+8*s**4-3*s**5)*m0+(10*s**3-15*s**4+6*s**5)*end+(-4*s**3+7*s**4-3*s**5)*m1


def foot(phase, depth):
    x0, y0 = BASE[0]+DEPTH[0]*depth, BASE[1]+DEPTH[1]*depth
    if phase < DUTY:
        return (x0-2*phase*RUN, y0+2*phase*RISE), 0.0, True
    s = (phase-DUTY)/(1-DUTY)
    x1, y1 = x0-2*DUTY*RUN, y0+2*DUTY*RISE
    mx, my = -2*RUN*(1-DUTY), 2*RISE*(1-DUTY)
    x = hermite(x1, x0, mx, mx, s)
    # Asymmetric C1 lift: clear the first riser early, then soften touchdown.
    # Both lift derivatives vanish at the contacts, so the swing joins the
    # tread's exact velocity instead of dropping the foot at the loop boundary.
    peak = (1/3)**2*(2/3)**2*math.exp(-1)
    lift = 62*s*s*(1-s)**2*math.exp(-3*s)/peak
    y = hermite5(y1, y0, my, my, s)-lift
    return (x, y), -8*math.sin(math.pi*s)**4, False


def surface_height(x, time, depth):
    phase = (time*2) % 1
    idx = math.floor((x-DEPTH[0]*depth-BASE[0]+RUN/2)/RUN+phase)
    return BASE[1]-(idx-phase)*RISE+DEPTH[1]*depth


def machine_background():
    image = Image.new("RGBA", (SIZE*SCALE, SIZE*SCALE), "white")
    shadow = Image.new("RGBA", image.size)
    sd = ImageDraw.Draw(shadow)
    ellipse(sd, (98, 469, 432, 502), "#20304027")
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(7*SCALE)))
    d = ImageDraw.Draw(image)
    # Rear housing and protected drive enclosure, in orthographic three-quarter view.
    polygon(d, [(111,445),(348,279),(390,300),(392,480),(151,492),(111,477)], "#394858", "#263543", 2)
    polygon(d, [(148,482),(382,317),(410,333),(410,481),(169,499)], "#253544", "#192a37", 2)
    polygon(d, [(168,480),(398,460),(410,481),(169,499),(130,487)], "#1e2b37", "#172530", 1)
    line(d, [(176,473),(392,452)], "#506171", 2)
    for x, y in [(179,481),(397,469),(373,346)]:
        ellipse(d, (x-2,y-2,x+2,y+2), "#8c9aa4")
    # Back rail, mast and console. No brand graphics or copied product outline.
    tube(d, (377,448), (377,170), "#667582", 12, "#253440")
    tube(d, (377,209), (304,209), "#738390", 8, "#33434e")
    polygon(d, [(335,145),(385,152),(393,189),(343,182)], "#202e3a", "#15232e", 2)
    polygon(d, [(341,151),(379,156),(384,176),(347,172)], "#86bac9", "#566d78", 1)
    line(d, [(350,158),(371,161)], "#eaf5f8", 2)
    line(d, [(352,165),(366,167)], "#c9e7ee", 2)
    ellipse(d, (365,180,373,186), "#cf5d54")
    return image


def treads(time):
    image = Image.new("RGBA", (SIZE*SCALE, SIZE*SCALE))
    d = ImageDraw.Draw(image)
    phase = (time*2) % 1
    for k in range(5,-7,-1):
        cx, cy = BASE[0]+(k-phase)*RUN, BASE[1]-(k-phase)*RISE
        a, b = (cx-RUN/2,cy), (cx+RUN/2,cy)
        an, bn = (a[0]+DEPTH[0],a[1]+DEPTH[1]), (b[0]+DEPTH[0],b[1]+DEPTH[1])
        polygon(d, [a,an,(an[0],an[1]+RISE),(a[0],a[1]+RISE)], "#3c4c59", "#24343f", 1)
        polygon(d, [a,b,bn,an], "#53616b", "#263640", 1.3)
        # Gripped horizontal tread ribs, drawn on the surface's depth axis.
        for u in (.22,.42,.62,.82):
            line(d, [(a[0]+DEPTH[0]*u+3,a[1]+DEPTH[1]*u),
                     (b[0]+DEPTH[0]*u-3,b[1]+DEPTH[1]*u)], "#8a969d", .8)
        line(d, [an,bn], "#bec7cc", 1.2)
    mask = Image.new("L", image.size)
    md = ImageDraw.Draw(mask)
    polygon(md, [(111,444),(348,278),(391,314),(149,484)], 255)
    image.putalpha(mask)
    return image


def shoe(draw, sole, pitch, near):
    # In stance every sole point remains on its own horizontal tread plane.
    angle = math.radians(pitch)
    def transform(p):
        x, y = p
        return (sole[0]+x*math.cos(angle)-y*math.sin(angle), sole[1]+x*math.sin(angle)+y*math.cos(angle))
    color = "#ced7dc" if near else "#9eabb5"
    polygon(draw, [transform(p) for p in [(-15,-8),(-7,-10),(5,-7),(17,-5),(19,-2),(18,0),(-16,0)]], color, "#384854", 1.2)
    line(draw, [transform((-16,0)), transform((18,0))], "#142632", 2.5)
    line(draw, [transform((0,-6)), transform((9,-4))], "#f7fafb", 1.2)


def frame(time):
    image = machine_background()
    image.alpha_composite(treads(time))
    d = ImageDraw.Draw(image)
    bob = 1.2*math.cos(4*math.pi*time)
    leg_records = []
    for near, offset, depth in [(False,.5,.30),(True,0,.70)]:
        phase = (time+offset) % 1
        sole, pitch, stance = foot(phase, depth)
        hip = (244+(0 if near else -5),247+bob+(0 if near else -3))
        ankle = (sole[0]-3, sole[1]-9)
        knee, angle = ik(hip,ankle)
        red, shade = ("#db5b51", "#a83f3c") if near else ("#b34c47", "#843a39")
        tube(d,hip,knee,red,24 if near else 21,shade,False)
        tube(d,knee,ankle,red,17 if near else 15,shade,False)
        ellipse(d, (knee[0]-10,knee[1]-10,knee[0]+10,knee[1]+10), red, shade, 1)
        line(d, [(hip[0]+3,hip[1]+3),(knee[0]+2,knee[1]-3)], "#f69b8b" if near else "#d66c60", 3)
        line(d, [(knee[0]+2,knee[1]+5),(ankle[0]+2,ankle[1]-3)], "#f18b7e" if near else "#d66c60", 2.5)
        shoe(d,sole,pitch,near)
        # Confirm that planted feet follow an actual translating tread exactly.
        machine_phase = (time*2) % 1
        tread_index = round((sole[0]-BASE[0]-DEPTH[0]*depth)/RUN+machine_phase)
        expected = (BASE[0]+(tread_index-machine_phase)*RUN+DEPTH[0]*depth,
                    BASE[1]-(tread_index-machine_phase)*RISE+DEPTH[1]*depth)
        error = math.dist(sole,expected) if stance else None
        leg_records.append({"near":near,"stance":stance,"phase":phase,"sole":sole,"kneeAngleDegrees":angle,"treadContactErrorPx":error})
    # Shorts/pelvis and shirt/torso retain their shape while the legs articulate.
    polygon(d, [(229,230+bob),(260,232+bob),(261,265+bob),(244,275+bob),(225,264+bob)], "#5e6b76", "#354754", 1.5)
    polygon(d, [(239,171+bob),(266,175+bob),(261,237+bob),(230,238+bob),(231,218+bob)], "#c0cbd2", "#778793", 1.8)
    polygon(d, [(250,176+bob),(266,175+bob),(261,237+bob),(248,235+bob)], "#a4b2bc")
    line(d, [(237,182+bob),(234,220+bob)], "#e2e9ed", 3)
    tube(d, (254,159+bob), (253,179+bob), "#b9c6ce", 14, "#7e909e", False)
    ellipse(d, (241,115+bob,277,159+bob), "#c3ced5", "#7c909e", 1.5)
    polygon(d, [(274,134+bob),(282,141+bob),(275,144+bob)], "#b9c6ce", "#7c909e", 1)
    ellipse(d, (249,135+bob,255,143+bob), "#a6b7c2")
    line(d, [(270,129+bob),(274,130+bob)], "#5a6e7c", 1)
    # Far arm, near rail and near arm; bent elbows imply a light balancing touch.
    for near, shoulder, hand in [(False,(245,182+bob),(312,208)),(True,(258,183+bob),(327,218))]:
        elbow,_ = ik(shoulder,hand,46,47,forward=False)
        color = "#a5b5c0" if not near else "#c5d0d7"
        tube(d,shoulder,elbow,color,14 if not near else 16,"#768b9b",False)
        tube(d,elbow,hand,color,12 if not near else 14,"#768b9b",False)
        if near:
            # The front rail is behind the hand; the hand wraps its top edge.
            tube(d,(391,454),(391,220),"#74838e",10,"#293d4b",False)
            tube(d,(391,220),(304,220),"#87959f",8,"#344c5b",False)
        ellipse(d, (hand[0]-4,hand[1]-5,hand[0]+6,hand[1]+6), color,"#6f8797",1)
    return image.convert("RGB").resize((SIZE,SIZE),Image.Resampling.LANCZOS), leg_records


def main():
    images, records = [], []
    for i in range(FRAMES):
        image, legs = frame(i/FRAMES)
        images.append(image); records.append({"frame":i,"legs":legs})
    palette_source = Image.new("RGB",(SIZE*3,SIZE*2),"white")
    samples = [0,6,12,18,24,30]
    for j,idx in enumerate(samples):
        palette_source.paste(images[idx],((j%3)*SIZE,(j//3)*SIZE))
    palette = palette_source.quantize(colors=192,method=Image.Quantize.MEDIANCUT)
    quantized = [image.quantize(palette=palette,dither=Image.Dither.NONE) for image in images]
    quantized[0].save(OUT/'stepmill-continuous-walk.gif',save_all=True,append_images=quantized[1:],loop=0,duration=DURATION_MS,optimize=False,disposal=2)
    images[0].save(OUT/'stepmill-continuous-walk-poster.png')
    sheet = Image.new('RGB',(1024,740),'#f3f6f8')
    sd = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype(r'C:\Windows\Fonts\segoeui.ttf',18)
        titlefont = ImageFont.truetype(r'C:\Windows\Fonts\segoeuib.ttf',24)
    except OSError:
        font=titlefont=ImageFont.load_default()
    sd.text((20,12),'Original continuous stair-machine walk',fill='#233847',font=titlefont)
    for j,idx in enumerate(samples):
        x,y=10+(j%3)*340,52+(j//3)*342
        sheet.paste(images[idx].resize((328,328),Image.Resampling.LANCZOS),(x,y))
        phase=idx/FRAMES
        sd.text((x+8,y+307),f'{idx+1:02d}/36  |  {phase*FRAMES*DURATION_MS/1000:.2f}s',fill='#233847',font=font)
    sheet.save(OUT/'stepmill-continuous-walk-contact-sheet.png')
    contact_errors=[leg['treadContactErrorPx'] for record in records for leg in record['legs'] if leg['stance']]
    angles=[leg['kneeAngleDegrees'] for record in records for leg in record['legs']]
    assert max(contact_errors)<1e-8
    provenance={
      'original':True,'externalMediaInputs':False,'asset':'stepmill-continuous-walk.gif',
      'movement':'Continuous upright alternating walk on a revolving stair machine, not a treadmill or stationary stairs',
      'frames':FRAMES,'durationMs':FRAMES*DURATION_MS,'frameDurationMs':DURATION_MS,'dimensions':[SIZE,SIZE],
      'loop':True,'gifBytes':(OUT/'stepmill-continuous-walk.gif').stat().st_size,
      'renderer':'render_stepmill.py; mathematically authored limb rig and Pillow vector primitives with 3x antialiasing',
      'stanceFootConstraint':'Planted sole center is attached to a tread translating down/back at its exact speed',
      'maxStanceContactErrorPx':max(contact_errors),'kneeAngleRangeDegrees':[min(angles),max(angles)],
      'reference':[{'title':'Core Health & Fitness: StepMill mechanical description','url':'https://www.corehandf.com/blogs/shop-hs/stairmaster-vs-elliptical-what-every-operator-should-know-before-building-a-cardio-floor','usedFor':'Exercise mechanism only: continuous climbing on revolving steps; no art or text copied'}],
      'reviewStatus':'Original candidate; root must inspect contact sheet and loop and confirm current exercise identity before assignment',
      'physicalExerciseValidation':False,'productionAssigned':False,
    }
    (OUT/'stepmill-continuous-walk-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf8')
    (OUT/'stepmill-continuous-walk-rig-checks.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf8')
    print(json.dumps(provenance))


if __name__=='__main__':main()
