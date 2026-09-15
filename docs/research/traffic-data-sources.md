# Traffic data sources and expansion options

Research date: 2026-09-15. Scope: practical official sources for the Taipei accident site. Dataset metadata was checked; download contents were not exhaustively audited. Suggested uses and cautions below are engineering/analytical recommendations, not promises from publishers.

## Recommended order

First maintain the existing Taipei accident series and expose more fields already present in its raw files. Then add fixed enforcement cameras as a small map layer. Investigate national accident files if fresher coverage or expansion beyond Taipei is needed. Traffic volumes are valuable but require more work to match locations and periods correctly.

## Curated shortlist

| Source | Coverage and useful content | Published format and cadence | Fit and cautions |
| --- | --- | --- | --- |
| [Taipei injury/fatal accident details — 臺北市死傷交通事故資料, 130110](https://data.gov.tw/dataset/130110) | Taipei; resource list currently includes ROC 101–114 (2012–2025). Dates, locations, casualties, road users, weather, speed limits and road conditions; notes reference X/Y coordinates. | CSV files per year; annual. | Best core source. The page links separate accident codebooks for before/after **2023-07-01**. Treat participant records separately from accident counts; inspect schemas and coordinate meaning per year. |
| [National 2025 injury/fatal accidents — 114年傷亡道路交通事故資料, 177136](https://data.gov.tw/dataset/177136) | Police agency A1/A2 detailed records for 2025, with coordinates, participant details, road conditions and recorded contributing factors. The page links other annual datasets. | ZIP download; irregular updates, despite annual coverage. | Candidate for nationwide expansion. Inspect archive contents and completeness before import. Do not append Taipei rows to overlapping national rows and count both. |
| [Current A1 accidents, 12818](https://data.gov.tw/dataset/12818) and [current A2 accidents, 13139](https://data.gov.tw/dataset/13139) | Police agency feeds with coordinates and detailed accident/participant fields. The A2 page currently lists monthly ZIP resources named for Jan–Aug 2026; the A1 page does not establish its actual coverage period. | A1: CSV. A2: monthly ZIP resources. Both current Chinese metadata pages say **irregular updates**. | Candidate for filling the gap after annual releases. “即時” in the title should not be presented as a live incident feed. Determine actual max date and missing months from files. Older search/English metadata may describe different formats or cadence. |
| [Taipei fixed enforcement cameras — 臺北市固定測速照相地點表, 130111](https://data.gov.tw/dataset/130111) | Existing camera locations, coordinates, function, direction, district and posted speed limit; another resource covers section-speed enforcement counts. | CSV; irregular updates. | Straightforward contextual map layer. Current locations do not establish installation dates or prove how enforcement affected historical crashes. |
| [Taipei traffic flow and characteristics survey, 128230](https://data.gov.tw/en/datasets/128230), [Taipei publisher page](https://data.taipei/dataset/detail?id=68767aa4-6703-4760-8a0e-74c641d66b90) | Taipei traffic survey material. Catalog fields are item, city, URL and description. | Annual. The listed CSV is only **374 bytes**: an index/link resource, not the traffic measurements themselves. | Potential historical traffic-volume context. Follow the linked survey publications and audit years, sites, directions, vehicle categories and survey periods before promising normalized crash rates. Download endpoint could not be inspected through the browser during this research. |
| [Taipei vehicle detector observations](https://data.taipei/dataset/detail?id=e57afe7f-3c9e-4f31-9208-eed859a92600) with [static detector metadata, 135705](https://data.gov.tw/dataset/135705) | Road information collected by Taipei vehicle detectors; static equipment data follows the transport ministry v2.0 standard. | XML feed plus tiny CSV index. Catalog says irregular; the observations page explicitly defers actual field definitions and update frequency to the underlying file. | Useful investigation for traffic-volume/speed context. Confirm live endpoint, equipment coverage, collection intervals and historical availability. Current observations alone cannot supply traffic exposure for past accident years. |

## Definitions that affect comparisons

- A1 means an accident causing death at the scene or within 24 hours. A2 includes injuries **or deaths after 24 hours**. Consequently A2 does not mean “no deaths.” Preserve the classification and do not relabel A1 figures as all traffic deaths. [Police dataset definitions](https://data.gov.tw/dataset/177136)
- Taipei also publishes an aggregate series explicitly using **30-day** casualties. This is a different measurement basis from an A1-only map and can be useful as a separately labelled trend check. [Taipei road accident time series](https://data.taipei/dataset/detail?id=52916103-adad-4522-a757-38dc04c9b59f)
- Crash counts show where recorded crashes happened. Calling a road “riskier per trip” requires comparable traffic exposure for the same place, period and road users. This is an analytical constraint; the source list does not establish that a valid denominator is available everywhere.

## Discovery lessons

Search the Chinese dataset names and follow the publishing agency's linked resources. Treat data.gov.tw as a catalog: a CSV badge may identify an index of download URLs, and an “API” label need not mean queryable accident records. The survey and detector datasets above demonstrate this directly.

Record the dataset ID, publisher, license, resource links, actual file coverage, and last successful import separately. A catalog metadata update time does not prove a new month of observations was released. The shortlisted national catalog entries identify the Open Government Data License v1.0; retain attribution and confirm the chosen resource's terms during integration.

Do not choose the apparently convenient [county/city realtime VD dataset 166031](https://data.gov.tw/dataset/166031) as a fresh dependency: its page explicitly says it has been withdrawn and retained only as historical metadata.

## Proposed ingestion and update design for this repository

This section is a recommendation based on the local code inspected on 2026-09-15; it is not implemented automation.

### Start with fields already downloaded

The local `raw/taipei/taipei_109.csv` and `taipei_114.csv` headers contain weather (`天候`), lighting (`光線`), posted speed limit (`速限-速度限制`), road form (`道路型態`), signals (`號誌1`, `號誌2`), collision type (`事故類型及型態`), and a recorded contributing-factor code (`肇因碼-個別`). The current `scripts/build-data.mjs` does not publish these. Adding selected fields is a smaller first step than joining a new source. Map their codes using the applicable official codebook before displaying labels. Posted speed limit does not establish a vehicle's actual speed, and police-recorded factors should be labelled as such.

Local header counts change from 18 to 20 to 50 to 49 to 47 across the annual files. ROC 111 uses `安全帽` where surrounding years use `保護裝置`. A shared file format therefore does not imply a shared meaning.

### A small catalog and one adapter per source

Keep a reviewed source registry with dataset ID, original Chinese title, English label, provider, landing page, resource IDs/URLs, geographic scope, coverage period, row meaning, expected cadence, license, coordinate system, adapter version, and codebook version.

Use data.gov.tw for discovery and resource metadata; retrieve the actual resources from the provider. The catalog's metadata specification distinguishes download URLs, formats, encodings, expected update frequency, coverage dates, and metadata modification time. A metadata edit is not proof that the underlying records were refreshed. [Official metadata specification](https://data.gov.tw/about/doc?chapter=11&doc=4)

Pipeline:

1. Discover added/replaced resources from the registered dataset.
2. Download with timeouts/retries; record a content hash and retrieval time. Check file content, not merely its URL extension: a download can return an HTML error page.
3. Decode and parse in a source-specific adapter (CSV, spreadsheet, JSON, XML, or files inside ZIP).
4. Normalize dates, coordinate systems, nulls, units, and documented category codes.
5. Validate and publish compact JSON using the existing site build.

Use separate internal models for accidents, involved people/vehicles, camera locations, and traffic observations. Do not force every dataset into a single wide table. An accident can have multiple party rows; casualty totals repeated on those rows must not be added repeatedly. Preserve source identifiers and raw codes so derived values are traceable. If an agency supplies no stable accident ID, document and test any composite grouping key rather than treating it as certain identity.

Keep source snapshots outside the deployed site. The current small generated JSON snapshot can remain in Git. For a substantially larger national archive, use durable object storage or versioned release assets for original downloads; a temporary CI cache should not be the sole reproducibility archive. Stream or partition large inputs instead of loading all national party records into memory.

### Suggested refresh workflow

Start with a weekly scheduled GitHub Action that checks registered sources. Weekly is a proposed polling schedule, not a promise that providers publish weekly. Detect changed content and new resources, including new annual dataset IDs where the publisher creates a separate catalog entry each year. Recheck recent past periods for corrections instead of only appending new months.

On a change:

- Fetch into a staging location and run the adapter.
- Verify required columns, supported codes, valid dates, plausible coordinate bounds, complete resource downloads, duplicates, and coverage.
- Compare record counts, fatalities, missing-coordinate rate, and per-period totals with the previous snapshot. Flag large deviations for inspection; a statistical change is not automatically an error.
- Build deterministically (stable sorting; avoid changing data files just because the job ran).
- Initially open/update a review PR with a concise before/after report; merge to use the existing Pages deployment. This is a recommended rollout choice, not a permission requirement.
- Retain the last successful published snapshot if download or validation fails. Make the failure visible in Actions and the source status metadata.

Fully automatic publication can follow once adapters and validation have demonstrated stability. In that variant, explicitly build/deploy in the update workflow or dispatch the deployment workflow: a push made with the default `GITHUB_TOKEN` does not itself trigger a push-based deployment. [GitHub workflow triggering documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

### Show freshness honestly

Maintain per-source `coverageStart`, `coverageEnd`, `lastCheckedAt`, `lastChangedAt`, `lastSuccessfulImportAt`, hashes, and validation status. The current `meta.generatedAt` records when this site's files were rebuilt, not when the government updated its records.

A useful UI distinguishes “Data covers …”, “Source checked …”, and “Site built …”. Mark incomplete years and avoid interpreting a partial current year as a fall in accidents. Annual historical data cannot become current simply by polling daily.

TDX can be evaluated for future transport observations. Its official examples describe client-ID/client-secret authentication and plan-dependent API limits; perform authenticated ingestion in Actions with secrets, then publish suitable aggregates, rather than exposing credentials in a static browser app. [Official TDX examples](https://github.com/tdxmotc/SampleCode)

### Practical sequence

1. Register and automate checks for the existing Taipei annual accident source.
2. Add weather, lighting, speed-limit and collision-type fields using date-appropriate codebooks; preserve unknown values and coverage gaps.
3. Add the fixed-camera layer as a separate contextual dataset.
4. Evaluate national current-year sources for wider geography or fresher provisional coverage, keeping their definitions and overlap with Taipei explicit.
5. Investigate matched traffic exposure when the product needs risk rates rather than crash counts. Traffic volume needs compatible location, time, and road-user coverage; current detector data is not automatically a valid denominator for ten years of crashes.

An assistant can help shortlist sources, translate descriptions, inspect sample rows, and propose mappings. Keep those mappings explicit and tested in code; do not let unattended imports guess the meaning of a newly appearing category.
