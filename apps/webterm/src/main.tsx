/// <reference path="../../../sdk/mcterm.d.ts" />
import { render } from 'solid-js/web'
import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js'
import QRCode from 'qrcode'
import './app.css'

interface ServeStatus { running: boolean; port?: number; clients?: number; sessionUrl?: string }
interface RelayStatus { running: boolean; connected?: boolean; viewer?: boolean; error?: string }

function App() {
  const [serve, setServe] = createSignal<ServeStatus>({ running: false })
  const [err, setErr] = createSignal('')
  const [copyOk, setCopyOk] = createSignal(false)

  const [rurl, setRurl] = createSignal('')
  const [rsecret, setRsecret] = createSignal('')
  const [rpass, setRpass] = createSignal('')
  const [showSecret, setShowSecret] = createSignal(false)
  const [showPass, setShowPass] = createSignal(false)
  const [relay, setRelay] = createSignal<RelayStatus>({ running: false })
  const [rerr, setRerr] = createSignal('')
  const [saveOk, setSaveOk] = createSignal(false)
  const [rcopyOk, setRcopyOk] = createSignal(false)
  const [qrSrc, setQrSrc] = createSignal('')

  const sessionUrl = () => serve().sessionUrl || ''
  const publicUrl = () => {
    const u = rurl().trim()
    return u ? u.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://') : ''
  }

  const relayText = createMemo(() => {
    const s = relay()
    let txt = 'off'
    if (s.running && !s.connected) txt = 'connecting…'
    else if (s.running && s.connected && !s.viewer) txt = 'exposed · waiting for viewer'
    else if (s.running && s.connected && s.viewer) txt = 'exposed · viewer connected'
    if (s.error) txt += ` · ${s.error}`
    return txt
  })
  const relayDot = createMemo(() => {
    const s = relay()
    if (s.running && s.connected && s.viewer) return 'dot on'
    if (s.running) return 'dot warn'
    return 'dot'
  })
  const relayShowUrl = createMemo(() => relay().running && !!publicUrl())

  let lastQr = ''
  createEffect(() => {
    const url = relayShowUrl() ? publicUrl() : ''
    if (url === lastQr) return
    lastQr = url
    if (!url) { setQrSrc(''); return }
    QRCode.toDataURL(url, { margin: 2, width: 180 })
      .then(setQrSrc).catch(() => setQrSrc(''))
  })

  async function toggleServer() {
    setErr('')
    try { setServe(await mcterm.rpc(serve().running ? 'serve.stop' : 'serve.start')) }
    catch (e: any) { setErr(e.message) }
  }

  const cfgFromFields = () => ({ url: rurl().trim(), secret: rsecret(), passphrase: rpass() })

  async function saveCfg() {
    setRerr('')
    try {
      await mcterm.rpc('relay.configSet', cfgFromFields())
      setSaveOk(true); setTimeout(() => setSaveOk(false), 1500)
    } catch (e: any) { setRerr(e.message) }
  }

  async function toggleRelay() {
    setRerr('')
    try {
      if (relay().running) { setRelay(await mcterm.rpc('relay.stop')); return }
      await mcterm.rpc('relay.configSet', cfgFromFields())
      setRelay(await mcterm.rpc('relay.start'))
    } catch (e: any) { setRerr(e.message) }
  }

  async function copy(text: string, set: (v: boolean) => void, onErr: (v: string) => void) {
    if (!text) return
    try {
      await mcterm.rpc('clipboard.write', { text })
      set(true); setTimeout(() => set(false), 1500)
    } catch (e: any) { onErr(e.message) }
  }

  async function loadCfg() {
    try {
      const c = await mcterm.rpc<{ url?: string; secret?: string; passphrase?: string }>('relay.config')
      setRurl(c.url || ''); setRsecret(c.secret || ''); setRpass(c.passphrase || '')
    } catch (e: any) { setRerr(`config load failed: ${e.message} — don't save until reloaded`) }
  }

  async function poll() {
    try { setServe(await mcterm.rpc('serve.status')) } catch (e: any) { setErr(e.message) }
    try { setRelay(await mcterm.rpc('relay.status')) } catch (e: any) { setRerr(e.message) }
  }

  loadCfg()
  poll()
  const id = setInterval(poll, 2000)
  onCleanup(() => clearInterval(id))

  const eye = (on: boolean) => mcterm.icon(on ? 'eye' : 'eye-off')

  return (
    <div id="wrap">
      <div class="row">
        <span class={'dot' + (serve().running ? ' on' : '')} />
        <span id="state">{serve().running ? `serving on 127.0.0.1:${serve().port}` : 'server stopped'}</span>
        <span class="meta">{serve().running ? `· ${serve().clients} client${serve().clients === 1 ? '' : 's'}` : ''}</span>
      </div>
      <div class="row">
        <button id="btn" class={serve().running ? 'stop' : 'primary'} onClick={toggleServer}>
          {serve().running ? 'stop server' : 'start server'}
        </button>
      </div>
      <Show when={serve().running}>
        <div class="row urlrow" id="sessrow">
          <div class="url">{sessionUrl()}</div>
          <button onClick={() => sessionUrl() && window.open(sessionUrl(), '_blank')} title="open session view">open</button>
          <button class={'copy' + (copyOk() ? ' ok' : '')} onClick={() => copy(sessionUrl(), setCopyOk, setErr)} title="copy URL">
            {copyOk() ? 'copied ✓' : 'copy'}
          </button>
        </div>
      </Show>
      <div class="row"><span class="err">{err()}</span></div>
      <div class="hint">localhost only · token-protected · stops when mcterm exits</div>

      <hr />

      <div class="row">
        <span class={relayDot()} />
        <h2>Expose remotely (internet)</h2>
      </div>
      <div class="cfg">
        <label for="rurl">Worker URL</label>
        <input id="rurl" type="text" spellcheck={false} autocomplete="off" autocapitalize="off" autocorrect="off"
          placeholder="wss://mcterm-relay.you.workers.dev"
          value={rurl()} onInput={(e) => setRurl(e.currentTarget.value)} />
        <label for="rsecret">Host secret</label>
        <div class="ipw">
          <input id="rsecret" type={showSecret() ? 'text' : 'password'} spellcheck={false}
            autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="HOST_SECRET"
            value={rsecret()} onInput={(e) => setRsecret(e.currentTarget.value)} />
          <button type="button" class="eye" title={showSecret() ? 'hide' : 'show'}
            onClick={() => setShowSecret(!showSecret())} innerHTML={eye(showSecret())} />
        </div>
        <label for="rpass">Viewer passphrase</label>
        <div class="ipw">
          <input id="rpass" type={showPass() ? 'text' : 'password'} spellcheck={false}
            autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="passphrase viewers type"
            value={rpass()} onInput={(e) => setRpass(e.currentTarget.value)} />
          <button type="button" class="eye" title={showPass() ? 'hide' : 'show'}
            onClick={() => setShowPass(!showPass())} innerHTML={eye(showPass())} />
        </div>
      </div>
      <div class="row">
        <button id="save" class={saveOk() ? 'ok' : ''} onClick={saveCfg}>{saveOk() ? 'saved ✓' : 'save config'}</button>
        <button id="rbtn" class={relay().running ? 'stop' : ''} onClick={toggleRelay}>
          {relay().running ? 'stop exposing' : 'expose remotely'}
        </button>
        <span id="rstate" class="meta">{relayText()}</span>
      </div>
      <Show when={relay().running}>
        <div class="warn-banner">⚠ Your terminal is reachable from the internet. Anyone with the URL + passphrase can run commands on this machine.</div>
      </Show>
      <Show when={relayShowUrl()}>
        <div class="row urlrow" id="rurlrow">
          <div class="url">{publicUrl()}</div>
          <button id="ropen" onClick={() => publicUrl() && window.open(publicUrl(), '_blank')} title="open public URL">open</button>
          <button id="rcopy" class={'copy' + (rcopyOk() ? ' ok' : '')} onClick={() => copy(publicUrl(), setRcopyOk, setRerr)} title="copy URL">
            {rcopyOk() ? 'copied ✓' : 'copy'}
          </button>
        </div>
        <div class="row" id="rqrrow"><div class="qr" title="scan to open on a phone"><img src={qrSrc()} alt="" /></div></div>
      </Show>
      <div class="row"><span class="err">{rerr()}</span></div>
      <div class="hint">off by default · host secret + passphrase stay on this machine · stops when mcterm exits</div>
    </div>
  )
}

render(App, document.getElementById('root')!)
