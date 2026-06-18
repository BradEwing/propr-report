# Prop R site

Astro 5 static site for the Santa Monica Proposition R dataset: a charts page (the
cumulative achievements time series) and a map page (multifamily developments by
address). Ships no JavaScript by default; the map is a single client island.

Deploys to GitHub Pages under the `/propr-report` base path, so every asset and data
URL must go through the `dataUrl()` helper in `src/lib/dataUrl.ts` (root-relative URLs
404 on Pages).

## Commands

```bash
npm install        # install dependencies
npm run dev        # local dev server
npm run build-data # regenerate public/data/*.json from ../data/curated/
npm run check      # astro check (type-checks .astro and TS)
npm run build      # prebuild runs build-data, then astro build -> dist/
npm run preview    # preview the production build
```

## Generated data

`public/data/` is **generated** by `npm run build-data` (a `tsx` script in
`scripts/build-data.ts`) and is **git-ignored**. It runs automatically before every
build via the `prebuild` hook. Inputs are the committed curated CSVs in
`../data/curated/`.

Current outputs:

- `public/data/cumulative.json` — the cumulative Prop R achievements time series.
- `public/data/developments.json` — address-level developments (empty until the
  curated `developments.csv` exists; a later step merges parcel geometry).
