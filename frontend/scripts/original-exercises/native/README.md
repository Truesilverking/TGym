# Anatomical exercise artwork authoring

This tool renders TGym's thirteen custom-exercise GIFs and PNG posters from a
real, skinned anatomical body. The rig, native hands/feet and muscle identity
come from the pinned Heatsy Body Model. A fitted continuous MakeHuman CC0
surface and replacement head share the same 56 bones. TGym authors the poses,
equipment, attachments, camera/light choices and gray/red anatomical painting.
One static four-view surface atlas, made with imagegen from TGym's own licensed
neutral model render, stays fixed in bind-rest space and deforms with the rig.
It uses no GymVisual preview, removed watermark, paid animation or generated
exercise-frame sequence. Attribution accompanies the artwork in
`model/NOTICE.md` and `assets/NOTICE.md`; the source PNG and exact prompt remain
in `assets/` with pinned geometry/head/source metadata.

The JavaScript authoring source follows the application's
[AGPL-3.0-or-later license](../../../../LICENSE). The upstream body/data and
derived anatomical GIF/PNG artwork retain **CC BY-SA 4.0**, with the complete
license and upstream notices in `model/`. These are separate licenses.

## Run

Use Node 22 or newer, FFmpeg and Python with Pillow. Install the isolated tool
dependencies here; this package does not add dependencies to the application.

```sh
npm ci
node render.mjs --list
node render.mjs --out /absolute/path/to/a-new-export
node verify-export.mjs /absolute/path/to/a-new-export > verification.json
```

On Windows the default browser is installed Microsoft Edge. Elsewhere the
default is Playwright Chromium; install it with `npx playwright install chromium`
if necessary. `CHROMIUM_PATH` selects a specific browser executable.
`FFMPEG_PATH` selects an FFmpeg executable; otherwise `ffmpeg` must be on PATH.
`PYTHON_PATH` selects Python for verification; the default is `python` on
Windows and `python3` elsewhere. Pillow only decodes and inspects artwork in
the independent verifier; it does not alter images.

Without `--out`, output goes to the repository's
`output/exercise-media-native/`, outside this authoring directory. Every run
requires a **new, nonexistent directory**. Partial and completed exports are
preserved; choose another directory to retry. Application source and authoring
source cannot be output destinations. Passing exercise IDs after the options
renders only those IDs; the complete acceptance verifier requires all thirteen.

```sh
node render.mjs --out /absolute/path/to/a-new-overhead-check overhead-cable-triceps-ez-bar
```

The renderer binds an ephemeral server only to `127.0.0.1` and serves its own
allowlisted modules/model plus the local pinned Three.js package. It closes
the browser and server when finished. It never reads a TGym profile, accesses
a phone, installs an APK, publishes a release or promotes files into the app.

## Source and output

- `scene.mjs` / `index.html`: white scene, orthographic cameras and shadows;
  initializes the avatar once and performs one draw per pose.
- `avatar.mjs`, `body-envelope.mjs`, `head.mjs`, `projected-surface.mjs`:
  continuous skinned avatar, fitted CC0 head and static four-view anatomical
  painting. Red anatomical masks are smoothed on welded surface adjacency
  and cached per exercise; the original anatomical labels remain intact.
- `rig.mjs`: fixed-length skeletal aiming, two-link IK and world joints.
- `hands.mjs`: anatomical finger flexion/opposition and actual grip centers;
  its wrapper supplies grip landmarks to the rig's body-joint records.
- `equipment.mjs`: authored machines, fixed supports, attachments and moving
  cable/lever/tread parts. The captain's-chair boarding pads sit outboard of
  the suspended foot trajectory.
- `poses-upper.mjs` / `poses-main.mjs`: authored exercise motion and holds.
- `model/`: immutable upstream geometry and data, source hashes and notices.
- `assets/`: required baked envelope/head geometry, static texture and input
  PNG, exact texture prompt, primary-source license/provenance and input pins.
  No raw 5.95 MB source walk animation or full MakeHuman OBJ is needed at run
  time; original source URLs/hashes remain available for auditing/adaptation.
- `mechanical-acceptance.json`: technique sources, variant constraints and
  illustrative authoring ranges; these ranges are not clinical prescriptions.
- `verify-export.mjs`: independent checks of recorded world joints and decoded
  GIF/PNG files, without importing the renderer or reconstructing its poses.

Each exercise exports 48 square 768-pixel PNG samples, a separate cycle-end
sample, recorded world joints/equipment metadata, a looping **512 × 512 GIF**
and a PNG poster decoded from its selected GIF frame. Locomotion uses 25 fps;
other exercises use 20 fps. Encoding uses Lanczos downsampling, a 192-color
palette and Bayer dithering at scale 4. Isometric holds retain fixed joints.

`export-proof.json` records input/source hashes, dependency/browser/FFmpeg
versions, output hashes and errors. Upstream model/data and baked avatar input
hashes are verified before rendering. All shaders, code, JSON/bin geometry,
source/input/texture PNGs, prompt and asset notices are hashed; renderer or
asset source changes during a run make its proof fail. The pinned dependencies
are Three.js **0.183.2** and
Playwright **1.63.0**. Use the same browser, GPU/driver and FFmpeg build when
comparing exact output bytes; another rendering stack may produce different
pixels despite the same pose data.

## Review boundary

A successful render or verifier is not visual approval. Review the encoded
loops and key poses for the exact exercise/equipment, grip, fixed supports,
cable clearance, skin deformation, feet, framing and seam before promotion.
The independent verifier checks skeleton landmarks, file integrity,
dimensions, timing, loop and selected posters. It does not certify all mesh
collisions, clinical technique, a user's individual range, physical-device
playback or Android/iPhone acceptance. Keep those results separate.

The user approved the anatomical appearance and confirmed an upright standing
overhead extension with a low rear cable pulley and short curved EZ attachment.
The source is frozen for final encoded-output review. This tool does not
promote its output into the application; exports still require the visual,
mechanical and playback reviews described above.
