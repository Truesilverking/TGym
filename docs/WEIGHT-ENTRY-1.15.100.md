# Shared weight entry

Version 1.15.100 extends the body-weight ruler introduced in 1.15.99 to exercise loads and the other existing weight editors. It reuses the same inertial motion, manual decimal entry, theme, accessibility and reduced-motion behavior.

## Entry points

- Workout working sets, warmups, timed holds, added bodyweight loads and drop-set loads.
- Routine prescriptions, added loads and weight progression increments.
- Exercise goals, the estimated 1RM calculator and confirmation of the working weight.
- Historical workout load edits, behind their existing Save changes confirmation.
- Body-weight targets and optional InBody mass fields. Ordinary body-weight recording retains its existing flow.

The scale action beside a compact weight field opens the large ruler. Inline entry and increment controls remain available. Narrow containers give the number its own row. Durations, speeds, reps, effort, percentages, height and circumference keep their appropriate controls.

## Data flow

`BodyWeightPicker` accepts bounds, display precision and a loading increment without converting units. Its existing body-weight defaults remain unchanged. Manual values retain their precision, including an unchanged imported value with more decimals than the display. Ruler movement follows the caller's increment; the rail moves continuously while its readout and accessible value follow that increment.

`WeightField` owns an isolated editor draft. Moving the ruler does not call the persisted field setter. Done reads the visible value and invokes the caller once; Cancel, back and dismissal discard the draft. Optional fields have an explicit Clear action. Failed setters keep the draft available for retry. Changed values, units, bounds or field context invalidate an open editor.

Workout loads stay in the profile unit and use the existing field, cascade, warmup and top/back-off helpers. A semantic workout-row context protects against a removed or reordered row while allowing harmless clock/rest updates. Zero remains valid for exercise loads. The body-weight ceiling is not imposed on exercise loads. InBody values remain report kilograms and retain their existing optional-field and validation rules.

No storage keys, package identifiers, exercise/routine IDs, history schemas, backup formats, workout clock rules or progression calculations change.

## Verification boundaries

Targeted tests cover precise kg/lb entry, zero and large loads, local drafts, cancellation, retry, stale fields, loading cascades, drop separation, harmless timer updates, history confirmation, optional InBody kilograms and invalid-report input. Full-suite, compiled-browser and publication evidence is recorded separately in the release audit. Browser checks use synthetic local profiles; they do not establish installation on a physical phone or iPhone PWA acceptance.

## Synthetic screenshots

These captures use fictitious local profiles and the final compiled UI.

- [Exercise weight ruler, mobile](assets/weight-entry-1.15.100/exercise-weight-mobile.png)
- [Added and drop loads, Spanish mobile](assets/weight-entry-1.15.100/drop-load-mobile-es.png)
- [Routine weight increment, desktop](assets/weight-entry-1.15.100/routine-weight-desktop.png)
