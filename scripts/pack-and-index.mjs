// Pack each built app (apps/<id>/dist + manifest) into out/<id>-<version>.tgz and
// emit index.json for the mcterm app registry. Pure node + tar.
import { readdirSync, readFileSync, existsSync, mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs'
import { resolve, join } from 'node:path'
import crypto from 'node:crypto'
import * as tar from 'tar'

const ROOT = resolve(import.meta.dirname, '..')
const ASSET_BASE = 'https://github.com/Stoica-Mihai/mcterm-apps/releases/download/apps/'

export async function packAndIndex({
  appsDir = join(ROOT, 'apps'),
  outDir = join(ROOT, 'out'),
  indexPath = join(ROOT, 'index.json'),
  assetBase = ASSET_BASE,
} = {}) {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const apps = {}
  for (const id of readdirSync(appsDir).sort()) {
    const appDir = join(appsDir, id)
    const manifestPath = join(appDir, 'manifest.json')
    const distDir = join(appDir, 'dist')
    if (!existsSync(manifestPath) || !existsSync(distDir)) {
      console.warn(`skip ${id}: missing manifest or dist`)
      continue
    }
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const version = m.version || '0.0.0'
    const stage = join(outDir, `.stage-${id}`)
    rmSync(stage, { recursive: true, force: true })
    mkdirSync(join(stage, id), { recursive: true })
    cpSync(manifestPath, join(stage, id, 'manifest.json'))
    cpSync(distDir, join(stage, id, 'dist'), { recursive: true })
    const tgz = join(outDir, `${id}-${version}.tgz`)
    // portable: strip mtime/uid/gid so the tarball + its sha256 are reproducible across builds
    await tar.c({ gzip: true, portable: true, file: tgz, cwd: stage }, [id])
    rmSync(stage, { recursive: true, force: true })
    const sha256 = crypto.createHash('sha256').update(readFileSync(tgz)).digest('hex')
    apps[id] = {
      version,
      sdk: m.sdk || '^1',
      tarball: `${assetBase}${id}-${version}.tgz`,
      sha256,
      caps: m.capabilities || [],
      description: m.description || '',
    }
  }
  const index = { apps }
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n')
  return index
}

if (import.meta.url === `file://${process.argv[1]}`) {
  packAndIndex().then((idx) => console.log(`indexed ${Object.keys(idx.apps).length} apps`))
}
