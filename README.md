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
`<id>-<version>.tgz`, and uploads them **plus the regenerated `index.json`** as assets on a new
versioned release `apps-v<run>` marked `--latest`. Old releases are kept (full history); CI never
commits back to `main` (so the branch never diverges). mcterm reads everything via
`releases/latest/download/…`, which always resolves to the newest release. Bump an app's `version`
in its `manifest.json` to ship an update.

## Adding an app

Create `apps/<id>/` with a `manifest.json` (include `"sdk": "^1"`) and `src/`. Reference the SDK
types via `/// <reference path="../../../sdk/mcterm.d.ts" />`. Push to `main` — CI publishes it.
