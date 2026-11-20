TGym anatomical exercise media

Body model: Heatsy Body Model, adapted by DDDEV LTD (2026) from
Z-Anatomy by Gauthier Kervyn and Marcin Zielinski, derived from
BodyParts3D, © The Database Center for Life Science.
Original BodyParts3D model: Kousaku Okubo.

Source: https://github.com/heatsy-app/heatsy-body-model
Pinned source commit: 6cf6a0ae7c63bcffca1137ddcec14a31b7254a6d
Source model: model/body_superficial.app5m.glb
SHA-256: ce9859de013c2ee9713dbe3158275208b57be1b4ff31957eca87195b991c0ab1
Source vocabulary: data/muscles.json
SHA-256: da930e89dd70ac65b2a960df3bf20321898a5171716400a14dc620e6dedc9883
Source anatomical mapping: data/za_map.json
SHA-256: 3a7466ea3537854db373364060f3428c3d1d22df683d1c4065a09519ade498af

The body model, its vocabulary/mapping, and TGym's derived anatomical
GIF/PNG illustrations are licensed under Creative Commons
Attribution-ShareAlike 4.0 International (CC BY-SA 4.0):
https://creativecommons.org/licenses/by-sa/4.0/
The complete license accompanies this notice as LICENSE-CC-BY-SA-4.0.txt.
The unchanged upstream attribution and changes are retained in
UPSTREAM-NOTICE.md; its original file manifest is UPSTREAM-MANIFEST.json.
Vendored files were extracted from immutable Git blobs and verified against
that manifest, rather than copied through a line-ending conversion.

TGym changes: authored exercise poses and animation timing; authored gym
equipment and attachments; selected camera framing, lights and background;
applied gray anatomical materials and red working-muscle highlights; rendered
looping exercise GIFs and corresponding still PNG posters. The upstream body
mesh and vocabulary/mapping are retained unchanged in this source directory.
No Heatsy app animation, equipment model, app code, commercial head, or
GymVisual image is included in these derived anatomical illustrations.

Additional continuous surface and replacement head/neck: MakeHuman core
exported model data, CC0-1.0. The outer surface was obtained from the CC0 lane
of OpenGym3D (AssiamahS/opengym3d, published assets/walk.glb); only its bind-rest
surface is used, not its source motion or painted preview. The head/neck was
derived from makehumancommunity/makehuman core base.obj at source commit
a8bc2d54ff0ac92e78ff71431b1023eda42bf482. Original CC0 sources retain CC0.
TGym fitted/welded those surfaces to the unchanged anatomical rig, remapped
their skin weights and transferred target-model anatomical identity.

TGym also created one static four-view anatomical texture with OpenAI imagegen
from its own neutral render of the licensed anatomical model. The same texture
deforms with the native rig in every frame; generated exercise-frame sequences
are not used. This input/texture and the combined anatomical illustrations
retain CC BY-SA 4.0 as anatomical-model derivatives. Complete additional
source URLs, hashes, adaptations, exact texture prompt and asset licenses are
retained in ../assets/NOTICE.md, ../assets/source-provenance.json and the
accompanying asset files. The additional notice is also bundled in TGym's
Settings credits for offline access.

This asset license covers the body-model sources and the following TGym
derived artwork paths. Application source code retains its separate
AGPL-3.0-or-later license. Existing catalogue images retain their respective
attributions; this notice does not change their licenses.

frontend/src/assets/exercises-original/bayesian-cable-curl.gif
frontend/src/assets/exercises-original/bayesian-cable-curl-poster.png
frontend/src/assets/exercises-original/captains-chair-knee-raise.gif
frontend/src/assets/exercises-original/captains-chair-knee-raise-poster.png
frontend/src/assets/exercises-original/cross-body-lat-pull-around.gif
frontend/src/assets/exercises-original/cross-body-lat-pull-around-poster.png
frontend/src/assets/exercises-original/dead-hang.gif
frontend/src/assets/exercises-original/dead-hang-poster.png
frontend/src/assets/exercises-original/machine-hip-thrust.gif
frontend/src/assets/exercises-original/machine-hip-thrust-poster.png
frontend/src/assets/exercises-original/nordic-hold.gif
frontend/src/assets/exercises-original/nordic-hold-poster.png
frontend/src/assets/exercises-original/overhead-cable-triceps-ez-bar.gif
frontend/src/assets/exercises-original/overhead-cable-triceps-ez-bar-poster.png
frontend/src/assets/exercises-original/plate-pinch-hold.gif
frontend/src/assets/exercises-original/plate-pinch-hold-poster.png
frontend/src/assets/exercises-original/spanish-squat-hold.gif
frontend/src/assets/exercises-original/spanish-squat-hold-poster.png
frontend/src/assets/exercises-original/standing-bent-knee-calf-raise.gif
frontend/src/assets/exercises-original/standing-bent-knee-calf-raise-poster.png
frontend/src/assets/exercises-original/stepmill-continuous-walk.gif
frontend/src/assets/exercises-original/stepmill-continuous-walk-poster.png
frontend/src/assets/exercises-original/suitcase-carry.gif
frontend/src/assets/exercises-original/suitcase-carry-poster.png
frontend/src/assets/exercises-original/walking-flat-ground.gif
frontend/src/assets/exercises-original/walking-flat-ground-poster.png

The upstream creators and licensors do not endorse TGym. Licensed material
is provided as is, without warranties, as stated in the licenses.
