Original TGym exercise animation candidates

The art, equipment, joint paths and rendering code are original. No photographs,
third-party GIFs, downloaded models, traced frames or generated bitmap inputs are
used. Primary references in each provenance JSON document the exercise pattern,
not permission to redistribute third-party media. Asset names and renderer inputs
contain no profile, exercise IDs or user names.

Reproduce with Python 3 and Pillow (copy the three scripts into an empty temporary
directory first, then run these commands there):

    python render_stepmill.py
    python render_custom_exercises.py
    python validate_originals.py

Keep these three scripts in one directory. They write files beside themselves.
The application consumes only the GIFs and posters in
`src/assets/exercises-original/`; the reviewed hashes are recorded here in
`original-media-final-manifest.json`. Compare generated hashes before replacing
any bundled asset. Provenance and rig-check JSON files are retained beside these
scripts; no private profile is required to reproduce them.
The optional Segoe UI font is used only for review contact-sheet labels; a built-in
Pillow font is used elsewhere when Segoe UI is unavailable. Exercise GIFs contain
no text or font dependency. All GIFs and posters are 512 by 512 pixels on white.

`production-originals-overview.png` is the 2048 by 1536 review grid for the twelve
production variants. Each `*-contact-sheet.png` shows six frames over one cycle.
`original-media-final-manifest.json` records all thirteen variants including the
separate StepMill candidate, byte sizes, hashes, decoding and geometry checks.

Each loop is authored at 36 frames. Pillow combines identical isometric frames
while preserving the complete 2.88-second breathing cycle. Walking/carry/StepMill
cycles are 2.16 seconds. The four holds retain their joint configuration and show
only small chest expansion. A hold is never depicted as repeated squats, curls,
pull-ups, or repeated Nordic descents.

Validation covers GIF decoding/loop/duration, PNG dimensions, fixed isometric
joint configuration, straight dead-hang elbows, bounded Bayesian elbow angles,
fixed-length arms, unilateral calf forefoot contact with constant knee flexion,
fixed hip-thrust shoulder/feet, and tracked overground-walking stance/swing soles.
This is mathematical and visual review, not clinical or physical-device exercise
validation. Root and an independent reviewer must inspect the loops and matching
variant metadata before integration. No script assigns assets to profiles or
changes IDs, history, routines, food logs, settings or production data.
