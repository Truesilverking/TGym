Original TGym anatomical exercise animations

The current artwork uses an original gray/black anatomical silhouette, volume
shading, targeted red muscle regions and a white background. All art, equipment,
joint paths and rendering code are authored here. No photographs, third-party
GIFs, downloaded models, traced frames or bitmap inputs are used. Primary
references in each provenance file describe the exercise mechanism only.
A catalog illustration was inspected as a style reference and is not a renderer
input or bundled asset. No script downloads media or requires private files.

The twelve production variants and separate StepMill variant were approved by
root and an independent visual reviewer before promotion. The thirteen reviewed
GIFs total 4,649,821 bytes; their thirteen posters total 453,915 bytes. Each is
512 by 512 pixels. All GIFs contain 36 decoded frames and loop indefinitely.
Holds retain their fixed joint configuration with subtle chest breathing;
walking/carry/StepMill cycles last 2.16 seconds and the others 2.88 seconds.

Reproduce with Python 3.11, Pillow 11.2.1 and NumPy 2.2.5. From the repository root:

    python -m pip install -r frontend/scripts/original-exercises/requirements-render.txt
    python -B frontend/scripts/original-exercises/generate_anatomical.py --out output/original-exercises
    python -B frontend/scripts/original-exercises/validate_anatomical.py --out output/original-exercises

Keep the Python files, provenance files and baseline rig JSON in this directory.
The output directory must differ from the source directory. Generation writes
only the requested output directory; it does not update application assets or
profiles. An optional exercise key after --out limits a preview, for example
bayesian-cable-curl. Validation expects the complete thirteen-variant output.

anatomical_style.py implements the current silhouettes, muscle patches and
materials. generate_anatomical.py renders the approved style over the existing
exercise geometry. render_custom_exercises.py and render_stepmill.py remain
unchanged historical rig sources; their direct entrypoints produce the previous
art style. Use the anatomical entrypoint for the current bundled artwork.

The baseline rig JSON files remain unchanged. Every generated record must equal
its baseline for all 36 frames. Validation additionally checks decoding, looping,
duration, fixed holds, straight dead-hang elbows, Bayesian arm lengths/range,
unilateral bent-knee calf forefoot contact, fixed hip-thrust shoulder/feet and
overground walking stance/swing constraints. Both original renderer hashes are
checked before validation completes.

The validator writes original-media-final-manifest.json with the exact asset
hashes, source hashes and checks. It also creates the twelve-variant production
overview, all-thirteen overview and loop-review.html. Each contact sheet shows
four timed poses. Segoe UI is optional for review labels, with a Pillow fallback;
GIFs and still posters contain no text or font dependency.

The application consumes only the GIFs and posters in
frontend/src/assets/exercises-original. Compare every generated GIF/poster hash
with the reviewed manifest before replacing a bundled file. No code assigns
assets to profiles or changes IDs, history, routines, food logs or settings.

Review and checks are mathematical and visual, not clinical or physical-device
exercise validation. Every future art or movement change needs contact-sheet
and loop review before integration. The older validate_originals.py is retained
for the historical renderer; validate_anatomical.py is the current pipeline.
