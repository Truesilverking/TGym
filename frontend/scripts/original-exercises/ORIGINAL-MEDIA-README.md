# TGym anatomical exercise media

**Status: rejected appearance; not shipped.** The user superseded the earlier
appearance approval and requires the same visual design as the existing
ExerciseDB catalogue GIFs. This candidate is not approved for application
integration or publication. Earlier approvals, candidate builds and successful
measurements are historical evidence, not current release acceptance.

The preserved authoring pipeline is [native/](native/README.md). It renders thirteen
exercise GIFs and matching still PNG posters from a continuous, skinned 3D
avatar, with authored equipment and motion. The earlier procedural silhouette
pipeline and its obsolete rig/provenance records have been retired. Historical
artwork and its evidence remain available in release tags and Git history.

The historical candidate export hashes and frozen authoring inputs are recorded in
[anatomical-media-manifest.json](anatomical-media-manifest.json).

The earlier gray/red/white appearance approval has been withdrawn. The separate
mechanical confirmation of the standing **low-rear-pulley, upright-torso overhead
extension with a short curved EZ attachment** is retained. All exercise IDs,
mapping, provenance and kinematics remain preserved; the rejected visual design
must not be substituted for the requested catalogue design.

`native/` and the original audit files are retained unchanged. Their status and
approval wording describes the earlier candidate and is superseded by this
document and the top-level manifest's rejection status.

## Sources and separate licenses

The application and authoring JavaScript retain AGPL-3.0-or-later. The anatomical
body/data and combined derived GIF/PNG artwork use **CC BY-SA 4.0**. Original
CC0 inputs retain CC0. These asset licenses do not change the application's
license or existing catalogue-image attributions.

- **Heatsy Body Model**: [pinned upstream source](https://github.com/heatsy-app/heatsy-body-model/tree/6cf6a0ae7c63bcffca1137ddcec14a31b7254a6d),
  CC BY-SA 4.0. The unchanged model supplies the 56-bone rig, native hands/feet,
  anatomical identities and source reference. DDDEV LTD adapted it from
  Z-Anatomy by Gauthier Kervyn and Marcin Zielinski, derived from BodyParts3D,
  copyright The Database Center for Life Science; original model Kousaku Okubo.
  Exact model/data bytes, full license and complete upstream notices are in
  [native/model/](native/model/NOTICE.md).
- **Continuous body surface**: the MakeHuman core export in OpenGym3D's
  [published walk asset](https://assiamahs.github.io/opengym3d/assets/walk.glb),
  identified as CC0-1.0 by its publisher's
  [manifest](https://assiamahs.github.io/opengym3d/exercises.json). Only its
  bind-rest surface is used; its walking animation, painted preview and source
  animation lanes are excluded. TGym fits/welds that surface, transfers anatomy
  and remaps weights to the unchanged anatomical rig. The published bytes are
  pinned by SHA-256; the published asset's source commit is not asserted.
- **Replacement head/neck**: MakeHuman's core `base.obj` at commit
  `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, with its
  [upstream CC0 asset license](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md).
  Source URLs/hashes and the full unchanged license are retained locally.
- **Static anatomical painting**: one original four-view texture made with
  OpenAI imagegen from TGym's own neutral render of the licensed anatomical
  model. The exact input PNG, output atlas and prompt are retained in
  `native/assets/`. That anatomical-model derivative is CC BY-SA 4.0. One
  unchanged atlas is projected in bind-rest coordinates and deforms with the
  rig; imagegen does not produce the exercise animation frames.

[native/assets/NOTICE.md](native/assets/NOTICE.md),
[source-provenance.json](native/assets/source-provenance.json) and
[pinned-inputs.json](native/assets/pinned-inputs.json) record the source roles,
licenses, adaptations and exact baked-input hashes. No GymVisual input, removed
watermark, paid animation or commercial app head is used in this replacement
set. Upstream creators do not endorse TGym. This candidate artwork contains no
logo or text; its attribution remains in the accompanying authoring notices.
Retaining those sources and notices does not mean the rejected artwork ships.

## Reproduce and inspect

These commands reproduce the historical candidate for inspection. They do not
approve its appearance or authorize reintegration into the application.

Use Node 22 or newer, FFmpeg, and Python with Pillow. The isolated native tool
pins Three.js 0.183.2 and Playwright 1.63.0; its dependencies are separate from
the application's dependency set. From the repository root:

```sh
npm --prefix frontend/scripts/original-exercises/native ci
node frontend/scripts/original-exercises/native/render.mjs --list
node frontend/scripts/original-exercises/native/render.mjs --out output/exercise-media-new-review
node frontend/scripts/original-exercises/native/verify-export.mjs output/exercise-media-new-review
```

On Windows, use `npm.cmd` if PowerShell blocks the npm shim. The browser defaults
to installed Microsoft Edge on Windows and Playwright Chromium elsewhere;
install Chromium with `npx playwright install chromium` from `native/` if needed.
`CHROMIUM_PATH`, `FFMPEG_PATH` and `PYTHON_PATH` select explicit executables.
FFmpeg otherwise comes from PATH; Python defaults to `python` on Windows and
`python3` elsewhere. See the [native tool README](native/README.md) for details.

Choose a new, nonexistent output directory for each attempt. Partial/completed
exports are immutable; rendering rejects source directories and never promotes
files into application assets. The default output is
`output/exercise-media-native/`. Append a key from `--list` to render only that
exercise; the independent complete-export verifier expects all thirteen.
Rendering uses an ephemeral loopback server and closes its browser/server when
finished. It does not read a profile, access a phone, install an APK or publish.

Each complete set contains thirteen looping **512 × 512 GIFs** and thirteen PNG
posters selected from decoded GIF frames. Each exercise records 49 world-joint
poses from `t=0` through `t=1` and encodes 48 frames. Walking, suitcase carry and
StepMill use 25 fps (1.92-second cycles); the others use 20 fps (2.40 seconds).
Holds keep their joint positions fixed. The renderer saves the 768-pixel source
frames, cycle-end sample, `motion.json` and `export-proof.json`; FFmpeg performs
the documented downsampling, palette generation and encoding.

`export-proof.json` records every renderer/input hash, dependency/browser/FFmpeg
version, output digest and error. Input hashes are checked before rendering;
source changes during a run invalidate its proof. Exact pixels also depend on
the rendering stack, so compare bytes using the same browser/GPU/driver/FFmpeg.
Pillow in the independent verifier only reads/decodes files; it does not edit
images. There is no requirement to reproduce an earlier silhouette's frame
count, pixel rig or obsolete output hashes.

## Exercise variants

Every key supplies `<key>.gif` and `<key>-poster.png`:

| Key | Demonstrated variant |
| --- | --- |
| `overhead-cable-triceps-ez-bar` | Standing upright, low rear pulley, short curved EZ attachment; fixed vertical upper arms and controlled elbow extension. |
| `cross-body-lat-pull-around` | Half-kneeling far-left-arm cross-body pull, near right knee low, fixed torso and legs. |
| `plate-pinch-hold` | Isometric plate pinch with opposed thumb/fingers. |
| `bayesian-cable-curl` | Right-arm supinated D-handle curl, low rear cable, fixed working elbow. |
| `spanish-squat-hold` | Isometric squat with taut support behind the knees. |
| `nordic-hold` | Isometric forward Nordic lean, supported knees/ankles and straight shoulder–hip–knee line. |
| `dead-hang` | Isometric overhead-bar suspension with extended elbows and feet clear. |
| `standing-bent-knee-calf-raise` | Standing unilateral left calf raise, bent supporting knee and fixed forefoot. |
| `machine-hip-thrust` | Dedicated hip-thrust machine, supported shoulders, fixed feet and moving hip restraint. |
| `captains-chair-knee-raise` | Supported forearms/back, both knees flex and rise together, feet suspended. |
| `suitcase-carry` | Unilateral left dumbbell carry with alternating level-ground gait. |
| `walking-flat-ground` | Unloaded level-ground walking with planted stance feet. |
| `stepmill-continuous-walk` | Continuous revolving stairs; stance feet follow descending treads. |

The overhead source describes
[low-pulley upright mechanics](https://www.muscleandstrength.com/exercises/standing-low-pulley-overhead-tricep-extension.html)
using a straight bar; only its mechanics are used. The user's curved EZ
attachment takes precedence. The authored 105°→12° elbow path is illustrative,
not a clinical prescription. Other primary technique sources, constraints and
authoring ranges are in
[native/mechanical-acceptance.json](native/mechanical-acceptance.json).

## Review and integration boundary

The independent verifier checks recorded finite joints, fixed bone lengths,
hold stationarity, exercise-specific support/motion, gait/tread coupling,
cycle closure, encoded dimensions/timing/loop and exact selected posters.
These raw-joint and decoded-file results do not establish visible skin contact,
all mesh collisions, clinical correctness or physical-device acceptance.
Review all encoded loops and key poses separately before integrating them.

The rejected candidate used GIF/poster pairs in
`frontend/src/assets/exercises-original/` with display-only fallback resolution.
This candidate must remain excluded from runtime integration; these files must
not be shipped.
The historical resolver preserved custom exercise IDs, duplicate identities,
routine/history references and uploaded user media without adding artwork bytes
to portable profiles. Preserve those identity and persistence boundaries in any
future solution. Historical candidate playback or mechanical checks do not
establish current design approval, a phone update, or Android/iPhone/PWA release
acceptance.
