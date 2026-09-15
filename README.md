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

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to
`main`, and can also be run manually from the Actions tab. Only `dist/` is uploaded.
In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
For a private organization repository, GitHub Pages requires GitHub Team or
Enterprise; the published site is normally public.

Expected URL: https://508-dev.github.io/cone-club-stats/

The workflow reads the base path from GitHub Pages. To check that path locally:

```sh
BASE_PATH=/cone-club-stats/ npm run build
BASE_PATH=/cone-club-stats/ npm run preview
```

Open `http://localhost:4173/cone-club-stats/` and
`http://localhost:4173/cone-club-stats/seatbelt.html`.

The current JSON snapshot is about 7.5 MB; its largest file is about 2.6 MB.
GitHub Pages allows a published site of up to 1 GB and has a soft bandwidth limit
of 100 GB/month. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
