// Build every framework app (apps/<id>/src) to apps/<id>/dist with Vite+Solid.
// --watch rebuilds on change (reload the app frame in mcterm to pick it up).
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const watch = process.argv.includes('--watch')
const appsDir = resolve(import.meta.dirname, '..', 'apps')

for (const id of readdirSync(appsDir)) {
  const root = resolve(appsDir, id, 'src')
  if (!existsSync(root)) continue
  console.log(`building app: ${id}${watch ? ' (watch)' : ''}`)
  await build({
    root,
    base: './',
    plugins: [solid()],
    logLevel: 'warn',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      watch: watch ? {} : null,
    },
  })
}
