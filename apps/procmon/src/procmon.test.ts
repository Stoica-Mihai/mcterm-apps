import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProcList, visibleProcs } from './proc'

const PS = [
  '    PID %CPU %MEM COMMAND',
  '   1234 12.5  3.2 firefox',
  '      1  0.0  0.1 systemd',
  '   5678  0.0  0.0 my prog with spaces',
].join('\n')

test('parseProcList: skips header, parses rows incl spaced command', () => {
  const r = parseProcList(PS)
  assert.equal(r.length, 3)
  assert.deepEqual(r[0], { pid: 1234, cpu: 12.5, mem: 3.2, cmd: 'firefox' })
  assert.equal(r[2].cmd, 'my prog with spaces')
})

test('visibleProcs: empty filter → top N; filter → all case-insensitive matches', () => {
  const all = parseProcList(PS)
  assert.deepEqual(visibleProcs(all, '', 2).map(p => p.pid), [1234, 1])      // top 2
  assert.deepEqual(visibleProcs(all, 'fire', 2).map(p => p.pid), [1234])      // match, uncapped by N
  assert.deepEqual(visibleProcs(all, 'PROG', 2).map(p => p.pid), [5678])      // case-insensitive
  assert.deepEqual(visibleProcs(all, 'nope', 2), [])
})
