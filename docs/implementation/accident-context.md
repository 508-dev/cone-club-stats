# Accident popup conditions

Adds recorded weather, lighting, posted road speed limits and collision type to the
fatal-accident JSON and popup. Raw codes are retained under `context` with the
applicable report-form version. Blank fields display “Not recorded”; unrecognized
values display their raw code instead of a guessed label. All distinct values from
participant rows are preserved, sorted, and displayed together. They can differ
because fields such as speed limits describe the involved parties' roads.

## Official sources

- [Form applicable before July 2023](https://www-ws.gov.taipei/001/Upload/467/relfile/32284/5040008/60d491c3-f620-4895-9915-402781651cda.pdf)
- [Form applicable from July 2023](https://www-ws.gov.taipei/001/Upload/467/relfile/32284/5040008/7ddb52e9-ebae-4834-b41a-5f41d5074279.pdf)
- [Dataset and official form links](https://data.gov.tw/dataset/130110)

Mappings use fields 4, 5, 7 and 15 of these forms. The newer form introduces weather
code 9, lighting codes 5–7 and collision codes 35–38, while still showing legacy
codes. The mapper therefore retains listed legacy meanings in the newer version.
It never interprets newly introduced codes using the older version.

The dataset's notes split forms before/after July 1, 2023; implementation selects
newer mappings for accidents dated July 1, 2023 onward. This is an explicit policy
based on event date; the raw files do not provide a per-record form version. A
provider using a different transition rule may require an adapter correction.

Speed limits are posted road limits in km/h, not measured vehicle speeds. Positive
integer values up to 200 are displayable; other values remain unrecognized. The
upper bound is a plausibility rule, not a codebook enum. Recorded categories do not
establish fault, and lighting does not establish time of day for equipment codes.

## Coverage and implementation

`src/shared/accident-context.js` is shared by ingestion validation and the popup.
`scripts/build-data.mjs` merges each accident's participant condition values and
publishes them for fatal accidents. Existing overall casualty totals, protective-
equipment figures and heatmap metrics are not changed by these added fields.

Historical absence of a column remains an empty list, rather than inferred data.
The refresh report counts blank available condition fields and unrecognized values.
Unknown condition codes produce review warnings rather than preventing publication;
other existing required-schema/category validation still applies.

The popup scrolls within a bounded height so added details remain usable on phones.
No new map filters are added in this step: heatmap JSON contains aggregate cells,
not these accident attributes, so a weather filter would require new aggregates or
an expanded accident representation.

## Verification and next work

Tests check the June 30/July 1 boundary, newly introduced codes, legacy codes under
the modern form, unknown values, speed-limit display and differing participant
values. The existing integration tests still cover complete staged refreshes.

Desktop and touch browser checks passed for popup opening, closing, filter changes
and viewport fit. The popup is keyboard-focusable for scrolling. Review caught
inherited-property strings in unknown-code lookups; numeric-only lookup and
regression tests now prevent these inputs from aborting refreshes. Recognition
status is returned separately from display wording for validation.

Next: fixed enforcement cameras (dataset 130111) as an independent map layer, then
national current-year resources. Retain the source/cadence caveats in the research
note. User handles commits and pushes.
