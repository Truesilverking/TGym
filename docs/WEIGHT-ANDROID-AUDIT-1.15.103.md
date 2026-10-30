# Weight presentation and pending update - 1.15.103 / Android 139

This candidate includes pending `Dev` correction `b8720be` and the Android weight-control fix. The Iron theme's legacy three-column stepper rules no longer override the shared weight field's value, increment buttons and ruler action.

Weight readouts use whole kg/lb across training, body measurements, goals, charts, history, calculators and visual exports. Focusing an editable value exposes its original precision. Calculations, saved records, JSON backups and editable Excel exchanges retain their precise numbers; opening, cancelling or confirming an unchanged editor does not round stored data.

The review also fixed secondary-pointer release cancelling an active ruler drag, legacy `start:null/0` excluding dated workouts from plateau/volume calculations, and repeated or absent chart-axis labels for sub-unit weight ranges.

Local verification on 2026-10-30: frontend 2,729 tests in 242 files, API 16, MCP 38, catalogue 6, Node-loadability, locale/source-string/version checks and fatigue probes pass. The integrated source was reviewed independently. Earlier incomplete test runs are retained privately; the final frontend run passes without failures.

Compiled Android, Pixel QA, mobile WebKit, offline/update and exact-source CI results will be recorded before publication. Safari/WebKit automation is not physical iPhone acceptance or a native iOS build. No finite audit guarantees that every possible error has been eliminated.

Private phone snapshots, profiles and local test tooling stay outside Git. Production phone data and protected `main` are separate from the isolated QA installation and `Dev` release workflow.
