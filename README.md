# Taipei Traffic Accidents

Static Svelte/Vite site with a traffic accident map and protective-equipment statistics.

## Development

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

`npm run build` builds the site into `dist/` using the JSON snapshot in
`public/data/`. `npm run preview` serves the production build locally.

## Updating data

The generated JSON snapshot is checked into Git so deployment needs no raw CSVs
or external data downloads. To refresh it, put the Taipei City Police CSV files
in `raw/taipei/` (one file per ROC year, with the year in its filename), then run:

```sh
npm run build:data
npm run build
```

Commit the updated `public/data/` files alongside any relevant code changes.
`raw/` remains ignored and is never included in the deployed site.

The weekly/manual refresh workflow validates accident and fixed enforcement camera
snapshots, then opens a review PR. Merge it to deploy the refreshed data.
For a standalone camera update, run `npm run refresh:cameras`; add `-- --dry-run`
to inspect changes without replacing the snapshot. Camera popups describe current
equipment inventory, independent of the selected accident year.
See [camera source and import notes](docs/implementation/fixed-cameras.md).

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to
`main`, and can also be run manually from the Actions tab. Only `dist/` is uploaded.
