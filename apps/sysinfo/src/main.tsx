/// <reference path="../../../sdk/mcterm.d.ts" />
import { render } from 'solid-js/web'
import { createSignal, onCleanup } from 'solid-js'
import './app.css'

function App() {
  const [host, setHost] = createSignal('…')
  const [kernel, setKernel] = createSignal('…')
  const [uptime, setUptime] = createSignal('…')
  const [mem, setMem] = createSignal('…')
  const [disk, setDisk] = createSignal('…')
  const [err, setErr] = createSignal('')

  const run = async (cmd: string) =>
    (await mcterm.rpc<{ stdout: string }>('pty.exec', { cmd })).stdout.trim()

  async function refresh() {
    try {
      setHost(await run('hostname'))
      setKernel(await run('uname -sr'))
      setUptime(await run('uptime -p'))
      setMem(await run("free -h | awk '/^Mem/{print $3 \" used / \" $2}'"))
      setDisk(await run("df -h / | awk 'NR==2{print $3 \" used / \" $2 \" (\" $5 \")\"}'"))
      setErr('')
    } catch (e: any) { setErr(String(e?.message || e)) }
  }

  refresh()
  const id = setInterval(refresh, 5000)
  onCleanup(() => clearInterval(id))

  return (
    <div id="wrap">
      <div class="row"><span class="k">host</span><span class="v accent">{host()}</span></div>
      <div class="row"><span class="k">kernel</span><span class="v">{kernel()}</span></div>
      <div class="row"><span class="k">uptime</span><span class="v">{uptime()}</span></div>
      <div class="row"><span class="k">memory</span><span class="v">{mem()}</span></div>
      <div class="row"><span class="k">disk /</span><span class="v">{disk()}</span></div>
      <div class="row"><span id="err">{err()}</span></div>
    </div>
  )
}

render(App, document.getElementById('root')!)
