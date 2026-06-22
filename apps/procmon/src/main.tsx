/// <reference path="../../../sdk/mcterm.d.ts" />
import { render } from 'solid-js/web'
import { createSignal, For, Show, batch, onCleanup } from 'solid-js'
import './app.css'
import { Proc, parseProcList, visibleProcs } from './proc'

const HISTORY = 60
const TICK_FOCUSED = 2000
const TICK_BLURRED = 10000

// One exec per tick: cpu jiffies ; meminfo ; process list
const SAMPLE_CMD = [
  "head -1 /proc/stat",
  "echo ---",
  "grep -E 'MemTotal|MemAvailable' /proc/meminfo",
  "echo ---",
  "ps axo pid,pcpu,pmem,comm --sort=-pcpu",
].join('; ')

function Spark(props: { points: number[]; max: number }) {
  const path = () => {
    const pts = props.points
    if (pts.length < 2) return ''
    const w = 100, h = 100
    const step = w / (HISTORY - 1)
    const x0 = w - (pts.length - 1) * step
    const xy = pts.map((v, i) =>
      `${(x0 + i * step).toFixed(2)},${(h - (Math.min(v, props.max) / props.max) * h).toFixed(2)}`)
    return `M${xy[0]} L${xy.slice(1).join(' ')}`
  }
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <Show when={path()}>
        <path d={`${path()} L100,100 L${100 - (props.points.length - 1) * (100 / (HISTORY - 1))},100 Z`}
          fill="var(--accent)" opacity="0.12" stroke="none" />
        <path d={path()} fill="none" stroke="var(--accent)" stroke-width="1.5"
          vector-effect="non-scaling-stroke" />
      </Show>
    </svg>
  )
}

function App() {
  let tbodyEl!: HTMLDivElement
  let filterEl!: HTMLInputElement

  const [cpuHist, setCpuHist] = createSignal<number[]>([])
  const [memHist, setMemHist] = createSignal<number[]>([])
  const [memText, setMemText] = createSignal('')
  const [procs, setProcs] = createSignal<Proc[]>([])
  const [sel, setSel] = createSignal(0)
  const [sortKey, setSortKey] = createSignal<'cpu' | 'mem'>('cpu')
  const [confirmPid, setConfirmPid] = createSignal<number | null>(null)
  const [filter, setFilter] = createSignal('')
  const [err, setErr] = createSignal('')

  const shown = () => visibleProcs(procs(), filter(), 25)

  // CPU% needs two /proc/stat samples
  let prevIdle = 0
  let prevTotal = 0

  function parseSample(out: string) {
    const [statS, memS, psS] = out.split(/\n?---\n/)

    const jiffies = statS.trim().split(/\s+/).slice(1).map(Number)
    const idle = jiffies[3] + (jiffies[4] || 0)
    const total = jiffies.reduce((a, b) => a + b, 0)
    let cpu: number | null = null
    if (prevTotal && total > prevTotal) {
      cpu = Math.max(0, Math.min(100, 100 * (1 - (idle - prevIdle) / (total - prevTotal))))
    }
    prevIdle = idle
    prevTotal = total

    const memKb = Object.fromEntries(
      memS.trim().split('\n').map(l => {
        const [k, v] = l.split(/:\s+/)
        return [k, parseInt(v, 10)]
      }))
    const usedKb = memKb.MemTotal - memKb.MemAvailable
    const memPct = (usedKb / memKb.MemTotal) * 100

    const list: Proc[] = parseProcList(psS)
    const vis = visibleProcs(list, filter(), 25)

    batch(() => {
      if (cpu !== null) {
        setCpuHist(h => [...h, cpu!].slice(-HISTORY))
        mcterm.setTitle(`Processes — cpu ${cpu!.toFixed(0)}%`)
      }
      setMemHist(h => [...h, memPct].slice(-HISTORY))
      setMemText(`${(usedKb / 1048576).toFixed(1)} / ${(memKb.MemTotal / 1048576).toFixed(1)} GiB`)
      setProcs(sortKey() === 'cpu' ? list : [...list].sort((a, b) => b.mem - a.mem))
      setSel(s => Math.min(s, Math.max(0, vis.length - 1)))
    })
  }

  async function tick() {
    try {
      const r = await mcterm.rpc<{ stdout: string }>('pty.exec', { cmd: SAMPLE_CMD })
      parseSample(r.stdout)
      setErr('')
    } catch (e: any) { setErr(e.message) }
  }

  // Slow tick while minimized — dock preview stays alive, exec spam doesn't
  let timer: ReturnType<typeof setInterval>
  const schedule = (ms: number) => {
    clearInterval(timer)
    timer = setInterval(tick, ms)
  }
  mcterm.onFocus(() => { schedule(TICK_FOCUSED); tbodyEl.focus() })
  mcterm.onBlur(() => schedule(TICK_BLURRED))
  schedule(TICK_FOCUSED)
  tick()
  onCleanup(() => clearInterval(timer))

  async function kill(pid: number, signal?: string) {
    try {
      await mcterm.rpc('pty.exec', { cmd: `kill ${signal ? `-${signal} ` : ''}${pid}` })
      setConfirmPid(null)
      tick()
    } catch (e: any) { setErr(e.message) }
  }

  const cur = () => {
    const h = cpuHist()
    return h.length ? h[h.length - 1] : null
  }
  const curMem = () => {
    const h = memHist()
    return h.length ? h[h.length - 1] : null
  }

  function onKey(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault(); setSel(Math.min(sel() + 1, shown().length - 1)); setConfirmPid(null); scrollSel(); break
      case 'ArrowUp':
        e.preventDefault(); setSel(Math.max(sel() - 1, 0)); setConfirmPid(null); scrollSel(); break
      case '/':
        // defer focus so this same '/' keystroke isn't typed into the input
        e.preventDefault(); requestAnimationFrame(() => filterEl.focus()); break
      case 'c': setSortKey('cpu'); break
      case 'm': setSortKey('mem'); break
      case 'k': {
        const p = shown()[sel()]
        if (p) setConfirmPid(p.pid)
        break
      }
      case 'Enter': {
        const pid = confirmPid()
        if (pid != null) { e.preventDefault(); kill(pid) }
        break
      }
      case 'K': {
        const pid = confirmPid()
        if (pid != null) { e.preventDefault(); kill(pid, '9') }
        break
      }
      case 'Escape':
        if (confirmPid() != null) { e.preventDefault(); e.stopPropagation(); setConfirmPid(null) }
        break
    }
  }

  const scrollSel = () =>
    requestAnimationFrame(() => tbodyEl.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' }))

  return (
    <div class="wrap">
      <div class="charts">
        <div class="chart">
          <span class="lbl">cpu</span>
          <span class="val">{cur() === null ? '…' : `${cur()!.toFixed(0)}%`}</span>
          <Spark points={cpuHist()} max={100} />
        </div>
        <div class="chart">
          <span class="lbl">memory</span>
          <span class="val">{curMem() === null ? '…' : `${curMem()!.toFixed(0)}%`}</span>
          <span class="sub">{memText()}</span>
          <Spark points={memHist()} max={100} />
        </div>
      </div>

      <div class="table">
        <div class="thead">
          <span class="c-pid">pid</span>
          <span class="c-cpu" classList={{ on: sortKey() === 'cpu' }}>cpu%</span>
          <span class="c-mem" classList={{ on: sortKey() === 'mem' }}>mem%</span>
          <span class="c-cmd">command</span>
        </div>
        <div class="tbody" tabindex="0" ref={tbodyEl} onKeyDown={onKey}>
          <For each={shown()}>{(p, i) =>
            <div class="row" classList={{ sel: i() === sel() }}
              onClick={() => { setSel(i()); setConfirmPid(null) }}>
              <span class="c-pid">{p.pid}</span>
              <span class="c-cpu">{p.cpu.toFixed(1)}</span>
              <span class="c-mem">{p.mem.toFixed(1)}</span>
              <span class="c-cmd">
                {p.cmd}
                <Show when={confirmPid() === p.pid}>
                  <span class="confirm">  — kill? ↵ term · ⇧K force · Esc</span>
                </Show>
              </span>
            </div>
          }</For>
        </div>
      </div>

      <div class="foot">
        <input class="filter" ref={filterEl} type="text" placeholder="/ filter by name…" spellcheck={false}
          value={filter()}
          onInput={(e) => { setFilter(e.currentTarget.value); setSel(0); setConfirmPid(null) }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setFilter(''); filterEl.blur(); tbodyEl.focus() } }} />
        <span class="count">{shown().length} of {procs().length}{filter() ? ` · filter: ${filter()}` : ''}</span>
        <span class="err">{err()}</span>
        <span class="hint">↑↓ select · c/m sort · / filter · k kill (↵ term · ⇧K force)</span>
      </div>
    </div>
  )
}

render(App, document.getElementById('root')!)
