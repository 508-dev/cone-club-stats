# Fixed enforcement camera layer

## Scope and source

Adds a separate, initially hidden map layer for Taipei's fixed enforcement camera
inventory. Blue camera icons are visually distinct from red fatal-accident dots.
Click/tap popups show road, location, recorded function, district, direction, speed
limits and import date. Textual details remain in the provider's original Chinese;
labels are English. Direction-specific limits and embedded newlines are preserved.

Source: [Taipei fixed camera locations, dataset 130111](https://data.gov.tw/dataset/130111).
The location resource is selected by its registered description; enforcement-count
statistics in the same catalog are not treated as locations. The current official
CSV uses Big5 encoding and contains 143 records. Published updates are irregular.
The inventory includes red-light and section-speed enforcement, not just speed
cameras. These facts were checked against the live metadata/download on 2026-09-16.

Camera locations are current inventory and remain independent of the accident year
or heatmap metric. The source does not supply installation dates; do not infer that
a camera was present at an old accident, or that it caused accident reductions.
A listed equipment location does not represent an entire section-speed corridor.

## Import and update

```sh
npm run refresh:cameras             # live downloads, validate, install snapshot
npm run refresh:cameras -- --dry-run
npm test
npm run build
```

`public/data/cameras.json` combines normalized locations with source provenance:
provider, license, metadata modification time, resource URL, encoding, SHA-256 and
last successful import time. The import date stays unchanged on a no-op. A source
metadata edit alone is not proof that camera records changed.

The adapter discovers one exact location resource, accepts explicitly supported
Big5/UTF-8 encodings, validates the full CSV header, IDs, required function/road,
city code and plausible Taipei coordinates. Invalid required values fail before
replacing the published file. Missing optional values and large inventory-count
changes are reported for review. It preserves provider function/direction strings
instead of guessing categories or direction bearings.

The Monday/manual refresh workflow runs accident refresh followed by camera refresh,
then builds and opens/updates the shared review PR. Camera notes append to the
accident report. If either import fails, no data-update PR is created by that run;
the deployed site remains on its previous snapshot. The accident importer copies
through the independent camera snapshot when swapping its generated directory.
Each standalone importer can be run independently; local runs are not a single
cross-source transaction, so review local changes before committing.

For local-only tests, CSV/catalog overrides require a dry run:

```sh
npm run refresh:cameras -- --dry-run --catalog /tmp/camera-catalog.json --csv /tmp/taipei-cameras.csv
```

Original raw CSVs stay out of Git and Pages. An ignored report records each run.
The snapshot is initially about 40 KB, comfortably small for the static site.

## Interaction and verification

The toggle becomes available when its independent snapshot loads. A load failure
shows a retry-by-reload message without blocking accident data. Camera counts are
shown separately. Keyboard-focusable Leaflet camera markers support popup access.
Popup content uses Svelte text rendering, avoiding raw provider HTML interpolation.
A shared helper mounts/unmounts popup components on close/removal for both layers.

Tests cover inventory discovery, encoding, directional limits, optional missing
fields, no-op import time, changed records, invalid CSV/coordinates, duplicate IDs,
dry-run success/failure preservation, and retaining cameras during accident builds.
The synthetic Big5 fixture contains no actual government camera records.

The provider's backslash speed-limit sentinel is normalized to missing; its raw
value is retained as `speedLimitRaw`. The popup displays “Not recorded” and import
reports include these records among missing optional details. Direction-specific
numeric text remains unchanged.

Desktop, keyboard and touch browser checks passed for opening/closing popups,
toggle cycling, independence from accident year, viewport fit, and unavailable
camera data. Standards review found no violations. Spec review found the sentinel
issue above; normalization and the Big5 regression fixture now cover it.

User handles commits/pushes. This workflow change must reach `main` before the
weekly schedule includes cameras. Nationwide accident sources remain the next
investigation stage; no national records are merged by this change.
