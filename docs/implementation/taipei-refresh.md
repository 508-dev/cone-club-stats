# Taipei automatic refresh — implementation and handoff

## Approved scope

The user accepted this sequence: automate the existing Taipei source, expose its
unused fields, add fixed cameras, then investigate current national accident data.
This change implements **stage 1 only**. The design/source inventory is in
[the research note](../research/traffic-data-sources.md).

Acceptance criteria for stage 1:

- Discover annual resources from official dataset 130110, including added years.
- Download and validate all resources in staging before replacing generated data.
- Reject missing years, malformed downloads, unexpected columns/codes and invalid
  dates/counts. Report missing values, unusable coordinates, duplicate party keys
  and material summary changes without silently inventing corrected values.
- Preserve current casualty aggregation; exclude impossible coordinates from maps.
- Record source provenance, hashes, actual date coverage and import time.
- Leave published files untouched on validation failure and on a no-op refresh.
- Weekly/manual Actions job opens or updates a review PR; no automatic merge.
- Build and test before proposing the data PR. New years appear in the map filter.

## Running it

```sh
npm test
npm run refresh:data -- --dry-run  # live downloads, validation and build, no replacement
npm run refresh:data              # same checks, then replace local public/data/
npm run build
```

A full run currently downloads roughly 511 MiB. It rechecks every annual resource
so historical corrections are detected; there is no persistent raw-data cache yet.
Timeouts/retries protect downloads. Raw files and build output are staged in an
ignored temporary directory on the same filesystem, cleaned when the process exits
normally. Only after validation/build/reporting succeed is the data directory
swapped, with rollback if installing the new directory fails. This is not a
concurrent local server transaction: do not run two local refreshes simultaneously.
The GitHub workflow serializes its own runs.

For offline verification of existing downloads, first save a real catalog response
locally, then use both overrides with `--dry-run`:

```sh
npm run refresh:data -- --dry-run --catalog /tmp/taipei-catalog.json --raw-dir raw/taipei
```

The overrides cannot publish. A local snapshot is not evidence of a new government
download. The default report is `.data-refresh-report.md` (ignored); CI puts it in
its temporary directory and also writes the Actions job summary.

## Operation and review

`.github/workflows/refresh-data.yml` runs Mondays at 06:23 Taiwan time and supports
manual dispatch. It opens/updates `automation/taipei-data` against `main`, containing
only `public/data/`. The PR body contains coverage, before/after annual totals and
quality warnings. Merge after inspecting the changes; the existing Pages workflow
then deploys. Enable “Allow GitHub Actions to create and approve pull requests” in
repository Actions settings if it is disabled. No token beyond `GITHUB_TOKEN` is
required. This workflow itself must first reach `main` to become scheduled.

A successful no-change check appears in Actions rather than creating a timestamp-
only PR. `public/data/source.json` describes the last imported source snapshot;
`lastSuccessfulImportAt` is not a claim of daily or weekly source publication.
`meta.generatedAt` changes only when the published snapshot changes through this
refresh command. The older manual `build:data` command still regenerates its time.

## Source assumptions and limitations

- Schema versions and observed category codes are explicit in
  `scripts/data/taipei-source.json`. A future year initially uses the latest known
  schema. Any changed columns or newly seen codes stop the job for adapter review.
  Reused codes with changed meanings cannot be detected from file structure alone;
  inspect new codebooks before adopting new fields.
- The registry includes legacy observed codes `車種=33` and `飲酒情形=111` to avoid
  silently rewriting existing records. They are observed exceptions, not validated
  codebook interpretations. The current coarse mappings remain unchanged.
- Blank casualty fields contribute no recorded count under the existing aggregator;
  the report exposes them rather than claiming they mean zero casualties.
- Invalid coordinates are excluded as a pair, without guessing whether longitude
  and latitude were swapped. Plausible world coordinates outside the Taipei bounding
  box are retained and reported for review.
- Repeated composite accident/party keys are counted as warnings, not automatically
  deleted: there is no verified universal source accident ID.
- The 10% and 5-count summary threshold and 5-percentage-point missing-coordinate
  threshold are review flags, not statistical proof of an upstream error.
- Raw snapshots are not archived durably yet. Hashes identify exact content but do
  not allow reconstructing an old download if the government overwrites it.
- Both pages display source-record coverage and successful import date, with links
  to the government source and the latest Actions check. Workflow failures appear
  in Actions and retain the previous site data.

## Next stages

1. Coverage/import information is now displayed on both pages. A future enhancement
   could show per-source validation status directly on the site.
2. Decode existing weather, lighting, posted-speed-limit and collision-type fields
   using the correct codebook before/after 2023-07-01. Preserve unknowns and missing
   historical coverage. Add popup details/filters with tests for codebook boundaries.
3. Add dataset 130111 as a separate camera layer. Do not imply installation dates or
   causal effectiveness from a present-day camera inventory.
4. Audit national A1/A2 resources for current-year coverage, overlap and definitions
   before merging their records with the Taipei history.

## Validation log

- Full offline 2012–2025 source validation and staged build passed.
- Seven tests cover discovery, validation, quality reporting, summary changes and a
  complete dry run with no-op/failure preservation.
- Production Vite build passed, with map years derived from coverage metadata.
- Full live refresh passed; repeat offline verification reported a no-op before
  the expanded missing-field counters were introduced.
- First GitHub Actions refresh completed successfully:
  https://github.com/508-dev/cone-club-stats/actions/runs/34947564645
- Final review found filename compatibility, coordinate-free-year layers, and
  missing-field reporting gaps. Fixes and regression tests are prepared locally.
- Government filenames with exactly one three-digit ROC year remain supported;
  unexpected or duplicate annual files fail rather than being silently ignored.
- Years without usable coordinates publish empty yearly grids. Missing district,
  location, party sequence, time and category fields are included in review notes.
- User handles commits and pushes. These review fixes and coverage UI changes have
  not been committed by the assistant.
