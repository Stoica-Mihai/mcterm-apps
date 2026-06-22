# mcterm-apps

Installable apps for [mcterm](https://github.com/Stoica-Mihai/mcterm). Each app is a SolidJS
web bundle built with Vite. mcterm installs them at runtime via `app install <name>`.

## Layout

```
apps/<id>/
  manifest.json   # id, name, version, sdk, capabilities, …
  src/            # index.html + main.tsx + app.css  (built to dist/ by Vite)
```

## Develop

- `npm install`
- `npm run build`   — build every app to `apps/<id>/dist`
- `npm test`        — app unit tests + the pack/index test
- `npm run pack`    — pack tarballs to `out/` and regenerate `index.json`

## Publish

CI (`.github/workflows/publish.yml`) runs on push to `main`: builds all apps, packs
`<id>-<version>.tgz`, uploads them to the rolling `apps` release, and commits the regenerated
`index.json`. mcterm reads `index.json` from raw.githubusercontent and downloads tarballs from the
release. Bump an app's `version` in its `manifest.json` to ship an update.

## Adding an app

Create `apps/<id>/` with a `manifest.json` (include `"sdk": "^1"`) and `src/`. Reference the SDK
types via `/// <reference path="../../../sdk/mcterm.d.ts" />`. Push to `main` — CI publishes it.
