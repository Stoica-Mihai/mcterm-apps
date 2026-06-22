import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import * as tar from 'tar'
import { packAndIndex } from './pack-and-index.mjs'

test('packAndIndex packs a tarball + emits a matching index', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pai-'))
  const appsDir = path.join(root, 'apps'), outDir = path.join(root, 'out')
  const indexPath = path.join(root, 'index.json')
  fs.mkdirSync(path.join(appsDir, 'clock', 'dist'), { recursive: true })
  fs.writeFileSync(path.join(appsDir, 'clock', 'manifest.json'),
    JSON.stringify({ id: 'clock', name: 'Clock', version: '1.0.0', sdk: '^1', capabilities: [], description: 'live clock' }))
  fs.writeFileSync(path.join(appsDir, 'clock', 'dist', 'index.html'), '<div>clock</div>')

  const idx = await packAndIndex({ appsDir, outDir, indexPath, assetBase: 'https://x/dl/' })

  const e = idx.apps.clock
  assert.equal(e.version, '1.0.0')
  assert.equal(e.name, 'Clock')
  assert.equal(e.sdk, '^1')
  assert.equal(e.tarball, 'https://x/dl/clock-1.0.0.tgz')
  assert.deepEqual(e.caps, [])
  assert.match(e.sha256, /^[0-9a-f]{64}$/)

  const tgz = fs.readFileSync(path.join(outDir, 'clock-1.0.0.tgz'))
  assert.equal(crypto.createHash('sha256').update(tgz).digest('hex'), e.sha256)
  assert.deepEqual(JSON.parse(fs.readFileSync(indexPath, 'utf8')), idx)

  const ex = path.join(root, 'extract'); fs.mkdirSync(ex)
  await tar.x({ file: path.join(outDir, 'clock-1.0.0.tgz'), cwd: ex })
  assert.equal(fs.existsSync(path.join(ex, 'clock', 'manifest.json')), true)
  assert.equal(fs.existsSync(path.join(ex, 'clock', 'dist', 'index.html')), true)
})

test('packAndIndex skips an app with no dist', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pai-'))
  const appsDir = path.join(root, 'apps'), outDir = path.join(root, 'out')
  fs.mkdirSync(path.join(appsDir, 'nodist'), { recursive: true })
  fs.writeFileSync(path.join(appsDir, 'nodist', 'manifest.json'), JSON.stringify({ id: 'nodist', version: '1.0.0' }))
  const idx = await packAndIndex({ appsDir, outDir, indexPath: path.join(root, 'index.json'), assetBase: 'https://x/dl/' })
  assert.equal(idx.apps.nodist, undefined)
})
